
import React, { useState } from 'react';
import { INITIAL_PROJECTS, ALL_WEEK_IDS, INITIAL_HOLIDAYS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint } from './constants';
import { Project, Role, ResourceAllocation, Holiday, User } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { Login } from './components/Login';
import { ShareModal } from './components/ShareModal';
import { LayoutDashboard, Calendar, Calculator, Settings, ShieldCheck, Globe, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday'>('planner');
  
  // Sharing Modal State
  const [projectToShare, setProjectToShare] = useState<Project | null>(null);

  // Timeline State
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);

  // Filter projects for the current user
  const visibleProjects = currentUser ? projects.filter(p => 
    p.ownerId === currentUser.id || p.sharedWith.includes(currentUser.email)
  ) : [];

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab('planner');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
  };

  const handleShareProject = (email: string) => {
    if (projectToShare) {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectToShare.id) return p;
        if (p.sharedWith.includes(email)) return p;
        return { ...p, sharedWith: [...p.sharedWith, email] };
      }));
    }
  };

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
      setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
      setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

  // Helper to deep update projects
  const updateProjectModule = (
    projectId: string, 
    moduleId: string, 
    fn: (m: any) => any
  ) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        modules: p.modules.map(m => m.id === moduleId ? fn(m) : m)
      };
    }));
  };

  const updateAllocation = (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number) => {
    updateProjectModule(projectId, moduleId, (m) => {
      const newTasks = m.tasks.map((task: any) => {
        if (task.id !== taskId) return task;
        const newAssignments = task.assignments.map((assign: any) => {
          if (assign.id !== assignmentId) return assign;
          const filtered = assign.allocations.filter((a: any) => a.weekId !== weekId);
          if (value > 0) {
            filtered.push({ weekId, count: value });
          }
          return { ...assign, allocations: filtered };
        });
        return { ...task, assignments: newAssignments };
      });
      return { ...m, tasks: newTasks };
    });
  };

  const updateAssignmentRole = (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => {
      const newTasks = m.tasks.map((task: any) => {
        if (task.id !== taskId) return task;
        const newAssignments = task.assignments.map((a: any) => a.id === assignmentId ? { ...a, role } : a);
        return { ...task, assignments: newAssignments };
      });
      return { ...m, tasks: newTasks };
    });
  };

  const addProject = () => {
    if (!currentUser) return;
    const newId = `p${projects.length + 1}-${Date.now()}`;
    setProjects(prev => [...prev, {
      id: newId,
      name: `New Project ${projects.length + 1}`,
      ownerId: currentUser.id,
      sharedWith: [],
      modules: []
    }]);
  };

  const updateProjectName = (projectId: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
  };

  const updateTaskName = (projectId: string, moduleId: string, taskId: string, name: string) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => t.id === taskId ? { ...t, name } : t)
    }));
  };

  const addModule = (projectId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const newId = `m${p.modules.length + 1}-${Date.now()}`;
      return {
        ...p,
        modules: [...p.modules, {
          id: newId,
          name: 'New Module',
          legacyFunctionPoints: 0,
          functionPoints: 0,
          tasks: []
        }]
      };
    }));
  };

  const addTask = (projectId: string, moduleId: string, taskName: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => {
      const newId = `${m.id}-t${m.tasks.length + 1}-${Date.now()}`;
      return {
        ...m,
        tasks: [...m.tasks, { 
          id: newId, 
          name: taskName, 
          assignments: [
            { id: `${newId}-a1`, role: role, allocations: [] }
          ]
        }]
      };
    });
  };

  const addAssignment = (projectId: string, moduleId: string, taskId: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => {
      const newTasks = m.tasks.map((task: any) => {
         if (task.id !== taskId) return task;
         const newAssignId = `${task.id}-a${task.assignments.length + 1}-${Date.now()}`;
         return {
           ...task,
           assignments: [...task.assignments, { id: newAssignId, role, allocations: [] }]
         };
      });
      return { ...m, tasks: newTasks };
    });
  };

  const updateFunctionPoints = (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
    updateProjectModule(projectId, moduleId, (m) => ({ ...m, legacyFunctionPoints: legacyFp, functionPoints: mvpFp }));
  };

  const reorderModules = (projectId: string, startIndex: number, endIndex: number) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      const result = Array.from(p.modules);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { ...p, modules: result };
    }));
  };

  // Helper to shift a set of allocations by N weeks
  const shiftAllocations = (allocations: ResourceAllocation[], offset: number): ResourceAllocation[] => {
    return allocations.map(alloc => {
      const currentIndex = ALL_WEEK_IDS.indexOf(alloc.weekId);
      if (currentIndex === -1) return alloc; // Unknown week, keep as is
      
      const newIndex = currentIndex + offset;
      if (newIndex >= 0 && newIndex < ALL_WEEK_IDS.length) {
        return { ...alloc, weekId: ALL_WEEK_IDS[newIndex] };
      }
      return null; // Drop if out of bounds
    }).filter(a => a !== null) as ResourceAllocation[];
  };

  const shiftTaskTimeline = (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -1 : 1;
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assignments: t.assignments.map((a: any) => ({
            ...a,
            allocations: shiftAllocations(a.allocations, offset)
          }))
        };
      })
    }));
  };

  const shiftAssignmentTimeline = (projectId: string, moduleId: string, taskId: string, assignmentId: string, direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -1 : 1;
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assignments: t.assignments.map((a: any) => {
            if (a.id !== assignmentId) return a;
            return {
              ...a,
              allocations: shiftAllocations(a.allocations, offset)
            };
          })
        };
      })
    }));
  };

  const updateTaskSchedule = (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
    if (!startWeekId || duration < 0) return;

    const startIndex = ALL_WEEK_IDS.indexOf(startWeekId);
    if (startIndex === -1) return;

    // Generate new allocations based on the range
    const newAllocationWeeks = ALL_WEEK_IDS.slice(startIndex, startIndex + duration);

    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        // For each assignment, reset allocations and fill with default (1.0) for the new duration
        const newAssignments = t.assignments.map((assign: any) => {
          const newAllocations: ResourceAllocation[] = newAllocationWeeks.map(weekId => ({
            weekId,
            count: 1 // Default to 1 headcount/day
          }));
          return { ...assign, allocations: newAllocations };
        });
        return { ...t, startWeekId, duration, assignments: newAssignments };
      })
    }));
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
               OM
             </div>
             <span className="font-bold text-lg text-white">Resourcer</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 uppercase tracking-widest font-semibold">Project Manager V1.0</div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Dashboard</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('planner')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Calendar size={20} />
            <span className="font-medium">Resource Planner</span>
          </button>

          <button 
            onClick={() => setActiveTab('estimator')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Calculator size={20} />
            <span className="font-medium">FP Calculator</span>
          </button>

          <button 
            onClick={() => setActiveTab('holiday')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'holiday' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
          >
            <Globe size={20} />
            <span className="font-medium">Holidays</span>
          </button>
        </nav>

        {/* User Profile Footer */}
        <div className="p-4 border-t border-slate-800">
           <div className="flex items-center gap-3 mb-4 px-2">
              <img src={currentUser.avatar} alt="Avatar" className="w-8 h-8 rounded-full bg-slate-700" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{currentUser.name}</div>
                <div className="text-xs text-slate-500 truncate">{currentUser.email}</div>
              </div>
           </div>
           <button 
             onClick={handleLogout}
             className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
           >
             <LogOut size={16} />
             <span>Sign Out</span>
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
           <h1 className="text-xl font-bold text-slate-800">
             {activeTab === 'dashboard' && 'Portfolio Overview'}
             {activeTab === 'planner' && 'Master Resource Plan'}
             {activeTab === 'estimator' && 'Effort Estimation'}
             {activeTab === 'holiday' && 'Holiday Configuration'}
           </h1>
           <div className="flex items-center gap-4">
              <div className="text-sm text-slate-500">
                Visible Projects: <span className="font-semibold text-slate-800">{visibleProjects.length}</span>
              </div>
           </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && <Dashboard projects={visibleProjects} />}
          
          {activeTab === 'planner' && (
            <div className="h-full flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-slate-500 text-sm">Manage headcount across projects and modules.</p>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded text-xs text-slate-600">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div> Dev
                   </div>
                   <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded text-xs text-slate-600">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div> QA
                   </div>
                   <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1 rounded text-xs text-slate-600">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div> BA
                   </div>
                </div>
              </div>
              <PlannerGrid 
                currentUserId={currentUser.id}
                projects={visibleProjects} 
                holidays={holidays}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                onExtendTimeline={handleExtendTimeline}
                onUpdateAllocation={updateAllocation}
                onUpdateAssignmentRole={updateAssignmentRole}
                onAddTask={addTask}
                onAddAssignment={addAssignment}
                onReorderModules={reorderModules}
                onShiftTask={shiftTaskTimeline}
                onShiftAssignment={shiftAssignmentTimeline}
                onUpdateTaskSchedule={updateTaskSchedule}
                onAddProject={addProject}
                onDeleteProject={handleDeleteProject}
                onShareProject={setProjectToShare}
                onAddModule={addModule}
                onUpdateProjectName={updateProjectName}
                onUpdateTaskName={updateTaskName}
              />
            </div>
          )}

          {activeTab === 'estimator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-1 h-fit">
                <Estimator 
                  projects={visibleProjects} 
                  onUpdateFunctionPoints={updateFunctionPoints} 
                  onReorderModules={reorderModules}
                />
              </div>
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center flex-col text-slate-400">
                <Calculator className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-slate-600">Effort Estimation</h3>
                <p className="text-center mt-2 max-w-md">Select a module to calculate efforts based on Function Points.</p>
              </div>
            </div>
          )}

          {activeTab === 'holiday' && (
            <AdminSettings 
              holidays={holidays} 
              onUpdateHolidays={setHolidays} 
            />
          )}
        </div>

        {/* Modals */}
        {projectToShare && (
          <ShareModal 
            project={projectToShare} 
            onClose={() => setProjectToShare(null)} 
            onShare={handleShareProject} 
          />
        )}
      </main>
    </div>
  );
};

export default App;
