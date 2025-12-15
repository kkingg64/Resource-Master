
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

// Generate a consistent color from a string
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 
    'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 
    'bg-cyan-500', 'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 
    'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500'
  ];
  return colors[Math.abs(hash) % colors.length];
}

const ShareModal: React.FC<{ onClose: () => void, ownerId: string }> = ({ onClose, ownerId }) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}${window.location.pathname}?mode=readonly&owner=${ownerId}`;

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
  const [activeViewers, setActiveViewers] = useState<any[]>([]);
  
  // Read Only Mode Logic
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);

  // Derived state for data ownership
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const urlOwnerId = params.get('owner');
  const targetUserId = session ? (urlOwnerId || session.user.id) : null;
  const isOwner = session && targetUserId === session.user.id;

  useEffect(() => {
    const mode = params.get('mode');
    if (session && !isOwner) {
        setIsReadOnlyMode(true);
    } else if (mode === 'readonly') {
        setIsReadOnlyMode(true);
    } else {
        setIsReadOnlyMode(false);
    }
  }, [session, isOwner, params]);
  
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

  // Presence logic for active viewers
  useEffect(() => {
    if (!session || !targetUserId) return;

    const channel = supabase.channel(`project-room-${targetUserId}`, {
      config: {
        presence: {
          key: session.user.id,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const newState = channel.presenceState();
        const viewers = [];
        for (const key in newState) {
          viewers.push(...newState[key]);
        }
        // Remove duplicates if any
        const uniqueViewers = Array.from(new Map(viewers.map(v => [v.user_id, v])).values());
        setActiveViewers(uniqueViewers);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: session.user.id,
            email: session.user.email, // Ensure email is available or fallback
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, targetUserId]);

  useEffect(() => {
    if (session) {
      fetchData(false);
    }
  }, [session, targetUserId]); // Re-fetch if targetUserId changes

  const calculateTimelineBounds = (currentProjects: Project[]) => {
    if (currentProjects.length === 0) return;

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

    currentProjects.forEach(project => {
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
    }
  };
  
  const fetchData = async (isRefresh: boolean = false) => {
    if (!session || !targetUserId) return;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data: projectsData, error: projectsError } = await supabase.from('projects').select('*').eq('user_id', targetUserId);
    if (projectsError) { console.error("Error fetching projects", projectsError); setLoading(false); return; }

    let finalProjectsData = projectsData;
    // Only create default project if you are the owner and have no projects
    if (projectsData && projectsData.length === 0 && isOwner) {
      const { data: newProject, error: newProjectError } = await callSupabase(
        'CREATE default project', { name: 'My First Project' },
        supabase.from('projects').insert({ name: 'My First Project', user_id: session!.user.id }).select().single()
      );
      if (newProject && !newProjectError) { finalProjectsData = [newProject]; }
    }
    
    const projectIds = finalProjectsData.map(p => p.id);
    let modulesData = [], tasksData = [], assignmentsData = [];
    let allocationsData = [];

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
    
    const structuredProjects = structureProjectsData(finalProjectsData, modulesData, tasksData, assignmentsData, allocationsData);
    setProjects(structuredProjects);
    
    // Calculate timeline BEFORE stopping the loading spinner to prevent UI jumps
    calculateTimelineBounds(structuredProjects);

    const { data: resourcesData, error: resourcesError } = await supabase
      .from('resources')
      .select('*, individual_holidays(*)')
      .eq('user_id', targetUserId)
      .order('name');
    
    if (resourcesError) console.error(resourcesError);
    else if (resourcesData) setResources(resourcesData);

    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*')
      .eq('user_id', targetUserId);
      
    if (holidaysError) console.error(holidaysError);
    else if (holidaysData) setHolidays(holidaysData);

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
    
    // Shift all assignments
    task.assignments.forEach(a => {
        if(a.startDate) {
            const d = new Date(a.startDate.replace(/-/g, '/'));
            d.setDate(d.getDate() + (direction === 'left' ? -7 : 7)); // Shift by 1 week
            a.startDate = formatDateForInput(d);
            
            // Shift allocations
            if (a.allocations.length > 0) {
                 const newAllocationsMap = new Map<string, ResourceAllocation>();
                 a.allocations.forEach(alloc => {
                     const newWeekId = shiftWeekId(alloc.weekId, direction);
                     if (newAllocationsMap.has(newWeekId)) {
                        newAllocationsMap.get(newWeekId)!.count += alloc.count;
                     } else {
                        newAllocationsMap.set(newWeekId, { ...alloc, weekId: newWeekId, days: {} });
                     }
                 });
                 a.allocations = Array.from(newAllocationsMap.values());
            }
        }
    });

    setProjects(updatedProjects);
    
    // Propagate changes for all assignments in task
    for (const assignment of task.assignments) {
        await propagateScheduleChanges(updatedProjects, assignment.id);
    }

    const { error } = await callSupabase(
        'SHIFT task',
        { taskId, direction },
        supabase.from('task_assignments').upsert(task.assignments.map(a => ({ id: a.id, start_date: a.startDate, task_id: taskId, user_id: session!.user.id })))
    );

    if(error) {
        setProjects(previousState);
        alert("Failed to shift task.");
    } else {
        // Also update allocations in DB
        for (const assignment of task.assignments) {
             await supabase.from('resource_allocations').delete().eq('assignment_id', assignment.id);
             if (assignment.allocations.length > 0) {
                const dbAllocations = assignment.allocations.map(a => ({
                    assignment_id: assignment.id,
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

  const copyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
    if (isReadOnlyMode) return;
    const project = projects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    const task = module?.tasks.find(t => t.id === taskId);
    const assignment = task?.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;
    
    // Generate new ID locally for optimisic UI
    const newId = crypto.randomUUID();
    const newAssignment: TaskAssignment = {
        ...deepClone(assignment),
        id: newId,
        resourceName: undefined, // Clear resource
        sort_order: (task?.assignments.length || 0)
    };
    
    // Clear allocations for the copy
    newAssignment.allocations = [];
    
    const previousState = deepClone(projects);
    const updatedProjects = deepClone(projects);
    updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId)?.assignments.push(newAssignment);
    setProjects(updatedProjects);

    const { data, error } = await callSupabase('COPY assignment', { assignmentId }, supabase.from('task_assignments').insert({
        id: newId,
        task_id: taskId,
        role: assignment.role,
        start_date: assignment.startDate,
        duration: assignment.duration,
        parent_assignment_id: assignment.parentAssignmentId,
        sort_order: newAssignment.sort_order,
        user_id: session!.user.id
    }));

    if (error) {
        setProjects(previousState);
        alert("Failed to copy assignment.");
    }
  };

  const updateAllocation = (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    if (isReadOnlyMode) return;
    const updatedProjects = deepClone(projects);
    const project = updatedProjects.find(p => p.id === projectId);
    const module = project?.modules.find(m => m.id === moduleId);
    const task = module?.tasks.find(t => t.id === taskId);
    const assignment = task?.assignments.find(a => a.id === assignmentId);
    if (!assignment) return;

    // --- Daily Allocation Logic ---
    if (dayDate) {
        let alloc = assignment.allocations.find(a => a.weekId === weekId);
        if (!alloc) {
            alloc = { weekId, count: 0, days: {} };
            assignment.allocations.push(alloc);
        }
        alloc.days = alloc.days || {};
        alloc.days[dayDate] = value;
        
        // Recalculate weekly total from days
        let weeklyTotal = 0;
        Object.values(alloc.days).forEach(val => weeklyTotal += val);
        alloc.count = weeklyTotal;
        
        if (weeklyTotal === 0 && Object.keys(alloc.days).length === 0) {
             assignment.allocations = assignment.allocations.filter(a => a.weekId !== weekId);
        }
    } 
    // --- Weekly Allocation Logic ---
    else {
        // If updating weekly total directly, clear daily breakdown as it becomes invalid/approximate
        const existingIndex = assignment.allocations.findIndex(a => a.weekId === weekId);
        if (existingIndex > -1) {
            if (value <= 0) {
                assignment.allocations.splice(existingIndex, 1);
            } else {
                assignment.allocations[existingIndex].count = value;
                assignment.allocations[existingIndex].days = {}; // Clear daily
            }
        } else if (value > 0) {
            assignment.allocations.push({ weekId, count: value, days: {} });
        }
    }
    setProjects(updatedProjects);

    // Debounced Save
    const key = `${assignmentId}-${weekId}`;
    window.clearTimeout(allocationTimeouts.current[key]);
    allocationTimeouts.current[key] = window.setTimeout(async () => {
       const finalAlloc = updatedProjects
           .find(p => p.id === projectId)?.modules
           .find(m => m.id === moduleId)?.tasks
           .find(t => t.id === taskId)?.assignments
           .find(a => a.id === assignmentId)?.allocations
           .find(a => a.weekId === weekId);

       if (finalAlloc) {
           await callSupabase('UPDATE allocation', { assignmentId, weekId, value }, supabase.from('resource_allocations').upsert({ 
               assignment_id: assignmentId, 
               week_id: weekId, 
               count: finalAlloc.count,
               days: finalAlloc.days || {},
               user_id: session!.user.id 
            }, { onConflict: 'assignment_id,week_id' }));
       } else {
           await callSupabase('DELETE allocation', { assignmentId, weekId }, supabase.from('resource_allocations').delete().match({ assignment_id: assignmentId, week_id: weekId }));
       }
    }, 500);
  };

  const addProject = async () => {
    if (isReadOnlyMode) return;
    const newId = crypto.randomUUID();
    const newProject: Project = { id: newId, name: "New Project", modules: [] };
    setProjects([...projects, newProject]);
    await callSupabase('ADD project', { id: newId }, supabase.from('projects').insert({ id: newId, name: "New Project", user_id: session!.user.id }));
  };

  const addModule = async (projectId: string) => {
    if (isReadOnlyMode) return;
    const newId = crypto.randomUUID();
    const projectIndex = projects.findIndex(p => p.id === projectId);
    const newModule: ProjectModule = { id: newId, name: "New Module", legacyFunctionPoints: 0, functionPoints: 0, tasks: [], sort_order: projects[projectIndex].modules.length };
    const updatedProjects = deepClone(projects);
    updatedProjects[projectIndex].modules.push(newModule);
    setProjects(updatedProjects);
    await callSupabase('ADD module', { id: newId }, supabase.from('modules').insert({ id: newId, project_id: projectId, name: "New Module", sort_order: newModule.sort_order, user_id: session!.user.id }));
  };

  const updateProjectName = async (projectId: string, name: string) => {
      if (isReadOnlyMode) return;
      const updatedProjects = projects.map(p => p.id === projectId ? { ...p, name } : p);
      setProjects(updatedProjects);
      await callSupabase('UPDATE project name', { projectId, name }, supabase.from('projects').update({ name }).eq('id', projectId));
  };

  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
      if (module) module.name = name;
      setProjects(updatedProjects);
      await callSupabase('UPDATE module name', { moduleId, name }, supabase.from('modules').update({ name }).eq('id', moduleId));
  };

  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
      if (task) task.name = name;
      setProjects(updatedProjects);
      await callSupabase('UPDATE task name', { taskId, name }, supabase.from('tasks').update({ name }).eq('id', taskId));
  };

  const deleteProject = async (projectId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm("Delete project?")) return;
      setProjects(projects.filter(p => p.id !== projectId));
      await callSupabase('DELETE project', { projectId }, supabase.from('projects').delete().eq('id', projectId));
  };

  const deleteModule = async (projectId: string, moduleId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm("Delete module?")) return;
      const updatedProjects = deepClone(projects);
      const project = updatedProjects.find(p => p.id === projectId);
      if (project) {
          project.modules = project.modules.filter(m => m.id !== moduleId);
          setProjects(updatedProjects);
          await callSupabase('DELETE module', { moduleId }, supabase.from('modules').delete().eq('id', moduleId));
      }
  };

  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm("Delete task?")) return;
      const updatedProjects = deepClone(projects);
      const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
      if (module) {
          module.tasks = module.tasks.filter(t => t.id !== taskId);
          setProjects(updatedProjects);
          await callSupabase('DELETE task', { taskId }, supabase.from('tasks').delete().eq('id', taskId));
      }
  };
  
  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm("Delete assignment?")) return;
      const updatedProjects = deepClone(projects);
      const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
      if (task) {
          task.assignments = task.assignments.filter(a => a.id !== assignmentId);
          setProjects(updatedProjects);
          await callSupabase('DELETE assignment', { assignmentId }, supabase.from('task_assignments').delete().eq('id', assignmentId));
      }
  };

  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    if (isReadOnlyMode) return;
    const updatedProjects = deepClone(projects);
    const module = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId);
    if (!module) return;
    
    // Check if task exists (re-use logic for AI assistant)
    let task = module.tasks.find(t => t.id === taskId);
    if (!task) {
        task = { id: taskId, name: taskName, assignments: [], sort_order: module.tasks.length };
        module.tasks.push(task);
        // DB insert
        await callSupabase('ADD task', { taskId }, supabase.from('tasks').insert({ id: taskId, module_id: moduleId, name: taskName, sort_order: task.sort_order, user_id: session!.user.id }));
    }
    
    // Add default assignment
    const assignmentId = crypto.randomUUID();
    const assignment: TaskAssignment = { id: assignmentId, role, allocations: [], sort_order: 0 };
    task.assignments.push(assignment);
    setProjects(updatedProjects);
    
    await callSupabase('ADD assignment', { assignmentId }, supabase.from('task_assignments').insert({ id: assignmentId, task_id: taskId, role, sort_order: 0, user_id: session!.user.id }));
  };

  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
      if (isReadOnlyMode) return;
      const updatedProjects = deepClone(projects);
      const task = updatedProjects.find(p => p.id === projectId)?.modules.find(m => m.id === moduleId)?.tasks.find(t => t.id === taskId);
      if (task) {
          const assignmentId = crypto.randomUUID();
          const newAssignment: TaskAssignment = { id: assignmentId, role, allocations: [], sort_order: task.assignments.length };
          task.assignments.push(newAssignment);
          setProjects(updatedProjects);
          await callSupabase('ADD assignment', { assignmentId }, supabase.from('task_assignments').insert({ id: assignmentId, task_id: taskId, role, sort_order: newAssignment.sort_order, user_id: session!.user.id }));
      }
  };

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-2">OMS Resource Master</h1>
            <p className="text-slate-500">Sign in to manage your projects</p>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            providers={['google', 'github']}
            theme="light"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <aside className={`${isSidebarCollapsed ? 'w-0 -ml-4' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out z-40 flex-shrink-0`}>
        <div className="p-4 flex items-center gap-3 border-b border-slate-800">
           <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-900/50 flex-shrink-0">OM</div>
           <span className="font-bold text-lg text-white tracking-tight truncate">Resource Master</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
           <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <LayoutDashboard size={18} /> <span className="text-sm font-medium">Dashboard</span>
           </button>
           <button onClick={() => setActiveTab('planner')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <Calendar size={18} /> <span className="text-sm font-medium">Planner</span>
           </button>
           <button onClick={() => setActiveTab('estimator')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <Calculator size={18} /> <span className="text-sm font-medium">Estimator</span>
           </button>
           <div className="pt-4 pb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-2">Configuration</p>
           </div>
           <button onClick={() => setActiveTab('resources')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <Users size={18} /> <span className="text-sm font-medium">Resources</span>
           </button>
           <button onClick={() => setActiveTab('holidays')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <Globe size={18} /> <span className="text-sm font-medium">Holidays</span>
           </button>
           <button onClick={() => setActiveTab('settings')} className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800'}`}>
              <SettingsIcon size={18} /> <span className="text-sm font-medium">Settings</span>
           </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
             <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
               {session?.user.email?.charAt(0).toUpperCase()}
             </div>
             <div className="overflow-hidden">
               <div className="text-sm font-medium text-white truncate">{session?.user.email}</div>
               <div className="text-xs text-slate-500 truncate">Project Manager</div>
             </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors w-full">
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 shadow-sm z-50 relative flex-shrink-0">
          <div className="max-w-[1920px] mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                  {isSidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
               </button>
               <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                 <span className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-md shadow-indigo-200">OMS</span>
                 <span className="hidden md:inline">Resource Master</span>
               </h1>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('dashboard')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <LayoutDashboard size={16} /> <span className="hidden sm:inline">Dashboard</span>
                  </button>
                  <button onClick={() => setActiveTab('planner')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'planner' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <Calendar size={16} /> <span className="hidden sm:inline">Planner</span>
                  </button>
                  <button onClick={() => setActiveTab('estimator')} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'estimator' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                     <Calculator size={16} /> <span className="hidden sm:inline">Estimator</span>
                  </button>
               </div>

               <div className="flex items-center gap-3 pl-4 border-l border-slate-200 ml-2">
                    {/* Active Viewers Avatars */}
                    <div className="flex items-center -space-x-2">
                        {activeViewers.map((viewer) => (
                        <div 
                            key={viewer.user_id} 
                            className={`w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold text-white shadow-sm ${stringToColor(viewer.email || 'U')}`}
                            title={viewer.email}
                        >
                            {(viewer.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        ))}
                    </div>

                    {isReadOnlyMode && (
                        <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded border border-amber-200">
                        Read Only
                        </span>
                    )}

                    <button 
                        onClick={() => setShowShareModal(true)} 
                        className="flex items-center gap-2 bg-white text-slate-700 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors text-sm font-medium shadow-sm"
                    >
                        <Share2 size={16} />
                        <span className="hidden sm:inline">Share</span>
                    </button>
                </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          {loading ? (
             <div className="h-full flex items-center justify-center">
               <div className="flex flex-col items-center gap-4">
                 <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 <p className="text-slate-500 font-medium">Loading project data...</p>
               </div>
             </div>
          ) : (
            <div className="h-full overflow-hidden p-4">
              {activeTab === 'dashboard' && <Dashboard projects={projects} />}
              {activeTab === 'planner' && (
                <PlannerGrid
                  projects={projects}
                  holidays={holidays}
                  resources={resources}
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  onExtendTimeline={(direction) => {
                      if (direction === 'start') setTimelineStart(addWeeksToPoint(timelineStart, -4));
                      if (direction === 'end') setTimelineEnd(addWeeksToPoint(timelineEnd, 4));
                  }}
                  onUpdateAllocation={updateAllocation}
                  onUpdateAssignmentResourceName={async (pId, mId, tId, aId, name) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const assignment = updated.find(p=>p.id===pId)?.modules.find(m=>m.id===mId)?.tasks.find(t=>t.id===tId)?.assignments.find(a=>a.id===aId);
                      if(assignment) assignment.resourceName = name;
                      setProjects(updated);
                      // If changing resource, we might need to recalculate schedule based on new resource holidays? 
                      // For now, just update the name. Advanced logic would re-run schedule.
                      await callSupabase('UPDATE resource', { aId, name }, supabase.from('task_assignments').update({ resource_name: name }).eq('id', aId));
                  }}
                  onUpdateAssignmentDependency={updateAssignmentDependency}
                  onAddTask={addTask}
                  onAddAssignment={addAssignment}
                  onCopyAssignment={copyAssignment}
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
                  onImportPlan={async (importedProjects, importedHolidays) => {
                       if (isReadOnlyMode) return;
                       setLoading(true);
                       // Delete existing
                       for (const p of projects) { await deleteProject(p.id); }
                       // Import new
                       // Simplified import logic - in production needs robust batch inserts
                       // Re-fetch to sync
                       await fetchData();
                       setLoading(false);
                  }}
                  onShowHistory={() => setShowHistory(true)}
                  onRefresh={() => fetchData(true)}
                  saveStatus={saveStatus}
                  isRefreshing={isRefreshing}
                  isReadOnly={isReadOnlyMode}
                />
              )}
              {activeTab === 'estimator' && <Estimator 
                  projects={projects} 
                  holidays={holidays}
                  onUpdateFunctionPoints={async (pId, mId, lFp, fFp, bFp, pVel, pTeam, fVel, fTeam, bVel, bTeam) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const mod = updated.find(p => p.id === pId)?.modules.find(m => m.id === mId);
                      if (mod) { 
                          mod.legacyFunctionPoints = lFp;
                          mod.frontendFunctionPoints = fFp;
                          mod.backendFunctionPoints = bFp;
                          mod.prepVelocity = pVel;
                          mod.prepTeamSize = pTeam;
                          mod.frontendVelocity = fVel;
                          mod.frontendTeamSize = fTeam;
                          mod.backendVelocity = bVel;
                          mod.backendTeamSize = bTeam;
                      }
                      setProjects(updated);
                      await callSupabase('UPDATE estimation', { mId }, supabase.from('modules').update({ 
                          legacy_function_points: lFp,
                          frontend_function_points: fFp,
                          backend_function_points: bFp,
                          prep_velocity: pVel,
                          prep_team_size: pTeam,
                          frontend_velocity: fVel,
                          frontend_team_size: fTeam,
                          backend_velocity: bVel,
                          backend_team_size: bTeam
                      }).eq('id', mId));
                  }}
                  onUpdateModuleComplexity={async (pId, mId, type, complexity) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const mod = updated.find(p => p.id === pId)?.modules.find(m => m.id === mId);
                      if (mod) {
                          if (type === 'frontend') mod.frontendComplexity = complexity;
                          else mod.backendComplexity = complexity;
                      }
                      setProjects(updated);
                      await callSupabase('UPDATE complexity', { mId, type, complexity }, supabase.from('modules').update({ 
                          [type === 'frontend' ? 'frontend_complexity' : 'backend_complexity']: complexity 
                      }).eq('id', mId));
                  }}
                  onUpdateModuleStartDate={async (pId, mId, date) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const mod = updated.find(p => p.id === pId)?.modules.find(m => m.id === mId);
                      if (mod) mod.startDate = date || undefined;
                      setProjects(updated);
                      await callSupabase('UPDATE module start', { mId, date }, supabase.from('modules').update({ start_date: date }).eq('id', mId));
                  }}
                  onUpdateModuleStartTask={async (pId, mId, taskId) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const mod = updated.find(p => p.id === pId)?.modules.find(m => m.id === mId);
                      if (mod) mod.startTaskId = taskId || undefined;
                      setProjects(updated);
                      await callSupabase('UPDATE module start task', { mId, taskId }, supabase.from('modules').update({ start_task_id: taskId }).eq('id', mId));
                  }}
                  onUpdateModuleDeliveryTask={async (pId, mId, taskId) => {
                      if (isReadOnlyMode) return;
                      const updated = deepClone(projects);
                      const mod = updated.find(p => p.id === pId)?.modules.find(m => m.id === mId);
                      if (mod) mod.deliveryTaskId = taskId || undefined;
                      setProjects(updated);
                      await callSupabase('UPDATE module delivery task', { mId, taskId }, supabase.from('modules').update({ delivery_task_id: taskId }).eq('id', mId));
                  }}
                  onReorderModules={reorderModules}
                  isReadOnly={isReadOnlyMode}
              />}
              {activeTab === 'settings' && <Settings isDebugLogEnabled={isDebugLogEnabled} setIsDebugLogEnabled={setIsDebugLogEnabled} isAIEnabled={isAIEnabled} setIsAIEnabled={setIsAIEnabled} />}
              {activeTab === 'resources' && <Resources 
                  resources={resources} 
                  onAddResource={async (name, cat, region, type) => {
                      if (isReadOnlyMode) return;
                      const id = crypto.randomUUID();
                      const newRes: Resource = { id, name, category: cat, holiday_region: region, individual_holidays: [], type };
                      setResources([...resources, newRes]);
                      await callSupabase('ADD resource', { name }, supabase.from('resources').insert({ id, name, category: cat, holiday_region: region, type, user_id: session!.user.id }));
                  }} 
                  onDeleteResource={async (id) => {
                      if (isReadOnlyMode) return;
                      if(!confirm("Delete resource?")) return;
                      setResources(resources.filter(r => r.id !== id));
                      await callSupabase('DELETE resource', { id }, supabase.from('resources').delete().eq('id', id));
                  }}
                  onUpdateResourceCategory={async (id, cat) => {
                      if (isReadOnlyMode) return;
                      setResources(resources.map(r => r.id === id ? { ...r, category: cat } : r));
                      await callSupabase('UPDATE resource category', { id, cat }, supabase.from('resources').update({ category: cat }).eq('id', id));
                  }}
                  onUpdateResourceRegion={async (id, region) => {
                      if (isReadOnlyMode) return;
                      setResources(resources.map(r => r.id === id ? { ...r, holiday_region: region || undefined } : r));
                      await callSupabase('UPDATE resource region', { id, region }, supabase.from('resources').update({ holiday_region: region }).eq('id', id));
                  }}
                  onUpdateResourceType={async (id, type) => {
                      if (isReadOnlyMode) return;
                      setResources(resources.map(r => r.id === id ? { ...r, type } : r));
                      await callSupabase('UPDATE resource type', { id, type }, supabase.from('resources').update({ type }).eq('id', id));
                  }}
                  onUpdateResourceName={async (id, name) => {
                      if (isReadOnlyMode) return;
                      setResources(resources.map(r => r.id === id ? { ...r, name } : r));
                      await callSupabase('UPDATE resource name', { id, name }, supabase.from('resources').update({ name }).eq('id', id));
                  }}
                  onAddIndividualHoliday={async (resId, items) => {
                      if (isReadOnlyMode) return;
                      const updatedResources = deepClone(resources);
                      const res = updatedResources.find(r => r.id === resId);
                      if (res) {
                          const newHolidays = items.map(item => ({ id: crypto.randomUUID(), date: item.date, name: item.name, resource_id: resId }));
                          res.individual_holidays = [...(res.individual_holidays || []), ...newHolidays];
                          setResources(updatedResources);
                          await callSupabase('ADD individual holidays', { count: items.length }, supabase.from('individual_holidays').insert(newHolidays));
                      }
                  }}
                  onDeleteIndividualHoliday={async (hId) => {
                      if (isReadOnlyMode) return;
                      const updatedResources = deepClone(resources);
                      updatedResources.forEach(r => {
                          if (r.individual_holidays) {
                              r.individual_holidays = r.individual_holidays.filter(h => h.id !== hId);
                          }
                      });
                      setResources(updatedResources);
                      await callSupabase('DELETE individual holiday', { hId }, supabase.from('individual_holidays').delete().eq('id', hId));
                  }}
                  isReadOnly={isReadOnlyMode}
              />}
              {activeTab === 'holidays' && <AdminSettings 
                holidays={holidays}
                onAddHolidays={async (items) => {
                    if (isReadOnlyMode) return;
                    const newHolidays = items.map(i => ({ ...i, id: crypto.randomUUID(), user_id: session!.user.id }));
                    setHolidays([...holidays, ...newHolidays]);
                    await callSupabase('ADD holidays', { count: items.length }, supabase.from('holidays').insert(newHolidays));
                }}
                onDeleteHoliday={async (id) => {
                    if (isReadOnlyMode) return;
                    setHolidays(holidays.filter(h => h.id !== id));
                    await callSupabase('DELETE holiday', { id }, supabase.from('holidays').delete().eq('id', id));
                }}
                onDeleteHolidaysByCountry={async (country) => {
                    if (isReadOnlyMode) return;
                    setHolidays(holidays.filter(h => h.country !== country));
                    await callSupabase('DELETE holidays by country', { country }, supabase.from('holidays').delete().eq('country', country).eq('user_id', session!.user.id));
                }}
              />}
            </div>
          )}
        </main>

        {showHistory && <VersionHistory 
            onClose={() => setShowHistory(false)} 
            onSaveCurrent={async (name) => {
                 if (isReadOnlyMode) return;
                 // Mock save version
                 await callSupabase('SAVE version', { name }, supabase.from('versions').insert({ name, user_id: session!.user.id }));
            }}
            onRestore={(id) => {
                if (isReadOnlyMode) return;
                alert("Restore logic placeholder");
            }}
        />}

        {showShareModal && session && (
          <ShareModal 
            onClose={() => setShowShareModal(false)} 
            ownerId={targetUserId || session.user.id} 
          />
        )}
        
        {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
        
        {isAIEnabled && <AIAssistant 
            projects={projects} 
            resources={resources}
            onAddTask={(projectId, moduleId, taskId, taskName, role) => addTask(projectId, moduleId, taskId, taskName, role)}
            onAssignResource={(pId, mId, tId, assignmentId, resName) => updateAllocation(pId, mId, tId, assignmentId, "manual-ai-override", 0)} // Simplified AI hook
        />}

      </div>
    </div>
  );
};

export default App;
