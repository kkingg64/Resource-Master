import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GOV_HOLIDAYS_DB, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getWeekIdFromDate } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { Resources } from './components/Resources';
import { VersionHistory } from './components/VersionHistory';
import { DebugLog } from './components/DebugLog';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, Globe, ChevronLeft, ChevronRight, LogOut, Users } from 'lucide-react';
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
  const allocationsByAssignment = new Map<string, any[]>();
  allocations.forEach(a => {
    if (!allocationsByAssignment.has(a.assignment_id)) {
      allocationsByAssignment.set(a.assignment_id, []);
    }
    allocationsByAssignment.get(a.assignment_id)!.push({
      weekId: a.week_id,
      count: a.count,
      days: a.days || {},
    });
  });

  const assignmentsByTask = new Map<string, any[]>();
  assignments.forEach(a => {
    if (!assignmentsByTask.has(a.task_id)) {
      assignmentsByTask.set(a.task_id, []);
    }
    assignmentsByTask.get(a.task_id)!.push({
      id: a.id,
      role: a.role,
      resourceName: a.resource_name,
      allocations: allocationsByAssignment.get(a.id) || [],
    });
  });

  const tasksByModule = new Map<string, any[]>();
  tasks.forEach(t => {
    if (!tasksByModule.has(t.module_id)) {
      tasksByModule.set(t.module_id, []);
    }
    tasksByModule.get(t.module_id)!.push({
      id: t.id,
      name: t.name,
      startWeekId: t.start_week_id,
      duration: t.duration,
      sort_order: t.sort_order,
      assignments: (assignmentsByTask.get(t.id) || []).sort((a,b) => a.role.localeCompare(b.role)),
    });
  });

  const modulesByProject = new Map<string, any[]>();
  modules.forEach(m => {
    if (!modulesByProject.has(m.project_id)) {
      modulesByProject.set(m.project_id, []);
    }
    const moduleTasks = (tasksByModule.get(m.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    modulesByProject.get(m.project_id)!.push({
      id: m.id,
      name: m.name,
      legacyFunctionPoints: m.legacy_function_points,
      functionPoints: m.function_points,
      sort_order: m.sort_order,
      tasks: moduleTasks,
    });
  });

  return projects.map(p => ({
    id: p.id,
    name: p.name,
    modules: (modulesByProject.get(p.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  })).sort((a,b) => a.name.localeCompare(b.name));
};

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const App: React.FC = () => {
  const [session, setSession] = useState<any | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'holiday' | 'settings' | 'resources'>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const statusTimeoutRef = useRef<number>();

  useEffect(() => {
    return () => clearTimeout(statusTimeoutRef.current);
  }, []);

  // Debug Log State
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const nextLogId = useRef(0);
  
  const log = (message: string, payload: any, status: LogEntry['status'] = 'pending'): number => {
    if (!isDebugLogEnabled) return -1;
    const id = nextLogId.current++;
    // FIX: Changed to parameter-less toLocaleTimeString() to fix "Expected 1 arguments, but got 0" error.
    const newEntry: LogEntry = { id, timestamp: new Date().toLocaleTimeString(), message, payload, status };
    setLogEntries(prev => [newEntry, ...prev.slice(0, 99)]);
    return id;
  };

  const updateLog = (id: number, status: 'success' | 'error', payload?: any) => {
    if (id === -1) return;
    setLogEntries(prev => prev.map(entry =>
      entry.id === id ? { ...entry, status, payload: payload || entry.payload } : entry
    ));
  };
  
  const callSupabase = async (
    message: string,
    payload: any,
    supabasePromise: PromiseLike<{ data: any; error: any }>
  ) => {
    const logId = log(message, payload);
    setSaveStatus('saving');
    clearTimeout(statusTimeoutRef.current);
    
    const result = await supabasePromise;
    if (result.error) {
      updateLog(logId, 'error', result.error);
      setSaveStatus('error');
    } else {
      updateLog(logId, 'success', result.data);
      setSaveStatus('success');
    }
    
    statusTimeoutRef.current = window.setTimeout(() => setSaveStatus('idle'), 3000);

    return result;
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchData();
    }
  }, [session]);
  
  const dateToCountryMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const countryCode in GOV_HOLIDAYS_DB) {
      for (const holiday of GOV_HOLIDAYS_DB[countryCode]) {
        map.set(holiday.date, holiday.country);
      }
    }
    return map;
  }, []);

  const fetchData = async (isRefresh: boolean = false) => {
    if (!session) return;
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    // Fetch projects
    const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
    if (projectsError) { console.error("Error fetching projects", projectsError); setLoading(false); return; }

    let finalProjectsData = projectsData;
    if (projectsData && projectsData.length === 0) {
      const { data: newProject, error: newProjectError } = await callSupabase(
        'CREATE default project', { name: 'My First Project' },
        supabase.from('projects').insert({ name: 'My First Project', user_id: session!.user.id }).select().single()
      );
      if (newProject && !newProjectError) { finalProjectsData = [newProject]; }
    }
    
    const projectIds = finalProjectsData.map(p => p.id);
    let modulesData = [], tasksData = [], assignmentsData = [], allocationsData = [];

    if (projectIds.length > 0) {
      const { data: modules, error: modulesError } = await supabase.from('modules').select('*').in('project_id', projectIds);
      if (modulesError) console.error(modulesError); else modulesData = modules;
      
      const moduleIds = modulesData.map(m => m.id);
      if (moduleIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*').in('module_id', moduleIds);
        if (tasksError) console.error(tasksError); else tasksData = tasks;

        const taskIds = tasksData.map(t => t.id);
        if (taskIds.length > 0) {
          const { data: assignments, error: assignmentsError } = await supabase.from('task_assignments').select('*').in('task_id', taskIds);
          if (assignmentsError) console.error(assignmentsError); else assignmentsData = assignments;
          
          const assignmentIds = assignmentsData.map(a => a.id);
          if (assignmentIds.length > 0) {
            const { data: allocations, error: allocationsError } = await supabase.from('resource_allocations').select('*').in('assignment_id', assignmentIds);
            if (allocationsError) console.error(allocationsError); else allocationsData = allocations;
          }
        }
      }
    }
    setProjects(structureProjectsData(finalProjectsData, modulesData, tasksData, assignmentsData, allocationsData));

    // Fetch holidays and resources in parallel
    const [holidaysResponse, resourcesResponse] = await Promise.all([
      supabase.from('holidays').select('id, date, name').eq('user_id', session.user.id),
      supabase.from('resources').select('*').eq('user_id', session.user.id).order('name')
    ]);

    if (holidaysResponse.data) {
      const hydratedHolidays = holidaysResponse.data.map(h => ({
        ...h,
        id: h.id.toString(),
        country: dateToCountryMap.get(h.date) || 'Global'
      }));
      setHolidays(hydratedHolidays);
    }
    if (resourcesResponse.data) setResources(resourcesResponse.data);

    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
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
                weekdays.forEach(d => (alloc.days as {[key: string]: number})[d] = alloc.count / 5);
            }
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
            const days = weekdays.reduce((acc, day) => ({...acc, [day]: 0}), {} as {[key: string]: number});
            days[dayDate] = value;
            newAlloc.days = days;
            newAlloc.count = Object.values(days).reduce((sum, v) => sum + v, 0);
        }
        assignment.allocations.push(newAlloc);
        allocationToUpdate = newAlloc;
    } else {
        const alloc = assignment.allocations[allocIndex];
        if (alloc && dayDate && alloc.days && alloc.days[dayDate] !== undefined) {
             delete alloc.days[dayDate];
             alloc.count = Object.values(alloc.days).reduce((sum: number, v: number) => sum + v, 0);
             allocationToUpdate = alloc;
        }
    }

    setProjects(updatedProjects);

    if (allocationToUpdate) {
        const { data: existingAlloc } = await supabase.from('resource_allocations').select('id').eq('assignment_id', assignmentId).eq('week_id', weekId).maybeSingle();
        const upsertData = { id: existingAlloc?.id, assignment_id: assignmentId, user_id: session!.user.id, week_id: weekId, count: allocationToUpdate.count, days: allocationToUpdate.days };
        const { error } = await callSupabase('UPSERT allocation', upsertData, supabase.from('resource_allocations').upsert(upsertData));
        if (error) { setProjects(previousState); alert("Error: Could not save allocation."); }
    }
  };

  const addProject = async () => {
    const { data, error } = await callSupabase(
        'CREATE project', { name: `New Project ${projects.length + 1}` },
        supabase.from('projects').insert({ name: `New Project ${projects.length + 1}`, user_id: session!.user.id }).select().single()
    );
    if (error) { alert("Could not create project."); }
    else { setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]); }
  };
  
  const deleteProject = async (projectId: string) => {
    const previousState = deepClone(projects);
    setProjects(prev => prev.filter(p => p.id !== projectId));
    const { error } = await callSupabase('DELETE project', { id: projectId }, supabase.from('projects').delete().eq('id', projectId));
    if (error) { setProjects(previousState); alert("Failed to delete project."); }
  };
  
  const updateProjectName = async (projectId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (project) { project.name = name; setProjects(updatedProjects); }

    const { error } = await callSupabase('UPDATE project name', { id: projectId, name }, supabase.from('projects').update({ name }).eq('id', projectId));
    if (error) { setProjects(previousState); alert("Failed to update project name."); }
  };
  
  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
     const previousState = deepClone(projects);
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     const module = project?.modules.find(m => m.id === moduleId);
     if (module) { module.name = name; setProjects(updatedProjects); }
     
     const { error } = await callSupabase('UPDATE module name', { id: moduleId, name }, supabase.from('modules').update({ name }).eq('id', moduleId));
     if (error) { setProjects(previousState); alert("Failed to update module name."); }
  };
  
  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
    if (task) { task.name = name; setProjects(updatedProjects); }
    
    const { error } = await callSupabase('UPDATE task name', { id: taskId, name }, supabase.from('tasks').update({ name }).eq('id', taskId));
    if (error) { setProjects(previousState); alert("Failed to update task name."); }
  };
  
  const addModule = async (projectId: string) => {
    const { data, error } = await callSupabase(
        'CREATE module', { name: 'New Module', projectId },
        supabase.from('modules').insert({ name: 'New Module', project_id: projectId, user_id: session!.user.id }).select().single()
    );
    if (error) { alert("Failed to add module."); }
    else { setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id: data.id, name: data.name, legacyFunctionPoints: 0, functionPoints: 0, tasks: [] }] } : p)); }
  };
  
  const deleteModule = async (projectId: string, moduleId: string) => {
    const previousState = deepClone(projects);
    const project = projects.find(p => p.id === projectId);
    if (project) setProjects(projects.map(p => p.id === projectId ? {...p, modules: p.modules.filter(m => m.id !== moduleId)} : p));
    
    const { error } = await callSupabase('DELETE module', { id: moduleId }, supabase.from('modules').delete().eq('id', moduleId));
    if (error) { setProjects(previousState); alert("Failed to delete module."); }
  };
  
  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    const startWeekId = getWeekIdFromDate(new Date());
    const duration = 1;

    const { data: taskData, error: taskError } = await callSupabase('CREATE task', { taskId, taskName }, supabase.from('tasks').insert({ 
      id: taskId, 
      name: taskName, 
      module_id: moduleId, 
      user_id: session!.user.id,
      start_week_id: startWeekId,
      duration: duration
    }).select().single());

    if (taskError) { alert("Failed to add task."); return; }
    
    const { error: assignError } = await callSupabase('CREATE assignment', { taskId, role }, supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single());
    if (assignError) { return; }

    fetchData();
  };
  
  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
    const previousState = deepClone(projects);
    const project = projects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    if (module) setProjects(projects.map(p => p.id === projectId ? {...p, modules: p.modules.map(m => m.id === moduleId ? {...m, tasks: m.tasks.filter(t => t.id !== taskId)}: m)} : p));
    
    const { error } = await callSupabase('DELETE task', { id: taskId }, supabase.from('tasks').delete().eq('id', taskId));
    if (error) { setProjects(previousState); alert("Failed to delete task."); }
  };
  
  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    const { error } = await callSupabase(
        'CREATE assignment', { taskId, role },
        supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id }).select().single()
    );
    if (!error) fetchData();
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
     const previousState = deepClone(projects);
     setProjects(prev => {
        const updatedProjects = deepClone(prev);
        const project = updatedProjects.find(p => p.id === projectId);
        if (project) {
          const module = project.modules.find(m => m.id === moduleId);
          if (module) {
            const task = module.tasks.find(t => t.id === taskId);
            if (task) {
              task.assignments = task.assignments.filter(a => a.id !== assignmentId);
            }
          }
        }
        return updatedProjects;
     });
     
     const { error } = await callSupabase('DELETE assignment', { id: assignmentId }, supabase.from('task_assignments').delete().eq('id', assignmentId));
     if (error) { setProjects(previousState); alert("Failed to delete assignment."); } else { fetchData(); }
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const assignment = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId)?.assignments.find(a => a.id === assignmentId);
    if (assignment) {
      assignment.resourceName = name;
    }
    setProjects(updatedProjects);

    const { error } = await callSupabase('UPDATE assignment resource name', { id: assignmentId, name }, supabase.from('task_assignments').update({ resource_name: name }).eq('id', assignmentId));
    if (error) { setProjects(previousState); alert("Failed to update resource name."); }
  };

  const updateAssignmentRole = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const assignment = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId)?.assignments.find(a => a.id === assignmentId);
    if (assignment) {
      assignment.role = role;
    }
    setProjects(updatedProjects);

    const { error } = await callSupabase('UPDATE assignment role', { id: assignmentId, role }, supabase.from('task_assignments').update({ role }).eq('id', assignmentId));
    if (error) { setProjects(previousState); alert("Failed to update role."); }
  };

  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => {
     const previousState = deepClone(projects);
     const module = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
     if (module) {
        module.legacyFunctionPoints = legacyFp;
        module.functionPoints = mvpFp;
        setProjects(deepClone(projects));
     }
     
     const { error } = await callSupabase('UPDATE function points', { id: moduleId, legacyFp, mvpFp }, supabase.from('modules').update({ legacy_function_points: legacyFp, function_points: mvpFp }).eq('id', moduleId));
     if (error) { setProjects(previousState); alert("Failed to update function points."); }
  };
  
  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (!project) return;
    
    const [removed] = project.modules.splice(startIndex, 1);
    project.modules.splice(endIndex, 0, removed);
    setProjects(updatedProjects);
    
    const updates = project.modules.map((module, index) => ({ 
      id: module.id, 
      sort_order: index, 
      project_id: projectId,
      user_id: session!.user.id 
    }));
    
    const { error } = await callSupabase('REORDER modules', { updates }, supabase.from('modules').upsert(updates));
    if (error) { setProjects(previousState); alert("Failed to reorder modules."); }
  };

  const reorderTasks = async (projectId: string, moduleId: string, startIndex: number, endIndex: number) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    if (!project) return;
    const module = project.modules.find(m => m.id === moduleId);
    if (!module) return;

    const [removed] = module.tasks.splice(startIndex, 1);
    module.tasks.splice(endIndex, 0, removed);
    setProjects(updatedProjects);

    const updates = module.tasks.map((task, index) => ({
      id: task.id,
      sort_order: index,
      module_id: moduleId,
      user_id: session!.user.id
    }));
    
    const { error } = await callSupabase('REORDER tasks', { updates }, supabase.from('tasks').upsert(updates));
    if (error) { 
        setProjects(previousState); 
        alert("Failed to reorder tasks."); 
    }
  };
  
  const updateTaskSchedule = async (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => {
     const previousState = deepClone(projects);
     const task = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
     if (task) { task.startWeekId = startWeekId; task.duration = duration; setProjects(deepClone(projects)); }
     
     const { error } = await callSupabase('UPDATE task schedule', { id: taskId, startWeekId, duration }, supabase.from('tasks').update({ start_week_id: startWeekId, duration }).eq('id', taskId));
     if (error) { setProjects(previousState); alert("Failed to update task schedule."); }
  };
  
  const handleSaveVersion = async (name: string) => {
    const { error } = await callSupabase('SAVE version', { name }, supabase.from('versions').insert({ name, user_id: session!.user.id, data: { projects, holidays, resources } }));
    if (error) { alert("Error: Could not save version."); } 
    else { alert(`Version '${name}' saved successfully!`); }
  };

  const handleRestoreVersion = async (id: number) => {
    const { data: version, error } = await callSupabase('FETCH version for restore', { id }, supabase.from('versions').select('data').eq('id', id).single());
    if (error || !version) { alert("Error: Version not found."); return; }
    
    log('Start restoring version', { id });
    await supabase.from('projects').delete().eq('user_id', session!.user.id);
    await supabase.from('holidays').delete().eq('user_id', session!.user.id);
    await supabase.from('resources').delete().eq('user_id', session!.user.id);
    
    setProjects(version.data.projects || []);
    setHolidays(version.data.holidays || []);
    setResources(version.data.resources || []);
    
    alert(`Version restored. Any new changes will be saved to your current state.`);
    setShowHistory(false);
  };

  // --- Resource Management ---
  const addResource = async (name: string, category: Role) => {
    const { data, error } = await callSupabase(
      'CREATE resource', { name, category },
      supabase.from('resources').insert({ name, category, user_id: session!.user.id }).select().single()
    );
    if (error) { alert('Failed to add resource.'); } 
    else { setResources(prev => [...prev, data]); }
  };

  const deleteResource = async (id: string) => {
    const previousState = deepClone(resources);
    setResources(prev => prev.filter(r => r.id !== id));
    const { error } = await callSupabase('DELETE resource', { id }, supabase.from('resources').delete().eq('id', id));
    if (error) { setResources(previousState); alert('Failed to delete resource.'); }
  };

  // --- Holiday Management ---
  const addHolidays = async (holidaysToAdd: Omit<Holiday, 'id'>[]) => {
    // Exclude country from insert to prevent errors if column doesn't exist in DB
    const holidaysToInsert = holidaysToAdd.map(h => ({ date: h.date, name: h.name, user_id: session!.user.id }));
    const { error } = await callSupabase(
        'SYNC holidays', { count: holidaysToInsert.length, country: holidaysToAdd[0]?.country },
        supabase.from('holidays').upsert(holidaysToInsert, { onConflict: 'user_id,date' })
    );
    if (error) { alert('Failed to sync holidays.'); } 
    else { fetchData(true); }
  };
  
  const deleteHoliday = async (id: string) => {
    const previousState = deepClone(holidays);
    setHolidays(prev => prev.filter(h => h.id !== id));
    const { error } = await callSupabase('DELETE holiday', { id }, supabase.from('holidays').delete().eq('id', id));
    if (error) { setHolidays(previousState); alert('Failed to delete holiday.'); }
  };
  
  const deleteHolidaysByCountry = async (country: string) => {
    const previousState = deepClone(holidays);
    const datesToDelete = GOV_HOLIDAYS_DB[country]?.map(h => h.date) || [];
    if (datesToDelete.length === 0) return;

    setHolidays(prev => prev.filter(h => !datesToDelete.includes(h.date)));
    const { error } = await callSupabase(
      'DELETE holidays by country', 
      { country, dates: datesToDelete.length }, 
      supabase.from('holidays').delete().in('date', datesToDelete).eq('user_id', session!.user.id)
    );
    if (error) { setHolidays(previousState); alert(`Failed to delete holidays for ${country}.`); }
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
      {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
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
            <button onClick={() => setActiveTab('resources')} title="Resources" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Users size={20} />{!isSidebarCollapsed && <span className="font-medium">Resources</span>}</button>
            <button onClick={() => setActiveTab('holiday')} title="Holidays" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-4 py-3 rounded-lg ${activeTab === 'holiday' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Globe size={20} />{!isSidebarCollapsed && <span className="font-medium">Holidays</span>}</button>
          </nav>
          <div className="p-2 border-t border-slate-800">
            <div className={`p-2 ${isSidebarCollapsed ? '' : 'mb-2'}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-500 text-white flex items-center justify-center font-bold rounded-full flex-shrink-0">
                  {session.user.email ? session.user.email[0].toUpperCase() : 'U'}
                </div>
                {!isSidebarCollapsed && (
                  <div className="overflow-hidden">
                    <p className="text-sm font-semibold text-white truncate" title={session.user.email}>{session.user.email}</p>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <button onClick={() => setActiveTab('settings')} title="Settings" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 text-sm rounded-lg ${activeTab === 'settings' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}><SettingsIcon size={16} />{!isSidebarCollapsed && <span>Settings</span>}</button>
              <button onClick={() => supabase.auth.signOut()} title="Sign Out" className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : ''} gap-3 px-3 py-2 text-sm rounded-lg text-slate-400 hover:text-white hover:bg-slate-800`}><LogOut size={16} />{!isSidebarCollapsed && <span>Sign Out</span>}</button>
            </div>
          </div>
        </aside>
        <main className="flex-1 flex flex-col overflow-hidden">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8"><h1 className="text-xl font-bold text-slate-800">{activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</h1></header>
          <div className="flex-1 overflow-auto p-6">
            {loading ? <div className="text-center p-8 text-slate-500">Loading your data...</div> : (
              <>
                {activeTab === 'dashboard' && <Dashboard projects={projects} />}
                {activeTab === 'planner' && <PlannerGrid projects={projects} resources={resources} holidays={holidays} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={handleExtendTimeline} onUpdateAllocation={updateAllocation} onUpdateAssignmentRole={updateAssignmentRole} onUpdateAssignmentResourceName={updateAssignmentResourceName} onAddTask={addTask} onAddAssignment={addAssignment} onReorderModules={reorderModules} onReorderTasks={reorderTasks} onShiftTask={async () => {}} onShiftAssignment={async () => {}} onUpdateTaskSchedule={updateTaskSchedule} onAddProject={addProject} onAddModule={addModule} onUpdateProjectName={updateProjectName} onUpdateModuleName={updateModuleName} onUpdateTaskName={updateTaskName} onDeleteProject={deleteProject} onDeleteModule={deleteModule} onDeleteTask={deleteTask} onDeleteAssignment={deleteAssignment} onImportPlan={() => {}} onShowHistory={() => setShowHistory(true)} onUpdateFunctionPoints={updateFunctionPoints} onRefresh={() => fetchData(true)} saveStatus={saveStatus} isRefreshing={isRefreshing} />}
                {activeTab === 'estimator' && <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full"><div className="lg:col-span-1 h-fit"><Estimator projects={projects} onUpdateFunctionPoints={updateFunctionPoints} onReorderModules={reorderModules}/></div><div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex items-center justify-center flex-col text-slate-400"><Calculator className="w-16 h-16 mb-4 opacity-20" /><h3 className="text-lg font-medium text-slate-600">Effort Estimation</h3></div></div>}
                {activeTab === 'resources' && <Resources resources={resources} onAddResource={addResource} onDeleteResource={deleteResource} />}
                {activeTab === 'holiday' && <AdminSettings holidays={holidays} onAddHolidays={addHolidays} onDeleteHoliday={deleteHoliday} onDeleteHolidaysByCountry={deleteHolidaysByCountry} />}
                {activeTab === 'settings' && <Settings isDebugLogEnabled={isDebugLogEnabled} setIsDebugLogEnabled={setIsDebugLogEnabled} />}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

export default App;
