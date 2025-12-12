import React, { useState, useEffect } from 'react';
import { DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Settings } from './components/Settings';
import { Resources } from './components/Resources';
import { VersionHistory } from './components/VersionHistory';
import { DebugLog } from './components/DebugLog';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, LogOut, Users } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

// Helper to structure data from Supabase
const structureProjectsData = (
  projects: any[],
  modules: any[],
  tasks: any[],
  assignments: any[],
  allocations: any[]
): Project[] => {
  const allocationsByAssignment = new Map<string, ResourceAllocation[]>();
  allocations.forEach(a => {
    if (!allocationsByAssignment.has(a.assignment_id)) {
      allocationsByAssignment.set(a.assignment_id, []);
    }
    allocationsByAssignment.get(a.assignment_id)!.push({
      weekId: a.week_id,
      count: a.count,
      days: a.days
    });
  });

  const assignmentsByTask = new Map<string, TaskAssignment[]>();
  assignments.forEach(a => {
    if (!assignmentsByTask.has(a.task_id)) {
      assignmentsByTask.set(a.task_id, []);
    }
    assignmentsByTask.get(a.task_id)!.push({
      id: a.id,
      role: a.role,
      resourceName: a.resource_name,
      allocations: allocationsByAssignment.get(a.id) || [],
      startDate: a.start_date,
      duration: a.duration,
      parentAssignmentId: a.parent_assignment_id,
      sort_order: a.sort_order
    });
  });

  // Sort assignments
  assignmentsByTask.forEach(list => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  const tasksByModule = new Map<string, ProjectTask[]>();
  tasks.forEach(t => {
    if (!tasksByModule.has(t.module_id)) {
      tasksByModule.set(t.module_id, []);
    }
    tasksByModule.get(t.module_id)!.push({
      id: t.id,
      name: t.name,
      assignments: assignmentsByTask.get(t.id) || [],
      sort_order: t.sort_order
    });
  });

  // Sort tasks
  tasksByModule.forEach(list => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  const modulesByProject = new Map<string, ProjectModule[]>();
  modules.forEach(m => {
    if (!modulesByProject.has(m.project_id)) {
      modulesByProject.set(m.project_id, []);
    }
    modulesByProject.get(m.project_id)!.push({
      id: m.id,
      name: m.name,
      legacyFunctionPoints: m.legacy_function_points || 0,
      functionPoints: m.function_points || 0,
      tasks: tasksByModule.get(m.id) || [],
      sort_order: m.sort_order
    });
  });

  // Sort modules
  modulesByProject.forEach(list => list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));

  return projects.map(p => ({
    id: p.id,
    name: p.name,
    modules: modulesByProject.get(p.id) || []
  }));
};

const App: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'resources' | 'settings'>('planner');
    const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
    const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
    const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
    const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const log = (message: string, payload?: any, status: 'pending' | 'success' | 'error' = 'pending') => {
        if (!isDebugLogEnabled) return;
        const entry: LogEntry = {
            id: Date.now(),
            timestamp: new Date().toISOString().split('T')[1].slice(0, 8),
            message,
            payload,
            status
        };
        setDebugLogs(prev => [entry, ...prev].slice(0, 50));
    };

    const fetchData = async () => {
        setIsRefreshing(true);
        try {
            log('Fetching all data...');
            const [pRes, mRes, tRes, aRes, allocRes, hRes, rRes] = await Promise.all([
                supabase.from('projects').select('*').order('created_at'),
                supabase.from('modules').select('*').order('sort_order'),
                supabase.from('tasks').select('*').order('sort_order'),
                supabase.from('assignments').select('*').order('sort_order'),
                supabase.from('allocations').select('*'),
                supabase.from('holidays').select('*'),
                supabase.from('resources').select('*, individual_holidays(*)')
            ]);

            if (pRes.error) throw pRes.error;
            if (mRes.error) throw mRes.error;
            if (tRes.error) throw tRes.error;
            if (aRes.error) throw aRes.error;
            if (allocRes.error) throw allocRes.error;
            if (hRes.error) throw hRes.error;
            if (rRes.error) throw rRes.error;

            const structuredProjects = structureProjectsData(pRes.data, mRes.data, tRes.data, aRes.data, allocRes.data);
            setProjects(structuredProjects);
            setHolidays(hRes.data);
            setResources(rRes.data);
            log('Data fetched successfully', null, 'success');
        } catch (error: any) {
            console.error('Error fetching data:', error);
            log('Error fetching data', error, 'error');
        } finally {
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (session) {
            fetchData();
        }
    }, [session]);

    // --- Actions ---

    const handleExtendTimeline = (direction: 'start' | 'end') => {
        if (direction === 'start') {
            setTimelineStart(prev => addWeeksToPoint(prev, -4));
        } else {
            setTimelineEnd(prev => addWeeksToPoint(prev, 4));
        }
    };
    
    const handleUpdateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
       // Optimistic update
       setProjects(prev => {
           return prev.map(p => {
               if(p.id !== projectId) return p;
               return {
                   ...p,
                   modules: p.modules.map(m => {
                       if(m.id !== moduleId) return m;
                       return {
                           ...m,
                           tasks: m.tasks.map(t => {
                               if(t.id !== taskId) return t;
                               return {
                                   ...t,
                                   assignments: t.assignments.map(a => {
                                       if(a.id !== assignmentId) return a;
                                       let newAllocations = [...a.allocations];
                                       const existingIndex = newAllocations.findIndex(al => al.weekId === weekId);
                                       if(existingIndex >= 0) {
                                           if (dayDate) {
                                                const existing = newAllocations[existingIndex];
                                                const newDays = { ...existing.days, [dayDate]: value };
                                                const newCount = Object.values(newDays).reduce((sum, v) => sum + v, 0);
                                                newAllocations[existingIndex] = { ...existing, count: newCount, days: newDays };
                                           } else {
                                                newAllocations[existingIndex] = { ...newAllocations[existingIndex], count: value };
                                           }
                                       } else {
                                           if (dayDate) {
                                               newAllocations.push({ weekId, count: value, days: { [dayDate]: value } });
                                           } else {
                                               newAllocations.push({ weekId, count: value });
                                           }
                                       }
                                       return { ...a, allocations: newAllocations };
                                   })
                               }
                           })
                       }
                   })
               }
           })
       });

       try {
           setSaveStatus('saving');
           
           if (dayDate) {
               const currentProject = projects.find(p => p.id === projectId);
               const currentModule = currentProject?.modules.find(m => m.id === moduleId);
               const currentTask = currentModule?.tasks.find(t => t.id === taskId);
               const currentAssignment = currentTask?.assignments.find(a => a.id === assignmentId);
               const currentAllocation = currentAssignment?.allocations.find(a => a.weekId === weekId);
               
               let newDays = currentAllocation?.days ? { ...currentAllocation.days } : {};
               newDays[dayDate] = value;
               const newCount = Object.values(newDays).reduce((s, v) => s + v, 0);
               
               const { error } = await supabase.from('allocations').upsert({
                   assignment_id: assignmentId,
                   week_id: weekId,
                   count: newCount,
                   days: newDays
               }, { onConflict: 'assignment_id,week_id' });
               if (error) throw error;
           } else {
                const { error } = await supabase.from('allocations').upsert({
                   assignment_id: assignmentId,
                   week_id: weekId,
                   count: value
               }, { onConflict: 'assignment_id,week_id' });
               if (error) throw error;
           }
           setSaveStatus('success');
       } catch (e) {
           console.error(e);
           setSaveStatus('error');
       } finally {
           setTimeout(() => setSaveStatus('idle'), 2000);
       }
    };

    const handleUpdateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, resourceName: name } : a) } : t) } : m) } : p));
        await supabase.from('assignments').update({ resource_name: name }).eq('id', assignmentId);
    };

    const handleUpdateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
         setProjects(prev => prev.map(p => ({
             ...p,
             modules: p.modules.map(m => ({
                 ...m,
                 tasks: m.tasks.map(t => ({
                     ...t,
                     assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, parentAssignmentId: parentAssignmentId || undefined } : a)
                 }))
             }))
         })));
         await supabase.from('assignments').update({ parent_assignment_id: parentAssignmentId }).eq('id', assignmentId);
    };

    const handleAddTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
        const newTask: ProjectTask = { id: taskId, name: taskName, assignments: [] };
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: [...m.tasks, newTask] } : m) } : p));
        await supabase.from('tasks').insert({ id: taskId, module_id: moduleId, name: taskName, sort_order: 999 });
    };

    const handleAddAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
        const newId = crypto.randomUUID();
        const newAssignment: TaskAssignment = { id: newId, role, allocations: [] };
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, assignments: [...t.assignments, newAssignment] } : t) } : m) } : p));
        await supabase.from('assignments').insert({ id: newId, task_id: taskId, role, sort_order: 999 });
    };

    const handleCopyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
        const task = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
        const original = task?.assignments.find(a => a.id === assignmentId);
        if (!original) return;

        const newId = crypto.randomUUID();
        const copy: TaskAssignment = { ...original, id: newId, resourceName: undefined, allocations: [...original.allocations] };
        
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, assignments: [...t.assignments, copy] } : t) } : m) } : p));
        
        await supabase.from('assignments').insert({ id: newId, task_id: taskId, role: copy.role, start_date: copy.startDate, duration: copy.duration, sort_order: 999 });
        if (copy.allocations.length > 0) {
            const allocsToInsert = copy.allocations.map(a => ({ assignment_id: newId, week_id: a.weekId, count: a.count, days: a.days }));
            await supabase.from('allocations').insert(allocsToInsert);
        }
    };

    const handleReorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
        const project = projects.find(p => p.id === projectId);
        if (!project) return;
        const newModules = [...project.modules];
        const [removed] = newModules.splice(startIndex, 1);
        newModules.splice(endIndex, 0, removed);
        
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: newModules } : p));
        
        const updates = newModules.map((m, idx) => ({ id: m.id, sort_order: idx }));
        for (const update of updates) {
             await supabase.from('modules').update({ sort_order: update.sort_order }).eq('id', update.id);
        }
    };
    
    const handleReorderTasks = async (projectId: string, moduleId: string, startIndex: number, endIndex: number) => {
         const project = projects.find(p => p.id === projectId);
         const module = project?.modules.find(m => m.id === moduleId);
         if (!module) return;
         const newTasks = [...module.tasks];
         const [removed] = newTasks.splice(startIndex, 1);
         newTasks.splice(endIndex, 0, removed);

         setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: newTasks } : m) } : p));

         const updates = newTasks.map((t, idx) => ({ id: t.id, sort_order: idx }));
         for (const update of updates) {
             await supabase.from('tasks').update({ sort_order: update.sort_order }).eq('id', update.id);
         }
    };

    const handleReorderAssignments = async (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => {
         const project = projects.find(p => p.id === projectId);
         const module = project?.modules.find(m => m.id === moduleId);
         const task = module?.tasks.find(t => t.id === taskId);
         if (!task) return;
         const newAssignments = [...task.assignments];
         const [removed] = newAssignments.splice(startIndex, 1);
         newAssignments.splice(endIndex, 0, removed);

         setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, assignments: newAssignments } : t) } : m) } : p));

         const updates = newAssignments.map((a, idx) => ({ id: a.id, sort_order: idx }));
         for (const update of updates) {
             await supabase.from('assignments').update({ sort_order: update.sort_order }).eq('id', update.id);
         }
    };

    const handleShiftTask = async (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
        // Logic to shift all assignments start dates by 1 week
    };

    const handleUpdateAssignmentSchedule = async (assignmentId: string, startDate: string, duration: number) => {
         setProjects(prev => prev.map(p => ({
             ...p,
             modules: p.modules.map(m => ({
                 ...m,
                 tasks: m.tasks.map(t => ({
                     ...t,
                     assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, startDate, duration } : a)
                 }))
             }))
         })));
         await supabase.from('assignments').update({ start_date: startDate, duration }).eq('id', assignmentId);
    };

    const handleAddProject = async () => {
        const id = crypto.randomUUID();
        const name = "New Project";
        setProjects(prev => [...prev, { id, name, modules: [] }]);
        await supabase.from('projects').insert({ id, name });
    };

    const handleAddModule = async (projectId: string) => {
        const id = crypto.randomUUID();
        const name = "New Module";
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id, name, tasks: [], functionPoints: 0, legacyFunctionPoints: 0 }] } : p));
        await supabase.from('modules').insert({ id, project_id: projectId, name, sort_order: 999 });
    };

    const handleUpdateProjectName = async (projectId: string, name: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
        await supabase.from('projects').update({ name }).eq('id', projectId);
    };

    const handleUpdateModuleName = async (projectId: string, moduleId: string, name: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, name } : m) } : p));
        await supabase.from('modules').update({ name }).eq('id', moduleId);
    };

    const handleUpdateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, name } : t) } : m) } : p));
        await supabase.from('tasks').update({ name }).eq('id', taskId);
    };

    const handleDeleteProject = async (projectId: string) => {
        if(!confirm("Are you sure?")) return;
        setProjects(prev => prev.filter(p => p.id !== projectId));
        await supabase.from('projects').delete().eq('id', projectId);
    };

    const handleDeleteModule = async (projectId: string, moduleId: string) => {
        if(!confirm("Are you sure?")) return;
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) } : p));
        await supabase.from('modules').delete().eq('id', moduleId);
    };

    const handleDeleteTask = async (projectId: string, moduleId: string, taskId: string) => {
        if(!confirm("Are you sure?")) return;
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.filter(t => t.id !== taskId) } : m) } : p));
        await supabase.from('tasks').delete().eq('id', taskId);
    };

    const handleDeleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
        if(!confirm("Are you sure?")) return;
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? { ...t, assignments: t.assignments.filter(a => a.id !== assignmentId) } : t) } : m) } : p));
        await supabase.from('assignments').delete().eq('id', assignmentId);
    };
    
    const handleAddResource = async (name: string, category: Role, region: string, type: 'Internal' | 'External') => {
        const { data, error } = await supabase.from('resources').insert({ name, category, holiday_region: region, type }).select();
        if(!error && data) setResources(prev => [...prev, data[0]]);
    };
    
    const handleDeleteResource = async (id: string) => {
        if(!confirm("Delete resource?")) return;
        await supabase.from('resources').delete().eq('id', id);
        setResources(prev => prev.filter(r => r.id !== id));
    };

    const handleUpdateResourceCategory = async (id: string, category: Role) => {
        setResources(prev => prev.map(r => r.id === id ? { ...r, category } : r));
        await supabase.from('resources').update({ category }).eq('id', id);
    };

    const handleUpdateResourceRegion = async (id: string, region: string | null) => {
        setResources(prev => prev.map(r => r.id === id ? { ...r, holiday_region: region || undefined } : r));
        await supabase.from('resources').update({ holiday_region: region }).eq('id', id);
    };
    
    const handleUpdateResourceType = async (id: string, type: 'Internal' | 'External') => {
        setResources(prev => prev.map(r => r.id === id ? { ...r, type } : r));
        await supabase.from('resources').update({ type }).eq('id', id);
    };

    const handleAddIndividualHoliday = async (resourceId: string, date: string, name: string) => {
        const { data, error } = await supabase.from('individual_holidays').insert({ resource_id: resourceId, date, name }).select();
        if(data) {
            setResources(prev => prev.map(r => r.id === resourceId ? { ...r, individual_holidays: [...(r.individual_holidays || []), data[0]] } : r));
        }
    };
    
    const handleDeleteIndividualHoliday = async (holidayId: string) => {
        await supabase.from('individual_holidays').delete().eq('id', holidayId);
        setResources(prev => prev.map(r => ({ ...r, individual_holidays: (r.individual_holidays || []).filter(h => h.id !== holidayId) })));
    };

    const handleUpdateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, legacyFunctionPoints: legacyFp, functionPoints: mvpFp } : m) } : p));
        await supabase.from('modules').update({ legacy_function_points: legacyFp, function_points: mvpFp }).eq('id', moduleId);
    };

    const handleImportPlan = async (importedProjects: Project[], importedHolidays: Holiday[]) => {
        alert("Import not fully implemented in this demo.");
    };

    const handleSaveVersion = async (name: string) => {
        await supabase.from('versions').insert({ name, data: { projects, holidays, resources } });
    };

    const handleRestoreVersion = async (versionId: number) => {
        const { data } = await supabase.from('versions').select('data').eq('id', versionId).single();
        if (data && data.data) {
            alert("Restore logic requires complex DB syncing.");
        }
    };

    if (!session) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-100">
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
                    <h1 className="text-2xl font-bold mb-6 text-center text-slate-800">Resource Planner Login</h1>
                    <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-slate-100 overflow-hidden font-sans text-slate-900">
            <aside className="w-16 md:w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 transition-all duration-300 shadow-xl z-50">
                <div className="p-4 flex items-center gap-3 border-b border-slate-800">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900/50">
                        <span className="font-bold text-white text-lg">P</span>
                    </div>
                    <span className="font-bold text-white text-lg hidden md:block tracking-tight">PlanMaster</span>
                </div>

                <nav className="flex-1 py-6 space-y-2 px-2">
                    <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                        <LayoutDashboard size={20} className={activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        <span className="font-medium hidden md:block">Dashboard</span>
                    </button>
                    <button onClick={() => setActiveTab('planner')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                        <Calendar size={20} className={activeTab === 'planner' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        <span className="font-medium hidden md:block">Planner</span>
                    </button>
                    <button onClick={() => setActiveTab('estimator')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                        <Calculator size={20} className={activeTab === 'estimator' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        <span className="font-medium hidden md:block">Estimator</span>
                    </button>
                    <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                        <Users size={20} className={activeTab === 'resources' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        <span className="font-medium hidden md:block">Resources</span>
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                        <SettingsIcon size={20} className={activeTab === 'settings' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                        <span className="font-medium hidden md:block">Settings</span>
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-all">
                        <LogOut size={18} />
                        <span className="font-medium hidden md:block text-sm">Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden flex flex-col relative">
                <header className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-6 shadow-sm flex-shrink-0 z-40">
                    <h1 className="text-lg font-bold text-slate-800 capitalize">{activeTab}</h1>
                    <div className="flex items-center gap-4">
                        <div className="text-sm text-slate-500">
                             {session.user.email}
                        </div>
                    </div>
                </header>
                
                <div className="flex-1 overflow-auto p-6 relative">
                    {activeTab === 'dashboard' && <Dashboard projects={projects} />}
                    {activeTab === 'planner' && (
                        <PlannerGrid 
                            projects={projects}
                            holidays={holidays}
                            resources={resources}
                            timelineStart={timelineStart}
                            timelineEnd={timelineEnd}
                            onExtendTimeline={handleExtendTimeline}
                            onUpdateAllocation={handleUpdateAllocation}
                            onUpdateAssignmentResourceName={handleUpdateAssignmentResourceName}
                            onUpdateAssignmentDependency={handleUpdateAssignmentDependency}
                            onAddTask={handleAddTask}
                            onAddAssignment={handleAddAssignment}
                            onCopyAssignment={handleCopyAssignment}
                            onReorderModules={handleReorderModules}
                            onReorderTasks={handleReorderTasks}
                            onReorderAssignments={handleReorderAssignments}
                            onShiftTask={handleShiftTask}
                            onUpdateAssignmentSchedule={handleUpdateAssignmentSchedule}
                            onAddProject={handleAddProject}
                            onAddModule={handleAddModule}
                            onUpdateProjectName={handleUpdateProjectName}
                            onUpdateModuleName={handleUpdateModuleName}
                            onUpdateTaskName={handleUpdateTaskName}
                            onDeleteProject={handleDeleteProject}
                            onDeleteModule={handleDeleteModule}
                            onDeleteTask={handleDeleteTask}
                            onDeleteAssignment={handleDeleteAssignment}
                            onImportPlan={handleImportPlan}
                            onShowHistory={() => setShowHistory(true)}
                            onRefresh={fetchData}
                            saveStatus={saveStatus}
                            isRefreshing={isRefreshing}
                        />
                    )}
                    {activeTab === 'estimator' && (
                        <Estimator 
                            projects={projects} 
                            onUpdateFunctionPoints={handleUpdateFunctionPoints}
                            onReorderModules={handleReorderModules}
                        />
                    )}
                    {activeTab === 'resources' && (
                        <Resources 
                            resources={resources} 
                            onAddResource={handleAddResource}
                            onDeleteResource={handleDeleteResource}
                            onUpdateResourceCategory={handleUpdateResourceCategory}
                            onUpdateResourceRegion={handleUpdateResourceRegion}
                            onUpdateResourceType={handleUpdateResourceType}
                            onAddIndividualHoliday={handleAddIndividualHoliday}
                            onDeleteIndividualHoliday={handleDeleteIndividualHoliday}
                        />
                    )}
                    {activeTab === 'settings' && (
                        <Settings isDebugLogEnabled={isDebugLogEnabled} setIsDebugLogEnabled={setIsDebugLogEnabled} />
                    )}
                </div>

                {isDebugLogEnabled && <DebugLog entries={debugLogs} setEntries={setDebugLogs} />}
                {showHistory && (
                    <VersionHistory 
                        onClose={() => setShowHistory(false)} 
                        onRestore={handleRestoreVersion} 
                        onSaveCurrent={handleSaveVersion} 
                    />
                )}
            </main>
        </div>
    );
};

export default App;