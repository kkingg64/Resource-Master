import React, { useState, useEffect, useRef, useMemo } from 'react';
import { GOV_HOLIDAYS_DB, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getWeekIdFromDate, getDateFromWeek, formatDateForInput, calculateEndDate, findNextWorkingDay } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource, ComplexityLevel, ModuleType } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Settings } from './components/Settings';
import { Resources } from './components/Resources';
import { VersionHistory } from './components/VersionHistory';
import { DebugLog } from './components/DebugLog';
import { AdminSettings } from './components/AdminSettings';
import { AIAssistant } from './components/AIAssistant';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, Users, Globe, Share2, Copy, Check, X, Mail } from 'lucide-react';
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
      startDate: t.start_date,
      sort_order: t.sort_order,
      frontendFunctionPoints: t.frontend_function_points || 0,
      backendFunctionPoints: t.backend_function_points || 0,
      frontendVelocity: t.frontend_velocity,
      frontendTeamSize: t.frontend_team_size,
      frontendComplexity: t.frontend_complexity,
      backendVelocity: t.backend_velocity,
      backendTeamSize: t.backend_team_size,
      backendComplexity: t.backend_complexity,
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
      type: m.type || ModuleType.Development,
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

const ShareModal: React.FC<{ onClose: () => void, session: any }> = ({ onClose, session }) => {
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const shareUrl = `${window.location.origin}${window.location.pathname}?share=${session.user.id}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareViaEmail = () => {
    if (!email.trim()) return;
    
    const subject = encodeURIComponent("Project Plan for OMS Resource Master");
    const body = encodeURIComponent(
      `Hi,\n\nPlease find the read-only project plan here:\n${shareUrl}\n\nThanks!`
    );
    
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
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

        <div>
          <label className="text-sm font-medium text-slate-700">Copy Link</label>
          <p className="text-xs text-slate-500 mb-2">
            Share this unique link with your team members. It will give them <strong>Read-Only</strong> access to your project plan.
          </p>
          <div className="flex items-center gap-2">
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
        </div>
        
        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">Invite via Email</label>
          <p className="text-xs text-slate-500 mb-2">Draft an email with the link to send to a teammate.</p>
          <div className="flex items-center gap-2">
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1 bg-slate-50 border border-slate-300 text-slate-600 text-sm rounded-lg p-2.5 focus:ring-indigo-500 focus:border-indigo-500 block w-full"
            />
            <button 
              onClick={handleShareViaEmail}
              className="p-2.5 rounded-lg border flex items-center justify-center bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Open Email Client"
              disabled={!email.trim()}
            >
              <Mail size={18} />
            </button>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs text-amber-800 mt-6">
           <strong>Note:</strong> Team members will need to be logged into the application to view the shared plan.
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

// Helper function for shared FP logic
const getTaskBaseName = (name: string): string => {
  const prefixes = ["Design & Build-", "QA-", "UAT-"];
  for (const prefix of prefixes) {
    if (name.startsWith(prefix)) {
      return name.substring(prefix.length).trim();
    }
  }
  return name.trim();
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
  
  // Read Only Mode & Sharing Logic
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(false);
  const [sharedUserId, setSharedUserId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get('share');
    if (shareId) {
        setIsReadOnlyMode(true);
        setSharedUserId(shareId);
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
  }, [session, sharedUserId]); // Re-fetch if sharedUserId changes

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
    
    let projectsData, modulesData, tasksData, assignmentsData, allocationsData, resourcesData, holidaysData;

    if (sharedUserId) {
      // --- NEW LOGIC FOR SHARED VIEW ---
      const { data: sharedData, error: rpcError } = await supabase.rpc('get_shared_plan_data', { user_id_to_fetch: sharedUserId });

      if (rpcError) {
          console.error("Error fetching shared plan", rpcError);
          alert("Could not load the shared plan. The link may be invalid, or the database function may not be set up correctly.");
          setLoading(false);
          setIsRefreshing(false);
          return;
      }
      
      projectsData = sharedData.projects || [];
      modulesData = sharedData.modules || [];
      tasksData = sharedData.tasks || [];
      assignmentsData = sharedData.assignments || [];
      allocationsData = sharedData.allocations || [];
      resourcesData = sharedData.resources || [];
      holidaysData = sharedData.holidays || [];

    } else {
      // --- EXISTING LOGIC FOR USER'S OWN DATA ---
      const userIdToFetch = session.user.id;
      const { data: pData, error: pError } = await supabase.from('projects').select('*').eq('user_id', userIdToFetch);
      if (pError) { console.error("Error fetching projects", pError); setLoading(false); return; }
      projectsData = pData;

      if (projectsData && projectsData.length === 0) {
        const { data: newProject, error: newProjectError } = await callSupabase( 'CREATE default project', { name: 'My First Project' }, supabase.from('projects').insert({ name: 'My First Project', user_id: session!.user.id }).select().single() );
        if (newProject && !newProjectError) { projectsData = [newProject]; }
      }
      
      const projectIds = projectsData.map(p => p.id);
      modulesData = [], tasksData = [], assignmentsData = [], allocationsData = [];

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
      
      const { data: resData, error: resError } = await supabase.from('resources').select('*, individual_holidays(*)').eq('user_id', userIdToFetch).order('name');
      if (resError) console.error(resError);
      resourcesData = resData || [];

      const { data: holData, error: holError } = await supabase.from('holidays').select('*').eq('user_id', userIdToFetch);
      if (holError) console.error(holError);
      holidaysData = holData || [];
    }
    
    const structuredProjects = structureProjectsData(projectsData, modulesData, tasksData, assignmentsData, allocationsData);
    
    setHolidays(holidaysData);
    // Ensure individual_holidays is always an array, even if null from DB
    setResources(resourcesData.map((r: any) => ({...r, individual_holidays: r.individual_holidays || []})));
    setProjects(structuredProjects);
    
    calculateTimelineBounds(structuredProjects, resourcesData, holidaysData);

    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
  };

  const propagateScheduleChanges = async (currentProjects: Project[], startAssignmentId: string) => {
    // ... propagateScheduleChanges implementation ...
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
    // ... updateAssignmentSchedule implementation ...
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
      // ... updateAssignmentProgress implementation ...
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
    // ... updateAssignmentDependency implementation ...
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
      // ... reorderModules implementation ...
      if (isReadOnlyMode) return;
      const previousState = deepClone(projects);
      const updatedProjects = deepClone(projects);
      const project = updatedProjects.find(p => p.id === projectId);
      if (!project) return;
      const [removed] = project.modules.splice(startIndex, 1);
      project.modules.splice(endIndex, 0, removed);
      setProjects(updatedProjects);
      const updates = project.modules.map((module, index) => ({ id: module.id, name: module.name, type: module.type, legacy_function_points: module.legacyFunctionPoints, function_points: module.functionPoints, sort_order: index, project_id: projectId, user_id: session!.user.id }));
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

  const moveTask = async (projectId: string, sourceModuleId: string, targetModuleId: string, sourceIndex: number, targetIndex: number) => {
      if (isReadOnlyMode) return;
      const previousState = deepClone(projects);
      const updatedProjects = deepClone(projects);
      const project = updatedProjects.find(p => p.id === projectId);
      if (!project) return;
      
      const sourceModule = project.modules.find(m => m.id === sourceModuleId);
      const targetModule = project.modules.find(m => m.id === targetModuleId);
      
      if (!sourceModule || !targetModule) return;

      const [movedTask] = sourceModule.tasks.splice(sourceIndex, 1);
      targetModule.tasks.splice(targetIndex, 0, movedTask);
      
      setProjects(updatedProjects);

      const updates = [
          ...sourceModule.tasks.map((t, i) => ({ id: t.id, module_id: sourceModuleId, sort_order: i, name: t.name, user_id: session!.user.id })),
          ...targetModule.tasks.map((t, i) => ({ id: t.id, module_id: targetModuleId, sort_order: i, name: t.name, user_id: session!.user.id }))
      ];

      const { error } = await callSupabase('MOVE task', { updates: updates.length }, supabase.from('tasks').upsert(updates));
      if (error) { setProjects(previousState); alert("Failed to move task."); }
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
      // ... updateAllocation implementation ...
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
      // ... updateAssignmentResourceName implementation ...
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
                    user_id: session!.user.id,
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

  const updateModuleType = async (projectId: string, moduleId: string, type: ModuleType) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => m.id === moduleId ? { ...m, type } : m)
          };
      }));
      await callSupabase('UPDATE module type', { moduleId, type },
          supabase.from('modules').update({ type }).eq('id', moduleId)
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

  const updateModuleEstimates = async (projectId: string, moduleId: string, legacyFp: number, pVel: number, pTeam: number, fVel: number, fTeam: number, bVel: number, bTeam: number) => {
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
                      prepVelocity: pVel,
                      prepTeamSize: pTeam,
                      frontendVelocity: fVel,
                      frontendTeamSize: fTeam,
                      backendVelocity: bVel,
                      backendTeamSize: bTeam,
                  };
              })
          };
      }));
      
      await callSupabase('UPDATE module estimates', { moduleId }, 
          supabase.from('modules').update({ 
              legacy_function_points: legacyFp,
              prep_velocity: pVel,
              prep_team_size: pTeam,
              frontend_velocity: fVel,
              frontend_team_size: fTeam,
              backend_velocity: bVel,
              backend_team_size: bTeam,
          }).eq('id', moduleId)
      );
  };
  
  const updateTaskEstimates = async (projectId: string, moduleId: string, taskId: string, updates: Partial<Omit<ProjectTask, 'id' | 'name' | 'assignments'>>) => {
      if (isReadOnlyMode) return;

      const isFpUpdate = 'frontendFunctionPoints' in updates || 'backendFunctionPoints' in updates;
      const newProjects = deepClone(projects);
      const taskIdsToUpdate: string[] = [taskId];
      const dbTaskPayloads: any[] = [];
      
      if (isFpUpdate) {
        let baseName = '';
        const task = newProjects.flatMap(p => p.modules.flatMap(m => m.tasks)).find(t => t.id === taskId);
        if (task) {
          baseName = getTaskBaseName(task.name);
        }
        
        if (baseName) {
          newProjects.forEach(p => {
            p.modules.forEach(m => {
              m.tasks.forEach(t => {
                if (t.id !== taskId && getTaskBaseName(t.name) === baseName) {
                  taskIdsToUpdate.push(t.id);
                }
              });
            });
          });
        }
      }
      
      const modulesToRecalculate = new Set<string>();

      newProjects.forEach(p => {
        if (p.id !== projectId) return;
        p.modules.forEach(m => {
          let moduleWasUpdated = false;
          m.tasks.forEach(t => {
            if (taskIdsToUpdate.includes(t.id)) {
              Object.assign(t, updates);
              moduleWasUpdated = true;

              const dbPayload: any = { id: t.id };
              for (const key in updates) {
                dbPayload[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = (updates as any)[key];
              }
              dbTaskPayloads.push(dbPayload);
            }
          });
          if (moduleWasUpdated) {
              modulesToRecalculate.add(m.id);
          }
        });
      });

      // Recalculate module FPs for affected modules
      newProjects.forEach(p => {
        p.modules.forEach(m => {
          if (modulesToRecalculate.has(m.id) && m.type === ModuleType.Development) {
            m.frontendFunctionPoints = m.tasks.reduce((sum, t) => sum + (t.frontendFunctionPoints || 0), 0);
            m.backendFunctionPoints = m.tasks.reduce((sum, t) => sum + (t.backendFunctionPoints || 0), 0);
            m.functionPoints = m.frontendFunctionPoints + m.backendFunctionPoints;
          }
        });
      });

      setProjects(newProjects);

      // DB updates
      if (dbTaskPayloads.length > 0) {
        await callSupabase('UPDATE task estimates (batch)', { count: dbTaskPayloads.length },
          supabase.from('tasks').upsert(dbTaskPayloads)
        );
      }

      const modulePayloads = Array.from(modulesToRecalculate).map(modId => {
        const mod = newProjects.flatMap(p => p.modules).find(m => m.id === modId);
        if (mod && mod.type === ModuleType.Development) {
          return {
            id: mod.id,
            frontend_function_points: mod.frontendFunctionPoints,
            backend_function_points: mod.backendFunctionPoints,
            function_points: mod.functionPoints
          };
        }
        return null;
      }).filter((p): p is NonNullable<typeof p> => p !== null);

      if (modulePayloads.length > 0) {
        await callSupabase('UPDATE module aggregated FP (batch)', { count: modulePayloads.length },
          supabase.from('modules').upsert(modulePayloads)
        );
      }
  };

  const updateModuleComplexity = async (projectId: string, moduleId: string, type: 'frontend' | 'backend' | 'prep', complexity: ComplexityLevel) => {
    if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if(p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if(m.id !== moduleId) return m;
                  if (type === 'frontend') {
                    return { ...m, frontendComplexity: complexity };
                  } else if (type === 'backend') {
                    return { ...m, backendComplexity: complexity };
                  } else if (type === 'prep') {
                    return { ...m, complexity: complexity };
                  }
                  return m;
              })
          };
      }));
      
      const dbFieldMap = {
        frontend: 'frontend_complexity',
        backend: 'backend_complexity',
        prep: 'complexity',
      };
      const dbField = dbFieldMap[type];

      await callSupabase('UPDATE module complexity', { moduleId, type, complexity }, 
          supabase.from('modules').update({ [dbField]: complexity }).eq('id', moduleId)
      );
  };

  const updateModuleStartDate = async (projectId: string, moduleId: string, startDate: string | null) => {
      if (isReadOnlyMode) return;
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if (m.id !== moduleId) return m;
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
      setProjects(prev => prev.map(p => {
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if (m.id !== moduleId) return m;
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
          if (p.id !== projectId) return p;
          return {
              ...p,
              modules: p.modules.map(m => {
                  if (m.id !== moduleId) return m;
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
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Planner Login</h1>
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google']} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden text-slate-900 font-sans">
       {/* Sidebar */}
       <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 flex-shrink-0 z-50 border-r border-slate-800 shadow-xl`}>
          <div className="p-4 flex items-center gap-3 border-b border-slate-800 h-16">
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white font-bold shadow-lg shadow-indigo-900/50">RP</div>
            {!isSidebarCollapsed && <span className="font-bold text-white tracking-tight animate-in fade-in duration-300">ResourcePlan</span>}
          </div>
          
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Dashboard">
               <LayoutDashboard size={20} /> {!isSidebarCollapsed && <span>Dashboard</span>}
            </button>
            <button onClick={() => setActiveTab('planner')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Planner Grid">
               <Calendar size={20} /> {!isSidebarCollapsed && <span>Planner</span>}
            </button>
            <button onClick={() => setActiveTab('estimator')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Estimator">
               <Calculator size={20} /> {!isSidebarCollapsed && <span>Estimator</span>}
            </button>
            <div className="h-px bg-slate-800 my-2 mx-2"></div>
            <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Resources">
               <Users size={20} /> {!isSidebarCollapsed && <span>Resources</span>}
            </button>
            <button onClick={() => setActiveTab('holidays')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Holidays">
               <Globe size={20} /> {!isSidebarCollapsed && <span>Holidays</span>}
            </button>
            <div className="h-px bg-slate-800 my-2 mx-2"></div>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Settings">
               <SettingsIcon size={20} /> {!isSidebarCollapsed && <span>Settings</span>}
            </button>
          </nav>
          
          <div className="p-2 border-t border-slate-800">
             <button onClick={() => setShowShareModal(true)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 mb-1" title="Share">
                <Share2 size={18} /> {!isSidebarCollapsed && <span className="text-sm">Share</span>}
             </button>
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 hover:text-white text-slate-400 mb-1" title={isSidebarCollapsed ? "Expand" : "Collapse"}>
               {isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />} {!isSidebarCollapsed && <span className="text-sm">Collapse</span>}
             </button>
             <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/30 hover:text-red-400 text-slate-400 transition-colors" title="Sign Out">
               <LogOut size={18} /> {!isSidebarCollapsed && <span className="text-sm">Sign Out</span>}
             </button>
          </div>
       </aside>

       {/* Main Content */}
       <main className="flex-1 flex flex-col min-w-0 h-full bg-white relative overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 gap-2">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span>Loading plan...</span>
            </div>
          ) : (
            <div className="flex-1 p-4 flex flex-col relative min-h-0">
              {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
              
              {activeTab === 'planner' && <PlannerGrid 
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
                onMoveTask={moveTask}
                onUpdateModuleType={updateModuleType}
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
                onImportPlan={(p, h) => { setProjects(p); setHolidays(h); calculateTimelineBounds(p, resources, h); }}
                onShowHistory={() => setShowHistory(true)}
                onRefresh={() => fetchData(true)}
                saveStatus={saveStatus}
                isRefreshing={isRefreshing}
                isReadOnly={isReadOnlyMode}
              />}
              
              {activeTab === 'estimator' && <Estimator 
                projects={projects} 
                holidays={holidays} 
                onUpdateModuleEstimates={updateModuleEstimates}
                onUpdateTaskEstimates={updateTaskEstimates}
                onUpdateModuleComplexity={updateModuleComplexity}
                onUpdateModuleStartDate={updateModuleStartDate}
                onUpdateModuleDeliveryTask={updateModuleDeliveryTask}
                onUpdateModuleStartTask={updateModuleStartTask}
                onReorderModules={reorderModules}
                onDeleteModule={deleteModule}
                isReadOnly={isReadOnlyMode}
              />}
              
              {activeTab === 'resources' && <Resources 
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
              />}
              
              {activeTab === 'settings' && <Settings 
                isDebugLogEnabled={isDebugLogEnabled}
                setIsDebugLogEnabled={setIsDebugLogEnabled}
                isAIEnabled={isAIEnabled}
                setIsAIEnabled={setIsAIEnabled}
              />}
              
              {activeTab === 'holidays' && <AdminSettings 
                holidays={holidays}
                onAddHolidays={addHoliday}
                onDeleteHoliday={deleteHoliday}
                onDeleteHolidaysByCountry={deleteHolidaysByCountry}
              />}
            </div>
          )}
       </main>

       {/* Modals & Overlays */}
       {isAIEnabled && <AIAssistant projects={projects} resources={resources} onAddTask={addTask} onAssignResource={updateAssignmentResourceName} />}
       {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
       {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} session={session} />}
       {showHistory && <VersionHistory onClose={() => setShowHistory(false)} onRestore={restoreVersion} onSaveCurrent={saveCurrentVersion} />}
    </div>
  );
};

export default App;
