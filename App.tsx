import React, { useState } from 'react';
import { INITIAL_PROJECTS, ALL_WEEK_IDS, INITIAL_HOLIDAYS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint } from './constants';
import { Project, Role, ResourceAllocation, Holiday } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { VersionHistory } from './components/VersionHistory';
import { saveVersion, getVersionById } from './lib/idb';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ShieldCheck, Globe, ChevronLeft, ChevronRight } from 'lucide-react';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday' | 'settings'>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  // Timeline State
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);

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

  const updateAssignmentResourceName = (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assignments: t.assignments.map((a: any) => 
            a.id === assignmentId ? { ...a, resourceName } : a
          )
        };
      })
    }));
  };

  const addProject = () => {
    const newId = `p${projects.length + 1}-${Date.now()}`;
    setProjects(prev => [...prev, {
      id: newId,
      name: `New Project ${projects.length + 1}`,
      modules: []
    }]);
  };

  const deleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
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
  
  const deleteModule = (projectId: string, moduleId: string) => {
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, modules: p.modules.filter(m => m.id !== moduleId) };
    }));
  };

  const addTask = (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: [...m.tasks, { 
        id: taskId, 
        name: taskName, 
        assignments: [
          { id: `${taskId}-a1`, role: role, resourceName: 'Unassigned', allocations: [] }
        ]
      }]
    }));
  };

  const deleteTask = (projectId: string, moduleId: string, taskId: string) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.filter((t: any) => t.id !== taskId)
    }));
  };

  const addAssignment = (projectId: string, moduleId: string, taskId: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => {
      const newTasks = m.tasks.map((task: any) => {
         if (task.id !== taskId) return task;
         const newAssignId = `${task.id}-a${task.assignments.length + 1}-${Date.now()}`;
         return {
           ...task,
           assignments: [...task.assignments, { id: newAssignId, role, resourceName: 'Unassigned', allocations: [] }]
         };
      });
      return { ...m, tasks: newTasks };
    });
  };

  const deleteAssignment = (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          assignments: t.assignments.filter((a: any) => a.id !== assignmentId)
        };
      })
    }));
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

  const handleImportPlan = (importedProjects: Project[], importedHolidays: Holiday[]) => {
    setProjects(importedProjects);
    setHolidays(importedHolidays);
    alert('Plan imported successfully!');
  };

  const handleSaveVersion = async (name: string) => {
    try {
      await saveVersion({
        name,
        timestamp: Date.now(),
        data: { projects, holidays }
      });
      alert(`Version '${name}' saved successfully!`);
    } catch (error) {
      console.error("Failed to save version:", error);
      alert("Error: Could not save version.");
    }
  };

  const handleRestoreVersion = async (id: number) => {
    try {
      const version = await getVersionById(id);
      if (version) {
        setProjects(version.data.projects);
        setHolidays(version.data.holidays);
        alert(`Version '${version.name}' restored successfully!`);
      } else {
        alert("Error: Version not found.");
      }
    } catch (error) {
      console.error("Failed to restore version:", error);
      alert("Error: Could not restore version.");
    }
  };


  return (
    <>
      {showHistory && (
        <VersionHistory 
          onClose={() => setShowHistory(false)} 
          onRestore={handleRestoreVersion}
          onSaveCurrent={handleSaveVersion}
        />
      )}
      <div className="flex h-screen w-full bg-slate-100">
        {/* Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shadow-xl transition-all duration-300 ease-in-out`}>
          <div className={`p-4 border-b border-slate-800 flex flex-col gap-4 ${isSidebarCollapsed ? 'items-center' : ''}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">
                  OM
                </div>
                {!isSidebarCollapsed && (
                  <span className="font-bold text-lg text-white whitespace-nowrap">Resourcer</span>
                )}
              </div>
              
              <button 
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} 
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white transition-colors"
                title={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>

            {!isSidebarCollapsed && (
              <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold whitespace-nowrap overflow-hidden transition-opacity">
                Project Manager V1.1.1
              </div>
            )}
          </div>

          <nav className="flex-1 p-2 space-y-2 mt-2">
            <button 
              onClick={() => setActiveTab('dashboard')}
              title={isSidebarCollapsed ? "Dashboard" : ""}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <LayoutDashboard size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium truncate">Dashboard</span>}
            </button>
            
            <button 
              onClick={() => setActiveTab('planner')}
              title={isSidebarCollapsed ? "Resource Planner" : ""}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3 rounded-lg transition-all ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Calendar size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium truncate">Resource Planner</span>}
            </button>

            <button 
              onClick={() => setActiveTab('estimator')}
              title={isSidebarCollapsed ? "FP Calculator" : ""}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3 rounded-lg transition-all ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Calculator size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium truncate">FP Calculator</span>}
            </button>

            <button 
              onClick={() => setActiveTab('holiday')}
              title={isSidebarCollapsed ? "Holidays" : ""}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-3 rounded-lg transition-all ${activeTab === 'holiday' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}
            >
              <Globe size={20} className="shrink-0" />
              {!isSidebarCollapsed && <span className="font-medium truncate">Holidays</span>}
            </button>
          </nav>

          <div className="p-4 border-t border-slate-800">
            <button
              onClick={() => setActiveTab('settings')}
              title={isSidebarCollapsed ? "Settings" : ""}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : 'justify-start px-4'} gap-3 py-2 text-sm rounded-lg transition-all ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <SettingsIcon size={16} className="shrink-0" />
              {!isSidebarCollapsed && <span>Settings</span>}
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden transition-all duration-300">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
            <h1 className="text-xl font-bold text-slate-800">
              {activeTab === 'dashboard' && 'Portfolio Overview'}
              {activeTab === 'planner' && 'Master Resource Plan'}
              {activeTab === 'estimator' && 'Effort Estimation'}
              {activeTab === 'holiday' && 'Holiday Configuration'}
              {activeTab === 'settings' && 'Application Settings'}
            </h1>
            <div className="flex items-center gap-4">
                <div className="text-sm text-slate-500">
                  Portfolio: <span className="font-semibold text-slate-800">{projects.length} Projects</span>
                </div>
            </div>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-auto p-6">
            {activeTab === 'dashboard' && <Dashboard projects={projects} />}
            
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
                  projects={projects} 
                  holidays={holidays}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  onExtendTimeline={handleExtendTimeline}
                  onUpdateAllocation={updateAllocation}
                  onUpdateAssignmentRole={updateAssignmentRole}
                  onUpdateAssignmentResourceName={updateAssignmentResourceName}
                  onAddTask={addTask}
                  onAddAssignment={addAssignment}
                  onReorderModules={reorderModules}
                  onShiftTask={shiftTaskTimeline}
                  onShiftAssignment={shiftAssignmentTimeline}
                  onUpdateTaskSchedule={updateTaskSchedule}
                  onAddProject={addProject}
                  onAddModule={addModule}
                  onUpdateProjectName={updateProjectName}
                  onUpdateTaskName={updateTaskName}
                  onDeleteProject={deleteProject}
                  onDeleteModule={deleteModule}
                  onDeleteTask={deleteTask}
                  onDeleteAssignment={deleteAssignment}
                  onImportPlan={handleImportPlan}
                  onShowHistory={() => setShowHistory(true)}
                />
              </div>
            )}

            {activeTab === 'estimator' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
                <div className="lg:col-span-1 h-fit">
                  <Estimator 
                    projects={projects} 
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

            {activeTab === 'settings' && <Settings />}
          </div>
        </main>
      </div>
    </>
  );
};

export default App;