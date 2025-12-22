

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GOV_HOLIDAYS_DB, DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekdaysForWeekId, getWeekIdFromDate, getDateFromWeek, formatDateForInput, calculateEndDate, findNextWorkingDay } from './constants';
import { Project, Role, ResourceAllocation, Holiday, ProjectModule, ProjectTask, TaskAssignment, LogEntry, Resource, ComplexityLevel, ModuleType, ProjectRole, ProjectMember } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Settings } from './components/Settings';
import { Resources } from './components/Resources';
import { VersionHistory } from './components/VersionHistory';
import { DebugLog } from './components/DebugLog';
import { AdminSettings } from './components/AdminSettings';
import { AIAssistant } from './components/AIAssistant';
import { LayoutDashboard, Calendar, Calculator, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, Users, Globe, Share2, Copy, Check, X, UserPlus, Database, AlertTriangle } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const structureProjectsData = (
  projects: any[],
  modules: any[],
  tasks: any[],
  assignments: any[],
  allocations: any[],
  currentUserId: string,
  members: any[] = [],
  currentUserEmail: string = ''
): Project[] => {
  const allocationsByAssignment = new Map<string, any[]>();
  (allocations || []).forEach(a => {
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
  (assignments || []).forEach(a => {
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
  (tasks || []).forEach(t => {
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
  (modules || []).forEach(m => {
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

  return (projects || []).map(p => {
    // Determine Role
    let role: ProjectRole = 'viewer';
    if (p.user_id === currentUserId) {
        role = 'owner';
    } else {
        // Members lookup: match project_id and the current user's email
        // Note: We use Email because project_members stores user_email
        const membership = members.find(m => m.project_id === p.id && m.user_email === currentUserEmail);
        if (membership) {
            role = membership.role;
        }
    }

    return {
        id: p.id,
        name: p.name,
        modules: (modulesByProject.get(p.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
        currentUserRole: role,
        ownerEmail: p.owner_email,
        user_id: p.user_id // Pass this through to identify owner
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
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

// Fix DB Screen Component
const FixRecursionScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const sql = `-- FIX POLICIES AND ENABLE GLOBAL RESOURCE ACCESS
-- This script fixes recursion issues and makes Resources/Holidays editable by all team members.

-- 1. Helper function to check if current user is a member of a project
CREATE OR REPLACE FUNCTION is_project_member(_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM project_members 
    WHERE project_id = _project_id 
    AND user_email = auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Helper function to check if current user owns a project
CREATE OR REPLACE FUNCTION is_project_owner(_project_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM projects 
    WHERE id = _project_id 
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Reset Policies for Projects
DROP POLICY IF EXISTS "Projects Select Policy" ON projects;
DROP POLICY IF EXISTS "Projects Manage Policy" ON projects;
DROP POLICY IF EXISTS "Members Select Policy" ON project_members;
DROP POLICY IF EXISTS "Members Manage Policy" ON project_members;

-- 4. Projects Policy
CREATE POLICY "Projects Select Policy" ON projects
  FOR SELECT USING (
    user_id = auth.uid() 
    OR 
    is_project_member(id)
  );

CREATE POLICY "Projects Manage Policy" ON projects
  FOR ALL USING (user_id = auth.uid());

-- 5. Members Policy
CREATE POLICY "Members Select Policy" ON project_members
  FOR SELECT USING (
    user_email = auth.email() OR is_project_owner(project_id)
  );

CREATE POLICY "Members Manage Policy" ON project_members
  FOR ALL USING (
    is_project_owner(project_id)
  );

-- 6. GLOBAL ACCESS for Resources & Holidays
DROP POLICY IF EXISTS "Resources All Access" ON resources;
CREATE POLICY "Resources All Access" ON resources
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Holidays All Access" ON holidays;
CREATE POLICY "Holidays All Access" ON holidays
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Individual Holidays All Access" ON individual_holidays;
CREATE POLICY "Individual Holidays All Access" ON individual_holidays
  FOR ALL TO authenticated USING (true);

-- 7. Add missing columns (Self-healing)
ALTER TABLE holidays ADD COLUMN IF NOT EXISTS duration numeric DEFAULT 1;
ALTER TABLE individual_holidays ADD COLUMN IF NOT EXISTS duration numeric DEFAULT 1;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS program text;

NOTIFY pgrst, 'reload schema';
`;

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-xl shadow-2xl border border-red-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-900">Database Policy Update Required</h2>
            <p className="text-red-700 mt-1">To enable Global Resources and Team Sharing, please update your database.</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            We've updated the permissions model to allow <strong>Shared Resources</strong> and prevent permission errors.
            <br/><br/>
            <strong>Action Required:</strong> Copy the SQL script below and run it in your Supabase SQL Editor.
          </p>
          <div className="bg-slate-900 rounded-lg p-4 relative group mb-6">
            <pre className="text-xs text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap max-h-64 custom-scrollbar">
              {sql}
            </pre>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(sql);
                alert("SQL copied to clipboard!");
              }}
              className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded text-xs transition-colors"
            >
              Copy SQL
            </button>
          </div>
          <div className="flex justify-end gap-2">
             <button 
              onClick={onRetry}
              className="bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Cancel / Retry
            </button>
            <button 
              onClick={() => {
                  onRetry();
                  window.location.reload();
              }}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
            >
              <Check size={16} /> I've run the SQL, Reload App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ShareModal: React.FC<{ onClose: () => void, projectId: string, session: any }> = ({ onClose, projectId, session }) => {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<ProjectRole>('viewer');
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareUrl = session?.user?.id ? `${window.location.origin}${window.location.pathname}?share=${session.user.id}` : '';

  useEffect(() => {
      fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('project_members').select('*').eq('project_id', projectId);
      if (!error && data) {
          setMembers(data);
      }
      setIsLoading(false);
  };

  const addMember = async () => {
      if (!newEmail.trim()) return;
      setIsAdding(true);
      
      const { error } = await supabase.from('project_members').insert({
          project_id: projectId,
          user_email: newEmail.trim(),
          role: newRole,
      });

      if (error) {
          alert('Failed to add member: ' + error.message);
      } else {
          setNewEmail('');
          fetchMembers();
      }
      setIsAdding(false);
  };

  const updateMemberRole = async (memberId: string, role: ProjectRole) => {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role } : m));
      
      const { error } = await supabase.from('project_members').update({ role }).eq('id', memberId);
      if (error) {
          alert('Failed to update role');
          fetchMembers(); // Revert on failure
      }
  };

  const removeMember = async (memberId: string) => {
      if (!confirm("Remove this member?")) return;
      setMembers(prev => prev.filter(m => m.id !== memberId));
      
      const { error } = await supabase.from('project_members').delete().eq('id', memberId);
      if (error) {
          alert('Failed to remove member');
          fetchMembers(); // Revert on failure
      }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!session || !session.user) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" /> Manage Access
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Invite Section */}
        <div className="mb-6">
            <label className="text-sm font-semibold text-slate-700 mb-2 block">Invite Teammate</label>
            <div className="flex gap-2">
                <input 
                    type="email" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    placeholder="teammate@company.com" 
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <select 
                    value={newRole} 
                    onChange={e => setNewRole(e.target.value as ProjectRole)} 
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                </select>
                <button 
                    onClick={addMember} 
                    disabled={isAdding || !newEmail}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                    {isAdding ? '...' : <><UserPlus size={16}/> Invite</>}
                </button>
            </div>
        </div>

        {/* List Section */}
        <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-3">People with access</h4>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                {/* Owner (You) */}
                <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                            {session.user.email?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-900">{session.user.email} <span className="text-slate-400 font-normal">(You)</span></p>
                            <p className="text-xs text-slate-500">Owner</p>
                        </div>
                    </div>
                </div>

                {/* Other Members */}
                {isLoading ? <div className="text-center py-4 text-slate-400 text-sm">Loading members...</div> : members.map(member => (
                    <div key={member.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors group">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs">
                                {member.user_email.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-900">{member.user_email}</p>
                                <p className="text-xs text-slate-500 capitalize">{member.role}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <select 
                                value={member.role} 
                                onChange={e => updateMemberRole(member.id, e.target.value as ProjectRole)}
                                className="text-xs border-none bg-transparent font-medium text-slate-600 cursor-pointer focus:ring-0 hover:text-indigo-600"
                            >
                                <option value="viewer">Viewer</option>
                                <option value="editor">Editor</option>
                            </select>
                            <button onClick={() => removeMember(member.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all">
                                <X size={16} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
        
        {/* Footer Link */}
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
             <div className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer hover:text-indigo-600" onClick={copyToClipboard}>
                <div className="p-1.5 bg-slate-100 rounded-full"><Share2 size={14}/></div>
                <span>{copied ? 'Link Copied!' : 'Copy Read-Only Link'}</span>
             </div>
             <button onClick={onClose} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors">
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
  const [isTakingTooLong, setIsTakingTooLong] = useState(false);
  
  const [dbError, setDbError] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentRole: ProjectRole = currentProject?.currentUserRole || 'owner'; 
  
  const isReadOnlyMode = currentRole === 'viewer';
  const isOwner = currentRole === 'owner';

  const activeProjectResources = resources;
  const activeProjectHolidays = holidays;

  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const statusTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(statusTimeoutRef.current);
  }, []);

  useEffect(() => {
    let timer: number;
    if (loading) {
      setIsTakingTooLong(false);
      timer = window.setTimeout(() => {
        setIsTakingTooLong(true);
      }, 4000); 
    }
    return () => clearTimeout(timer);
  }, [loading]);

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
    if (isReadOnlyMode) {
        const isGlobalEdit = message.includes('resource') || message.includes('holiday');
        if (!isGlobalEdit) {
            return { data: null, error: 'Read Only Mode' };
        }
    }

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
  
    const resourceHolidaysMap = new Map<string, Map<string, number>>();
    const defaultHolidays = new Map<string, number>();
    currentHolidays.filter(h => h.country === 'HK').forEach(h => defaultHolidays.set(h.date, h.duration || 1));
    resourceHolidaysMap.set('Unassigned', defaultHolidays);
    currentResources.forEach(res => {
      const regional = currentHolidays.filter(h => h.country === res.holiday_region);
      const individual = res.individual_holidays || [];
      const map = new Map<string, number>();
      regional.forEach(h => map.set(h.date, h.duration || 1));
      individual.forEach(h => map.set(h.date, h.duration || 1));
      resourceHolidaysMap.set(res.name, map);
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
                    const holidayMap = resourceHolidaysMap.get(assignment.resourceName || 'Unassigned') || defaultHolidays;
                    const endDateStr = calculateEndDate(assignment.startDate, assignment.duration, holidayMap);
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
        setTimelineStart(addWeeksToPoint(minPoint, -1)); 
        setTimelineEnd(addWeeksToPoint(maxPoint, 1));   
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
    setDbError(null);

    const { data: ownedProjects, error: ownedError } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
    if (ownedError) {
        if (ownedError.code === '42P17' || ownedError.message?.includes('recursion') || ownedError.code === '500' || (ownedError as any).status === 500) {
            setDbError(ownedError);
            setLoading(false);
            return;
        }
    }

    let sharedProjects: any[] = [];
    let memberships: any[] = [];
    try {
        const { data: memberData, error: memberError } = await supabase.from('project_members').select('*, projects(*)').eq('user_email', session.user.email);
        if (memberError) {
             if (memberError.code === '42P17' || memberError.message?.includes('recursion') || memberError.code === '500' || (memberError as any).status === 500) {
                setDbError(memberError);
                setLoading(false);
                return;
            }
        }
        if (memberData) {
            memberships = memberData;
            sharedProjects = memberData.map((m: any) => m.projects).filter(Boolean);
        }
    } catch (e) {
        // ignore
    }

    let allProjectsRaw = [...(ownedProjects || []), ...sharedProjects];
    
    const uniqueProjects = Array.from(new Map(allProjectsRaw.map(p => [p.id, p])).values());

    if (uniqueProjects.length === 0) {
      const { data: newProject, error: newProjectError } = await callSupabase(
        'CREATE default project', { name: 'My First Project' },
        supabase.from('projects').insert({ name: 'My First Project', user_id: session!.user.id }).select().single()
      );
      if (newProject && !newProjectError) { uniqueProjects.push(newProject); }
    }
    
    if (uniqueProjects.length > 0 && (!selectedProjectId || !uniqueProjects.find(p => p.id === selectedProjectId))) {
        setSelectedProjectId(uniqueProjects[0].id);
    }

    const projectIds = uniqueProjects.map(p => p.id);
    
    // Explicitly initialize as empty arrays to prevent undefined
    let modulesData: any[] = [], tasksData: any[] = [], assignmentsData: any[] = [], allocationsData: any[] = [];

    if (projectIds.length > 0) {
      const { data: modules, error: modulesError } = await supabase.from('modules').select('*').in('project_id', projectIds);
      if (modulesError) console.error(modulesError); else modulesData = modules || [];
      
      const moduleIds = modulesData.map(m => m.id);
      if (moduleIds.length > 0) {
        const { data: tasks, error: tasksError } = await supabase.from('tasks').select('*').in('module_id', moduleIds);
        if (tasksError) console.error(tasksError); else tasksData = tasks || [];

        const taskIds = tasksData.map(t => t.id);
        if (taskIds.length > 0) {
          const { data: assignments, error: assignmentsError } = await supabase.from('task_assignments').select('*').in('task_id', taskIds);
          if (assignmentsError) console.error(assignmentsError); else assignmentsData = assignments || [];
          
          const assignmentIds = assignmentsData.map(a => a.id);
          if (assignmentIds.length > 0) {
            const { data: allocations, error: allocationsError } = await supabase.from('resource_allocations').select('*').in('assignment_id', assignmentIds);
            if (allocationsError) console.error(allocationsError); else allocationsData = allocations || [];
          }
        }
      }
    }
    
    const { data: resourcesData, error: resourcesError } = await supabase
      .from('resources')
      .select('*, individual_holidays(*)')
      .order('name');
    
    if (resourcesError) console.error(resourcesError);
    const freshResources = resourcesData || [];

    const { data: holidaysData, error: holidaysError } = await supabase
      .from('holidays')
      .select('*');
      
    if (holidaysData) console.error(holidaysError);
    const freshHolidays = holidaysData || [];
    
    const structuredProjects = structureProjectsData(uniqueProjects, modulesData, tasksData, assignmentsData, allocationsData, session.user.id, memberships, session.user.email);
    
    setHolidays(freshHolidays);
    setResources(freshResources);
    setProjects(structuredProjects);
    
    calculateTimelineBounds(structuredProjects, freshResources, freshHolidays);

    if (isRefresh) setIsRefreshing(false);
    else setLoading(false);
  };

  const updateHolidayDuration = async (id: string, duration: number) => {
      if (isReadOnlyMode) return;
      const { error } = await callSupabase('UPDATE holiday duration', { id, duration },
          supabase.from('holidays').update({ duration }).eq('id', id)
      );
      if (error) alert("Failed to update holiday duration.");
      else fetchData(true);
  };

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') {
        setTimelineStart(prev => addWeeksToPoint(prev, -4));
    } else {
        setTimelineEnd(prev => addWeeksToPoint(prev, 4));
    }
  };

  const updateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => {
      if (isReadOnlyMode) return;
      
      let payload: any = { count };
      if (dayDate) {
          const project = projects.find(p => p.id === projectId);
          const module = project?.modules.find(m => m.id === moduleId);
          const task = module?.tasks.find(t => t.id === taskId);
          const assignment = task?.assignments.find(a => a.id === assignmentId);
          const allocation = assignment?.allocations.find(a => a.weekId === weekId);
          
          const currentDays = { ...(allocation?.days || {}) };
          currentDays[dayDate] = count;
          
          const totalCount = Object.values(currentDays).reduce((sum, val) => sum + val, 0);
          payload = { count: totalCount, days: currentDays };
      }

      await callSupabase('UPDATE allocation', payload,
          supabase.from('resource_allocations').upsert({
              assignment_id: assignmentId,
              week_id: weekId,
              ...payload
          }, { onConflict: 'assignment_id, week_id' })
      );
      
      fetchData(false);
  };

  const updateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE resource', { assignmentId, resourceName },
          supabase.from('task_assignments').update({ resource_name: resourceName }).eq('id', assignmentId)
      );
      fetchData(false);
  };

  const updateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE dependency', { assignmentId, parentAssignmentId },
          supabase.from('task_assignments').update({ parent_assignment_id: parentAssignmentId }).eq('id', assignmentId)
      );
      fetchData(false);
  };

  const addTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
      if (isReadOnlyMode) return;
      
      // Default new tasks to start today for 5 days
      const today = formatDateForInput(new Date());
      const defaultDuration = 5;

      await callSupabase('CREATE task', { taskId, taskName },
          supabase.from('tasks').insert({ id: taskId, module_id: moduleId, name: taskName })
      );
      await callSupabase('CREATE assignment', { taskId, role },
          supabase.from('task_assignments').insert({ 
              task_id: taskId, 
              role, 
              resource_name: 'Unassigned',
              start_date: today,
              duration: defaultDuration
          })
      );
      fetchData(true);
  };

  const addAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
      if (isReadOnlyMode) return;
      
      // Default new assignments to start today for 5 days
      const today = formatDateForInput(new Date());
      const defaultDuration = 5;

      await callSupabase('ADD assignment', { taskId, role },
          supabase.from('task_assignments').insert({ 
              task_id: taskId, 
              role, 
              resource_name: 'Unassigned',
              start_date: today,
              duration: defaultDuration
          })
      );
      fetchData(true);
  };

  const onCopyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if (isReadOnlyMode) return;
      const { data: assignment } = await supabase.from('task_assignments').select('*').eq('id', assignmentId).single();
      if (!assignment) return;
      
      const { data: allocations } = await supabase.from('resource_allocations').select('*').eq('assignment_id', assignmentId);
      
      const { data: newAssignment } = await supabase.from('task_assignments').insert({
          task_id: taskId,
          role: assignment.role,
          resource_name: assignment.resource_name,
          start_date: assignment.start_date,
          duration: assignment.duration
      }).select().single();
      
      if (newAssignment && allocations) {
          const newAllocations = allocations.map((a: any) => ({
              assignment_id: newAssignment.id,
              week_id: a.week_id,
              count: a.count,
              days: a.days
          }));
          if (newAllocations.length > 0) {
              await supabase.from('resource_allocations').insert(newAllocations);
          }
      }
      fetchData(true);
  };

  const reorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
      if (isReadOnlyMode) return;
      // Placeholder
  };

  const reorderTasks = async (projectId: string, moduleId: string, startIndex: number, endIndex: number) => {
      if (isReadOnlyMode) return;
      // Placeholder
  };

  const moveTask = async (projectId: string, sourceModuleId: string, targetModuleId: string, sourceIndex: number, targetIndex: number) => {
      if (isReadOnlyMode) return;
      const project = projects.find(p => p.id === projectId);
      const sourceModule = project?.modules.find(m => m.id === sourceModuleId);
      const task = sourceModule?.tasks[sourceIndex];
      
      if (task) {
          await callSupabase('MOVE task', { taskId: task.id, targetModuleId },
              supabase.from('tasks').update({ module_id: targetModuleId }).eq('id', task.id)
          );
          fetchData(true);
      }
  };

  const updateModuleType = async (projectId: string, moduleId: string, type: ModuleType) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE module type', { moduleId, type },
          supabase.from('modules').update({ type }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const reorderAssignments = async (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => {
      if (isReadOnlyMode) return;
      // Placeholder
  };

  const onShiftTask = async (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
      if (isReadOnlyMode) return;
      const project = projects.find(p => p.id === projectId);
      const module = project?.modules.find(m => m.id === moduleId);
      const task = module?.tasks.find(t => t.id === taskId);
      if (!task) return;
      const updates = task.assignments.map(a => {
          if (!a.startDate) return null;
          const date = new Date(a.startDate);
          date.setDate(date.getDate() + (direction === 'right' ? 7 : -7));
          return supabase.from('task_assignments').update({ start_date: formatDateForInput(date) }).eq('id', a.id);
      }).filter(Boolean);
      await Promise.all(updates);
      fetchData(true);
  };

  const updateAssignmentSchedule = async (assignmentId: string, startDate: string, duration: number) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE schedule', { assignmentId, startDate, duration },
          supabase.from('task_assignments').update({ start_date: startDate, duration }).eq('id', assignmentId)
      );
      fetchData(false);
  };

  const updateAssignmentProgress = async (assignmentId: string, progress: number) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE progress', { assignmentId, progress },
          supabase.from('task_assignments').update({ progress }).eq('id', assignmentId)
      );
      fetchData(false);
  };

  const addProject = async () => {
      if (isReadOnlyMode) return;
      await callSupabase('ADD project', {},
          supabase.from('projects').insert({ name: 'New Project', user_id: session.user.id })
      );
      fetchData(true);
  };

  const addModule = async (projectId: string) => {
      if (isReadOnlyMode) return;
      await callSupabase('ADD module', { projectId },
          supabase.from('modules').insert({ project_id: projectId, name: 'New Module' })
      );
      fetchData(true);
  };

  const updateProjectName = async (projectId: string, name: string) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE project', { projectId, name },
          supabase.from('projects').update({ name }).eq('id', projectId)
      );
      fetchData(false);
  };

  const updateModuleName = async (projectId: string, moduleId: string, name: string) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE module', { moduleId, name },
          supabase.from('modules').update({ name }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const updateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE task', { taskId, name },
          supabase.from('tasks').update({ name }).eq('id', taskId)
      );
      fetchData(false);
  };

  const deleteProject = async (projectId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm('Delete project?')) return;
      await supabase.from('projects').delete().eq('id', projectId);
      fetchData(true);
  };

  const deleteModule = async (projectId: string, moduleId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm('Delete module?')) return;
      await supabase.from('modules').delete().eq('id', moduleId);
      fetchData(true);
  };

  const deleteTask = async (projectId: string, moduleId: string, taskId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm('Delete task?')) return;
      await supabase.from('tasks').delete().eq('id', taskId);
      fetchData(true);
  };

  const deleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
      if (isReadOnlyMode) return;
      if (!confirm('Delete assignment?')) return;
      await supabase.from('task_assignments').delete().eq('id', assignmentId);
      fetchData(true);
  };

  const updateModuleEstimates = async (projectId: string, moduleId: string, legacyFp: number, prepVelocity: number, prepTeamSize: number, feVelocity: number, feTeamSize: number, beVelocity: number, beTeamSize: number) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE estimates', { moduleId },
          supabase.from('modules').update({ 
              legacy_function_points: legacyFp,
              prep_velocity: prepVelocity,
              prep_team_size: prepTeamSize,
              frontend_velocity: feVelocity,
              frontend_team_size: feTeamSize,
              backend_velocity: beVelocity,
              backend_team_size: beTeamSize
          }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const updateTaskEstimates = async (projectId: string, moduleId: string, taskId: string, updates: any) => {
      if (isReadOnlyMode) return;
      const dbUpdates: any = {};
      if (updates.frontendFunctionPoints !== undefined) dbUpdates.frontend_function_points = updates.frontendFunctionPoints;
      if (updates.backendFunctionPoints !== undefined) dbUpdates.backend_function_points = updates.backendFunctionPoints;
      if (updates.frontendVelocity !== undefined) dbUpdates.frontend_velocity = updates.frontendVelocity;
      if (updates.frontendTeamSize !== undefined) dbUpdates.frontend_team_size = updates.frontendTeamSize;
      if (updates.frontendComplexity !== undefined) dbUpdates.frontend_complexity = updates.frontendComplexity;
      if (updates.backendVelocity !== undefined) dbUpdates.backend_velocity = updates.backendVelocity;
      if (updates.backendTeamSize !== undefined) dbUpdates.backend_team_size = updates.backendTeamSize;
      if (updates.backendComplexity !== undefined) dbUpdates.backend_complexity = updates.backendComplexity;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;

      await callSupabase('UPDATE task est', { taskId, ...dbUpdates },
          supabase.from('tasks').update(dbUpdates).eq('id', taskId)
      );
      fetchData(false);
  };

  const updateModuleComplexity = async (projectId: string, moduleId: string, type: 'frontend' | 'backend' | 'prep', complexity: ComplexityLevel) => {
      if (isReadOnlyMode) return;
      const field = type === 'frontend' ? 'frontend_complexity' : type === 'backend' ? 'backend_complexity' : 'complexity'; 
      await callSupabase('UPDATE complexity', { moduleId, type, complexity },
          supabase.from('modules').update({ [field]: complexity }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const updateModuleStartDate = async (projectId: string, moduleId: string, startDate: string | null) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE mod start', { moduleId, startDate },
          supabase.from('modules').update({ start_date: startDate }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const updateModuleDeliveryTask = async (projectId: string, moduleId: string, deliveryTaskId: string | null) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE mod delivery', { moduleId, deliveryTaskId },
          supabase.from('modules').update({ delivery_task_id: deliveryTaskId }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const updateModuleStartTask = async (projectId: string, moduleId: string, startTaskId: string | null) => {
      if (isReadOnlyMode) return;
      await callSupabase('UPDATE mod start task', { moduleId, startTaskId },
          supabase.from('modules').update({ start_task_id: startTaskId }).eq('id', moduleId)
      );
      fetchData(false);
  };

  const addResource = async (name: string, category: Role, region: string, type: 'Internal' | 'External', program: string | null) => {
      if (isReadOnlyMode) return;
      await callSupabase('ADD resource', { name },
          supabase.from('resources').insert({ name, category, holiday_region: region, type, program })
      );
      fetchData(true);
  };

  const deleteResource = async (id: string) => {
      if (isReadOnlyMode) return;
      if (!confirm('Delete resource?')) return;
      await supabase.from('resources').delete().eq('id', id);
      fetchData(true);
  };

  const updateResourceCategory = async (id: string, category: Role) => {
      if (isReadOnlyMode) return;
      await supabase.from('resources').update({ category }).eq('id', id);
      fetchData(false);
  };

  const updateResourceRegion = async (id: string, region: string | null) => {
      if (isReadOnlyMode) return;
      await supabase.from('resources').update({ holiday_region: region }).eq('id', id);
      fetchData(false);
  };

  const updateResourceType = async (id: string, type: 'Internal' | 'External') => {
      if (isReadOnlyMode) return;
      await supabase.from('resources').update({ type }).eq('id', id);
      fetchData(false);
  };

  const updateResourceName = async (id: string, name: string) => {
      if (isReadOnlyMode) return;
      await supabase.from('resources').update({ name }).eq('id', id);
      fetchData(false);
  };

  const addIndividualHolidays = async (resourceId: string, items: { date: string, name: string, duration: number }[]) => {
      if (isReadOnlyMode) return;
      const records = items.map(i => ({ resource_id: resourceId, date: i.date, name: i.name, duration: i.duration }));
      await supabase.from('individual_holidays').insert(records);
      fetchData(true);
  };

  const deleteIndividualHoliday = async (id: string) => {
      if (isReadOnlyMode) return;
      await supabase.from('individual_holidays').delete().eq('id', id);
      fetchData(true);
  };

  const addHoliday = async (holidays: Omit<Holiday, 'id'>[]) => {
      if (isReadOnlyMode) return;
      await supabase.from('holidays').insert(holidays);
      fetchData(true);
  };

  const deleteHoliday = async (id: string) => {
      if (isReadOnlyMode) return;
      await supabase.from('holidays').delete().eq('id', id);
      fetchData(true);
  };

  const deleteHolidaysByCountry = async (country: string) => {
      if (isReadOnlyMode) return;
      await supabase.from('holidays').delete().eq('country', country);
      fetchData(true);
  };

  const saveCurrentVersion = async (name: string) => {
      if (isReadOnlyMode) return;
      const snapshot = { projects, resources, holidays };
      await supabase.from('versions').insert({ name, data: snapshot });
  };

  const restoreVersion = async (versionId: number) => {
      if (isReadOnlyMode) return;
      alert("Restore functionality is currently a placeholder.");
  };

  const onImportPlan = async (importedProjects: Project[], importedHolidays: Holiday[]) => {
      // Placeholder for import logic. Full implementation would require replacing DB content.
      // For now, this prevents the crash.
      console.log('Import requested', importedProjects);
      alert('Import functionality is partially implemented. Please use the Database Repair Tool in Settings if you encounter data issues.');
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Master</h1>
            <Auth 
                supabaseClient={supabase} 
                appearance={{ theme: ThemeSupa }} 
                providers={['google']} 
            />
        </div>
      </div>
    );
  }

  if (dbError) {
      return <FixRecursionScreen onRetry={() => fetchData(false)} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-slate-50 text-slate-500 gap-4">
        <div className="flex items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Loading plan...</span>
        </div>
        {isTakingTooLong && (
            <div className="animate-in fade-in zoom-in-95 mt-4">
                <button 
                    onClick={() => setDbError({ code: 'FORCE_FIX', message: 'User forced fix' })}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg shadow-sm hover:bg-red-50 text-sm font-medium transition-colors"
                >
                    <AlertTriangle size={16} />
                    Taking too long? Fix Database
                </button>
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden text-slate-900 font-sans">
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
            {isOwner && (
                <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all duration-200 ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`} title="Settings">
                <SettingsIcon size={20} /> {!isSidebarCollapsed && <span>Settings</span>}
                </button>
            )}
          </nav>
          
          <div className="p-2 border-t border-slate-800">
             <div className={`mb-2 ${isSidebarCollapsed ? 'flex justify-center' : ''}`}>
                <div className={`flex items-center gap-3 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 transition-all ${isSidebarCollapsed ? 'justify-center w-10 h-10 p-0 rounded-full' : 'w-full'}`}>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm border border-white/10" title={session?.user?.email}>
                        {session?.user?.email?.substring(0, 2).toUpperCase() || 'U'}
                    </div>
                    {!isSidebarCollapsed && (
                        <div className="overflow-hidden flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate" title={session?.user?.email}>
                                {session?.user?.email}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate capitalize flex items-center gap-1">
                                <span className={`w-1.5 h-1.5 rounded-full ${isOwner ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                                {currentRole}
                            </p>
                        </div>
                    )}
                </div>
             </div>

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

       <main className={`flex-1 flex flex-col min-w-0 h-full bg-white relative custom-scrollbar ${['planner', 'estimator'].includes(activeTab) ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <div className={`flex-1 h-full ${['planner', 'estimator'].includes(activeTab) ? 'p-0 overflow-hidden' : 'p-4'}`}>
            {activeTab === 'dashboard' && <Dashboard projects={projects} resources={activeProjectResources} holidays={activeProjectHolidays} />}
            
            {activeTab === 'planner' && <div className="h-full p-4 overflow-hidden"><PlannerGrid 
              projects={projects} 
              holidays={activeProjectHolidays}
              resources={activeProjectResources}
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
              onImportPlan={onImportPlan}
              onShowHistory={() => setShowHistory(true)}
              onRefresh={() => fetchData(true)}
              saveStatus={saveStatus}
              isRefreshing={isRefreshing}
              isReadOnly={isReadOnlyMode}
            /></div>}
            
            {activeTab === 'estimator' && <div className="h-full p-4 overflow-hidden"><Estimator 
              projects={projects} 
              holidays={activeProjectHolidays} 
              onUpdateModuleEstimates={updateModuleEstimates}
              onUpdateTaskEstimates={updateTaskEstimates}
              onUpdateModuleComplexity={updateModuleComplexity}
              onUpdateModuleStartDate={updateModuleStartDate}
              onUpdateModuleDeliveryTask={updateModuleDeliveryTask}
              onUpdateModuleStartTask={updateModuleStartTask}
              onReorderModules={reorderModules}
              onDeleteModule={deleteModule}
              isReadOnly={isReadOnlyMode}
            /></div>}
            
            {activeTab === 'resources' && <Resources 
              resources={activeProjectResources} 
              onAddResource={addResource} 
              onDeleteResource={deleteResource}
              onUpdateResourceCategory={updateResourceCategory}
              onUpdateResourceRegion={updateResourceRegion}
              onUpdateResourceType={updateResourceType}
              onUpdateResourceName={updateResourceName}
              onAddIndividualHoliday={addIndividualHolidays}
              onDeleteIndividualHoliday={deleteIndividualHoliday}
              isReadOnly={false} 
            />}
            
            {activeTab === 'settings' && isOwner && <Settings 
              isDebugLogEnabled={isDebugLogEnabled}
              setIsDebugLogEnabled={setIsDebugLogEnabled}
              isAIEnabled={isAIEnabled}
              setIsAIEnabled={setIsAIEnabled}
              onOpenDatabaseFix={() => setDbError({ code: 'MANUAL_FIX', message: 'User requested manual fix' })}
            />}
            
            {activeTab === 'holidays' && <AdminSettings 
              holidays={activeProjectHolidays}
              onAddHolidays={addHoliday}
              onDeleteHoliday={deleteHoliday}
              onDeleteHolidaysByCountry={deleteHolidaysByCountry}
              onUpdateHolidayDuration={updateHolidayDuration}
              isReadOnly={false}
            />}
          </div>
       </main>

       {isAIEnabled && <AIAssistant projects={projects} resources={activeProjectResources} onAddTask={addTask} onAssignResource={updateAssignmentResourceName} />}
       {isDebugLogEnabled && <DebugLog entries={logEntries} setEntries={setLogEntries} />}
       {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} projectId={selectedProjectId} session={session} />}
       {showHistory && <VersionHistory onClose={() => setShowHistory(false)} onRestore={restoreVersion} onSaveCurrent={saveCurrentVersion} />}
    </div>
  );
};

export default App;