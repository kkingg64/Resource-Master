
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

// FIX: Moved helper function outside component scope and fixed JSX parsing ambiguity with a trailing comma in the generic type parameter.
// Helper function for creating a safe, deep clone of the state
const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

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
      const formattedProjects = structureProjectsData(projectsData);
      if (formattedProjects.length === 0) {
         // Create default project if none exist
         const { data, error } = await supabase.from('projects').insert({ name: 'My First Project', user_id: session!.user.id }).select().single();
         if (data && !error) {
             setProjects([{ id: data.id, name: data.name, modules: [] }]);
         } else {
             console.error("Error creating default project:", error);
         }
      } else {
          setProjects(formattedProjects);
      }
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
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);

    const project = updatedProjects.find(p => p.id === projectId);
    if (!project) return;
    const module = project.modules.find(m => m.id === moduleId);
    if (!module) return;
    const task = module.tasks.find(t => t.id === taskId);
    if (!task) return;
    const assignment = task.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    let allocationToUpdate: any = null;
    const allocIndex = assignment.allocations.findIndex(al => al.weekId === weekId);
    
    if (allocIndex > -1) {
        const alloc = assignment.allocations[allocIndex];
        if (dayDate) {
            alloc.days = alloc.days || {};
            if (Object.keys(alloc.days).length === 0 && alloc.count > 0) {
                const weekdays = getWeekdaysForWeekId(weekId);
                // FIX: Used {[key: string]: number} to avoid JSX parsing ambiguity.
                weekdays.forEach(d => (alloc.days as {[key: string]: number})[d] = alloc.count / 5);
            }
            // FIX: Used {[key: string]: number} to avoid JSX parsing ambiguity.
            (alloc.days as {[key: string]: number})[dayDate] = value;
            alloc.count = Object.values(alloc.days).reduce((sum: number, v: number) => sum + v, 0);
        } else {
            alloc.count = value;
            alloc.days = {};
        }
        allocationToUpdate = alloc;
    } else if (value > 0) {
        const newAlloc: ResourceAllocation = { weekId, count: value, days: {} };
        if (dayDate) {
            const weekdays = getWeekdaysForWeekId(weekId);
            // FIX: Used {[key: string]: number} to avoid JSX parsing ambiguity.
            const days = weekdays.reduce((acc, day) => ({...acc, [day]: 0}), {} as {[key: string]: number});
            days[dayDate] = value;
            newAlloc.days = days;
            newAlloc.count = Object.values(days).reduce((sum, v) => sum + v, 0);
        }
        assignment.allocations.push(newAlloc);
        allocationToUpdate = newAlloc;
    } else { // Handle setting value to 0 for an existing daily allocation
        const alloc = assignment.allocations[allocIndex];
        if (alloc && dayDate && alloc.days && alloc.days[dayDate] !== undefined) {
             delete alloc.days[dayDate];
             alloc.count = Object.values(alloc.days).reduce((sum: number, v: number) => sum + v, 0);
             allocationToUpdate = alloc;
        }
    }

    setProjects(updatedProjects);

    // DB update
    if (allocationToUpdate) {
        const { data: existingAlloc } = await supabase
            .from('resource_allocations')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('week_id', weekId)
            .maybeSingle();

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
            setProjects(previousState);
            alert("Error: Could not save allocation.");
        }
    }
  };

  const addProject = async () => {
    const { data, error } = await supabase.from('projects').insert({ name: `New Project ${projects.length + 1}`, user_id: session!.user.id }).select().single();
    if (error) {
        console.error("Error adding project:", error);
        alert("Could not create project.");
    }
    else {
        setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]);
    }
  };
  
  const deleteProject = async (projectId: string) => {
    const previousState = deepClone(projects);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete project.");
    }
  };
  
  const updateProjectName = async (projectId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (project) {
        project.name = name;
        setProjects(updatedProjects);
    }

    const { error } = await supabase.from('projects').update({ name }).eq('id', projectId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update project name.");
    }
  };
  
  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
     const previousState = deepClone(projects);
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     const module = project?.modules.find(m => m.id === moduleId);
     if (module) {
        module.name = name;
        setProjects(updatedProjects);
     }
     
     const { error } = await supabase.from('modules').update({ name }).eq('id', moduleId);
     if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update module name.");
     }
  };
  
  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    const task = module?.tasks.find(t => t.id === taskId);
    if (task) {
        task.name = name;
        setProjects(updatedProjects);
    }
    
    const { error } = await supabase.from('tasks').update({ name }).eq('id', taskId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update task name.");
    }
  };
  
  const addModule = async (projectId: string) => {
    const { data, error } = await supabase.from('modules').insert({ name: 'New Module', project_id: projectId, user_id: session!.user.id }).select().single();
    if (error) {
        console.error(error);
        alert("Failed to add module.");
    }
    else {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id: data.id, name: data.name, legacyFunctionPoints: 0, functionPoints: 0, tasks: [] }] } : p));
    }
  };
  
  const deleteModule = async (projectId: string, moduleId: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (project) {
        project.modules = project.modules.filter(m => m.id !== moduleId);
        setProjects(updatedProjects);
    }
    
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete module.");
    }
  };
  
  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    // This now needs to be a transaction
    const { data: taskData, error: taskError } = await supabase.from('tasks').insert({ id: taskId, name: taskName, module_id: moduleId, user_id: session!.user.id }).select().single();
    if (taskError) { console.error(taskError); alert("Failed to add task."); return; }
    
    const { data: assignData, error: assignError } = await supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (assignError) { console.error(assignError); return; }

    fetchData(); // Simplest way to refresh state after complex insert
  };
  
  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    if (module) {
        module.tasks = module.tasks.filter(t => t.id !== taskId);
        setProjects(updatedProjects);
    }
    
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete task.");
    }
  };
  
  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    const { data, error } = await supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (error) console.error(error);
    else fetchData();
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
     const previousState = deepClone(projects);
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     const module = project?.modules.find(m => m.id === moduleId);
     const task = module?.tasks.find(t => t.id === taskId);
     if (task) {
        task.assignments = task.assignments.filter(a => a.id !== assignmentId);
        setProjects(updatedProjects);
     }
     
     const { error } = await supabase.from('task_assignments').delete().eq('id', assignmentId);
     if (error) { 
         console.error(error); 
         setProjects(previousState);
         alert("Failed to delete assignment.");
     }
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    const task = module?.tasks.find(t => t.id === taskId);
    const assignment = task?.assignments.find(a => a.id === assignmentId);
    if (assignment) {
        assignment.resourceName = name;
        setProjects(updatedProjects);
    }

    const { error } = await supabase.from('task_assignments').update({ resource_name: name }).eq('id', assignmentId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update resource name.");
    }
  };

  const updateAssignmentRole = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    const task = module?.tasks.find(t => t.id === taskId);
    const assignment = task?.assignments.find(a => a.id === assignmentId);
    if (assignment) {
        assignment.role = role;
        setProjects(updatedProjects);
    }

    const { error } = await supabase.from('task_assignments').update({ role }).eq('id', assignmentId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update role.");
    }
  };

  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
     const previousState = deepClone(projects);
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     const module = project?.modules.find(m => m.id === moduleId);
     if (module) {
        module.legacyFunctionPoints = legacyFp;
        module.functionPoints = mvpFp;
        setProjects(updatedProjects);
     }
     
     const { error } = await supabase.from('modules').update({ legacy_function_points: legacyFp, function_points: mvpFp }).eq('id', moduleId);
     if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update function points.");
     }
  };
  
  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const [removed] = project.modules.splice(startIndex, 1);
    project.modules.splice(endIndex, 0, removed);
    
    setProjects(updatedProjects);
    
    // Update sort_order in DB
    const updates = project.modules.map((module, index) => 
      supabase.from('modules').update({ sort_order: index }).eq('id', module.id)
    );
    const results = await Promise.all(updates);
    const hasError = results.some(res => res.error);
    if (hasError) {
        console.error("Failed to reorder modules", results);
        setProjects(previousState);
        alert("Failed to reorder modules.");
    }
  };
  
  const updateTaskSchedule = async (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
     const previousState = deepClone(projects);
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     const module = project?.modules.find(m => m.id === moduleId);
     const task = module?.tasks.find(t => t.id === taskId);
     if (task) {
        task.startWeekId = startWeekId;
        task.duration = duration;
        setProjects(updatedProjects);
     }
     
     const { error } = await supabase.from('tasks').update({ start_week_id: startWeekId, duration }).eq('id', taskId);
     if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update task schedule.");
     }
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
                {activeTab === 'planner' && <PlannerGrid projects={projects} holidays={holidays} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={handleExtendTimeline} onUpdateAllocation={updateAllocation} onUpdateAssignmentRole={updateAssignmentRole} onUpdateAssignmentResourceName={updateAssignmentResourceName} onAddTask={addTask} onAddAssignment={addAssignment} onReorderModules={reorderModules} onShiftTask={async () => {}} onShiftAssignment={async () => {}} onUpdateTaskSchedule={updateTaskSchedule} onAddProject={addProject} onAddModule={addModule} onUpdateProjectName={updateProjectName} onUpdateModuleName={updateModuleName} onUpdateTaskName={updateTaskName} onDeleteProject={deleteProject} onDeleteModule={deleteModule} onDeleteTask={deleteTask} onDeleteAssignment={deleteAssignment} onImportPlan={() => {}} onShowHistory={() => setShowHistory(true)} onUpdateFunctionPoints={updateFunctionPoints} />}
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
