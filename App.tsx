
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { Session } from '@supabase/supabase-js';
import { INITIAL_PROJECTS, ALL_WEEK_IDS, INITIAL_HOLIDAYS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, GOV_HOLIDAYS_DB } from './constants';
import { Project, Role, ResourceAllocation, Holiday } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { Login } from './components/Login';
import { ShareModal } from './components/ShareModal';
import { LayoutDashboard, Calendar, Calculator, Globe, LogOut, UserCircle } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday'>('planner');
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);

  const [isShareModalOpen, setShareModalOpen] = useState(false);
  const [projectToShare, setProjectToShare] = useState<Project | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchData = async () => {
    setLoading(true);
    if (!session) return;

    try {
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (projectsError) throw projectsError;
      setProjects(projectsData.map(p => ({...p, modules: p.modules || []})));

      const { data: holidaysData, error: holidaysError } = await supabase
        .from('holidays')
        .select('*')
        .eq('user_id', session.user.id);

      if (holidaysError) throw holidaysError;
      setHolidays(holidaysData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Could not fetch your data. Please check your connection and refresh.');
    } finally {
      setLoading(false);
    }
  };
  
  const debouncedSave = (updatedProjects: Project[], updatedHolidays?: Holiday[]) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Save projects
        for (const project of updatedProjects) {
          const { id, name, modules, shared_with, owner_id } = project;
          await supabase.from('projects').upsert({ id, name, modules, shared_with, owner_id });
        }
        
        // Save holidays if provided
        if(updatedHolidays && session) {
            await supabase.from('holidays').delete().eq('user_id', session.user.id);
            if (updatedHolidays.length > 0) {
              await supabase.from('holidays').insert(updatedHolidays.map(h => ({...h, user_id: session.user.id})));
            }
        }

        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error("Save error:", error);
        setSaveStatus('error');
      }
    }, 1500);
  };
  
  const handleStateChange = (newProjects: Project[] | ((p: Project[]) => Project[]), newHolidays?: Holiday[] | ((h: Holiday[]) => Holiday[])) => {
      const updatedProjects = typeof newProjects === 'function' ? newProjects(projects) : newProjects;
      const updatedHolidays = newHolidays ? (typeof newHolidays === 'function' ? newHolidays(holidays) : newHolidays) : holidays;
      
      setProjects(updatedProjects);
      if (newHolidays) {
          setHolidays(updatedHolidays);
      }
      
      debouncedSave(updatedProjects, newHolidays ? updatedHolidays : undefined);
  };


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
    fn: (m: any) => any,
    isDataDirty: boolean = true
  ) => {
    handleStateChange(prev => prev.map(p => {
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

  const addProject = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('projects').insert({
        name: `New Project ${projects.length + 1}`,
        owner_id: session.user.id,
        modules: []
    }).select().single();
    
    if (error) {
        console.error("Error creating project:", error);
        return;
    }
    
    handleStateChange(prev => [data, ...prev]);
  };
  
  const deleteProject = async (projectId: string) => {
      if (window.confirm('Are you sure you want to delete this project and all its data? This action cannot be undone.')) {
        handleStateChange(prev => prev.filter(p => p.id !== projectId));
        await supabase.from('projects').delete().eq('id', projectId);
      }
  };

  const updateProjectName = (projectId: string, name: string) => {
    handleStateChange(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
  };

  const updateTaskName = (projectId: string, moduleId: string, taskId: string, name: string) => {
    updateProjectModule(projectId, moduleId, (m) => ({
      ...m,
      tasks: m.tasks.map((t: any) => t.id === taskId ? { ...t, name } : t)
    }));
  };

  const addModule = (projectId: string) => {
    handleStateChange(prev => prev.map(p => {
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
    handleStateChange(prev => prev.map(p => {
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
        return { ...t, assignments: t.assignments.map((a: any) => a.id !== assignmentId ? a : { ...a, allocations: shiftAllocations(a.allocations, offset) }) };
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
        const newAssignments = t.assignments.map((assign: any) => ({ ...assign, allocations: newAllocationWeeks.map(weekId => ({ weekId, count: 1 })) }));
        return { ...t, startWeekId, duration, assignments: newAssignments };
      })
    }));
  };

  const handleUpdateHolidays = (newHolidays: Holiday[]) => {
      handleStateChange(projects, newHolidays);
  };
  
  const openShareModal = (project: Project) => {
    setProjectToShare(project);
    setShareModalOpen(true);
  };

  const handleShareProject = (email: string) => {
    if (!projectToShare) return;
    
    const updatedSharedWith = Array.from(new Set([...(projectToShare.shared_with || []), email]));
    
    handleStateChange(prev => prev.map(p => 
      p.id === projectToShare.id ? { ...p, shared_with: updatedSharedWith } : p
    ));
    setShareModalOpen(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen w-screen bg-slate-900 text-white">Loading...</div>;
  }
  
  if (!session) {
    return <Login />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-100">
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shadow-xl">
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">OM</div>
             <span className="font-bold text-lg text-white">Resourcer</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {['dashboard', 'planner', 'estimator', 'holiday'].map(tab => {
             const icons = { dashboard: LayoutDashboard, planner: Calendar, estimator: Calculator, holiday: Globe };
             const Icon = icons[tab as keyof typeof icons];
             return (
              <button key={tab} onClick={() => setActiveTab(tab as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
                <Icon size={20} />
                <span className="font-medium capitalize">{tab === 'estimator' ? 'FP Calculator' : tab}</span>
              </button>
             )
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
           <div className="flex items-center gap-3 px-4 py-2 text-sm text-slate-400">
             <UserCircle size={20} />
             <span className="truncate">{session.user.email}</span>
           </div>
           <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors">
             <LogOut size={16} />
             <span>Logout</span>
           </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
           <h1 className="text-xl font-bold text-slate-800 capitalize">
             {activeTab === 'estimator' ? 'Effort Estimation' : (activeTab === 'holiday' ? 'Holiday Configuration' : `${activeTab} Overview`)}
           </h1>
           <div className="flex items-center gap-4 text-sm">
             <span className={`transition-opacity duration-500 ${saveStatus === 'saving' ? 'opacity-100' : 'opacity-0'}`}>Saving...</span>
             <span className={`transition-opacity duration-500 ${saveStatus === 'saved' ? 'opacity-100 text-green-600' : 'opacity-0'}`}>Saved!</span>
             <span className={`transition-opacity duration-500 ${saveStatus === 'error' ? 'opacity-100 text-red-600' : 'opacity-0'}`}>Save Error!</span>
           </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'dashboard' && <Dashboard projects={projects} timelineStart={timelineStart} timelineEnd={timelineEnd} />}
          {activeTab === 'planner' && <PlannerGrid userId={session.user.id} projects={projects} holidays={holidays} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={handleExtendTimeline} onUpdateAllocation={updateAllocation} onUpdateAssignmentRole={updateAssignmentRole} onAddTask={addTask} onAddAssignment={addAssignment} onReorderModules={reorderModules} onShiftTask={shiftTaskTimeline} onShiftAssignment={shiftAssignmentTimeline} onUpdateTaskSchedule={updateTaskSchedule} onAddProject={addProject} onAddModule={addModule} onUpdateProjectName={updateProjectName} onUpdateTaskName={updateTaskName} onDeleteProject={deleteProject} onShareProject={openShareModal} />}
          {activeTab === 'estimator' && <Estimator projects={projects} onUpdateFunctionPoints={updateFunctionPoints} onReorderModules={reorderModules} />}
          {activeTab === 'holiday' && <AdminSettings holidays={holidays} onUpdateHolidays={handleUpdateHolidays} />}
        </div>
      </main>
      
      {isShareModalOpen && projectToShare && (
        <ShareModal 
          project={projectToShare}
          onClose={() => setShareModalOpen(false)}
          onShare={handleShareProject}
        />
      )}
    </div>
  );
};

export default App;
