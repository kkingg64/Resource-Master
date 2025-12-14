import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GOV_HOLIDAYS_DB, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getWeekIdFromDate, getDateFromWeek, formatDateForInput, calculateEndDate, findNextWorkingDay } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource, ComplexityLevel } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Settings } from './components/Settings';
import { Resources } from './components/Resources';
import { VersionHistory } from './components/VersionHistory';
import { DebugLog } from './components/DebugLog';
import { AdminSettings } from './components/AdminSettings';
import { AIAssistant } from './components/AIAssistant';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, Users, Globe } from 'lucide-react';
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
      startDate: a.start_date, // New day-based field
      startWeekId: a.start_week_id, // Keep for backward compatibility
      duration: a.duration,
      parentAssignmentId: a.parent_assignment_id,
      sort_order: a.sort_order,
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
      sort_order: t.sort_order,
      assignments: (assignmentsByTask.get(t.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
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
      complexity: m.complexity || 'Medium', // Default to Medium if undefined
      
      // Default FE/BE FP to the main function_points if they are not explicitly set (null)
      frontendFunctionPoints: m.frontend_function_points ?? m.function_points ?? 0,
      backendFunctionPoints: m.backend_function_points ?? m.function_points ?? 0,
      
      frontendComplexity: m.frontend_complexity || m.complexity || 'Medium',
      backendComplexity: m.backend_complexity || m.complexity || 'Medium',

      // New Prep fields
      prepVelocity: m.prep_velocity || 10,
      prepTeamSize: m.prep_team_size || 2,

      startDate: m.start_date, // New Start Date field
      startTaskId: m.start_task_id, // New Start Task Anchor
      deliveryTaskId: m.delivery_task_id, // Deprecated but kept

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

const shiftWeekId = (weekId: string, direction: 'left' | 'right'): string => {
  const [yearStr, weekStr] = weekId.split('-');
  if (!yearStr || !weekStr) return weekId;
  const point = { year: parseInt(yearStr), week: parseInt(weekStr) };
  if (isNaN(point.year) || isNaN(point.week)) return weekId;

  const weeksToAdd = direction === 'left' ? -1 : 1;
  const newPoint = addWeeksToPoint(point, weeksToAdd);
  return `${newPoint.year}-${String(newPoint.week).padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [session, setSession] = useState<any | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'settings' | 'resources' | 'holidays'>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const statusTimeoutRef = useRef<number | undefined>(undefined);
  const allocationTimeouts = useRef<Record<string, number>>({});
  const timelineInitialized = useRef(false);

  useEffect(() => {
    return () => window.clearTimeout(statusTimeoutRef.current);
  }, []);

  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const nextLogId = useRef(0);
  
  const log = (message: string, payload: any, status: LogEntry['status'] = 'pending'): number => {
    if (!isDebugLogEnabled) return -1;
    const id = nextLogId.current++;
    const newEntry: LogEntry = { id, timestamp: new Date().toISOString(), message, payload, status };
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
    window.clearTimeout(statusTimeoutRef.current);
    
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
    
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session) {
      fetchData(false);
    }
  }, [session]);

  useEffect(() => {
    if (projects.length === 0 || loading || timelineInitialized.current) {
        return;
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    let minPoint: WeekPoint | null = null;
    let maxPoint: WeekPoint | null = null;

    const processDate = (dateStr: string) => {
        if (!dateStr) return;
        try {
            const d = new Date(dateStr.replace(/-/g, '/'));
            const weekId = getWeekIdFromDate(d);
            const [y, w] = weekId.split('-').map(Number);
            if (!isNaN(y) && !isNaN(w)) {
                const val = y * 100 + w;
                if (val < minVal) {
                    minVal = val;
                    minPoint = { year: y, week: w };
                }
                if (val > maxVal) {
                    maxVal = val;
                    maxPoint = { year: y, week: w };
                }
            }
        } catch (e) {
            // ignore invalid dates
        }
    };

    projects.forEach(project => {
        project.modules.forEach(module => {
            if (module.startDate) processDate(module.startDate);
            module.tasks.forEach(task => {
                task.assignments.forEach(assignment => {
                    if (assignment.startDate) {
                        processDate(assignment.startDate);
                        if (assignment.duration) {
                             const d = new Date(assignment.startDate.replace(/-/g, '/'));
                             d.setDate(d.getDate() + Math.ceil(assignment.duration * 1.5)); 
                             processDate(formatDateForInput(d));
                        }
                    }
                    
                    assignment.allocations.forEach(alloc => {
                        if (alloc.weekId) {
                            const [y, w] = alloc.weekId.split('-').map(Number);
                            if (!isNaN(y) && !isNaN(w)) {
                                const val = y * 100 + w;
                                if (val < minVal) { minVal = val; minPoint = { year: y, week: w }; }
                                if (val > maxVal) { maxVal = val; maxPoint = { year: y, week: w }; }
                            }
                        }
                    });
                });
            });
        });
    });

    if (minPoint && maxPoint) {
        setTimelineStart(addWeeksToPoint(minPoint, -1));
        setTimelineEnd(addWeeksToPoint(maxPoint, 4));
        timelineInitialized.current = true;
    } else if (projects.length > 0) {
        timelineInitialized.current = true;
    }
  }, [projects, loading]);
  
  const fetchData = async (isRefresh: boolean = false) => {
    if (!session) return;
    if (isRefresh) {
      setIsRefreshing(true);
      timelineInitialized.current = false;
    } else {
      setLoading(true);
    }

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

    const { data: resourcesData, error: resourcesError } = await supabase
      .from('resources')
      .select('*, individual_holidays(*)')
      .eq('user_id', session.user.id)
      .order('name');
    
    if (resourcesError) console.error(resourcesError);
    else if (resourcesData) setResources(resourcesData);

    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*')
      .eq('user_id', session.user.id);
      
    if (holidaysError) console.error(holidaysError);
    else if (holidaysData) setHolidays(holidaysData);

    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
  };
  
  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number) => {
     const previousState = deepClone(projects);
     const module = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
     if (module) {
        module.legacyFunctionPoints = legacyFp;
        module.frontendFunctionPoints = frontendFp;
        module.backendFunctionPoints = backendFp;
        module.functionPoints = frontendFp + backendFp;
        module.prepVelocity = prepVelocity;
        module.prepTeamSize = prepTeamSize;
        setProjects(deepClone(projects));
     }
     
     const { error } = await callSupabase(
        'UPDATE function points & prep', 
        { id: moduleId, legacyFp, frontendFp, backendFp, prepVelocity, prepTeamSize }, 
        supabase.from('modules').update({ 
            legacy_function_points: legacyFp, 
            frontend_function_points: frontendFp,
            backend_function_points: backendFp,
            function_points: frontendFp + backendFp,
            prep_velocity: prepVelocity,
            prep_team_size: prepTeamSize
        }).eq('id', moduleId)
    );
     if (error) { setProjects(previousState); alert("Failed to update function points."); }
  };
  
  const updateModuleComplexity = async (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => {
    const previousState = deepClone(projects);
    const module = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
    if (module) {
        if (type === 'frontend') module.frontendComplexity = complexity;
        else module.backendComplexity = complexity;
        
        // Sync legacy column with backend complexity as a default
        module.complexity = complexity;
        setProjects(deepClone(projects));
    }

    const updatePayload = type === 'frontend' 
        ? { frontend_complexity: complexity } 
        : { backend_complexity: complexity, complexity: complexity };

    const { error } = await callSupabase('UPDATE complexity', { id: moduleId, type, complexity }, supabase.from('modules').update(updatePayload).eq('id', moduleId));
    if (error) { setProjects(previousState); alert("Failed to update module complexity."); }
  };

  const updateModuleStartDate = async (projectId: string, moduleId: string, startDate: string | null) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
    if (module) {
        module.startDate = startDate || undefined;
        setProjects(updatedProjects);
    }
    const { error } = await callSupabase('UPDATE module start date', { id: moduleId, startDate }, supabase.from('modules').update({ start_date: startDate }).eq('id', moduleId));
    if (error) { setProjects(previousState); alert("Failed to update module start date."); }
  };

  const updateModuleStartTask = async (projectId: string, moduleId: string, startTaskId: string | null) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
    if (module) {
        module.startTaskId = startTaskId || undefined;
        setProjects(updatedProjects);
    }
    const { error } = await callSupabase('UPDATE module start task', { id: moduleId, startTaskId }, supabase.from('modules').update({ start_task_id: startTaskId }).eq('id', moduleId));
    if (error) { setProjects(previousState); alert("Failed to update module start task."); }
  };

  const updateModuleDeliveryTask = async (projectId: string, moduleId: string, deliveryTaskId: string | null) => {
    // Deprecated functionality, but keeping handler for backward compat if needed, though UI is removed.
    // Logic updated to ensure data consistency
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
    if (module) {
        module.deliveryTaskId = deliveryTaskId || undefined;
        setProjects(updatedProjects);
    }
    const { error } = await callSupabase('UPDATE module delivery task', { id: moduleId, deliveryTaskId }, supabase.from('modules').update({ delivery_task_id: deliveryTaskId }).eq('id', moduleId));
    if (error) { setProjects(previousState); alert("Failed to update module delivery task."); }
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
        const key = `${assignmentId}-${weekId}`;
        if (allocationTimeouts.current[key]) window.clearTimeout(allocationTimeouts.current[key]);
        setSaveStatus('saving');
        allocationTimeouts.current[key] = window.setTimeout(async () => {
            const { data: existingAlloc } = await supabase.from('resource_allocations').select('id').eq('assignment_id', assignmentId).eq('week_id', weekId).maybeSingle();
            const upsertData = { id: existingAlloc?.id, assignment_id: assignmentId, user_id: session!.user.id, week_id: weekId, count: allocationToUpdate.count, days: allocationToUpdate.days };
            const { error } = await callSupabase('UPSERT allocation', upsertData, supabase.from('resource_allocations').upsert(upsertData));
            if (error) { console.error("Failed to save allocation", error); alert("Error: Could not save allocation."); }
            delete allocationTimeouts.current[key];
        }, 1000);
    }
  };

  const addProject = async () => {
    const { data, error } = await callSupabase('CREATE project', { name: `New Project ${projects.length + 1}` }, supabase.from('projects').insert({ name: `New Project ${projects.length + 1}`, user_id: session!.user.id }).select().single());
    if (error) { alert("Could not create project."); } else { setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]); }
  };
  const deleteProject = async (projectId: string) => {
    if (window.confirm('Delete project?')) {
        const previousState = deepClone(projects);
        setProjects(prev => prev.filter(p => p.id !== projectId));
        const { error } = await callSupabase('DELETE project', { id: projectId }, supabase.from('projects').delete().eq('id', projectId));
        if (error) { setProjects(previousState); alert("Failed to delete project."); }
    }
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
    const { data, error } = await callSupabase('CREATE module', { name: 'New Module', projectId }, supabase.from('modules').insert({ name: 'New Module', project_id: projectId, user_id: session!.user.id }).select().single());
    if (error) { alert("Failed to add module."); } else { setProjects(prev => prev.map(p => p.id === projectId ? { ...p, modules: [...p.modules, { id: data.id, name: data.name, legacyFunctionPoints: 0, functionPoints: 0, tasks: [] }] } : p)); }
  };
  const deleteModule = async (projectId: string, moduleId: string) => {
    if (window.confirm('Delete module?')) {
        const previousState = deepClone(projects);
        const project = projects.find(p => p.id === projectId);
        if (project) setProjects(projects.map(p => p.id === projectId ? {...p, modules: p.modules.filter(m => m.id !== moduleId)} : p));
        const { error } = await callSupabase('DELETE module', { id: moduleId }, supabase.from('modules').delete().eq('id', moduleId));
        if (error) { setProjects(previousState); alert("Failed to delete module."); }
    }
  };
  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    const { data, error } = await callSupabase('CREATE task', { taskId, taskName }, supabase.from('tasks').insert({ id: taskId, name: taskName, module_id: moduleId, user_id: session!.user.id }).select().single());
    if (error) { alert("Failed to add task."); return; }
    const { error: assignError } = await callSupabase('CREATE assignment', { taskId, role }, supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id, start_date: formatDateForInput(new Date()), duration: 5 }).select().single());
    if (!assignError) fetchData(true);
  };
  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
    if (window.confirm('Delete task?')) {
        const previousState = deepClone(projects);
        const project = projects.find(p => p.id === projectId);
        const module = project?.modules.find(m => m.id === moduleId);
        if (module) setProjects(projects.map(p => p.id === projectId ? {...p, modules: p.modules.map(m => m.id === moduleId ? {...m, tasks: m.tasks.filter(t => t.id !== taskId)}: m)} : p));
        const { error } = await callSupabase('DELETE task', { id: taskId }, supabase.from('tasks').delete().eq('id', taskId));
        if (error) { setProjects(previousState); alert("Failed to delete task."); }
    }
  };
  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    const { error } = await callSupabase('CREATE assignment', { taskId, role }, supabase.from('task_assignments').insert({ task_id: taskId, role, resource_name: 'Unassigned', user_id: session!.user.id, start_date: formatDateForInput(new Date()), duration: 5 }).select().single());
    if (!error) fetchData(true);
  };
  const onCopyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
    const originalAssignment = projects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId)?.assignments.find(a => a.id === assignmentId);
    if (!originalAssignment) return;
    const { data: newAssignment, error: assignError } = await callSupabase('COPY assignment', { taskId: taskId, role: originalAssignment.role }, supabase.from('task_assignments').insert({ task_id: taskId, role: originalAssignment.role, resource_name: 'Unassigned', user_id: session!.user.id, start_date: originalAssignment.startDate || formatDateForInput(new Date()), duration: originalAssignment.duration, parent_assignment_id: originalAssignment.parentAssignmentId }).select().single());
    if (assignError || !newAssignment) { alert("Failed to copy assignment."); return; }
    if (originalAssignment.allocations.length > 0) {
        const newAllocations = originalAssignment.allocations.map(alloc => ({ assignment_id: newAssignment.id, user_id: session!.user.id, week_id: alloc.weekId, count: alloc.count, days: alloc.days || {} }));
        await callSupabase('COPY allocations', { count: newAllocations.length }, supabase.from('resource_allocations').insert(newAllocations));
    }
    await fetchData(true);
  };
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
    if (window.confirm('Delete assignment?')) {
        const previousState = deepClone(projects);
        setProjects(prev => {
            const updatedProjects = deepClone(prev);
            const project = updatedProjects.find(p => p.id === projectId);
            if (project) { const module = project.modules.find(m => m.id === moduleId); if (module) { const task = module.tasks.find(t => t.id === taskId); if (task) task.assignments = task.assignments.filter(a => a.id !== assignmentId); } }
            return updatedProjects;
        });
        const { error } = await callSupabase('DELETE assignment', { id: assignmentId }, supabase.from('task_assignments').delete().eq('id', assignmentId));
        if (error) { setProjects(previousState); alert("Failed to delete assignment."); } else { fetchData(true); }
    }
  };
  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const assignment = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId)?.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    assignment.resourceName = name;
    const selectedResource = resources.find(r => r.name === name);
    let newRole = assignment.role;
    if (selectedResource) { newRole = selectedResource.category; assignment.role = newRole; }
    setProjects(updatedProjects);
    const updatePayload = { resource_name: name, role: newRole };
    const { error } = await callSupabase('UPDATE assignment resource & role', { id: assignmentId, ...updatePayload }, supabase.from('task_assignments').update(updatePayload).eq('id', assignmentId));
    if (error) { setProjects(previousState); alert("Failed to update resource assignment."); }
  };

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
        setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
        setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

  const updateAssignmentSchedule = async (assignmentId: string, startDate: string, duration: number) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    let found = false;
    
    for (const p of updatedProjects) {
        for (const m of p.modules) {
            for (const t of m.tasks) {
                const assignment = t.assignments.find(a => a.id === assignmentId);
                if (assignment) {
                    assignment.startDate = startDate;
                    assignment.duration = duration;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }
    
    if (found) setProjects(updatedProjects);
    
    const { error } = await callSupabase(
        'UPDATE assignment schedule',
        { assignmentId, startDate, duration },
        supabase.from('task_assignments').update({ start_date: startDate, duration }).eq('id', assignmentId)
    );

    if (error) {
        setProjects(previousState);
        alert("Failed to update schedule.");
    }
  };

  const updateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    let found = false;

    for (const p of updatedProjects) {
        for (const m of p.modules) {
            for (const t of m.tasks) {
                const assignment = t.assignments.find(a => a.id === assignmentId);
                if (assignment) {
                    assignment.parentAssignmentId = parentAssignmentId || undefined;
                    found = true;
                    break;
                }
            }
            if (found) break;
        }
        if (found) break;
    }

    if (found) setProjects(updatedProjects);

    const { error } = await callSupabase(
        'UPDATE assignment dependency',
        { assignmentId, parentAssignmentId },
        supabase.from('task_assignments').update({ parent_assignment_id: parentAssignmentId }).eq('id', assignmentId)
    );

    if (error) {
        setProjects(previousState);
        alert("Failed to update dependency.");
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
      const updates = project.modules.map((module, index) => ({ id: module.id, name: module.name, legacy_function_points: module.legacyFunctionPoints, function_points: module.functionPoints, sort_order: index, project_id: projectId, user_id: session!.user.id }));
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
      const updates = module.tasks.map((task, index) => ({ id: task.id, name: task.name, sort_order: index, module_id: moduleId, user_id: session!.user.id }));
      const { error } = await callSupabase('REORDER tasks', { updates }, supabase.from('tasks').upsert(updates));
      if (error) { setProjects(previousState); alert("Failed to reorder tasks."); }
  };

  const reorderAssignments = async (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const [removed] = task.assignments.splice(startIndex, 1);
    task.assignments.splice(endIndex, 0, removed);
    setProjects(updatedProjects);
    const updates = task.assignments.map((assignment, index) => ({ id: assignment.id, task_id: taskId, role: assignment.role, resource_name: assignment.resourceName, start_date: assignment.startDate, duration: assignment.duration, parent_assignment_id: assignment.parentAssignmentId, sort_order: index, user_id: session!.user.id, }));
    const { error } = await callSupabase('REORDER assignments', { updates: updates.length }, supabase.from('task_assignments').upsert(updates));
    if (error) { setProjects(previousState); alert("Failed to reorder assignments."); }
  };
  
  const onShiftTask = async (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
    if (!task) return;
    const allAssignmentIds = task.assignments.map(a => a.id);
    if(allAssignmentIds.length === 0) return;
    const allNewAllocationsForDB: any[] = [];
    for (const assignment of task.assignments) {
      const newAllocationsMap = new Map<string, ResourceAllocation>();
      for (const alloc of assignment.allocations) {
        const newWeekId = shiftWeekId(alloc.weekId, direction);
        if (newAllocationsMap.has(newWeekId)) { const existing = newAllocationsMap.get(newWeekId)!; existing.count += alloc.count; existing.days = {}; } 
        else { newAllocationsMap.set(newWeekId, { ...alloc, weekId: newWeekId }); }
      }
      assignment.allocations = Array.from(newAllocationsMap.values());
      assignment.allocations.forEach(a => allNewAllocationsForDB.push({ assignment_id: assignment.id, user_id: session!.user.id, week_id: a.weekId, count: a.count, days: a.days || {} }));
    }
    setProjects(updatedProjects);
    setSaveStatus('saving');
    const { error: delErr } = await supabase.from('resource_allocations').delete().in('assignment_id', allAssignmentIds);
    if (delErr) { setSaveStatus('error'); setProjects(previousState); return; }
    if (allNewAllocationsForDB.length > 0) { const { error: insErr } = await supabase.from('resource_allocations').insert(allNewAllocationsForDB); if (insErr) { setSaveStatus('error'); fetchData(true); return; } }
    setSaveStatus('success');
    statusTimeoutRef.current = window.setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const addResource = async (name: string, category: Role, region: string, type: 'Internal' | 'External') => {
    const { error } = await callSupabase('CREATE resource', { name, category }, supabase.from('resources').insert({ name, category, holiday_region: region === 'No Region' ? null : region, type, user_id: session!.user.id }).select().single());
    if (error) { alert("Failed to add resource."); } else { fetchData(true); }
  };
  const deleteResource = async (id: string) => {
    if (window.confirm('Delete resource?')) { const { error } = await callSupabase('DELETE resource', { id }, supabase.from('resources').delete().eq('id', id)); if (error) { alert("Failed to delete resource."); } else { fetchData(true); } }
  };
  const updateResourceCategory = async (id: string, category: Role) => { const { error } = await callSupabase('UPDATE resource category', { id, category }, supabase.from('resources').update({ category }).eq('id', id)); if (error) alert("Failed to update resource category."); else fetchData(true); };
  const updateResourceRegion = async (id: string, region: string | null) => { const { error } = await callSupabase('UPDATE resource region', { id, region }, supabase.from('resources').update({ holiday_region: region }).eq('id', id)); if (error) alert("Failed to update resource region."); else fetchData(true); };
  const updateResourceType = async (id: string, type: 'Internal' | 'External') => { const { error } = await callSupabase('UPDATE resource type', { id, type }, supabase.from('resources').update({ type }).eq('id', id)); if (error) alert("Failed to update resource type."); else fetchData(true); };
  const addIndividualHoliday = async (resourceId: string, date: string, name: string) => { const { error } = await callSupabase('ADD individual holiday', { resourceId, date }, supabase.from('individual_holidays').insert({ resource_id: resourceId, date, name, user_id: session!.user.id })); if (error) alert("Failed to add holiday."); else fetchData(true); };
  const deleteIndividualHoliday = async (holidayId: string) => { const { error } = await callSupabase('DELETE individual holiday', { id: holidayId }, supabase.from('individual_holidays').delete().eq('id', holidayId)); if (error) alert("Failed to delete holiday."); else fetchData(true); };
  const addHoliday = async (holidays: Omit<Holiday, 'id'>[]) => { const toInsert = holidays.map(h => ({ ...h, user_id: session!.user.id })); const { error } = await callSupabase('ADD holidays', { count: toInsert.length }, supabase.from('holidays').insert(toInsert)); if (error) alert("Failed to add holidays."); else fetchData(true); };
  const deleteHoliday = async (id: string) => { const { error } = await callSupabase('DELETE holiday', { id }, supabase.from('holidays').delete().eq('id', id)); if (error) alert("Failed to delete holiday."); else fetchData(true); };
  const deleteHolidaysByCountry = async (country: string) => { const { error } = await callSupabase('DELETE holidays by country', { country }, supabase.from('holidays').delete().eq('country', country).eq('user_id', session!.user.id)); if (error) alert("Failed to delete holidays."); else fetchData(true); };
  const saveCurrentVersion = async (name: string) => { const { error } = await callSupabase('SAVE version', { name }, supabase.from('versions').insert({ name, user_id: session!.user.id, data: { projects, resources, holidays } })); if (error) alert("Failed to save version."); };
  const restoreVersion = async (versionId: number) => { const { data, error } = await supabase.from('versions').select('data').eq('id', versionId).single(); if (error || !data) { alert("Failed to restore version."); return; } const snapshot = data.data; if (snapshot.projects) { alert("Version restore logic would implementation deep backend restore. Loading snapshot into memory only."); setProjects(snapshot.projects); setResources(snapshot.resources || []); setHolidays(snapshot.holidays || []); } };
  
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 w-full max-w-md">
          <h1 className="text-2xl font-bold text-center mb-6 text-slate-800">OMS Resource Master</h1>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} theme="default" providers={['google']} />
        </div>
      </div>
    );
  }

  if (loading) {
      return <div className="flex h-screen items-center justify-center text-slate-500 gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-500"></div> Loading data...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100 overflow-hidden">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b border-slate-200 h-14 flex items-center justify-between px-4 flex-shrink-0 z-20">
            <div className="flex items-center gap-4">
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
                    {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                </button>
                <h1 className="font-bold text-lg text-slate-800 tracking-tight">OMS Resource Master</h1>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-xs font-medium bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full border border-indigo-100">{session.user.email}</span>
                <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sign Out">
                    <LogOut size={18} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar */}
            <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out z-10`}>
                <nav className="p-2 space-y-1 mt-4">
                   <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Calendar} label="Planner" isActive={activeTab === 'planner'} onClick={() => setActiveTab('planner')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Calculator} label="Estimator" isActive={activeTab === 'estimator'} onClick={() => setActiveTab('estimator')} collapsed={isSidebarCollapsed} />
                   <div className="my-2 border-t border-slate-100"></div>
                   <SidebarItem icon={Users} label="Resources" isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Globe} label="Holidays" isActive={activeTab === 'holidays'} onClick={() => setActiveTab('holidays')} collapsed={isSidebarCollapsed} />
                   <div className="my-2 border-t border-slate-100"></div>
                   <SidebarItem icon={SettingsIcon} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={isSidebarCollapsed} />
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
                <div className="flex-1 p-4 overflow-hidden">
                    {activeTab === 'dashboard' && <Dashboard projects={projects} />}
                    {activeTab === 'planner' && (
                        <div className="h-full">
                            <PlannerGrid 
                                projects={projects} 
                                holidays={holidays}
                                resources={resources}
                                timelineStart={timelineStart}
                                timelineEnd={timelineEnd}
                                onExtendTimeline={handleExtendTimeline}
                                onUpdateAllocation={updateAllocation}
                                onUpdateAssignmentResourceName={updateAssignmentResourceName}
                                onUpdateAssignmentDependency={updateAssignmentDependency}
                                onAddTask={addTask}
                                onAddAssignment={addAssignment}
                                onCopyAssignment={onCopyAssignment}
                                onReorderModules={reorderModules}
                                onReorderTasks={reorderTasks}
                                onReorderAssignments={reorderAssignments}
                                onShiftTask={onShiftTask}
                                onUpdateAssignmentSchedule={updateAssignmentSchedule}
                                onAddProject={addProject}
                                onAddModule={addModule}
                                onUpdateProjectName={updateProjectName}
                                onUpdateModuleName={updateModuleName}
                                onUpdateTaskName={updateTaskName}
                                onDeleteProject={deleteProject}
                                onDeleteModule={deleteModule}
                                onDeleteTask={deleteTask}
                                onDeleteAssignment={deleteAssignment}
                                onImportPlan={(p) => { setProjects(p); }}
                                onShowHistory={() => setShowHistory(true)}
                                onRefresh={() => fetchData(true)}
                                saveStatus={saveStatus}
                                isRefreshing={isRefreshing}
                            />
                        </div>
                    )}
                    {activeTab === 'estimator' && (
                        <div className="h-full">
                            <Estimator 
                                projects={projects} 
                                holidays={holidays}
                                onUpdateFunctionPoints={updateFunctionPoints}
                                onReorderModules={reorderModules}
                                onUpdateModuleComplexity={updateModuleComplexity}
                                onUpdateModuleStartDate={updateModuleStartDate}
                                onUpdateModuleDeliveryTask={updateModuleDeliveryTask}
                                onUpdateModuleStartTask={updateModuleStartTask}
                            />
                        </div>
                    )}
                    {activeTab === 'resources' && (
                        <div className="h-full overflow-y-auto custom-scrollbar">
                           <Resources 
                              resources={resources}
                              onAddResource={addResource}
                              onDeleteResource={deleteResource}
                              onUpdateResourceCategory={updateResourceCategory}
                              onUpdateResourceRegion={updateResourceRegion}
                              onUpdateResourceType={updateResourceType}
                              onAddIndividualHoliday={addIndividualHoliday}
                              onDeleteIndividualHoliday={deleteIndividualHoliday}
                           />
                        </div>
                    )}
                    {activeTab === 'holidays' && (
                        <div className="h-full overflow-hidden">
                            <AdminSettings 
                                holidays={holidays}
                                onAddHolidays={addHoliday}
                                onDeleteHoliday={deleteHoliday}
                                onDeleteHolidaysByCountry={deleteHolidaysByCountry}
                            />
                        </div>
                    )}
                    {activeTab === 'settings' && (
                        <div className="max-w-4xl mx-auto h-full overflow-y-auto custom-scrollbar">
                           <Settings 
                                isDebugLogEnabled={isDebugLogEnabled} 
                                setIsDebugLogEnabled={setIsDebugLogEnabled} 
                                isAIEnabled={isAIEnabled}
                                setIsAIEnabled={setIsAIEnabled}
                           />
                        </div>
                    )}
                </div>
            </div>
        </div>

        {/* Floating Components */}
        {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
        {showHistory && (
            <VersionHistory 
                onClose={() => setShowHistory(false)} 
                onRestore={restoreVersion}
                onSaveCurrent={saveCurrentVersion}
            />
        )}
        {isAIEnabled && <AIAssistant 
            projects={projects}
            resources={resources}
            onAddTask={addTask}
            onAssignResource={updateAssignmentResourceName}
        />}
    </div>
  );
};

const SidebarItem: React.FC<{ icon: React.ElementType, label: string, isActive: boolean, onClick: () => void, collapsed: boolean }> = ({ icon: Icon, label, isActive, onClick, collapsed }) => (
    <button 
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
            ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}
            ${collapsed ? 'justify-center' : ''}
        `}
        title={collapsed ? label : ''}
    >
        <Icon size={20} className={`${isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
        {!collapsed && <span>{label}</span>}
        {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                {label}
            </div>
        )}
    </button>
);

export default App;