import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Session } from '@supabase/supabase-js';
import { 
  Project, ProjectModule, ProjectTask, TaskAssignment, Resource, Holiday, 
  Role, LogEntry, ResourceAllocation, Phase, ViewMode, TimelineColumn 
} from './types';
import { 
  DEFAULT_START, DEFAULT_END, WeekPoint, getDateFromWeek, getWeekIdFromDate, 
  calculateEndDate, findNextWorkingDay, formatDateForInput, addWeeksToPoint,
  GOV_HOLIDAYS_DB
} from './constants';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Dashboard } from './components/Dashboard';
import { Resources } from './components/Resources';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { DebugLog } from './components/DebugLog';
import { AIAssistant } from './components/AIAssistant';
import { VersionHistory } from './components/VersionHistory';
import { Layout, Calendar, BarChart3, Users, Settings as SettingsIcon, Shield, LogOut, Menu } from 'lucide-react';

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const shiftWeekIdByAmount = (weekId: string, weeks: number): string => {
  const [year, week] = weekId.split('-').map(Number);
  const date = getDateFromWeek(year, week);
  date.setDate(date.getDate() + (weeks * 7));
  return getWeekIdFromDate(date);
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [activeTab, setActiveTab] = useState<'planner' | 'estimator' | 'dashboard' | 'resources' | 'admin' | 'settings'>('planner');
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const addLog = (message: string, status: 'pending' | 'success' | 'error', payload?: any) => {
    if (!isDebugLogEnabled && status === 'pending') return;
    const entry: LogEntry = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      message,
      status,
      payload
    };
    setLogEntries(prev => [entry, ...prev].slice(0, 50));
  };

  const callSupabase = async (label: string, payload: any, promise: PromiseLike<any>) => {
    addLog(label, 'pending', payload);
    setSaveStatus('saving');
    try {
      const { data, error } = await promise;
      if (error) throw error;
      addLog(label, 'success', data);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return { data, error: null };
    } catch (error: any) {
      console.error(error);
      addLog(label, 'error', error);
      setSaveStatus('error');
      return { data: null, error };
    }
  };

  const loadData = useCallback(async () => {
    if (!session) return;
    setIsRefreshing(true);
    addLog('Fetching all data', 'pending');

    try {
      const [pRes, hRes, rRes] = await Promise.all([
        supabase.from('projects').select('*, modules:project_modules(*, tasks:project_tasks(*, assignments:task_assignments(*, allocations:resource_allocations(*))))').order('created_at'),
        supabase.from('holidays').select('*'),
        supabase.from('resources').select('*, individual_holidays(*)')
      ]);

      if (pRes.error) throw pRes.error;
      if (hRes.error) throw hRes.error;
      if (rRes.error) throw rRes.error;

      // Sort data structure
      const sortedProjects = pRes.data.map((p: any) => ({
        ...p,
        modules: p.modules.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((m: any) => ({
          ...m,
          tasks: m.tasks.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((t: any) => ({
            ...t,
            assignments: t.assignments.sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((a: any) => ({
              ...a,
              role: a.role as Role,
              allocations: a.allocations || []
            }))
          }))
        }))
      }));

      setProjects(sortedProjects);
      setHolidays(hRes.data);
      setResources(rRes.data);
      addLog('Data fetch complete', 'success');
    } catch (error) {
      addLog('Data fetch failed', 'error', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      loadData();
    }
  }, [session, loadData]);

  // --- Handlers ---

  const getHolidays = (resourceName?: string): Set<string> => {
    const res = resources.find(r => r.name === resourceName);
    const region = res?.holiday_region || 'HK'; // Default to HK or logic
    const regional = holidays.filter(h => h.country === region);
    const individual = res?.individual_holidays || [];
    return new Set([...regional, ...individual].map(h => h.date));
  };

  const propagateScheduleChanges = async (
    currentProjects: Project[],
    changedAssignmentId: string,
    visited = new Set<string>()
  ) => {
    if (visited.has(changedAssignmentId)) return;
    visited.add(changedAssignmentId);

    // Find the changed assignment to know its end date
    let changedAssignment: TaskAssignment | undefined;
    let changedAssignmentEndDate: string | null = null;

    for (const p of currentProjects) {
      for (const m of p.modules) {
        for (const t of m.tasks) {
          const a = t.assignments.find(ass => ass.id === changedAssignmentId);
          if (a) {
            changedAssignment = a;
            const holidaysSet = getHolidays(a.resourceName);
            if (a.startDate) {
                changedAssignmentEndDate = calculateEndDate(a.startDate, a.duration || 1, holidaysSet);
            }
            break;
          }
        }
        if (changedAssignment) break;
      }
      if (changedAssignment) break;
    }

    if (!changedAssignment || !changedAssignmentEndDate) return;

    // Find dependents
    const dependents: TaskAssignment[] = [];
    for (const p of currentProjects) {
      for (const m of p.modules) {
        for (const t of m.tasks) {
          t.assignments.forEach(a => {
            if (a.parentAssignmentId === changedAssignmentId) {
              dependents.push(a);
            }
          });
        }
      }
    }

    for (const dependent of dependents) {
        const holidaysSet = getHolidays(dependent.resourceName);
        const newStartDate = findNextWorkingDay(changedAssignmentEndDate, holidaysSet);
        
        if (dependent.startDate !== newStartDate) {
            const oldStartWeekId = dependent.startDate ? getWeekIdFromDate(new Date(dependent.startDate.replace(/-/g, '/'))) : null;
            dependent.startDate = newStartDate;
            
            // DB Update for dependent start date
            await supabase.from('task_assignments').update({ start_date: newStartDate }).eq('id', dependent.id);

            const newStartWeekId = getWeekIdFromDate(new Date(newStartDate.replace(/-/g, '/')));
             if (oldStartWeekId && oldStartWeekId !== newStartWeekId) {
                const [y1, w1] = oldStartWeekId.split('-').map(Number);
                const [y2, w2] = newStartWeekId.split('-').map(Number);
                const date1 = getDateFromWeek(y1, w1);
                const date2 = getDateFromWeek(y2, w2);
                const diffTime = date2.getTime() - date1.getTime();
                const weekDiff = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

                if (weekDiff !== 0) {
                    dependent.allocations.forEach(alloc => {
                        alloc.weekId = shiftWeekIdByAmount(alloc.weekId, weekDiff);
                    });
                    
                    // DB Update for shifted allocations
                    const updates = dependent.allocations.map(a => ({
                        assignment_id: dependent.id,
                        user_id: session!.user.id,
                        week_id: a.weekId,
                        count: a.count,
                        days: a.days || {}
                    }));
                    // Delete old allocs and insert new (simple way)
                    await supabase.from('resource_allocations').delete().eq('assignment_id', dependent.id);
                    if (updates.length > 0) {
                        await supabase.from('resource_allocations').insert(updates);
                    }
                }
             }
             
             await propagateScheduleChanges(currentProjects, dependent.id, visited);
        }
    }
  };

  const updateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    let targetAssignment: TaskAssignment | null = null;

    // Find target assignment
    for (const p of updatedProjects) {
        for (const m of p.modules) {
            for (const t of m.tasks) {
                const assignment = t.assignments.find(a => a.id === assignmentId);
                if (assignment) {
                    targetAssignment = assignment;
                    break;
                }
            }
            if (targetAssignment) break;
        }
        if (targetAssignment) break;
    }

    if (targetAssignment) {
        targetAssignment.parentAssignmentId = parentAssignmentId || undefined;
        let allocationUpdatesForTarget: any[] = [];
        
        // Immediate update if parent is set
        if (parentAssignmentId) {
             let parentAssignment: TaskAssignment | null = null;
             // Find parent to get initial date
             for (const p of updatedProjects) {
                for (const m of p.modules) {
                    for (const t of m.tasks) {
                        const pa = t.assignments.find(a => a.id === parentAssignmentId);
                        if (pa) { parentAssignment = pa; break; }
                    }
                    if (parentAssignment) break;
                }
                if (parentAssignment) break;
             }

             if (parentAssignment && parentAssignment.startDate) {
                 const parentEndDate = calculateEndDate(parentAssignment.startDate, parentAssignment.duration || 1, getHolidays(parentAssignment.resourceName));
                 const myHolidays = getHolidays(targetAssignment.resourceName);
                 const newStartDate = findNextWorkingDay(parentEndDate, myHolidays);

                 // Check if start date changed
                 if (targetAssignment.startDate !== newStartDate) {
                     const oldStartWeekId = targetAssignment.startDate ? getWeekIdFromDate(new Date(targetAssignment.startDate.replace(/-/g, '/'))) : null;
                     const newStartWeekId = getWeekIdFromDate(new Date(newStartDate.replace(/-/g, '/')));
                     
                     targetAssignment.startDate = newStartDate;

                     // Shift Allocations if week changed
                     if (oldStartWeekId && oldStartWeekId !== newStartWeekId) {
                        const [y1, w1] = oldStartWeekId.split('-').map(Number);
                        const [y2, w2] = newStartWeekId.split('-').map(Number);
                        const date1 = getDateFromWeek(y1, w1);
                        const date2 = getDateFromWeek(y2, w2);
                        const diffTime = date2.getTime() - date1.getTime();
                        const weekDiff = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

                        if (weekDiff !== 0) {
                            const newAllocationsMap = new Map<string, ResourceAllocation>();
                            targetAssignment.allocations.forEach(alloc => {
                                const newWeekId = shiftWeekIdByAmount(alloc.weekId, weekDiff);
                                if (newAllocationsMap.has(newWeekId)) {
                                    const existing = newAllocationsMap.get(newWeekId)!;
                                    existing.count += alloc.count;
                                    existing.days = {}; // Clear daily details on shift as they might be invalid
                                } else {
                                    newAllocationsMap.set(newWeekId, { ...alloc, weekId: newWeekId, days: {} });
                                }
                            });
                            targetAssignment.allocations = Array.from(newAllocationsMap.values());
                            
                            // Prepare DB Update payload
                            allocationUpdatesForTarget = targetAssignment.allocations.map(a => ({
                                assignment_id: targetAssignment!.id,
                                user_id: session!.user.id,
                                week_id: a.weekId,
                                count: a.count,
                                days: a.days || {}
                            }));
                        }
                     }
                 }
             }
        }

        await propagateScheduleChanges(updatedProjects, assignmentId);
        setProjects(updatedProjects);
        
        // 1. Update Assignment Dependency & Start Date
        const { error } = await callSupabase(
            'UPDATE assignment dependency',
            { assignmentId, parentAssignmentId },
            supabase.from('task_assignments').update({ parent_assignment_id: parentAssignmentId, start_date: targetAssignment?.startDate }).eq('id', assignmentId)
        );

        if (error) {
            setProjects(previousState);
            alert("Failed to update dependency.");
            return;
        }

        // 2. Update Allocations if they were shifted
        if (allocationUpdatesForTarget.length > 0) {
             await supabase.from('resource_allocations').delete().eq('assignment_id', assignmentId);
             if (allocationUpdatesForTarget.length > 0) {
                await supabase.from('resource_allocations').insert(allocationUpdatesForTarget);
             }
        }
    }
  };

  // Other specific handlers needed for PlannerGrid
  const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    // Optimistic Update
    const updatedProjects = deepClone(projects);
    const p = updatedProjects.find(x => x.id === projectId);
    const m = p?.modules.find(x => x.id === moduleId);
    const t = m?.tasks.find(x => x.id === taskId);
    const a = t?.assignments.find(x => x.id === assignmentId);
    if (!a) return;

    let allocation = a.allocations.find(x => x.weekId === weekId);
    if (!allocation) {
      allocation = { weekId, count: 0 };
      a.allocations.push(allocation);
    }
    
    if (dayDate) {
        if (!allocation.days) allocation.days = {};
        allocation.days[dayDate] = value;
        // Recalculate total for week based on days
        allocation.count = Object.values(allocation.days).reduce((sum, v) => sum + v, 0);
    } else {
        allocation.count = value;
    }
    setProjects(updatedProjects);

    // DB Update
    if (!session) return;
    await callSupabase(
      'UPSERT allocation', 
      { assignmentId, weekId, value },
      supabase.from('resource_allocations').upsert({
        assignment_id: assignmentId,
        user_id: session.user.id,
        week_id: weekId,
        count: allocation.count,
        days: allocation.days || {}
      }, { onConflict: 'assignment_id, week_id' })
    );
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    const updatedProjects = deepClone(projects);
    const p = updatedProjects.find(x => x.id === projectId);
    const m = p?.modules.find(x => x.id === moduleId);
    const t = m?.tasks.find(x => x.id === taskId);
    const a = t?.assignments.find(x => x.id === assignmentId);
    if (!a) return;
    a.resourceName = name;
    setProjects(updatedProjects);

    await callSupabase(
        'UPDATE assignment resource',
        { assignmentId, name },
        supabase.from('task_assignments').update({ resource_name: name }).eq('id', assignmentId)
    );
  };
  
  // Basic CRUD helpers
  const handleAddTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
      const updatedProjects = deepClone(projects);
      const m = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
      if(!m) return;
      
      const newTask: ProjectTask = {
          id: taskId,
          name: taskName,
          assignments: [],
          sort_order: m.tasks.length
      };
      m.tasks.push(newTask);
      setProjects(updatedProjects);

      await callSupabase(
          'INSERT task',
          { taskId, taskName },
          supabase.from('project_tasks').insert({
              id: taskId,
              module_id: moduleId,
              user_id: session?.user.id,
              name: taskName,
              sort_order: newTask.sort_order
          })
      );
  };

  const handleAddAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
      const updatedProjects = deepClone(projects);
      const t = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
      if(!t) return;

      const newAssignment: TaskAssignment = {
          id: crypto.randomUUID(),
          role,
          allocations: [],
          sort_order: t.assignments.length
      };
      t.assignments.push(newAssignment);
      setProjects(updatedProjects);

      await callSupabase(
          'INSERT assignment',
          { id: newAssignment.id, role },
          supabase.from('task_assignments').insert({
              id: newAssignment.id,
              task_id: taskId,
              user_id: session?.user.id,
              role,
              sort_order: newAssignment.sort_order
          })
      );
  };

  // Login Screen
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-200">
          <div className="flex justify-center mb-6 text-indigo-600">
             <Layout size={48} />
          </div>
          <h1 className="text-2xl font-bold text-center text-slate-800 mb-6">OMS Resource Master</h1>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-100 text-slate-800 font-sans overflow-hidden">
      <div className="w-20 bg-slate-900 flex flex-col items-center py-6 gap-6 z-50 shadow-xl flex-shrink-0">
        <div className="text-white p-2 bg-indigo-600 rounded-lg mb-4">
          <Layout size={24} />
        </div>
        <nav className="flex flex-col gap-4 w-full px-2">
          <button onClick={() => setActiveTab('planner')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'planner' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Planner">
            <Calendar size={20} />
            <span className="text-[10px] font-medium">Plan</span>
          </button>
          <button onClick={() => setActiveTab('estimator')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'estimator' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Estimator">
            <Users size={20} />
            <span className="text-[10px] font-medium">Est.</span>
          </button>
          <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'dashboard' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Dashboard">
            <BarChart3 size={20} />
            <span className="text-[10px] font-medium">Dash</span>
          </button>
          <div className="h-px bg-slate-700 w-full my-2"></div>
          <button onClick={() => setActiveTab('resources')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'resources' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Resources">
            <Users size={20} />
            <span className="text-[10px] font-medium">Res</span>
          </button>
          <button onClick={() => setActiveTab('admin')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'admin' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Admin">
            <Shield size={20} />
            <span className="text-[10px] font-medium">Admin</span>
          </button>
        </nav>
        <div className="mt-auto flex flex-col gap-4 w-full px-2">
          <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 ${activeTab === 'settings' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`} title="Settings">
            <SettingsIcon size={20} />
            <span className="text-[10px] font-medium">Set</span>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 rounded-xl transition-all flex flex-col items-center gap-1 text-red-400 hover:bg-red-500/10 hover:text-red-300" title="Logout">
            <LogOut size={20} />
            <span className="text-[10px] font-medium">Exit</span>
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-hidden flex flex-col relative h-full">
        {activeTab === 'planner' && (
          <PlannerGrid
            projects={projects}
            holidays={holidays}
            resources={resources}
            timelineStart={timelineStart}
            timelineEnd={timelineEnd}
            onExtendTimeline={(dir) => dir === 'start' ? setTimelineStart(prev => addWeeksToPoint(prev, -4)) : setTimelineEnd(prev => addWeeksToPoint(prev, 4))}
            onUpdateAllocation={updateAllocation}
            onUpdateAssignmentResourceName={updateAssignmentResourceName}
            onUpdateAssignmentDependency={updateAssignmentDependency}
            onAddTask={handleAddTask}
            onAddAssignment={handleAddAssignment}
            onCopyAssignment={() => {}} // Not implemented in this snippet
            onReorderModules={() => {}} // Not implemented
            onReorderTasks={() => {}} // Not implemented
            onReorderAssignments={() => {}} // Not implemented
            onShiftTask={() => {}} // Not implemented
            onUpdateAssignmentSchedule={async (assignmentId, startDate, duration) => {
                 const updatedProjects = deepClone(projects);
                 // Find and update in state
                 for(const p of updatedProjects) {
                     for(const m of p.modules) {
                         for(const t of m.tasks) {
                             const a = t.assignments.find(x => x.id === assignmentId);
                             if(a) { a.startDate = startDate; a.duration = duration; break; }
                         }
                     }
                 }
                 setProjects(updatedProjects);
                 await callSupabase('UPDATE schedule', { assignmentId, startDate, duration }, supabase.from('task_assignments').update({ start_date: startDate, duration }).eq('id', assignmentId));
            }}
            onUpdateAssignmentProgress={async (assignmentId, progress) => {
                 const updatedProjects = deepClone(projects);
                 // Find and update in state
                 for(const p of updatedProjects) {
                     for(const m of p.modules) {
                         for(const t of m.tasks) {
                             const a = t.assignments.find(x => x.id === assignmentId);
                             if(a) { a.progress = progress; break; }
                         }
                     }
                 }
                 setProjects(updatedProjects);
                 await callSupabase('UPDATE progress', { assignmentId, progress }, supabase.from('task_assignments').update({ progress }).eq('id', assignmentId));
            }}
            onAddProject={async () => {
                const id = crypto.randomUUID();
                const name = "New Project";
                setProjects([...projects, { id, name, modules: [] }]);
                await callSupabase('INSERT project', { id, name }, supabase.from('projects').insert({ id, name, user_id: session.user.id }));
            }}
            onAddModule={async (projectId) => {
                const updated = deepClone(projects);
                const p = updated.find(x => x.id === projectId);
                if (!p) return;
                const moduleId = crypto.randomUUID();
                const newModule: ProjectModule = { id: moduleId, name: "New Module", tasks: [], legacyFunctionPoints: 0, functionPoints: 0 };
                p.modules.push(newModule);
                setProjects(updated);
                await callSupabase('INSERT module', { moduleId }, supabase.from('project_modules').insert({ id: moduleId, project_id: projectId, user_id: session.user.id, name: "New Module" }));
            }}
            onUpdateProjectName={async (id, name) => {
                const updated = deepClone(projects);
                const p = updated.find(x => x.id === id);
                if(p) p.name = name;
                setProjects(updated);
                await callSupabase('UPDATE project', { id, name }, supabase.from('projects').update({ name }).eq('id', id));
            }}
            onUpdateModuleName={async (pid, mid, name) => {
                 const updated = deepClone(projects);
                 const m = updated.find(p => p.id === pid)?.modules.find(m => m.id === mid);
                 if(m) m.name = name;
                 setProjects(updated);
                 await callSupabase('UPDATE module', { mid, name }, supabase.from('project_modules').update({ name }).eq('id', mid));
            }}
            onUpdateTaskName={async (pid, mid, tid, name) => {
                 const updated = deepClone(projects);
                 const t = updated.find(p => p.id === pid)?.modules.find(m => m.id === mid)?.tasks.find(t => t.id === tid);
                 if(t) t.name = name;
                 setProjects(updated);
                 await callSupabase('UPDATE task', { tid, name }, supabase.from('project_tasks').update({ name }).eq('id', tid));
            }}
            onDeleteProject={async (id) => {
                setProjects(projects.filter(p => p.id !== id));
                await callSupabase('DELETE project', { id }, supabase.from('projects').delete().eq('id', id));
            }}
            onDeleteModule={async (pid, mid) => {
                const updated = deepClone(projects);
                const p = updated.find(x => x.id === pid);
                if(p) p.modules = p.modules.filter(m => m.id !== mid);
                setProjects(updated);
                await callSupabase('DELETE module', { mid }, supabase.from('project_modules').delete().eq('id', mid));
            }}
            onDeleteTask={async (pid, mid, tid) => {
                const updated = deepClone(projects);
                const m = updated.find(p => p.id === pid)?.modules.find(m => m.id === mid);
                if(m) m.tasks = m.tasks.filter(t => t.id !== tid);
                setProjects(updated);
                await callSupabase('DELETE task', { tid }, supabase.from('project_tasks').delete().eq('id', tid));
            }}
            onDeleteAssignment={async (pid, mid, tid, aid) => {
                const updated = deepClone(projects);
                const t = updated.find(p => p.id === pid)?.modules.find(m => m.id === mid)?.tasks.find(t => t.id === tid);
                if(t) t.assignments = t.assignments.filter(a => a.id !== aid);
                setProjects(updated);
                await callSupabase('DELETE assignment', { aid }, supabase.from('task_assignments').delete().eq('id', aid));
            }}
            onImportPlan={() => {}} // Placeholder
            onShowHistory={() => setShowHistory(true)}
            onRefresh={loadData}
            saveStatus={saveStatus}
            isRefreshing={isRefreshing}
          />
        )}
        
        {activeTab === 'estimator' && (
          <div className="p-4 h-full overflow-hidden">
             <Estimator 
                projects={projects}
                holidays={holidays}
                onUpdateFunctionPoints={() => {}} // Simplified for this reconstruction
                onUpdateModuleComplexity={() => {}}
                onUpdateModuleStartDate={() => {}}
                onUpdateModuleDeliveryTask={() => {}}
                onUpdateModuleStartTask={() => {}}
                onReorderModules={() => {}}
             />
          </div>
        )}

        {activeTab === 'dashboard' && (
           <div className="p-4 h-full overflow-hidden bg-slate-100">
              <Dashboard projects={projects} />
           </div>
        )}

        {activeTab === 'resources' && (
          <div className="p-4 h-full overflow-y-auto">
             <Resources 
                resources={resources}
                onAddResource={async (name, category, region, type) => {
                    const id = crypto.randomUUID();
                    const newRes = { id, name, category, holiday_region: region, type, individual_holidays: [] };
                    setResources([...resources, newRes]);
                    await callSupabase('INSERT resource', newRes, supabase.from('resources').insert({ ...newRes, user_id: session.user.id }));
                }}
                onDeleteResource={async (id) => {
                    setResources(resources.filter(r => r.id !== id));
                    await callSupabase('DELETE resource', { id }, supabase.from('resources').delete().eq('id', id));
                }}
                onUpdateResourceCategory={async (id, category) => {
                    setResources(resources.map(r => r.id === id ? { ...r, category } : r));
                    await callSupabase('UPDATE resource', { id, category }, supabase.from('resources').update({ category }).eq('id', id));
                }}
                onUpdateResourceRegion={async (id, region) => {
                    setResources(resources.map(r => r.id === id ? { ...r, holiday_region: region || undefined } : r));
                    await callSupabase('UPDATE resource', { id, region }, supabase.from('resources').update({ holiday_region: region }).eq('id', id));
                }}
                onUpdateResourceType={async (id, type) => {
                    setResources(resources.map(r => r.id === id ? { ...r, type } : r));
                    await callSupabase('UPDATE resource', { id, type }, supabase.from('resources').update({ type }).eq('id', id));
                }}
                onAddIndividualHoliday={async (resourceId, items) => {
                    const newItems = items.map(i => ({ id: crypto.randomUUID(), resource_id: resourceId, ...i }));
                    const updated = deepClone(resources);
                    const r = updated.find(x => x.id === resourceId);
                    if(r) r.individual_holidays = [...(r.individual_holidays || []), ...newItems];
                    setResources(updated);
                    await callSupabase('INSERT holidays', { items }, supabase.from('individual_holidays').insert(newItems.map(i => ({ ...i, user_id: session.user.id }))));
                }}
                onDeleteIndividualHoliday={async (id) => {
                    const updated = deepClone(resources);
                    for(const r of updated) {
                        if(r.individual_holidays) r.individual_holidays = r.individual_holidays.filter(h => h.id !== id);
                    }
                    setResources(updated);
                    await callSupabase('DELETE holiday', { id }, supabase.from('individual_holidays').delete().eq('id', id));
                }}
             />
          </div>
        )}

        {activeTab === 'admin' && (
           <div className="p-4 h-full overflow-hidden">
             <AdminSettings 
                holidays={holidays}
                onAddHolidays={async (newHolidays) => {
                    const withIds = newHolidays.map(h => ({ ...h, id: crypto.randomUUID(), user_id: session.user.id }));
                    setHolidays([...holidays, ...withIds]);
                    await callSupabase('INSERT holidays', { count: withIds.length }, supabase.from('holidays').insert(withIds));
                }}
                onDeleteHoliday={async (id) => {
                    setHolidays(holidays.filter(h => h.id !== id));
                    await callSupabase('DELETE holiday', { id }, supabase.from('holidays').delete().eq('id', id));
                }}
                onDeleteHolidaysByCountry={async (country) => {
                    setHolidays(holidays.filter(h => h.country !== country));
                    await callSupabase('DELETE holidays country', { country }, supabase.from('holidays').delete().eq('country', country));
                }}
             />
           </div>
        )}

        {activeTab === 'settings' && (
           <div className="p-4 h-full overflow-y-auto max-w-3xl mx-auto">
              <Settings 
                isDebugLogEnabled={isDebugLogEnabled}
                setIsDebugLogEnabled={setIsDebugLogEnabled}
                isAIEnabled={isAIEnabled}
                setIsAIEnabled={setIsAIEnabled}
              />
           </div>
        )}
        
        {isAIEnabled && <AIAssistant projects={projects} resources={resources} onAddTask={handleAddTask} onAssignResource={async (pid, mid, tid, aid, name) => updateAssignmentResourceName(pid, mid, tid, aid, name)} />}
        
        {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
        
        {showHistory && (
          <VersionHistory 
            onClose={() => setShowHistory(false)}
            onRestore={() => alert("Restore not implemented in this demo")}
            onSaveCurrent={async (name) => {
                await callSupabase('SAVE version', { name }, supabase.from('versions').insert({ name, user_id: session.user.id, data: projects }));
            }}
          />
        )}
      </main>
    </div>
  );
}