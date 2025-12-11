
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ALL_WEEK_IDS, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getDateFromWeek, getWeekIdFromDate } from './constants';
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
import { generateId } from './lib/id';

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
        dependencies: t.dependencies || [],
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
    })).sort((a: any, b: any) => a.sort_order - b.sort_order), // Sort modules
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
  
  const saveQueueRef = useRef(new Map());
  const debounceTimeoutRef = useRef<number | null>(null);

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

  const fetchData = useCallback(async () => {
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
            id, name, start_week_id, duration, dependencies,
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
         const defaultProjectId = generateId('proj');
         const { data, error } = await supabase.from('projects').insert({ id: defaultProjectId, name: 'My First Project', user_id: session!.user.id }).select().single();
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
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session, fetchData]);

  // Auto-adjust timeline based on project data
  useEffect(() => {
    if (loading) return; // Don't run while loading

    if (projects.length === 0) {
        // If there are no projects, reset to a default view around today
        const todayWeekId = getWeekIdFromDate(new Date());
        const [yearStr, weekStr] = todayWeekId.split('-');
        const todayPoint: WeekPoint = { year: parseInt(yearStr), week: parseInt(weekStr) };
        setTimelineStart(addWeeksToPoint(todayPoint, -4));
        setTimelineEnd(addWeeksToPoint(todayPoint, 48));
        return;
    }

    let earliestWeekId: string | undefined;
    let latestWeekId: string | undefined;

    projects.forEach(p => {
      p.modules.forEach(m => {
        m.tasks.forEach(t => {
          if (t.startWeekId) {
            if (!earliestWeekId || t.startWeekId < earliestWeekId) {
              earliestWeekId = t.startWeekId;
            }
            
            const duration = t.duration || 1; // weeks
            const [startYear, startWeek] = t.startWeekId.split('-').map(Number);
            const startDate = getDateFromWeek(startYear, startWeek);
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + (duration * 7));
            const endWeekId = getWeekIdFromDate(endDate);

            if (!latestWeekId || endWeekId > latestWeekId) {
              latestWeekId = endWeekId;
            }
          }
        });
      });
    });

    const todayWeekId = getWeekIdFromDate(new Date());

    let finalStartWeekId: string;
    if (earliestWeekId) {
      finalStartWeekId = todayWeekId < earliestWeekId ? todayWeekId : earliestWeekId;
    } else {
      finalStartWeekId = todayWeekId;
    }
    
    const [startYear, startWeek] = finalStartWeekId.split('-').map(Number);
    const newStartPoint: WeekPoint = { year: startYear, week: startWeek };
    setTimelineStart(addWeeksToPoint(newStartPoint, -4));

    if (latestWeekId) {
        const [endYear, endWeek] = latestWeekId.split('-').map(Number);
        const newEndPoint: WeekPoint = { year: endYear, week: endWeek };
        setTimelineEnd(addWeeksToPoint(newEndPoint, 4));
    } else {
        // if no tasks with dates, set end relative to start
        setTimelineEnd(addWeeksToPoint(newStartPoint, 52));
    }

  }, [projects, loading]);

  const commitAllocationSaves = useCallback(async () => {
    if (!session || saveQueueRef.current.size === 0) return;

    const updates = Array.from(saveQueueRef.current.values());
    saveQueueRef.current.clear();
    
    const upsertData = updates.map(item => ({
        id: item.existingAllocId,
        assignment_id: item.assignmentId,
        user_id: session.user.id,
        week_id: item.weekId,
        count: item.allocation.count,
        days: item.allocation.days
    }));

    const { error } = await supabase.from('resource_allocations').upsert(upsertData);

    if (error) {
        console.error("Failed to save allocations:", error);
        alert("Error: Some changes could not be saved. Re-syncing data.");
        fetchData();
    }
  }, [session, fetchData]);

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') setTimelineStart(prev => addWeeksToPoint(prev, -4));
    else setTimelineEnd(prev => addWeeksToPoint(prev, 4));
  };
  
  const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    // Optimistic update
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
                const newAlloc: ResourceAllocation = { weekId, count: value, days: {} };
                 if(dayDate) {
                   const weekdays = getWeekdaysForWeekId(weekId);
                   const days = weekdays.reduce((acc, day) => ({...acc, [day]: 0}), {} as Record<string, number>);
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

    // DB update queue
    if (allocationToUpdate) {
        const { data: existingAlloc } = await supabase
            .from('resource_allocations')
            .select('id')
            .eq('assignment_id', assignmentId)
            .eq('week_id', weekId)
            .maybeSingle();

        const queueKey = `${assignmentId}-${weekId}`;
        saveQueueRef.current.set(queueKey, {
            existingAllocId: existingAlloc?.id,
            assignmentId,
            weekId,
            allocation: allocationToUpdate,
        });

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = window.setTimeout(commitAllocationSaves, 2000);
    }
  };

  const addProject = async () => {
    const newId = generateId('proj');
    const { data, error } = await supabase.from('projects').insert({ id: newId, name: `New Project ${projects.length + 1}`, user_id: session!.user.id }).select().single();
    if (error) {
        console.error("Error adding project:", error);
        alert("Could not create project.");
    }
    else {
        setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]);
    }
  };
  
  const deleteProject = async (projectId: string) => {
    const previousState = projects;
    setProjects(prev => prev.filter(p => p.id !== projectId));
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete project.");
    }
  };
  
  const updateProjectName = async (projectId: string, name: string) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
    const { error } = await supabase.from('projects').update({ name }).eq('id', projectId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update project name.");
    }
  };
  
  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
     const previousState = projects;
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, name} : m) } : p));
     const { error } = await supabase.from('modules').update({ name }).eq('id', moduleId);
     if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update module name.");
     }
  };
  
  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, name} : t) } : m) } : p));
    const { error } = await supabase.from('tasks').update({ name }).eq('id', taskId);
    if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update task name.");
    }
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, modules: p.modules.map(m => {
        if (m.id !== moduleId) return m;
        return { ...m, tasks: m.tasks.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, resourceName: name } : a)};
        })};
      })};
    }));
    const { error } = await supabase.from('task_assignments').update({ resource_name: name }).eq('id', assignmentId);
    if (error) {
      console.error(error);
      setProjects(previousState);
      alert("Failed to update resource name.");
    }
  };

  const updateAssignmentRole = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, modules: p.modules.map(m => {
        if (m.id !== moduleId) return m;
        return { ...m, tasks: m.tasks.map(t => {
          if (t.id !== taskId) return t;
          return { ...t, assignments: t.assignments.map(a => a.id === assignmentId ? { ...a, role } : a)};
        })};
      })};
    }));
    const { error } = await supabase.from('task_assignments').update({ role }).eq('id', assignmentId);
    if (error) {
      console.error(error);
      setProjects(previousState);
      alert("Failed to update assignment role.");
    }
  };
  
  const addModule = async (projectId: string) => {
    const newId = generateId('mod');
    const { data, error } = await supabase.from('modules').insert({ id: newId, name: 'New Module', project_id: projectId, user_id: session!.user.id }).select().single();
    if (error) {
        console.error(error);
        alert("Failed to add module.");
    }
    else {
        setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id: data.id, name: data.name, legacyFunctionPoints: 0, functionPoints: 0, tasks: [] }] } : p));
    }
  };
  
  const deleteModule = async (projectId: string, moduleId: string) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.filter(m => m.id !== moduleId) } : p));
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete module.");
    }
  };
  
  const addTask = async (projectId: string, moduleId: string) => {
    const taskId = generateId('task');
    const assignId = generateId('asgn');
    const taskName = 'New Task';
    const role = Role.DEV;

    const { data: taskData, error: taskError } = await supabase.from('tasks').insert({ id: taskId, name: taskName, module_id: moduleId, user_id: session!.user.id }).select().single();
    if (taskError) { console.error(taskError); alert("Failed to add task."); return; }
    
    const { data: assignData, error: assignError } = await supabase.from('task_assignments').insert({ id: assignId, task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (assignError) { 
      console.error(assignError); 
      // Rollback task creation
      await supabase.from('tasks').delete().eq('id', taskId);
      alert("Failed to create task assignment. Rolling back.");
      return; 
    }

    fetchData(); 
  };
  
  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
    const previousState = projects;
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, tasks: m.tasks.filter(t => t.id !== taskId)} : m) } : p));
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) { 
        console.error(error); 
        setProjects(previousState);
        alert("Failed to delete task.");
    }
  };
  
  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    const newId = generateId('asgn');
    const { data, error } = await supabase.from('task_assignments').insert({ id: newId, task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single();
    if (error) console.error(error);
    else fetchData();
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
     const previousState = projects;
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, assignments: t.assignments.filter(a => a.id !== assignmentId) } : t)} : m) } : p));
     const { error } = await supabase.from('task_assignments').delete().eq('id', assignmentId);
     if (error) { 
         console.error(error); 
         setProjects(previousState);
         alert("Failed to delete assignment.");
     }
  };

  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
     const previousState = projects;
     setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? {...m, legacyFunctionPoints: legacyFp, functionPoints: mvpFp} : m) } : p));
     const { error } = await supabase.from('modules').update({ legacy_function_points: legacyFp, function_points: mvpFp }).eq('id', moduleId);
     if (error) {
        console.error(error);
        setProjects(previousState);
        alert("Failed to update function points.");
     }
  };
  
  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const previousState = projects;
    const reordered = Array.from(project.modules);
    const [removed] = reordered.splice(startIndex, 1);
    reordered.splice(endIndex, 0, removed);
    
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: reordered } : p));
    
    // Update sort_order in DB
    const updates = reordered.map((module, index) => 
      supabase.from('modules').update({ sort_order: index }).eq('id', module.id)
    );
    try {
        await Promise.all(updates);
    } catch(e) {
        console.error(e);
        setProjects(previousState);
        alert("Failed to reorder modules.");
    }
  };

  // Helper to recalculate dependency chains (Gantt logic)
  const recalculateAndSaveDependencyChain = async (
    currentProjects: Project[],
    projectId: string,
    moduleId: string, 
    startTaskId: string, 
    newStartWeekId: string, 
    newDuration: number
  ) => {
    // 1. Update the starting task locally
    let updatedProjects = JSON.parse(JSON.stringify(currentProjects));
    const tasksToUpdate: { id: string, startWeekId: string }[] = [];
    
    // Recursive function to update dependents
    const updateDependentTasks = (pId: string, mId: string, tId: string, sWeekId: string, dur: number) => {
       const taskEndWeekDate = new Date(getDateFromWeek(
          parseInt(sWeekId.split('-')[0]),
          parseInt(sWeekId.split('-')[1])
       ));
       taskEndWeekDate.setDate(taskEndWeekDate.getDate() + (dur * 7));
       const finishWeekId = getWeekIdFromDate(taskEndWeekDate);

       // Find all tasks that depend on tId
       updatedProjects.forEach((p: Project) => {
          p.modules.forEach((m: ProjectModule) => {
             m.tasks.forEach((t: ProjectTask) => {
                if (t.dependencies && t.dependencies.includes(tId)) {
                   // This task 't' depends on the modified task
                   // Start date must be > finishWeekId
                   // Simplified: Start date = Finish Week of predecessor
                   
                   // Check if we need to move it forward
                   // We only move forward, typically, to respect constraint
                   const currentStart = t.startWeekId || sWeekId;
                   if (finishWeekId > currentStart) {
                      // Update logic
                      t.startWeekId = finishWeekId;
                      tasksToUpdate.push({ id: t.id, startWeekId: finishWeekId });
                      // Recurse
                      updateDependentTasks(p.id, m.id, t.id, finishWeekId, t.duration || 1);
                   }
                }
             });
          });
       });
    };

    // Apply initial update
    updatedProjects = updatedProjects.map((p: Project) => {
       if (p.id !== projectId) return p;
       return { ...p, modules: p.modules.map((m: ProjectModule) => {
          if (m.id !== moduleId) return m;
          return { ...m, tasks: m.tasks.map((t: ProjectTask) => {
             if (t.id === startTaskId) {
               return { ...t, startWeekId: newStartWeekId, duration: newDuration };
             }
             return t;
          })};
       })};
    });

    // Start recursion
    updateDependentTasks(projectId, moduleId, startTaskId, newStartWeekId, newDuration);
    
    setProjects(updatedProjects);

    // Save initial task
    await supabase.from('tasks').update({ start_week_id: newStartWeekId, duration: newDuration }).eq('id', startTaskId);

    // Save cascading updates
    for (const update of tasksToUpdate) {
       await supabase.from('tasks').update({ start_week_id: update.startWeekId }).eq('id', update.id);
    }
  };
  
  const updateTaskSchedule = async (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
     await recalculateAndSaveDependencyChain(projects, projectId, moduleId, taskId, startWeekId, duration);
  };

  const updateTaskDependencies = async (projectId: string, moduleId: string, taskId: string, dependencies: string[]) => {
      const previousState = projects;
      
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: p.modules.map(m => m.id === moduleId ? { ...m, tasks: m.tasks.map(t => t.id === taskId ? {...t, dependencies } : t) } : m) } : p));
      
      const { error } = await supabase.from('tasks').update({ dependencies }).eq('id', taskId);
      
      if (error) {
         console.error(error);
         setProjects(previousState);
         alert("Failed to update dependencies.");
      } else {
         // Trigger auto-schedule to align with new dependencies
         const task = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
         if (task && task.startWeekId) {
            // Re-run scheduling logic as if this task just changed, to ensure it respects new predecessors
            // Actually, we need to check if IT needs to move based on predecessors.
            // Simplified: We assume user places it, or we could auto-align. 
            // For now, let's leave it manual placement unless predecessor moves.
         }
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
    await supabase.from('projects').delete().eq('user_id', session!.user.id);
    await supabase.from('holidays').delete().eq('user_id', session!.user.id);
    setProjects(version.data.projects);
    setHolidays(version.data.holidays);
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
          
          <div className="p-4 border-t border-slate-800 flex items-center gap-3 overflow-hidden">
             {session.user.user_metadata.avatar_url ? (
               <img src={session.user.user_metadata.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-600" />
             ) : (
               <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                  {session.user.email?.substring(0,2).toUpperCase()}
               </div>
             )}
             {!isSidebarCollapsed && (
               <div className="overflow-hidden">
                  <p className="text-sm font-medium text-white truncate">{session.user.user_metadata.full_name || 'User'}</p>
                  <p className="text-xs text-slate-500 truncate">{session.user.email}</p>
               </div>
             )}
          </div>

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
                {activeTab === 'planner' && <PlannerGrid projects={projects} holidays={holidays} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={handleExtendTimeline} onUpdateAllocation={updateAllocation} onUpdateAssignmentRole={updateAssignmentRole} onUpdateAssignmentResourceName={updateAssignmentResourceName} onAddTask={addTask} onAddAssignment={addAssignment} onReorderModules={reorderModules} onShiftTask={async () => {}} onShiftAssignment={async () => {}} onUpdateTaskSchedule={updateTaskSchedule} onAddProject={addProject} onAddModule={addModule} onUpdateProjectName={updateProjectName} onUpdateModuleName={updateModuleName} onUpdateTaskName={updateTaskName} onDeleteProject={deleteProject} onDeleteModule={deleteModule} onDeleteTask={deleteTask} onDeleteAssignment={deleteAssignment} onImportPlan={() => {}} onShowHistory={() => setShowHistory(true)} onUpdateFunctionPoints={updateFunctionPoints} onUpdateTaskDependencies={updateTaskDependencies} />}
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
