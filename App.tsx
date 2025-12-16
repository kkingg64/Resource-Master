

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
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, Users, Globe, Share2, Copy, Check, X } from 'lucide-react';
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
      progress: a.progress || 0, // NEW: Progress field
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

      // New FE/BE fields (default to 5 vel, 2 team if not set)
      frontendVelocity: m.frontend_velocity || 5,
      frontendTeamSize: m.frontend_team_size || 2,
      backendVelocity: m.backend_velocity || 5,
      backendTeamSize: m.backend_team_size || 2,

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

// Helper to shift week ID by N weeks
const shiftWeekIdByAmount = (weekId: string, amount: number): string => {
    if (amount === 0) return weekId;
    const [yearStr, weekStr] = weekId.split('-');
    if (!yearStr || !weekStr) return weekId;
    const point = { year: parseInt(yearStr), week: parseInt(weekStr) };
    if (isNaN(point.year) || isNaN(point.week)) return weekId;
    const newPoint = addWeeksToPoint(point, amount);
    return `${newPoint.year}-${String(newPoint.week).padStart(2, '0')}`;
};

const ShareModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}?mode=readonly`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" /> Share Project Plan
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Share this link with your team members to give them <strong>Read-Only</strong> access to the Dashboard, Planner, and Estimator.
        </p>

        <div className="flex items-center gap-2 mb-4">
          <input 
            type="text" 
            readOnly 
            value={shareUrl} 
            className="flex-1 bg-slate-50 border border-slate-300 text-slate-600 text-sm rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500 block w-full"
          />
          <button 
            onClick={copyToClipboard}
            className={`p-2.5 rounded-lg border flex items-center justify-center transition-all ${copied ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
            title="Copy to clipboard"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800">
           <strong>Note:</strong> Team members must have access to the underlying project data in the system for this link to populate correctly.
        </div>
        
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
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
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Read Only Mode Logic
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'readonly') {
        setIsReadOnlyMode(true);
    }
  }, []);
  
  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const statusTimeoutRef = useRef<number | undefined>(undefined);
  const allocationTimeouts = useRef<Record<string, number>>({});

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
    if (isReadOnlyMode) return { data: null, error: 'Read Only Mode' };

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

  const calculateTimelineBounds = (currentProjects: Project[], currentResources: Resource[], currentHolidays: Holiday[]) => {
    if (currentProjects.length === 0) {
      setTimelineStart(DEFAULT_START);
      setTimelineEnd(DEFAULT_END);
      return;
    }
  
    // Build holiday map for efficient lookup
    const resourceHolidaysMap = new Map<string, Set<string>>();
    const defaultHolidays = new Set(currentHolidays.filter(h => h.country === 'HK').map(h => h.date));
    resourceHolidaysMap.set('Unassigned', defaultHolidays);
    currentResources.forEach(res => {
      const regional = currentHolidays.filter(h => h.country === res.holiday_region);
      const individual = res.individual_holidays || [];
      resourceHolidaysMap.set(res.name, new Set([...regional, ...individual].map(h => h.date)));
    });
  
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
  
    const updateMinMax = (date: Date) => {
      if (!minDate || date < minDate) {
        minDate = date;
      }
      if (!maxDate || date > maxDate) {
        maxDate = date;
      }
    };
  
    currentProjects.forEach(project => {
      project.modules.forEach(module => {
        module.tasks.forEach(task => {
          task.assignments.forEach(assignment => {
            if (assignment.startDate) {
              try {
                const startDate = new Date(assignment.startDate.replace(/-/g, '/'));
                if (!isNaN(startDate.getTime())) {
                  updateMinMax(startDate);
                  if (assignment.duration) {
                    const holidaySet = resourceHolidaysMap.get(assignment.resourceName || 'Unassigned') || defaultHolidays;
                    const endDateStr = calculateEndDate(assignment.startDate, assignment.duration, holidaySet);
                    const endDate = new Date(endDateStr.replace(/-/g, '/'));
                    if (!isNaN(endDate.getTime())) {
                      updateMinMax(endDate);
                    }
                  }
                }
              } catch (e) {
                console.error('Invalid date format in assignment', assignment.id);
              }
            }
          });
        });
      });
    });
  
    if (minDate && maxDate) {
      const startWeekId = getWeekIdFromDate(minDate);
      const [startY, startW] = startWeekId.split('-').map(Number);
      
      const endWeekId = getWeekIdFromDate(maxDate);
      const [endY, endW] = endWeekId.split('-').map(Number);
  
      if (!isNaN(startY) && !isNaN(startW) && !isNaN(endY) && !isNaN(endW)) {
        const minPoint = { year: startY, week: startW };
        const maxPoint = { year: endY, week: endW };
        setTimelineStart(addWeeksToPoint(minPoint, -1)); // 1 week padding
        setTimelineEnd(addWeeksToPoint(maxPoint, 1));   // 1 week padding
      } else {
        setTimelineStart(DEFAULT_START);
        setTimelineEnd(DEFAULT_END);
      }
    } else {
      setTimelineStart(DEFAULT_START);
      setTimelineEnd(DEFAULT_END);
    }
  };
  
  const fetchData = async (isRefresh: boolean = false) => {
    if (!session) return;
    if (isRefresh) {
      setIsRefreshing(true);
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
    
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('resources')
      .select('*, individual_holidays(*)')
      .eq('user_id', session.user.id)
      .order('name');
    
    if (resourcesError) console.error(resourcesError);
    const freshResources = resourcesData || [];

    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*')
      .eq('user_id', session.user.id);
      
    if (holidaysError) console.error(holidaysError);
    const freshHolidays = holidaysData || [];
    
    const structuredProjects = structureProjectsData(finalProjectsData, modulesData, tasksData, assignmentsData, allocationsData);
    
    // Set state after all data is fetched and processed
    setHolidays(freshHolidays);
    setResources(freshResources);
    setProjects(structuredProjects);
    
    // Calculate timeline bounds using the fresh data
    calculateTimelineBounds(structuredProjects, freshResources, freshHolidays);

    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
  };

  const propagateScheduleChanges = async (currentProjects: Project[], startAssignmentId: string) => {
    if (isReadOnlyMode) return;
    const assignmentMap = new Map<string, TaskAssignment>();
    const dependencyMap = new Map<string, string[]>();

    currentProjects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                t.assignments.forEach(a => {
                    assignmentMap.set(a.id, a);
                    if (a.parentAssignmentId) {
                        if (!dependencyMap.has(a.parentAssignmentId)) {
                            dependencyMap.set(a.parentAssignmentId, []);
                        }
                        dependencyMap.get(a.parentAssignmentId)!.push(a.id);
                    }
                });
            });
        });
    });

    const updates: { id: string, start_date: string }[] = [];
    const allocationUpdates: { assignmentId: string, allocations: ResourceAllocation[] }[] = [];
    const queue = [startAssignmentId];
    const visited = new Set<string>();

    while (queue.length > 0) {
        const parentId = queue.shift()!;
        if (visited.has(parentId)) continue;
        visited.add(parentId);

        const parent = assignmentMap.get(parentId);
        if (!parent || !parent.startDate) continue;

        const children = dependencyMap.get(parentId) || [];
        
        // Helper to get holidays for a specific resource
        const getHolidays = (resName: string) => {
             const res = resources.find(r => r.name === resName);
             // Default to HK if unassigned or no region, to be safe
             const regional = res?.holiday_region ? holidays.filter(h => h.country === res.holiday_region) : holidays.filter(h => h.country === 'HK');
             const individual = res?.individual_holidays || [];
             return new Set([...regional, ...individual].map(h => h.date));
        };

        const parentHolidays = getHolidays(parent.resourceName || 'Unassigned');
        const parentEndDate = calculateEndDate(parent.startDate, parent.duration || 1, parentHolidays);

        for (const childId of children) {
            const child = assignmentMap.get(childId);
            if (!child) continue;

            const childHolidays = getHolidays(child.resourceName || 'Unassigned');
            // Child starts the next working day AFTER parent finishes
            const newStartDate = findNextWorkingDay(parentEndDate, childHolidays);

            if (child.startDate !== newStartDate) {
                // Check if week changed to shift allocations
                const oldStartWeekId = child.startDate ? getWeekIdFromDate(new Date(child.startDate.replace(/-/g, '/'))) : null;
                const newStartWeekId = getWeekIdFromDate(new Date(newStartDate.replace(/-/g, '/')));
                
                // Update start date in memory
                child.startDate = newStartDate;
                updates.push({ id: child.id, start_date: newStartDate });
                queue.push(child.id);

                // If week changed, shift allocations in memory
                if (oldStartWeekId && oldStartWeekId !== newStartWeekId) {
                    const [y1, w1] = oldStartWeekId.split('-').map(Number);
                    const [y2, w2] = newStartWeekId.split('-').map(Number);
                    // Use a simple week diff calculation based on dates for more accuracy over year boundaries
                    const date1 = getDateFromWeek(y1, w1);
                    const date2 = getDateFromWeek(y2, w2);
                    const diffTime = date2.getTime() - date1.getTime();
                    const weekDiff = Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));

                    if (weekDiff !== 0) {
                        const newAllocationsMap = new Map<string, ResourceAllocation>();
                        child.allocations.forEach(alloc => {
                            const newWeekId = shiftWeekIdByAmount(alloc.weekId, weekDiff);
                            if (newAllocationsMap.has(newWeekId)) {
                                const existing = newAllocationsMap.get(newWeekId)!;
                                existing.count += alloc.count;
                                existing.days = {}; // Clear daily details on shift as they might be invalid
                            } else {
                                newAllocationsMap.set(newWeekId, { ...alloc, weekId: newWeekId, days: {} });
                            }
                        });
                        child.allocations = Array.from(newAllocationsMap.values());
                        allocationUpdates.push({ assignmentId: child.id, allocations: child.allocations });
                    }
                }
            }
        }
    }

    if (updates.length > 0) {
        await Promise.all(updates.map(u => 
            supabase.from('task_assignments').update({ start_date: u.start_date }).eq('id', u.id)
        ));
    }

    if (allocationUpdates.length > 0) {
        for (const update of allocationUpdates) {
            // Delete old allocations for this assignment
            await supabase.from('resource_allocations').delete().eq('assignment_id', update.assignmentId);
            // Insert new ones
            if (update.allocations.length > 0) {
                const dbAllocations = update.allocations.map(a => ({
                    assignment_id: update.assignmentId,
                    user_id: session!.user.id,
                    week_id: a.weekId,
                    count: a.count,
                    days: a.days || {}
                }));
                await supabase.from('resource_allocations').insert(dbAllocations);
            }
        }
    }
  };
  
  const updateAssignmentSchedule = async (assignmentId: string, startDate: string, duration: number) => {
    if (isReadOnlyMode) return;
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    let foundAssignment: TaskAssignment | null = null;
    
    // Find assignment
    for (const p of updatedProjects) {
        for (const m of p.modules) {
            for (const t of m.tasks) {
                const a = t.assignments.find(x => x.id === assignmentId);
                if (a) {
                    foundAssignment = a;
                    break;
                }
            }
            if (foundAssignment) break;
        }
        if (foundAssignment) break;
    }
    
    if (foundAssignment) {
        foundAssignment.startDate = startDate;
        foundAssignment.duration = duration;

        // --- Auto-populate allocations based on new schedule ---
        const resourceName = foundAssignment.resourceName || 'Unassigned';
        const res = resources.find(r => r.name === resourceName);
        const regional = res?.holiday_region ? holidays.filter(h => h.country === res.holiday_region) : holidays.filter(h => h.country === 'HK');
        const individual = res?.individual_holidays || [];
        const holidaySet = new Set([...regional, ...individual].map(h => h.date));

        const newAllocationsMap = new Map<string, ResourceAllocation>();
        let currentDate = new Date(startDate.replace(/-/g, '/'));
        let workingDaysFound = 0;

        while (workingDaysFound < duration) {
            const dateStr = formatDateForInput(currentDate);
            const dayOfWeek = currentDate.getDay();
            
            // If it's a working day (Mon-Fri and not a holiday)
            if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
                workingDaysFound++;
                const weekId = getWeekIdFromDate(currentDate);
                
                if (!newAllocationsMap.has(weekId)) {
                    newAllocationsMap.set(weekId, { weekId, count: 0, days: {} });
                }
                
                const alloc = newAllocationsMap.get(weekId)!;
                alloc.days = alloc.days || {};
                alloc.days[dateStr] = 1; // Default to 1 man-day (FTE) per working day
                alloc.count += 1;
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const newAllocations = Array.from(newAllocationsMap.values());
        foundAssignment.allocations = newAllocations;
        // -----------------------------------------------------

        await propagateScheduleChanges(updatedProjects, assignmentId);
        setProjects(updatedProjects);
        
        // 1. Update Schedule Metadata
        const { error: assignError } = await callSupabase(
            'UPDATE assignment schedule',
            { assignmentId, startDate, duration },
            supabase.from('task_assignments').update({ start_date: startDate, duration }).eq('id', assignmentId)
        );

        if (assignError) {
            setProjects(previousState);
            alert("Failed to update schedule.");
            return;
        }

        // 2. Update Allocations (Delete Old -> Insert New)
        // Note: propagateScheduleChanges might have already updated dependencies, but here we update the source assignment's allocations
        await supabase.from('resource_allocations').delete().eq('assignment_id', assignmentId);
        if (newAllocations.length > 0) {
            const dbAllocations = newAllocations.map(a => ({
                assignment_id: assignmentId,
                user_id: session!.user.id,
                week_id: a.weekId,
                count: a.count,
                days: a.days || {}
            }));
            await supabase.from('resource_allocations').insert(dbAllocations);
        }
    }
  };

  const updateAssignmentProgress = async (assignmentId: string, progress: number) => {
      if (isReadOnlyMode) return;
      const previousState = deepClone(projects);
      const updatedProjects = deepClone(projects);
      let found = false;

      for (const p of updatedProjects) {
          for (const m of p.modules) {
              for (const t of m.tasks) {
                  const assignment = t.assignments.find(a => a.id === assignmentId);
                  if (assignment) {
                      assignment.progress = progress;
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
          'UPDATE assignment progress',
          { assignmentId, progress },
          supabase.from('task_assignments').update({ progress }).eq('id', assignmentId)
      );

      if (error) {
          setProjects(previousState);
          alert("Failed to update progress.");
      }
  };

  const updateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
    if (isReadOnlyMode) return;
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    let targetAssignment = null;

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
        
        // Immediate update if parent is set
        if (parentAssignmentId) {
             let parentAssignment = null;
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
                 const getHolidays = (resName: string) => {
                     const res = resources.find(r => r.name === resName);
                     const regional = res?.holiday_region ? holidays.filter(h => h.country === res.holiday_region) : holidays.filter(h => h.country === 'HK');
                     const individual = res?.individual_holidays || [];
                     return new Set([...regional, ...individual].map(h => h.date));
                 };
                 const parentEndDate = calculateEndDate(parentAssignment.startDate, parentAssignment.duration || 1, getHolidays(parentAssignment.resourceName || 'Unassigned'));
                 const myHolidays = getHolidays(targetAssignment.resourceName || 'Unassigned');
                 targetAssignment.startDate = findNextWorkingDay(parentEndDate, myHolidays);
             }
        }

        await propagateScheduleChanges(updatedProjects, assignmentId);
        setProjects(updatedProjects);
    }

    const { error } = await callSupabase(
        'UPDATE assignment dependency',
        { assignmentId, parentAssignmentId },
        supabase.from('task_assignments').update({ parent_assignment_id: parentAssignmentId, start_date: targetAssignment?.startDate }).eq('id', assignmentId)
    );

    if (error) {
        setProjects(previousState);
        alert("Failed to update dependency.");
    }
  };
  
  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
      if (isReadOnlyMode) return;
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
      if (isReadOnlyMode) return;
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
    if (isReadOnlyMode) return;
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
    if (isReadOnlyMode) return;
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
    if (isReadOnlyMode) return;
    const { error } = await callSupabase('CREATE resource', { name }, supabase.from('resources').insert({ name, category, holiday_region: region === 'No Region' ? null : region, type, user_id: session!.user.id }).select().single());
    if (error) { alert("Failed to add resource."); } else { fetchData(true); }
  };
  const deleteResource = async (id: string) => {
    if (isReadOnlyMode) return;
    if (window.confirm('Delete resource?')) { const { error } = await callSupabase('DELETE resource', { id }, supabase.from('resources').delete().eq('id', id)); if (error) { alert("Failed to delete resource."); } else { fetchData(true); } }
  };
  const updateResourceCategory = async (id: string, category: Role) => { if (isReadOnlyMode) return; const { error } = await callSupabase('UPDATE resource category', { id, category }, supabase.from('resources').update({ category }).eq('id', id)); if (error) alert("Failed to update resource category."); else fetchData(true); };
  const updateResourceRegion = async (id: string, region: string | null) => { if (isReadOnlyMode) return; const { error } = await callSupabase('UPDATE resource region', { id, region }, supabase.from('resources').update({ holiday_region: region }).eq('id', id)); if (error) alert("Failed to update resource region."); else fetchData(true); };
  const updateResourceType = async (id: string, type: 'Internal' | 'External') => { if (isReadOnlyMode) return; const { error } = await callSupabase('UPDATE resource type', { id, type }, supabase.from('resources').update({ type }).eq('id', id)); if (error) alert("Failed to update resource type."); else fetchData(true); };
  
  // NEW: Rename Resource function
  const updateResourceName = async (id: string, name: string) => {
    if (isReadOnlyMode) return;
    const resource = resources.find(r => r.id === id);
    const oldName = resource?.name;
    
    const { error } = await callSupabase('UPDATE resource name', { id, name },
        supabase.from('resources').update({ name }).eq('id', id)
    );
    
    if (error) {
        alert("Failed to update resource name.");
    } else {
        // Also update assignments if name changed to keep data consistent
        if (oldName && oldName !== name) {
             await callSupabase('UPDATE assignments resource name', { oldName, name },
                supabase.from('task_assignments').update({ resource_name: name }).eq('resource_name', oldName)
             );
        }
        fetchData(true);
    }
  };

  // Updated to accept an array of holidays for bulk insertion
  const addIndividualHolidays = async (resourceId: string, items: { date: string, name: string }[]) => { 
      if (isReadOnlyMode) return;
      const toInsert = items.map(item => ({ resource_id: resourceId, date: item.date, name: item.name, user_id: session!.user.id }));
      const { error } = await callSupabase('ADD individual holidays', { count: toInsert.length }, supabase.from('individual_holidays').insert(toInsert)); 
      if (error) alert("Failed to add holidays."); 
      else fetchData(true); 
  };
  
  const deleteIndividualHoliday = async (holidayId: string) => { if (isReadOnlyMode) return; const { error } = await callSupabase('DELETE individual holiday', { id: holidayId }, supabase.from('individual_holidays').delete().eq('id', holidayId)); if (error) alert("Failed to delete holiday."); else fetchData(true); };
  const addHoliday = async (holidays: Omit<Holiday, 'id'>[]) => { if (isReadOnlyMode) return; const toInsert = holidays.map(h => ({ ...h, user_id: session!.user.id })); const { error } = await callSupabase('ADD holidays', { count: toInsert.length }, supabase.from('holidays').insert(toInsert)); if (error) alert("Failed to add holidays."); else fetchData(true); };
  const deleteHoliday = async (id: string) => { if (isReadOnlyMode) return; const { error } = await callSupabase('DELETE holiday', { id }, supabase.from('holidays').delete().eq('id', id)); if (error) alert("Failed to delete holiday."); else fetchData(true); };
  const deleteHolidaysByCountry = async (country: string) => { if (isReadOnlyMode) return; const { error } = await callSupabase('DELETE holidays by country', { country }, supabase.from('holidays').delete().eq('country', country).eq('user_id', session.user.id)); if (error) alert("Failed to delete holidays."); else fetchData(true); };
  const saveCurrentVersion = async (name: string) => { if (isReadOnlyMode) return; const { error } = await callSupabase('SAVE version', { name }, supabase.from('versions').insert({ name, user_id: session!.user.id, data: { projects, resources, holidays } })); if (error) alert("Failed to save version."); };
  const restoreVersion = async (versionId: number) => { if (isReadOnlyMode) return; const { data, error } = await supabase.from('versions').select('data').eq('id', versionId).single(); if (error || !data) { alert("Failed to restore version."); return; } const snapshot = data.data; if (snapshot.projects) { alert("Version restore logic would implementation deep backend restore. Loading snapshot into memory only."); setProjects(snapshot.projects); setResources(snapshot.resources || []); setHolidays(snapshot.holidays || []); } };

  // --- Missing Handlers Implemented Below ---
  
  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
      setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
      setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

  const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => {
      if (isReadOnlyMode) return;
      const previousState = deepClone(projects);
      const updatedProjects = deepClone(projects);
      let foundAssignment: TaskAssignment | null = null;
      for(const p of updatedProjects) {
          if (p.id !== projectId) continue;
          for(const m of p.modules) {
              if (m.id !== moduleId) continue;
              for(const t of m.tasks) {
                  if (t.id !== taskId) continue;
                  foundAssignment = t.assignments.find(a => a.id === assignmentId) || null;
                  break;
              }
              if (foundAssignment) break;
          }
          if (foundAssignment) break;
      }
      
      if (foundAssignment) {
          let allocation = foundAssignment.allocations.find(a => a.weekId === weekId);
          if (!allocation) {
              allocation = { weekId, count: 0, days: {} };
              foundAssignment.allocations.push(allocation);
          }
          
          if (dayDate) {
               if (!allocation.days) allocation.days = {};
               allocation.days[dayDate] = count; 
               allocation.count = Object.values(allocation.days).reduce((sum, val) => sum + val, 0);
          } else {
               allocation.count = count;
          }
          setProjects(updatedProjects);
          
          if (allocationTimeouts.current[`${assignmentId}-${weekId}`]) {
              window.clearTimeout(allocationTimeouts.current[`${assignmentId}-${weekId}`]);
          }
          
          allocationTimeouts.current[`${assignmentId}-${weekId}`] = window.setTimeout(async () => {
              const { error } = await supabase.from('resource_allocations').upsert({
                  assignment_id: assignmentId,
                  week_id: weekId,
                  count: allocation!.count,
                  days: allocation!.days || {},
                  user_id: session.user.id
              }, { onConflict: 'assignment_id,week_id' });
              
              if (error) {
                  console.error("Failed to save allocation", error);
                  setProjects(previousState);
              }
          }, 1000);
      }
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      let found = false;
      for(const p of updatedProjects) {
        if(p.id !== projectId) continue;
        for(const m of p.modules) {
          if(m.id !== moduleId) continue;
          for(const t of m.tasks) {
            if(t.id !== taskId) continue;
            const a = t.assignments.find(ass => ass.id === assignmentId);
            if(a) {
                a.resourceName = resourceName;
                found = true;
            }
          }
        }
      }
      if(found) setProjects(updatedProjects);

      await callSupabase('UPDATE assignment resource', { assignmentId, resourceName }, 
        supabase.from('task_assignments').update({ resource_name: resourceName }).eq('id', assignmentId)
      );
  };

  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    if (isReadOnlyMode) return;
    const newProjectTask: ProjectTask = {
        id: taskId,
        name: taskName,
        assignments: []
    };
    
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    
    if (module) {
        const maxSort = module.tasks.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
        newProjectTask.sort_order = maxSort + 1;
        
        module.tasks.push(newProjectTask);
        setProjects(updatedProjects);
        
        const { error: taskError } = await callSupabase('CREATE task', { taskId, taskName }, 
             supabase.from('tasks').insert({
                 id: taskId,
                 module_id: moduleId,
                 name: taskName,
                 sort_order: newProjectTask.sort_order,
                 user_id: session.user.id
             })
        );
        
        if (taskError) {
            fetchData(true);
        }
    }
  };

  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      const project = updatedProjects.find(p => p.id === projectId);
      const module = project?.modules.find(m => m.id === moduleId);
      const task = module?.tasks.find(t => t.id === taskId);
      
      if (task) {
          const newAssignmentId = crypto.randomUUID();
          const maxSort = task.assignments.reduce((max, a) => Math.max(max, a.sort_order || 0), 0);
          
          const newAssignment: TaskAssignment = {
              id: newAssignmentId,
              role: role,
              resourceName: 'Unassigned',
              allocations: [],
              sort_order: maxSort + 1
          };
          
          task.assignments.push(newAssignment);
          setProjects(updatedProjects);
          
          await callSupabase('CREATE assignment', { assignmentId: newAssignmentId },
                supabase.from('task_assignments').insert({
                    id: newAssignmentId,
                    task_id: taskId,
                    role: role,
                    resource_name: 'Unassigned',
                    sort_order: newAssignment.sort_order,
                    user_id: session.user.id
                })
            );
      }
  };

  const onCopyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
      
      const sourceAssignment = task?.assignments.find(a => a.id === assignmentId);
      if (sourceAssignment && task) {
          const newAssignmentId = crypto.randomUUID();
          const maxSort = task.assignments.reduce((max, a) => Math.max(max, a.sort_order || 0), 0);
          
          const newAssignment: TaskAssignment = {
              ...deepClone(sourceAssignment),
              id: newAssignmentId,
              resourceName: 'Unassigned',
              allocations: sourceAssignment.allocations.map(a => ({ ...a })),
              sort_order: maxSort + 1
          };
          
          task.assignments.push(newAssignment);
          setProjects(updatedProjects);
          
           const { error } = await callSupabase('COPY assignment', { assignmentId: newAssignmentId },
                supabase.from('task_assignments').insert({
                    id: newAssignmentId,
                    task_id: taskId,
                    role: newAssignment.role,
                    resource_name: 'Unassigned',
                    start_date: newAssignment.startDate,
                    duration: newAssignment.duration,
                    sort_order: newAssignment.sort_order,
                    user_id: session.user.id
                })
            );
            
            if (!error && newAssignment.allocations.length > 0) {
                 const dbAllocations = newAssignment.allocations.map(a => ({
                    assignment_id: newAssignmentId,
                    user_id: session.user.id,
                    week_id: a.weekId,
                    count: a.count,
                    days: a.days || {}
                }));
                await supabase.from('resource_allocations').insert(dbAllocations);
            }
      }
  };
  
  const addProject = async () => {
    if (isReadOnlyMode) return;
    const name = "New Project";
    const { data, error } = await callSupabase('CREATE project', { name }, 
        supabase.from('projects').insert({ name, user_id: session.user.id }).select().single()
    );
    if(data && !error) {
        setProjects(prev => [...prev, { id: data.id, name: data.name, modules: [] }]);
    }
  };
  
  const addModule = async (projectId: string) => {
     if (isReadOnlyMode) return;
     const updatedProjects = deepClone(projects);
     const project = updatedProjects.find(p => p.id === projectId);
     if(project) {
         const name = "New Module";
         const maxSort = project.modules.reduce((max, m) => Math.max(max, m.sort_order || 0), 0);
         
         const { data, error } = await callSupabase('CREATE module', { name },
            supabase.from('modules').insert({
                project_id: projectId,
                name,
                sort_order: maxSort + 1,
                user_id: session.user.id,
                function_points: 0
            }).select().single()
         );
         
         if(data && !error) {
             const newModule: ProjectModule = {
                 id: data.id,
                 name: data.name,
                 tasks: [],
                 legacyFunctionPoints: 0,
                 functionPoints: 0,
                 sort_order: data.sort_order
             };
             project.modules.push(newModule);
             setProjects(updatedProjects);
         }
     }
  };
  
  const updateProjectName = async (projectId: string, name: string) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name } : p));
      await callSupabase('UPDATE project name', { projectId, name },
          supabase.from('projects').update({ name }).eq('id', projectId)
      );
  };

  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => m.id === moduleId ? { ...m, name } : m)
          };
      }));
      await callSupabase('UPDATE module name', { moduleId, name },
          supabase.from('modules').update({ name }).eq('id', moduleId)
      );
  };

  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if (m.id !== moduleId) return m;
                  return {
                      ...m,
                      tasks: m.tasks.map(t => t.id === taskId ? { ...t, name } : t)
                  };
              })
          };
      }));
      await callSupabase('UPDATE task name', { taskId, name },
          supabase.from('tasks').update({ name }).eq('id', taskId)
      );
  };
  
  const deleteProject = async (projectId: string) => {
      if (isReadOnlyMode) return;
      if(!window.confirm("Delete project?")) return;
      setProjects(prev => prev.filter(p => p.id !== projectId));
      await callSupabase('DELETE project', { projectId }, supabase.from('projects').delete().eq('id', projectId));
  };

  const deleteModule = async (projectId: string, moduleId: string) => {
      if (isReadOnlyMode) return;
      if(!window.confirm("Delete module?")) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return { ...p, modules: p.modules.filter(m => m.id !== moduleId) };
      }));
      await callSupabase('DELETE module', { moduleId }, supabase.from('modules').delete().eq('id', moduleId));
  };

  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
      if (isReadOnlyMode) return;
      if(!window.confirm("Delete task?")) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return { ...m, tasks: m.tasks.filter(t => t.id !== taskId) };
              })
          };
      }));
      await callSupabase('DELETE task', { taskId }, supabase.from('tasks').delete().eq('id', taskId));
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if (isReadOnlyMode) return;
      if(!window.confirm("Delete assignment?")) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return {
                      ...m,
                      tasks: m.tasks.map(t => {
                          if(t.id !== taskId) return t;
                          return { ...t, assignments: t.assignments.filter(a => a.id !== assignmentId) };
                      })
                  };
              })
          };
      }));
      await callSupabase('DELETE assignment', { assignmentId }, supabase.from('task_assignments').delete().eq('id', assignmentId));
  };

  const updateFunctionPoints = async (projectId: string, moduleId: string, legacyFp: number, feFp: number, beFp: number, pVel: number, pTeam: number, fVel: number, fTeam: number, bVel: number, bTeam: number) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return { 
                      ...m, 
                      legacyFunctionPoints: legacyFp,
                      frontendFunctionPoints: feFp,
                      backendFunctionPoints: beFp,
                      prepVelocity: pVel,
                      prepTeamSize: pTeam,
                      frontendVelocity: fVel,
                      frontendTeamSize: fTeam,
                      backendVelocity: bVel,
                      backendTeamSize: bTeam,
                      functionPoints: feFp + beFp // Total FP
                  };
              })
          };
      }));
      
      await callSupabase('UPDATE module metrics', { moduleId }, 
          supabase.from('modules').update({ 
              legacy_function_points: legacyFp,
              frontend_function_points: feFp,
              backend_function_points: beFp,
              prep_velocity: pVel,
              prep_team_size: pTeam,
              frontend_velocity: fVel,
              frontend_team_size: fTeam,
              backend_velocity: bVel,
              backend_team_size: bTeam,
              function_points: feFp + beFp
          }).eq('id', moduleId)
      );
  };
  
  const updateModuleComplexity = async (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return type === 'frontend' ? { ...m, frontendComplexity: complexity } : { ...m, backendComplexity: complexity };
              })
          };
      }));
      
      const field = type === 'frontend' ? 'frontend_complexity' : 'backend_complexity';
      await callSupabase('UPDATE module complexity', { moduleId, type, complexity },
          supabase.from('modules').update({ [field]: complexity }).eq('id', moduleId)
      );
  };

  const updateModuleStartDate = async (projectId: string, moduleId: string, startDate: string | null) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return { ...m, startDate: startDate || undefined };
              })
          };
      }));
      
      await callSupabase('UPDATE module start date', { moduleId, startDate },
          supabase.from('modules').update({ start_date: startDate }).eq('id', moduleId)
      );
  };

  const updateModuleDeliveryTask = async (projectId: string, moduleId: string, deliveryTaskId: string | null) => {
     if (isReadOnlyMode) return;
     // Deprecated logic kept for interface compliance
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return { ...m, deliveryTaskId: deliveryTaskId || undefined };
              })
          };
      }));
      
      await callSupabase('UPDATE module delivery task', { moduleId, deliveryTaskId },
          supabase.from('modules').update({ delivery_task_id: deliveryTaskId }).eq('id', moduleId)
      );
  };

  const updateModuleStartTask = async (projectId: string, moduleId: string, startTaskId: string | null) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  return { ...m, startTaskId: startTaskId || undefined };
              })
          };
      }));
      
      await callSupabase('UPDATE module start task', { moduleId, startTaskId },
          supabase.from('modules').update({ start_task_id: startTaskId }).eq('id', moduleId)
      );
  };
  
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
                <h1 className="font-bold text-lg text-slate-800 tracking-tight">
                    OMS Resource Master 
                    {isReadOnlyMode && <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Read-Only Mode</span>}
                </h1>
            </div>
            <div className="flex items-center gap-4">
                {!isReadOnlyMode && (
                    <button 
                        onClick={() => setShowShareModal(true)} 
                        className="text-xs flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 border border-indigo-200 transition-colors font-medium"
                    >
                        <Share2 size={14} /> Share
                    </button>
                )}
                <span className="text-xs font-medium bg-slate-50 text-slate-700 px-3 py-1 rounded-full border border-slate-200">{session.user.email}</span>
                <button onClick={() => supabase.auth.signOut()} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sign Out">
                    <LogOut size={18} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
            {/* Sidebar - INCREASED Z-INDEX TO 60 */}
            <div className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out z-[60]`}>
                <nav className="p-2 space-y-1 mt-4">
                   <SidebarItem icon={LayoutDashboard} label="Dashboard" isActive={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Calendar} label="Planner" isActive={activeTab === 'planner'} onClick={() => setActiveTab('planner')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Calculator} label="Estimator" isActive={activeTab === 'estimator'} onClick={() => setActiveTab('estimator')} collapsed={isSidebarCollapsed} />
                   <div className="my-2 border-t border-slate-100"></div>
                   <SidebarItem icon={Users} label="Resources" isActive={activeTab === 'resources'} onClick={() => setActiveTab('resources')} collapsed={isSidebarCollapsed} />
                   <SidebarItem icon={Globe} label="Holidays" isActive={activeTab === 'holidays'} onClick={() => setActiveTab('holidays')} collapsed={isSidebarCollapsed} />
                   <div className="my-2 border-t border-slate-100"></div>
                   {!isReadOnlyMode && <SidebarItem icon={SettingsIcon} label="Settings" isActive={activeTab === 'settings'} onClick={() => setActiveTab('settings')} collapsed={isSidebarCollapsed} />}
                </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 bg-slate-50 relative overflow-hidden flex flex-col">
                <div className="flex-1 p-4 overflow-hidden">
                    {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
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
                                onUpdateAssignmentProgress={updateAssignmentProgress}
                                onAddProject={addProject}
                                onAddModule={addModule}
                                onUpdateProjectName={updateProjectName}
                                onUpdateModuleName={updateModuleName}
                                onUpdateTaskName={updateTaskName}
                                onDeleteProject={deleteProject}
                                onDeleteModule={deleteModule}
                                onDeleteTask={deleteTask}
                                onDeleteAssignment={deleteAssignment}
                                onImportPlan={(p) => { if(!isReadOnlyMode) setProjects(p); }}
                                onShowHistory={() => setShowHistory(true)}
                                onRefresh={() => fetchData(true)}
                                saveStatus={saveStatus}
                                isRefreshing={isRefreshing}
                                isReadOnly={isReadOnlyMode}
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
                                isReadOnly={isReadOnlyMode}
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
                              onUpdateResourceName={updateResourceName}
                              onAddIndividualHoliday={addIndividualHolidays}
                              onDeleteIndividualHoliday={deleteIndividualHoliday}
                              isReadOnly={isReadOnlyMode}
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
                    {activeTab === 'settings' && !isReadOnlyMode && (
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
        {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} />}
        {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
        {showHistory && !isReadOnlyMode && (
            <VersionHistory 
                onClose={() => setShowHistory(false)} 
                onRestore={restoreVersion}
                onSaveCurrent={saveCurrentVersion}
            />
        )}
        {isAIEnabled && !isReadOnlyMode && <AIAssistant 
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
