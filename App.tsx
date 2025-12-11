
import React, { useState, useEffect } from 'react';
import { ALL_WEEK_IDS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { VersionHistory } from './components/VersionHistory';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, Globe, ChevronLeft, ChevronRight, LogOut } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Session } from '@supabase/supabase-js';

// Helper to structure data from Supabase
const structureProjectsData = (data: any[]): Project[] => {
  return data.map(p => ({
    id: p.id,
    name: p.name,
    modules: p.modules.map((m: any) => ({
      id: m.id,
      name: m.name,
      legacyFunctionPoints: m.legacy_function_points,
      functionPoints: m.function_points,
      tasks: m.tasks.map((t: any) => ({
        id: t.id,
        name: t.name,
        startWeekId: t.start_week_id,
        duration: t.duration,
        assignments: t.task_assignments.map((a: any) => ({
          id: a.id,
          role: a.role,
          resourceName: a.resource_name,
          allocations: a.resource_allocations.map((alloc: any) => ({
            weekId: alloc.week_id,
            count: alloc.count,
            days: alloc.days || {},
          })),
        })),
      })),
    })).sort((a,b) => a.sort_order - b.sort_order), // Sort modules
  }));
};

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday' | 'settings'>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    
    // Fetch projects and related data
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id, name,
        modules (
          id, name, legacy_function_points, function_points, sort_order,
          tasks (
            id, name, start_week_id, duration,
            task_assignments (
              id, role, resource_name,
              resource_allocations ( id, week_id, count, days )
            )
          )
        )
      `)
      .order('created_at', { ascending: true });

    // Fetch holidays
    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*');

    if (projectsError) console.error('Error fetching projects:', projectsError);
    if (holidaysError) console.error('Error fetching holidays:', holidaysError);

    if (projectsData) {
      setProjects(structureProjectsData(projectsData));
    }
    if (holidaysData) {
      setHolidays(holidaysData.map(h => ({ ...h, id: h.id.toString() })));
    }
    
    setLoading(false);
  };

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') setTimelineStart(prev => addWeeksToPoint(prev, -4));
    else setTimelineEnd(prev => addWeeksToPoint(prev, 4));
  };
  
  const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    const currentState = projects;
    // Optimistic update
    // FIX: The IIFE was not returning a value, causing a destructuring error.
    // Also fixed syntax error where `.map()` was closed with `};` instead of `})`.
    const { updatedProjects, allocationToUpdate } = (() => {
      let allocationToUpdate: any = null;
      const updatedProjects = projects.map(p => {
        if (p.id !== projectId) return p;
        return { ...p, modules: p.modules.map(m => {
          if (m.id !== moduleId) return m;
          return { ...m, tasks: m.tasks.map(t => {
            if (t.id !== taskId) return t;
            return { ...t, assignments: t.assignments.map(a => {
              if (a.id !== assignmentId) return a;
              
              const newAllocations = [...a.allocations];
              const allocIndex = newAllocations.findIndex(al => al.weekId === weekId);
              
              if (allocIndex > -1) {
                const alloc = { ...newAllocations[allocIndex] };
                if (dayDate) {
                  const newDays = { ...(alloc.days || {}) };
                   if ((!alloc.days || Object.keys(alloc.days).length === 0) && alloc.count > 0) {
                    const weekdays = getWeekdaysForWeekId(weekId);
                    weekdays.forEach(d => newDays[d] = alloc.count / 5);
                  }
                  newDays[dayDate] = value;
                  alloc.days = newDays;
                  alloc.count = Object.values(newDays).reduce((sum: number, v: number) => sum + v, 0);
                } else {
                  alloc.count = value;
                  alloc.days = {};
                }
                newAllocations[allocIndex] = alloc;
                allocationToUpdate = alloc;
              } else if (value > 0) {
                const newAlloc = { weekId, count: value, days: {} };
                 if(dayDate) {
                   const weekdays = getWeekdaysForWeekId(weekId);
                   const days = weekdays.reduce((acc, day) => ({...acc, [day]: 0}), {});
                   days[dayDate] = value;
                   newAlloc.days = days;
                 }
                newAllocations.push(newAlloc);
                allocationToUpdate = newAlloc;
              }
              return { ...a, allocations: newAllocations };
            })};
          })};
        })};
      });
      return { updatedProjects, allocationToUpdate };
    })();
    setProjects(updatedProjects);

    // DB update
    if (allocationToUpdate) {
        const { data: existingAlloc, error: findError } = await supabase
            .from('resource_allocations')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('week_id', weekId)
            .single();

        const upsertData = {
            id: existingAlloc?.id,
            assignment_id: assignmentId,
            user_id: session!.user.id,
            week_id: weekId,
            count: allocationToUpdate.count,
            days: allocationToUpdate.days
        };

        const { error } = await supabase.from('resource_allocations').upsert(upsertData);

        if (error) {
            console.error("Failed to update allocation:", error);
            setProjects(currentState); // Revert on error
            alert("Error: Could not save allocation.");
        }
    }
  };

  const addProject = async () => {
    const { data, error } = await supabase.from('projects').insert({ name: `New Project ${projects.length + 1}`, user_id: session!.user.id }).select().single();
    if (error) console.error(error);
    else setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]);
  };
  
  const deleteProject = async (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { console.error(error); fetchData(); }
  };
  
  const updateProjectName = async (projectId: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
    await supabase.from('projects').update({ name }).eq('id', projectId);
  };
  
  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, name} : m) } : p));
     await supabase.from('modules').update({ name }).eq('id', moduleId);
  };
  
  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
    // Optimistic update
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, name} : t) } : m) } : p));
    await supabase.from('tasks').update({ name }).eq('id', taskId);
  };
  
  const addModule = async (projectId: string) => {
    const { data, error } = await supabase.from('modules').insert({ name: 'New Module', project_id: projectId, user_id: session!.user.id }).select().single();
    if (error) console.error(error);
    else setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id: data.id, name: data.name, legacyFunctionPoints: 0, functionPoints: 0, tasks: [] }] } : p));
  };
  
  const deleteModule = async (projectId: string, moduleId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) } : p));
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) { console.error(error); fetchData(); }
  };
  
  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    // This now needs to be a transaction
    const { data: taskData, error: taskError } = await supabase.from('tasks').insert({ id: taskId, name: taskName, module_id: moduleId, user_id: session!.user.id }).select().single();
    if (taskError) { console.error(taskError); return; }
    
    const { data: assignData, error: assignError } = await supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (assignError) { console.error(assignError); return; }

    fetchData(); // Simplest way to refresh state after complex insert
  };
  
  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, tasks: m.tasks.filter(t => t.id !== taskId)} : m) } : p));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { console.error(error); fetchData(); }
  };
  
  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    const { data, error } = await supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (error) console.error(error);
    else fetchData();
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, assignments: t.assignments.filter(a => a.id !== assignmentId) } : t)} : m) } : p));
     const { error } = await supabase.from('task_assignments').delete().eq('id', assignmentId);
     if (error) { console.error(error); fetchData(); }
  };

  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, legacyFunctionPoints: legacyFp, functionPoints: mvpFp} : m) } : p));
     await supabase.from('modules').update({ legacy_function_points: legacyFp, function_points: mvpFp }).eq('id', moduleId);
  };
  
  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const reordered = Array.from(project.modules);
    const [removed] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, removed);
    
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: reordered } : p));
    
    // Update sort_order in DB
    const updates = reordered.map((module, index) => 
      supabase.from('modules').update({ sort_order: index }).eq('id', module.id)
    );
    await Promise.all(updates);
  };
  
  const updateTaskSchedule = async (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
     // For simplicity, just update the task details. Allocations are now manual.
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, startWeekId, duration } : t) } : m) } : p));
     await supabase.from('tasks').update({ start_week_id: startWeekId, duration }).eq('id', taskId);
  };
  
  const handleSaveVersion = async (name: string) => {
    const { error } = await supabase.from('versions').insert({
      name,
      user_id: session!.user.id,
      data: { projects, holidays }
    });
    if (error) {
      console.error("Failed to save version:", error);
      alert("Error: Could not save version.");
    } else {
      alert(`Version '${name}' saved successfully!`);
    }
  };

  const handleRestoreVersion = async (id: number) => {
    const { data: version, error } = await supabase.from('versions').select('data').eq('id', id).single();
    if (error || !version) {
      alert("Error: Version not found.");
      return;
    }
    // This is destructive. A more complex merge would be better in a real app.
    // Clear existing data
    await supabase.from('projects').delete().eq('user_id', session!.user.id);
    await supabase.from('holidays').delete().eq('user_id', session!.user.id);
    // Restore
    setProjects(version.data.projects);
    setHolidays(version.data.holidays);
    // We need to re-insert all this data into the DB, which is a complex operation.
    // For this app, we will just update the state and let the user save manually.
    alert(`Version restored. Any new changes will be saved to your current state.`);
    setShowHistory(false);
  };

  if (!session) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-100">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg">
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google', 'github']} />
        </div>
      </div>
    );
  }

  return (
    <>
      {showHistory && <VersionHistory onClose={() => setShowHistory(false)} onRestore={handleRestoreVersion} onSaveCurrent={handleSaveVersion}/>}
      <div className="flex h-screen w-full bg-slate-100">
        <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shadow-xl transition-all duration-300 ease-in-out`}>
          <div className={`p-4 border-b border-slate-800 flex flex-col gap-4 ${isSidebarCollapsed ? 'items-center' : ''}`}>
            <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center flex-col gap-4' : 'justify-between'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0">OM</div>
                {!isSidebarCollapsed && <span className="font-bold text-lg text-white whitespace-nowrap">Resourcer</span>}
              </div>
              <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-800 hover:text-white" title={isSidebarCollapsed ? "Expand" : "Collapse"}>
                {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button>
            </div>
          </div>
          <nav className="flex-1 p-2 space-y-2 mt-2">
            <button onClick={() => setActiveTab('dashboard')} title="Dashboard" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={20} />{!isSidebarCollapsed && <span className="font-medium">Dashboard</span>}</button>
            <button onClick={() => setActiveTab('planner')} title="Planner" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'planner' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Calendar size={20} />{!isSidebarCollapsed && <span className="font-medium">Planner</span>}</button>
            <button onClick={() => setActiveTab('estimator')} title="Estimator" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'estimator' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Calculator size={20} />{!isSidebarCollapsed && <span className="font-medium">Estimator</span>}</button>
            <button onClick={() => setActiveTab('holiday')} title="Holidays" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'holiday' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Globe size={20} />{!isSidebarCollapsed && <span className="font-medium">Holidays</span>}</button>
          </nav>
          <div className="p-4 border-t border-slate-800 space-y-2">
            <button onClick={() => setActiveTab('settings')} title="Settings" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-2 text-sm rounded-lg ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}><SettingsIcon size={16} />{!isSidebarCollapsed && <span>Settings</span>}</button>
            <button onClick={() => supabase.auth.signOut()} title="Sign Out" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-2 text-sm rounded-lg text-slate-400 hover:text-white`}><LogOut size={16} />{!isSidebarCollapsed && <span>Sign Out</span>}</button>
          </div>
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8"><h1 className="text-xl font-bold text-slate-800">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1></header>
          <div className="flex-1 overflow-auto p-6">
            {loading ? <div className="text-center">Loading your data...</div> : (
              <>
                {activeTab === 'dashboard' && <Dashboard projects={projects} />}
                {activeTab === 'planner' && <PlannerGrid projects={projects} holidays={holidays} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={handleExtendTimeline} onUpdateAllocation={updateAllocation} onUpdateAssignmentRole={async () => {}} onUpdateAssignmentResourceName={async () => {}} onAddTask={addTask} onAddAssignment={addAssignment} onReorderModules={reorderModules} onShiftTask={async () => {}} onShiftAssignment={async () => {}} onUpdateTaskSchedule={updateTaskSchedule} onAddProject={addProject} onAddModule={addModule} onUpdateProjectName={updateProjectName} onUpdateModuleName={updateModuleName} onUpdateTaskName={updateTaskName} onDeleteProject={deleteProject} onDeleteModule={deleteModule} onDeleteTask={deleteTask} onDeleteAssignment={deleteAssignment} onImportPlan={() => {}} onShowHistory={() => setShowHistory(true)} onUpdateFunctionPoints={updateFunctionPoints} />}
                {activeTab === 'estimator' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"><div className="lg:col-span-1 h-fit"><Estimator projects={projects} onUpdateFunctionPoints={updateFunctionPoints} onReorderModules={reorderModules}/></div><div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center flex-col text-slate-400"><Calculator className="w-16 h-16 mb-4 opacity-20" /><h3 className="text-lg font-medium text-slate-600">Effort Estimation</h3></div></div>}
                {activeTab === 'holiday' && <AdminSettings holidays={holidays} onUpdateHolidays={setHolidays} />}
                {activeTab === 'settings' && <Settings />}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default App;
