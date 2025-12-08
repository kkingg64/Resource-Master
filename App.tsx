import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_PROJECTS, ALL_WEEK_IDS, INITIAL_HOLIDAYS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint } from './constants';
import { Project, Role, ResourceAllocation, Holiday } from './types';
import { getPlannerData, savePlannerData } from './lib/supabaseClient';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { LayoutDashboard, Calendar, Calculator, Settings, ShieldCheck, Globe, LoaderCircle, CheckCircle, FileClock, XCircle } from 'lucide-react';

const LOCAL_STORAGE_KEYS = {
  PROJECTS: 'oms-planner-projects',
  HOLIDAYS: 'oms-planner-holidays',
};

type SaveStatus = 'idle' | 'local' | 'saving' | 'success' | 'error';

const SaveStatusIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  const statusConfig = {
    idle: { Icon: CheckCircle, text: 'All changes saved', color: 'text-slate-500' },
    local: { Icon: FileClock, text: 'Unsaved changes', color: 'text-amber-600' },
    saving: { Icon: LoaderCircle, text: 'Saving...', color: 'text-indigo-600 animate-spin' },
    success: { Icon: CheckCircle, text: 'All changes saved', color: 'text-green-600' },
    error: { Icon: XCircle, text: 'Save failed', color: 'text-red-600' },
  };
  const { Icon, text, color } = statusConfig[status];
  return (
    <div className={`flex items-center gap-2 text-xs font-medium transition-colors ${color}`}>
      <Icon size={14} className={status === 'saving' ? 'animate-spin' : ''} />
      <span>{text}</span>
    </div>
  );
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday'>('planner');
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const isInitialLoad = useRef(true);
  const debounceTimer = useRef<number | null>(null);

  // --- Data Persistence Hooks ---

  useEffect(() => {
    // Load data on initial mount
    const loadData = async () => {
      setIsLoading(true);
      const serverData = await getPlannerData();

      const localProjects = localStorage.getItem(LOCAL_STORAGE_KEYS.PROJECTS);
      const localHolidays = localStorage.getItem(LOCAL_STORAGE_KEYS.HOLIDAYS);

      if (serverData.projects && serverData.holidays) {
        setProjects(serverData.projects);
        setHolidays(serverData.holidays);
      } else if (localProjects && localHolidays) {
        setProjects(JSON.parse(localProjects));
        setHolidays(JSON.parse(localHolidays));
      } else {
        setProjects(INITIAL_PROJECTS);
        setHolidays(INITIAL_HOLIDAYS);
      }
      setIsLoading(false);
      setTimeout(() => { isInitialLoad.current = false; }, 500);
    };
    loadData();
  }, []);

  useEffect(() => {
    // This effect handles auto-saving
    if (isInitialLoad.current) return;

    // 1. Instant local backup
    localStorage.setItem(LOCAL_STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
    localStorage.setItem(LOCAL_STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
    setSaveStatus('local');

    // 2. Debounced save to Supabase
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await savePlannerData(projects, holidays);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000); // Revert to idle after success message
      } catch (error) {
        setSaveStatus('error');
      }
    }, 2000);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [projects, holidays]);


  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
      setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
      setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

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
    const newId = `p${projects.length + 1}-${Date.now()}`;
    setProjects(prev => [...prev, {
      id: newId,
      name: `New Project ${projects.length + 1}`,
      modules: []
    }]);
  };

  const deleteProject = (projectId: string) => {
    if (window.confirm('Are you sure you want to delete this project and all its data? This action cannot be undone.')) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
    }
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
    if (window.confirm('Are you sure you want to delete this module and all its tasks?')) {
      setProjects(prev => prev.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.filter(m => m.id !== moduleId) };
      }));
    }
  };

  const addTask = (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: [...m.tasks, { 
        id: taskId, 
        name: taskName, 
        assignments: [
          { id: `${taskId}-a1`, role: role, allocations: [] }
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
           assignments: [...task.assignments, { id: newAssignId, role, allocations: [] }]
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

  const shiftAllocations = (allocations: ResourceAllocation[], offset: number): ResourceAllocation[] => {
    return allocations.map(alloc => {
      const currentIndex = ALL_WEEK_IDS.indexOf(alloc.weekId);
      if (currentIndex === -1) return alloc;
      const newIndex = currentIndex + offset;
      if (newIndex >= 0 && newIndex < ALL_WEEK_IDS.length) {
        return { ...alloc, weekId: ALL_WEEK_IDS[newIndex] };
      }
      return null;
    }).filter(a => a !== null) as ResourceAllocation[];
  };

  const shiftTaskTimeline = (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -1 : 1;
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return { ...t, assignments: t.assignments.map((a: any) => ({ ...a, allocations: shiftAllocations(a.allocations, offset) })) };
      })
    }));
  };

  const shiftAssignmentTimeline = (projectId: string, moduleId: string, taskId: string, assignmentId: string, direction: 'left' | 'right') => {
    const offset = direction === 'left' ? -1 : 1;
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        return { ...t, assignments: t.assignments.map((a: any) => { if (a.id !== assignmentId) return a; return { ...a, allocations: shiftAllocations(a.allocations, offset) }; }) };
      })
    }));
  };

  const updateTaskSchedule = (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
    if (!startWeekId || duration < 0) return;
    const startIndex = ALL_WEEK_IDS.indexOf(startWeekId);
    if (startIndex === -1) return;
    const newAllocationWeeks = ALL_WEEK_IDS.slice(startIndex, startIndex + duration);
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => {
        if (t.id !== taskId) return t;
        const newAssignments = t.assignments.map((assign: any) => {
          const newAllocations: ResourceAllocation[] = newAllocationWeeks.map(weekId => ({ weekId, count: 1 }));
          return { ...assign, allocations: newAllocations };
        });
        return { ...t, startWeekId, duration, assignments: newAssignments };
      })
    }));
  };
  
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-100">
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle className="w-12 h-12 text-indigo-600 animate-spin" />
          <span className="text-slate-600 font-medium">Loading Planner...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">OM</div>
             <span className="font-bold text-lg text-white">Resourcer</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 uppercase tracking-widest font-semibold">Project Manager V1.0</div>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
            <LayoutDashboard size={20} /> <span className="font-medium">Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('planner')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Calendar size={20} /> <span className="font-medium">Resource Planner</span>
          </button>
          <button onClick={() => setActiveTab('estimator')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Calculator size={20} /> <span className="font-medium">FP Calculator</span>
          </button>
          <button onClick={() => setActiveTab('holiday')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'holiday' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
            <Globe size={20} /> <span className="font-medium">Holidays</span>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
           <button className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
             <Settings size={16} /> <span>Settings</span>
           </button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
           <h1 className="text-xl font-bold text-slate-800">
             {activeTab === 'dashboard' && 'Portfolio Overview'}
             {activeTab === 'planner' && 'Master Resource Plan'}
             {activeTab === 'estimator' && 'Effort Estimation'}
             {activeTab === 'holiday' && 'Holiday Configuration'}
           </h1>
           <div className="flex items-center gap-4">
              <SaveStatusIndicator status={saveStatus} />
           </div>
        </header>
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && <Dashboard projects={projects} />}
          {activeTab === 'planner' && (
            <div className="h-full flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-slate-500 text-sm">Manage headcount across projects and modules.</p>
              </div>
              <PlannerGrid 
                projects={projects} 
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
                onAddModule={addModule}
                onUpdateProjectName={updateProjectName}
                onUpdateTaskName={updateTaskName}
                onDeleteProject={deleteProject}
                onDeleteModule={deleteModule}
                onDeleteTask={deleteTask}
                onDeleteAssignment={deleteAssignment}
              />
            </div>
          )}
          {activeTab === 'estimator' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
              <div className="lg:col-span-1 h-fit">
                <Estimator projects={projects} onUpdateFunctionPoints={updateFunctionPoints} onReorderModules={reorderModules} />
              </div>
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center flex-col text-slate-400">
                <Calculator className="w-16 h-16 mb-4 opacity-20" />
                <h3 className="text-lg font-medium text-slate-600">Effort Estimation</h3>
                <p className="text-center mt-2 max-w-md">Select a module to calculate efforts based on Function Points.</p>
              </div>
            </div>
          )}
          {activeTab === 'holiday' && <AdminSettings holidays={holidays} onUpdateHolidays={setHolidays} />}
        </div>
      </main>
    </div>
  );
};

export default App;