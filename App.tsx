import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isOfflineMode } from './lib/supabaseClient';
import { Project, Resource, Holiday, Role, ModuleType, LogEntry, ProjectModule, ProjectTask, TaskAssignment, ComplexityLevel, ProjectRole, ProjectMember } from './types';
import { PlannerGrid } from './components/PlannerGrid';
import { DEFAULT_START, DEFAULT_END, addWeeksToPoint, getWeekIdFromDate, WeekPoint, calculateEndDate, findNextWorkingDay } from './constants';
import { BarChart3, Calendar, Calculator, Users, Globe, Settings as SettingsIcon, Menu, History, User, Share2, X, Copy, Check, Trash2, UserPlus, ChevronDown, Link as LinkIcon, LogOut, Sparkles, type LucideIcon } from 'lucide-react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { mockAuthManager } from './lib/mockAuth';
import { loadSampleDataFromJSON } from './lib/offlineDataLoader';
import { loadRealDataFromExport } from './lib/loadRealData';
import { runDiagnostics } from './lib/diagnostics';
import { fetchDataOffline } from './lib/offlineDataFetcher';

type TabId = 'dashboard' | 'planner' | 'estimator' | 'settings' | 'resources' | 'holidays';

const loadDashboard = () => import('./components/Dashboard');
const loadEstimator = () => import('./components/Estimator');
const loadResources = () => import('./components/Resources');
const loadAdminSettings = () => import('./components/AdminSettings');
const loadSettings = () => import('./components/Settings');
const loadAIAssistant = () => import('./components/AIAssistant');
const loadDebugLog = () => import('./components/DebugLog');
const loadVersionHistory = () => import('./components/VersionHistory');
const loadOfflineLoginScreen = () => import('./components/OfflineLoginScreen');

const Dashboard = React.lazy(() => loadDashboard().then((module) => ({ default: module.Dashboard })));
const Estimator = React.lazy(() => loadEstimator().then((module) => ({ default: module.Estimator })));
const Resources = React.lazy(() => loadResources().then((module) => ({ default: module.Resources })));
const AdminSettings = React.lazy(() => loadAdminSettings().then((module) => ({ default: module.AdminSettings })));
const Settings = React.lazy(() => loadSettings().then((module) => ({ default: module.Settings })));
const AIAssistant = React.lazy(() => loadAIAssistant().then((module) => ({ default: module.AIAssistant })));
const DebugLog = React.lazy(() => loadDebugLog().then((module) => ({ default: module.DebugLog })));
const VersionHistory = React.lazy(() => loadVersionHistory().then((module) => ({ default: module.VersionHistory })));
const OfflineLoginScreen = React.lazy(() => loadOfflineLoginScreen().then((module) => ({ default: module.OfflineLoginScreen })));

const TAB_PREFETCH_LOADERS: Partial<Record<TabId, () => Promise<unknown>>> = {
  dashboard: loadDashboard,
  estimator: loadEstimator,
  resources: loadResources,
  holidays: loadAdminSettings,
  settings: loadSettings,
};

const NAV_ITEMS: Array<{ id: TabId; icon: LucideIcon; label: string }> = [
  { id: 'dashboard', icon: BarChart3, label: 'Dashboard' },
  { id: 'planner', icon: Calendar, label: 'Planner' },
  { id: 'estimator', icon: Calculator, label: 'Estimator' },
  { id: 'resources', icon: Users, label: 'Resources' },
  { id: 'holidays', icon: Globe, label: 'Holidays' },
  { id: 'settings', icon: SettingsIcon, label: 'Settings' },
];

const createSafeId = (): string => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') {
    return randomUUID.call(globalThis.crypto);
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const DEBUG_LOG_STORAGE_KEY = 'oms_debug_log_v1';
const MAX_DEBUG_LOG_ENTRIES = 100;

const copyTextSafe = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
};
const reorderList = <T,>(items: T[], sourceIndex: number, targetIndex: number): T[] => {
  const reordered = [...items];
  const [movedItem] = reordered.splice(sourceIndex, 1);
  if (typeof movedItem === 'undefined') {
    return items;
  }
  reordered.splice(targetIndex, 0, movedItem);
  return reordered;
};
const shiftDateTextByDays = (dateText: string, days: number): string => {
  const shiftedDate = new Date(dateText.replace(/-/g, '/'));
  shiftedDate.setDate(shiftedDate.getDate() + days);
  return shiftedDate.toISOString().split('T')[0];
};

// Expose diagnostics & offline mode globally
if (typeof window !== 'undefined') {
  (window as any).__offlineMode = isOfflineMode;
}

// --- Share Modal Component ---

interface ShareModalProps {
  onClose: () => void;
  projectId: string;
  session: any;
  ownerEmail?: string;
}

const ShareModal: React.FC<ShareModalProps> = ({ onClose, projectId, session, ownerEmail }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ProjectRole>('viewer');
  const [isSharing, setIsSharing] = useState(false);
  const [message, setMessage] = useState('');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [projectId]);

  const fetchMembers = async () => {
    setLoadingMembers(true);
    const { data, error } = await supabase
      .from('project_members')
      .select('*')
      .eq('project_id', projectId);
    
    if (data) {
      setMembers(data);
    }
    setLoadingMembers(false);
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsSharing(true);
    setMessage('');

    try {
      if (email === session.user.email) {
          throw new Error("You are the owner.");
      }
      if (members.some(m => m.user_email === email)) {
          throw new Error("User is already a member.");
      }

      const { data, error } = await supabase.from('project_members').insert({
        project_id: projectId,
        user_email: email,
        role: role
      }).select().single();

      if (error) throw error;
      
      if (data) {
          setMembers([...members, data]);
          setMessage(`Invited ${email}`);
          setEmail('');
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message || 'Failed to share'}`);
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: ProjectRole) => {
      // Optimistic update
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));

      const { error } = await supabase
        .from('project_members')
        .update({ role: newRole })
        .eq('id', memberId);
        
      if (error) {
          // Revert on error
          fetchMembers();
          alert("Failed to update role");
      }
  };

  const handleRemoveMember = async (memberId: string) => {
      if (!confirm('Remove this user from the project?')) return;
      
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('id', memberId);
        
      if (!error) {
          setMembers(prev => prev.filter(m => m.id !== memberId));
      } else {
          alert("Failed to remove member");
      }
  };

  const handleCopyLink = () => {
    copyTextSafe(window.location.href).then((copied) => {
      if (copied) {
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center animate-in fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-slate-800">Manage access</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar">
            
            {/* Invite Section */}
            <form onSubmit={handleShare} className="flex gap-2 mb-6">
                <div className="flex-1 relative">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Add people by email..."
                        className="w-full pl-3 pr-24 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    />
                    <select
                        value={role}
                        onChange={(e) => setRole(e.target.value as ProjectRole)}
                        className="absolute right-1 top-1 bottom-1 w-20 text-xs font-medium bg-slate-50 border-l border-slate-200 text-slate-600 focus:outline-none rounded-r-md cursor-pointer hover:bg-slate-100"
                    >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={isSharing || !email}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isSharing ? '...' : 'Invite'}
                </button>
            </form>
            
            {message && (
                <div className={`mb-6 p-3 rounded-lg text-sm flex items-center gap-2 ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {message.startsWith('Error') ? <X size={16}/> : <Check size={16}/>}
                    {message}
                </div>
            )}

            {/* Members List */}
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">People with access</h4>
            <div className="space-y-4">
                {/* Owner Row */}
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                            {ownerEmail ? ownerEmail.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-800">
                                {ownerEmail === session.user.email ? `${ownerEmail} (You)` : ownerEmail}
                            </span>
                            <span className="text-xs text-slate-500">Project Owner</span>
                        </div>
                    </div>
                    <span className="text-xs text-slate-400 font-medium px-2">Owner</span>
                </div>

                {/* Teammates Rows */}
                {members.map(member => (
                    <div key={member.id} className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-sm">
                                {member.user_email.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-sm font-medium text-slate-800">{member.user_email}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <div className="relative group/role">
                                <select 
                                    value={member.role}
                                    onChange={(e) => handleUpdateRole(member.id, e.target.value as ProjectRole)}
                                    className="appearance-none bg-transparent pl-2 pr-6 py-1 text-sm text-slate-600 font-medium hover:bg-slate-50 rounded cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                                <ChevronDown size={14} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                             </div>
                             <button 
                                onClick={() => handleRemoveMember(member.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Remove access"
                             >
                                <Trash2 size={16} />
                             </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
             <button 
                onClick={handleCopyLink}
                className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors"
             >
                {copyFeedback ? <Check size={16} /> : <LinkIcon size={16} />}
                {copyFeedback ? 'Link copied' : 'Copy link'}
             </button>
             <button 
                onClick={onClose}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
             >
                Done
             </button>
        </div>

      </div>
    </div>
  );
};


// --- Main App Component ---

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
      startDate: a.start_date,
      startWeekId: a.start_week_id,
      duration: a.duration,
      // Keep actual progress source-of-truth from DB only.
      // Do not auto-promote past assignments to 100%, otherwise Actual Date picker
      // opens in a misleading completed state.
      progress: typeof a.progress === 'number' && Number.isFinite(a.progress)
        ? Math.max(0, Math.min(100, Math.round(a.progress)))
        : undefined,
      actualDate: typeof a.actual_date === 'string' && a.actual_date ? a.actual_date : undefined,
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
      complexity: m.complexity || 'Medium',
      frontendFunctionPoints: m.frontend_function_points ?? m.function_points ?? 0,
      backendFunctionPoints: m.backend_function_points ?? m.function_points ?? 0,
      frontendComplexity: m.frontend_complexity || m.complexity || 'Medium',
      backendComplexity: m.backend_complexity || m.complexity || 'Medium',
      prepVelocity: m.prep_velocity || 10,
      prepTeamSize: m.prep_team_size || 2,
      frontendVelocity: m.frontend_velocity || 5,
      frontendTeamSize: m.frontend_team_size || 2,
      backendVelocity: m.backend_velocity || 5,
      backendTeamSize: m.backend_team_size || 2,
      startDate: m.start_date,
      startTaskId: m.start_task_id,
      deliveryTaskId: m.delivery_task_id,
      sort_order: m.sort_order,
      tasks: moduleTasks,
    });
  });

  return (projects || []).map(p => {
    let role: ProjectRole = 'viewer';
    if (p.user_id === currentUserId) {
        role = 'owner';
    } else {
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
        user_id: p.user_id 
    };
  }).sort((a,b) => a.name.localeCompare(b.name));
};

export const App: React.FC = () => {
  const [session, setSession] = useState<any | null>(null);
  const [projects, setProjectsRaw] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);

  // --- Undo History ---
  const MAX_UNDO_HISTORY = 30;
  const undoHistoryRef = useRef<Project[][]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const skipUndoRef = useRef(false);

  const setProjects: typeof setProjectsRaw = useCallback((action) => {
    if (skipUndoRef.current) {
      setProjectsRaw(action);
      return;
    }
    setProjectsRaw(prev => {
      undoHistoryRef.current = [...undoHistoryRef.current.slice(-(MAX_UNDO_HISTORY - 1)), prev];
      setCanUndo(true);
      return typeof action === 'function' ? action(prev) : action;
    });
  }, []);

  const handleUndo = useCallback(() => {
    const history = undoHistoryRef.current;
    if (history.length === 0) return;
    const previousState = history[history.length - 1];
    undoHistoryRef.current = history.slice(0, -1);
    setCanUndo(undoHistoryRef.current.length > 0);
    skipUndoRef.current = true;
    setProjectsRaw(previousState);
    skipUndoRef.current = false;
  }, []);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dataLoadStatus, setDataLoadStatus] = useState<{
    active: boolean;
    label: string;
    progress: number;
    tone: 'info' | 'success' | 'error';
  }>({ active: false, label: '', progress: 0, tone: 'info' });
  const [activeTab, setActiveTab] = useState<TabId>('planner');
  const [showHistory, setShowHistory] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isAIPanelVisible, setIsAIPanelVisible] = useState(false);
  const [collapseResourceRowsSignal, setCollapseResourceRowsSignal] = useState(0);
  
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const projectMembersQueryEnabledRef = useRef(true);

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentRole: ProjectRole = currentProject?.currentUserRole || 'owner'; 
  const isReadOnlyMode = currentRole === 'viewer';
  const isOwner = currentRole === 'owner';

  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const statusTimeoutRef = useRef<number | undefined>(undefined);

  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(true);
  const [logEntries, setLogEntries] = useState<LogEntry[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const raw = window.sessionStorage.getItem(DEBUG_LOG_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // ─── GitHub Auth State ───
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('oms_github_token') || '');
  const [githubUser, setGithubUser] = useState<{login: string; avatar_url: string} | null>(() => {
    try { const s = localStorage.getItem('oms_github_user'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [githubClientId, setGithubClientId] = useState(() => {
    const saved = localStorage.getItem('oms_github_client_id') || '';
    if (saved.includes('@')) {
      localStorage.removeItem('oms_github_client_id');
      return '';
    }
    return saved;
  });
  const [githubDeviceCode, setGithubDeviceCode] = useState<{user_code: string; device_code: string; verification_uri: string; interval: number; expires_in: number} | null>(null);
  const [githubLoginStatus, setGithubLoginStatus] = useState<'idle' | 'waiting' | 'polling' | 'success' | 'error'>('idle');
  const [githubLoginMessage, setGithubLoginMessage] = useState('');
  const [isGithubCheckNowLoading, setIsGithubCheckNowLoading] = useState(false);
  const githubPollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // ─── Smartsheet Token State ───
  const [smartsheetToken, setSmartsheetToken] = useState(() => localStorage.getItem('oms_smartsheet_token') || '');
  const preloadedChunksRef = useRef<Set<string>>(new Set());

  const preloadChunk = useCallback((key: string, loader: () => Promise<unknown>) => {
    if (preloadedChunksRef.current.has(key)) return;
    preloadedChunksRef.current.add(key);
    void loader().catch(() => {
      preloadedChunksRef.current.delete(key);
    });
  }, []);

  const handleTabPrefetch = useCallback((tabId: TabId) => {
    const loader = TAB_PREFETCH_LOADERS[tabId];
    if (!loader) return;
    preloadChunk(`tab:${tabId}`, loader);
  }, [preloadChunk]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const runIdlePrefetch = () => {
      preloadChunk('tab:dashboard', loadDashboard);
      preloadChunk('tab:estimator', loadEstimator);
      preloadChunk('tab:resources', loadResources);
      if (isAIEnabled) preloadChunk('panel:ai', loadAIAssistant);
    };

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    let idleHandle: number | undefined;
    let timeoutHandle: number | undefined;

    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(() => runIdlePrefetch(), { timeout: 1500 });
    } else {
      timeoutHandle = window.setTimeout(runIdlePrefetch, 1200);
    }

    return () => {
      if (idleHandle !== undefined && typeof win.cancelIdleCallback === 'function') {
        win.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== undefined) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [isAIEnabled, preloadChunk]);

  const appendDebugEntry = useCallback((message: string, payload: any, status: LogEntry['status'] = 'pending'): number => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setLogEntries(prev => [{ id, timestamp: new Date().toISOString(), message, payload, status }, ...prev.slice(0, MAX_DEBUG_LOG_ENTRIES - 1)]);

    if (typeof window !== 'undefined') {
      const level = status === 'error' ? 'error' : 'info';
      console[level](`[OMS] ${message}`, payload);
    }

    return id;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      window.sessionStorage.setItem(DEBUG_LOG_STORAGE_KEY, JSON.stringify(logEntries.slice(0, MAX_DEBUG_LOG_ENTRIES)));
    } catch {
      // Ignore storage write failures.
    }
  }, [logEntries]);

  useEffect(() => {
    if (!githubToken) { setGithubUser(null); localStorage.removeItem('oms_github_user'); return; }
    (async () => {
      try {
        const res = await fetch('/api/github-user', { headers: { Authorization: `Bearer ${githubToken}`, 'User-Agent': 'OMS-Resource-Master' } });
        if (res.ok) {
          const data = await res.json();
          const user = { login: data.login, avatar_url: data.avatar_url };
          setGithubUser(user);
          localStorage.setItem('oms_github_user', JSON.stringify(user));
        }
      } catch {}
    })();
  }, [githubToken]);

  useEffect(() => () => { if (githubPollRef.current) clearTimeout(githubPollRef.current); }, []);

  useEffect(() => {
    localStorage.setItem('oms_ai_enabled', String(isAIEnabled));
  }, [isAIEnabled]);

  const clearGithubPollTimer = useCallback(() => {
    if (githubPollRef.current) {
      clearTimeout(githubPollRef.current);
      githubPollRef.current = undefined;
    }
  }, []);

  const pollGithubTokenOnce = useCallback(async (clientId: string, deviceCode: string) => {
    try {
      const tokenBody = new URLSearchParams({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      });
      const tokenRes = await fetch('/api/github-oauth-token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: tokenBody.toString(),
      });

      const raw = await tokenRes.text();
      let tokenData: any = {};
      try {
        tokenData = raw ? JSON.parse(raw) : {};
      } catch {
        tokenData = { error: 'invalid_response', error_description: raw?.slice(0, 200) || 'Non-JSON response from GitHub' };
      }

      if (!tokenRes.ok) {
        const msg = tokenData?.error_description || tokenData?.error || `GitHub returned ${tokenRes.status}`;
        clearGithubPollTimer();
        setGithubLoginStatus('error');
        setGithubLoginMessage(msg);
        setGithubDeviceCode(null);
        return;
      }

      if (tokenData.access_token) {
        clearGithubPollTimer();
        setGithubToken(tokenData.access_token);
        localStorage.setItem('oms_github_token', tokenData.access_token);
        setGithubLoginStatus('success');
        setGithubLoginMessage('Signed in!');
        setGithubDeviceCode(null);
        return { outcome: 'success' as const };
      } else if (tokenData.error === 'authorization_pending') {
        setGithubLoginMessage('Waiting for authorization...');
        return { outcome: 'pending' as const };
      } else if (tokenData.error === 'slow_down') {
        setGithubLoginMessage('GitHub asked to slow down polling...');
        return { outcome: 'slow_down' as const };
      } else if (tokenData.error === 'expired_token') {
        clearGithubPollTimer();
        setGithubLoginStatus('error');
        setGithubLoginMessage('Code expired. Try again.');
        setGithubDeviceCode(null);
        return { outcome: 'error' as const };
      } else if (tokenData.error) {
        clearGithubPollTimer();
        setGithubLoginStatus('error');
        setGithubLoginMessage(tokenData.error_description || tokenData.error);
        setGithubDeviceCode(null);
        return { outcome: 'error' as const };
      }
      return { outcome: 'pending' as const };
    } catch (pollError: any) {
      clearGithubPollTimer();
      setGithubLoginStatus('error');
      setGithubLoginMessage(pollError?.message || 'Token polling failed.');
      setGithubDeviceCode(null);
      return { outcome: 'error' as const };
    }
  }, [clearGithubPollTimer]);

  const startGithubPolling = useCallback((clientId: string, deviceCode: string, baseIntervalMs: number) => {
    clearGithubPollTimer();
    let nextDelayMs = baseIntervalMs;

    const tick = async () => {
      const result = await pollGithubTokenOnce(clientId, deviceCode);
      if (result.outcome === 'success' || result.outcome === 'error') return;

      if (result.outcome === 'slow_down') {
        nextDelayMs += 5000;
      }

      githubPollRef.current = setTimeout(tick, nextDelayMs);
    };

    githubPollRef.current = setTimeout(tick, nextDelayMs);
  }, [clearGithubPollTimer, pollGithubTokenOnce]);

  const startGithubDeviceFlow = useCallback(async () => {
    const trimmedClientId = githubClientId.trim();
    if (!trimmedClientId) { setGithubLoginStatus('error'); setGithubLoginMessage('Enter your GitHub OAuth App Client ID first.'); return; }
    if (trimmedClientId.includes('@')) { setGithubLoginStatus('error'); setGithubLoginMessage('Use your GitHub OAuth App Client ID here, not your email address.'); return; }
    localStorage.setItem('oms_github_client_id', trimmedClientId);
    setGithubLoginStatus('waiting');
    setGithubLoginMessage('');
    try {
      const deviceCodeBody = new URLSearchParams({
        client_id: trimmedClientId,
        scope: 'read:user',
      });
      const res = await fetch('/api/github-device-code', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: deviceCodeBody.toString(),
      });
      if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error_description || data.error);
      setGithubDeviceCode(data);
      setGithubLoginStatus('polling');
      const interval = (data.interval || 5) * 1000;
      startGithubPolling(trimmedClientId, data.device_code, interval);
    } catch (e: any) {
      setGithubLoginStatus('error');
      setGithubLoginMessage(e.message || 'Failed to start device flow');
    }
  }, [githubClientId, startGithubPolling]);

  const checkGithubAuthorizationNow = useCallback(async () => {
    const trimmedClientId = githubClientId.trim();
    if (!trimmedClientId || !githubDeviceCode?.device_code) {
      setGithubLoginStatus('error');
      setGithubLoginMessage('No active sign-in session. Click Sign in with GitHub again.');
      return;
    }
    setIsGithubCheckNowLoading(true);
    try {
      // Avoid overlapping requests with background polling.
      clearGithubPollTimer();
      setGithubLoginStatus('polling');
      setGithubLoginMessage('Checking authorization now...');
      const result = await pollGithubTokenOnce(trimmedClientId, githubDeviceCode.device_code);

      // If not completed yet, resume auto polling with conservative delay.
      if (result.outcome === 'pending') {
        startGithubPolling(
          trimmedClientId,
          githubDeviceCode.device_code,
          Math.max((githubDeviceCode.interval || 5) * 1000, 10000)
        );
      } else if (result.outcome === 'slow_down') {
        setGithubLoginMessage('GitHub asked to slow down polling... waiting 15s before retry.');
        startGithubPolling(trimmedClientId, githubDeviceCode.device_code, 15000);
      }
    } finally {
      setIsGithubCheckNowLoading(false);
    }
  }, [githubClientId, githubDeviceCode, pollGithubTokenOnce, clearGithubPollTimer, startGithubPolling]);

  const handleGithubLogout = useCallback(() => {
    setGithubToken('');
    setGithubUser(null);
    localStorage.removeItem('oms_github_token');
    localStorage.removeItem('oms_github_user');
    setGithubLoginStatus('idle');
    setGithubDeviceCode(null);
    clearGithubPollTimer();
  }, [clearGithubPollTimer]);
  
  // --- Handlers reused from previous implementation (abbreviated for clarity where logic is identical) ---

  const log = (message: string, payload: any, status: LogEntry['status'] = 'pending'): number => {
    if (!isDebugLogEnabled) return -1;
    return appendDebugEntry(message, payload, status);
  };
  
  const updateLog = (id: number, status: 'success' | 'error', payload?: any) => {
    setLogEntries(prev => prev.map(entry => entry.id === id ? { ...entry, status, payload: payload || entry.payload } : entry));
  };

  const callSupabase = async (message: string, payload: any, supabasePromise: PromiseLike<{ data: any; error: any }>) => {
    if (isReadOnlyMode) {
        const isGlobalEdit = message.includes('resource') || message.includes('holiday');
        if (!isGlobalEdit) return { data: null, error: 'Read Only Mode' };
    }
    // Skip DB calls in offline mode — all state is managed locally
    if (isOfflineMode) {
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 500);
      return { data: payload, error: null };
    }
    const logId = log(message, payload);
    setSaveStatus('saving');
    
    // Add 30-second timeout to prevent hanging forever
    const timeoutPromise = new Promise((_resolve, reject) => 
      setTimeout(() => reject(new Error(`Supabase call '${message}' timed out after 30 seconds`)), 30000)
    );
    
    try {
      const result = await Promise.race([supabasePromise, timeoutPromise]) as any;
      if (result?.error) {
        updateLog(logId, 'error', result.error);
        setSaveStatus('error');
      } else {
        updateLog(logId, 'success', result?.data);
        setSaveStatus('success');
      }
      setTimeout(() => setSaveStatus('idle'), 2000);
      return result || { data: null, error: null };
    } catch (timeoutErr: any) {
      updateLog(logId, 'error', timeoutErr);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return { data: null, error: timeoutErr };
    }
  };

  const fetchData = async (isRefresh: boolean = false) => {
    if (!session) return;
    const fetchLogId = appendDebugEntry('FETCH_DATA_START', {
      isRefresh,
      offlineMode: isOfflineMode,
      userEmail: session.user?.email || null,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
    }, 'pending');

    if (isRefresh) setIsRefreshing(true); else setLoading(true);
    setDataLoadStatus({
      active: true,
      label: isRefresh ? 'Refreshing data...' : 'Loading workspace data...',
      progress: 8,
      tone: 'info'
    });

    try {
      // Check if offline mode - load from localStorage instead
      if (isOfflineMode) {
        setDataLoadStatus({ active: true, label: 'Loading offline data...', progress: 20, tone: 'info' });
        console.log('📥 Fetching data from offline store...');
        const offlineData = await fetchDataOffline(session.user.id, session.user.email);
        
        const structured = structureProjectsData(
          offlineData.projects,
          offlineData.modules,
          offlineData.tasks,
          offlineData.assignments,
          offlineData.allocations,
          session.user.id,
          offlineData.memberships,
          session.user.email
        );
        
        setProjects(structured);
        setResources(offlineData.resources || []);
        setHolidays(offlineData.holidays || []);
        updateLog(fetchLogId, 'success', {
          mode: 'offline',
          projectCount: structured.length,
          resourceCount: (offlineData.resources || []).length,
          holidayCount: (offlineData.holidays || []).length,
        });
        console.log('✅ Offline data loaded successfully');
        setDataLoadStatus({ active: true, label: 'Offline data loaded', progress: 100, tone: 'success' });
        setTimeout(() => setDataLoadStatus(s => ({ ...s, active: false })), 800);
        
        if (isRefresh) setIsRefreshing(false); else setLoading(false);
        return;
      }

      // Live Mode - Fetch from Supabase
      setDataLoadStatus({ active: true, label: 'Fetching projects...', progress: 18, tone: 'info' });
      const { data: ownedProjects } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
      
      let sharedProjects: any[] = [];
      let memberships: any[] = [];
      if (projectMembersQueryEnabledRef.current) {
        setDataLoadStatus({ active: true, label: 'Checking shared projects...', progress: 30, tone: 'info' });
        try {
          // Schema-tolerant read: avoid strict column filters that may 400 on drifted schemas.
          const { data: memberData, error: memberError, status } = await supabase
            .from('project_members')
            .select('*');

          if (memberError) {
            if (status === 400 || status === 404) {
              projectMembersQueryEnabledRef.current = false;
              console.warn('project_members query disabled for this session due to schema/API mismatch:', memberError.message);
            }
          } else if (memberData) {
            const currentEmail = (session.user.email || '').toLowerCase();
            const currentUserId = session.user.id;

            const normalizedMembers = memberData.map((m: any) => ({
              project_id: m.project_id ?? m.projectId ?? null,
              user_email: String(m.user_email ?? m.email ?? m.member_email ?? '').toLowerCase(),
              user_id: m.user_id ?? m.member_user_id ?? null,
              role: m.role || 'viewer',
            }));

            memberships = normalizedMembers.filter((m: any) =>
              Boolean(m.project_id) && (
                (m.user_email && m.user_email === currentEmail) ||
                (m.user_id && m.user_id === currentUserId)
              )
            );

            const sharedProjectIds = Array.from(new Set(memberships.map((m: any) => m.project_id).filter(Boolean)));
            if (sharedProjectIds.length > 0) {
              const { data: sharedProjectData, error: sharedProjectsError } = await supabase
                .from('projects')
                .select('*')
                .in('id', sharedProjectIds);
              if (!sharedProjectsError && sharedProjectData) {
                sharedProjects = sharedProjectData;
              }
            }
          }
        } catch (e) {
          projectMembersQueryEnabledRef.current = false;
          console.warn('project_members query disabled for this session due to runtime error');
        }
      }

      let allProjectsRaw = [...(ownedProjects || []), ...sharedProjects];
      // Filter out 'My First Project' entries
      let uniqueProjects = Array.from(new Map(allProjectsRaw.map(p => [p.id, p])).values()).filter(p => p.name !== 'My First Project');
      
      if (uniqueProjects.length === 0) {
         const { data: newProject } = await supabase.from('projects').insert({ name: 'My First Project', user_id: session.user.id }).select().single();
         if(newProject) uniqueProjects.push(newProject);
      }

      if (uniqueProjects.length > 0 && (!selectedProjectId || !uniqueProjects.find(p => p.id === selectedProjectId))) {
          setSelectedProjectId(uniqueProjects[0].id);
      }
      
      const projectIds = uniqueProjects.map(p => p.id);
      let modulesData: any[] = [], tasksData: any[] = [], assignmentsData: any[] = [], allocationsData: any[] = [];
      
      if (projectIds.length > 0) {
          setDataLoadStatus({ active: true, label: 'Loading modules/tasks/assignments...', progress: 50, tone: 'info' });
          const { data: m } = await supabase.from('modules').select('*').in('project_id', projectIds);
          modulesData = m || [];
          const moduleIds = modulesData.map(x => x.id);
          if (moduleIds.length > 0) {
               const { data: t } = await supabase.from('tasks').select('*').in('module_id', moduleIds);
               tasksData = t || [];
               const taskIds = tasksData.map(x => x.id);
               if (taskIds.length > 0) {
                   const { data: a } = await supabase.from('task_assignments').select('*').in('task_id', taskIds);
                   assignmentsData = a || [];
                   const assignIds = assignmentsData.map(x => x.id);
                   if (assignIds.length > 0) {
                       setDataLoadStatus({ active: true, label: 'Loading allocations...', progress: 72, tone: 'info' });
                       const { data: al } = await supabase.from('resource_allocations').select('*').in('assignment_id', assignIds);
                       allocationsData = al || [];
                   }
               }
          }
      }

      setDataLoadStatus({ active: true, label: 'Loading resources & holidays...', progress: 84, tone: 'info' });
      const { data: resourcesData } = await supabase.from('resources').select('*, individual_holidays(*)').order('name');
      const { data: holidaysData } = await supabase.from('holidays').select('*');

      const structured = structureProjectsData(uniqueProjects, modulesData, tasksData, assignmentsData, allocationsData, session.user.id, memberships, session.user.email);
      setProjects(structured);
      setResources(resourcesData || []);
      setHolidays(holidaysData || []);
      updateLog(fetchLogId, 'success', {
        mode: 'live',
        projectCount: structured.length,
        moduleCount: modulesData.length,
        taskCount: tasksData.length,
        assignmentCount: assignmentsData.length,
        resourceCount: (resourcesData || []).length,
        holidayCount: (holidaysData || []).length,
      });
      setDataLoadStatus({ active: true, label: 'Data loaded', progress: 100, tone: 'success' });
      setTimeout(() => setDataLoadStatus(s => ({ ...s, active: false })), 800);
      
      if (isRefresh) setIsRefreshing(false); else setLoading(false);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      updateLog(fetchLogId, 'error', {
        isRefresh,
        offlineMode: isOfflineMode,
        message,
      });
      setDataLoadStatus({ active: true, label: `Load failed: ${message}`, progress: 100, tone: 'error' });
      if (isRefresh) setIsRefreshing(false); else setLoading(false);
    }
  };

  useEffect(() => {
    const getWasDiscarded = () => {
      if (typeof document !== 'undefined' && 'wasDiscarded' in document) {
        return Boolean((document as Document & { wasDiscarded?: boolean }).wasDiscarded);
      }

      if (typeof performance !== 'undefined') {
        const [navigationEntry] = performance.getEntriesByType('navigation') as Array<PerformanceNavigationTiming & { wasDiscarded?: boolean }>;
        return Boolean(navigationEntry?.wasDiscarded);
      }

      return false;
    };

    appendDebugEntry('APP_BOOT', {
      offlineMode: isOfflineMode,
      path: typeof window !== 'undefined' ? window.location.pathname : '/',
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
      wasDiscarded: getWasDiscarded(),
    }, 'success');

    const handleVisibilityChange = () => {
      appendDebugEntry('PAGE_VISIBILITY_CHANGE', {
        visibilityState: document.visibilityState,
        hidden: document.hidden,
      }, 'success');
    };

    const handleFocus = () => {
      appendDebugEntry('WINDOW_FOCUS', {
        visibilityState: document.visibilityState,
      }, 'success');
    };

    const handleBlur = () => {
      appendDebugEntry('WINDOW_BLUR', {
        visibilityState: document.visibilityState,
      }, 'success');
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      appendDebugEntry('PAGE_SHOW', {
        persisted: event.persisted,
        visibilityState: document.visibilityState,
        wasDiscarded: getWasDiscarded(),
      }, 'success');
    };

    const handlePageHide = (event: PageTransitionEvent) => {
      appendDebugEntry('PAGE_HIDE', {
        persisted: event.persisted,
        visibilityState: document.visibilityState,
      }, 'success');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [appendDebugEntry]);

  useEffect(() => {
    if (isOfflineMode) {
      // Offline Mode: Check if mock session exists
      const mockSession = mockAuthManager.getMockSession();
      appendDebugEntry('AUTH_SESSION_INIT', {
        mode: 'offline',
        hasSession: Boolean(mockSession),
        userEmail: mockSession?.user?.email || null,
      }, 'success');
      setSession(mockSession);
    } else {
      // Live Mode: Use Supabase auth
      supabase.auth.getSession().then(({ data: { session } }) => {
        appendDebugEntry('AUTH_GET_SESSION', {
          mode: 'live',
          hasSession: Boolean(session),
          userEmail: session?.user?.email || null,
        }, 'success');
        setSession(session);
      });
      const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
        appendDebugEntry('AUTH_STATE_CHANGE', {
          event,
          hasSession: Boolean(session),
          userEmail: session?.user?.email || null,
        }, 'success');
        setSession(session);
      });
      return () => { authListener?.subscription?.unsubscribe(); };
    }
  }, [appendDebugEntry]);

  useEffect(() => {
    if (session) fetchData(false);
  }, [session]);

  // Auto-load real data in offline mode if localStorage is empty
  useEffect(() => {
    if (!isOfflineMode || !session) return;

    // Check if data already loaded
    const hasData = localStorage.getItem('oms_data_projects');
    if (hasData) return;

    // Avoid repeated heavy auto-load attempts on every startup.
    const alreadyAttempted = localStorage.getItem('oms_offline_autoload_attempted') === '1';
    if (alreadyAttempted) return;
    localStorage.setItem('oms_offline_autoload_attempted', '1');

    // Delay to let first paint happen before heavy JSON parsing/writes.
    const timer = setTimeout(() => {
      console.log('🔄 Auto-loading real data into offline storage...');
      loadRealDataFromExport()
        .then(() => fetchData(true))
        .catch(error => {
          console.error('⚠️ Auto-load failed:', error);
          // Fallback: try loading sample data
          console.log('💡 Falling back to sample data...');
          loadSampleDataFromJSON()
            .then(() => fetchData(true))
            .catch(e => console.error('Sample load failed:', e));
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [session]);

  // Auto-fit timeline to current assignment range (with buffer weeks).
  // Run only while planner is active and debounce recalculation for burst updates.
  useEffect(() => {
    if (activeTab !== 'planner' || !projects.length) return;

    const timer = setTimeout(() => {
      let minDateStr: string | null = null;
      let maxDateStr: string | null = null;

      // Build minimal holiday map for calculation
      const hMap = new Map<string, number>();
      holidays.filter(h => h.country === 'HK').forEach(h => hMap.set(h.date, h.duration || 1));

      projects.forEach(p => {
        p.modules.forEach(m => {
          m.tasks.forEach(t => {
            t.assignments.forEach(a => {
              if (a.startDate) {
                if (!minDateStr || a.startDate < minDateStr) minDateStr = a.startDate;
                
                let endStr = a.startDate;
                if (a.duration && a.duration > 0) {
                  endStr = calculateEndDate(a.startDate, a.duration, hMap);
                }
                
                if (!maxDateStr || endStr > maxDateStr) maxDateStr = endStr;
              }
            });
          });
        });
      });

      if (minDateStr && maxDateStr) {
        const minDate = new Date((minDateStr as string).replace(/-/g, '/'));
        const maxDate = new Date((maxDateStr as string).replace(/-/g, '/'));

        const minWeekId = getWeekIdFromDate(minDate);
        const [minY, minW] = minWeekId.split('-').map(Number);
        
        const maxWeekId = getWeekIdFromDate(maxDate);
        const [maxY, maxW] = maxWeekId.split('-').map(Number);

        // Buffer: Start 2 weeks early, End 4 weeks late
        const startPoint = addWeeksToPoint({ year: minY, week: minW }, -2);
        const endPoint = addWeeksToPoint({ year: maxY, week: maxW }, 4);

        const isSameWeekPoint = (a: WeekPoint, b: WeekPoint) => a.year === b.year && a.week === b.week;

        setTimelineStart(prev => (isSameWeekPoint(prev, startPoint) ? prev : startPoint));
        setTimelineEnd(prev => (isSameWeekPoint(prev, endPoint) ? prev : endPoint));
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [activeTab, projects, holidays]);

  // --- Wrapper Functions for Child Components (Simplified for update) ---
  // Note: All these would use callSupabase as defined before.
    const runMutation = async (
      message: string,
      payload: any,
      supabasePromise: PromiseLike<{ data: any; error: any }>,
      refresh = false
    ) => {
      const result = await callSupabase(message, payload, supabasePromise);
      if (refresh) {
        await fetchData(true);
      }
      return result;
    };

  const genericUpdate = async (table: string, id: string, payload: any, refresh = false) => {
      await runMutation(`UPDATE ${table}`, payload, supabase.from(table).update(payload).eq('id', id), refresh);
    };

    const genericInsert = async (table: string, payload: any, refresh = false) => {
      return runMutation(`INSERT ${table}`, payload, supabase.from(table).insert(payload), refresh);
    };

    const genericDelete = async (table: string, id: string, refresh = true) => {
      return runMutation(`DELETE ${table}`, { id }, supabase.from(table).delete().eq('id', id), refresh);
    };

    const genericDeleteWhere = async (table: string, column: string, value: any, refresh = true) => {
      return runMutation(`DELETE ${table}`, { [column]: value }, supabase.from(table).delete().eq(column, value), refresh);
  };

      const findAssignmentInProjects = useCallback((assignmentId: string) => {
        for (const project of projects) {
          for (const module of project.modules) {
            for (const task of module.tasks) {
              const assignment = task.assignments.find((item) => item.id === assignmentId);
              if (assignment) {
                return assignment;
              }
            }
          }
        }
        return null;
      }, [projects]);

      const getAssignmentHolidayMap = useCallback((resourceName?: string) => {
        const holidayMap = new Map<string, number>();
        const fallbackRegion = holidays.some((holiday) => holiday.country === 'HK') ? 'HK' : holidays[0]?.country;
        const resource = resources.find((item) => item.name === resourceName);
        const regionalHolidays = resource?.holiday_region
          ? holidays.filter((holiday) => holiday.country === resource.holiday_region)
          : fallbackRegion
            ? holidays.filter((holiday) => holiday.country === fallbackRegion)
            : [];

        regionalHolidays.forEach((holiday) => holidayMap.set(holiday.date, holiday.duration || 1));
        (resource?.individual_holidays || []).forEach((holiday) => holidayMap.set(holiday.date, holiday.duration || 1));

        return holidayMap;
      }, [holidays, resources]);

      const findAssignmentContext = useCallback((assignmentId: string) => {
        for (const project of projects) {
          for (const module of project.modules) {
            for (const task of module.tasks) {
              const assignment = task.assignments.find((item) => item.id === assignmentId);
              if (assignment) {
                return { projectId: project.id, moduleId: module.id, taskId: task.id, assignment };
              }
            }
          }
        }
        return null;
      }, [projects]);

      const hasDependencyCycle = useCallback((childAssignmentId: string, potentialParentId: string | null): boolean => {
        if (!potentialParentId) return false;
        const assignmentById = new Map<string, TaskAssignment>();
        projects.forEach((project) => {
          project.modules.forEach((module) => {
            module.tasks.forEach((task) => {
              task.assignments.forEach((assignment) => assignmentById.set(assignment.id, assignment));
            });
          });
        });

        let cursor: string | null = potentialParentId;
        const visited = new Set<string>();
        while (cursor && !visited.has(cursor)) {
          if (cursor === childAssignmentId) return true;
          visited.add(cursor);
          cursor = assignmentById.get(cursor)?.parentAssignmentId || null;
        }
        return false;
      }, [projects]);

      const getWeeklyResourceAllocationWithoutAssignment = useCallback((resourceName: string, weekId: string, excludedAssignmentId: string): number => {
        let total = 0;
        projects.forEach((project) => {
          project.modules.forEach((module) => {
            module.tasks.forEach((task) => {
              task.assignments.forEach((assignment) => {
                if (assignment.id === excludedAssignmentId) return;
                if ((assignment.resourceName || 'Unassigned') !== resourceName) return;
                const weekAllocation = assignment.allocations.find((allocation) => allocation.weekId === weekId);
                if (!weekAllocation) return;
                total += Number(weekAllocation.count || 0);
              });
            });
          });
        });
        return total;
      }, [projects]);

      const findScheduleConflicts = useCallback((assignmentId: string, newStartDate: string, newDuration: number) => {
        const assignmentCtx = findAssignmentContext(assignmentId);
        if (!assignmentCtx) return [] as TaskAssignment[];
        const resourceName = assignmentCtx.assignment.resourceName || 'Unassigned';
        if (resourceName === 'Unassigned') return [] as TaskAssignment[];

        const targetHolidayMap = getAssignmentHolidayMap(resourceName);
        const targetEndDate = calculateEndDate(newStartDate, newDuration, targetHolidayMap);
        if (!targetEndDate) return [] as TaskAssignment[];

        const overlaps: TaskAssignment[] = [];
        projects.forEach((project) => {
          project.modules.forEach((module) => {
            module.tasks.forEach((task) => {
              task.assignments.forEach((assignment) => {
                if (assignment.id === assignmentId) return;
                if ((assignment.resourceName || 'Unassigned') !== resourceName) return;
                if (!assignment.startDate || !assignment.duration || assignment.duration <= 0) return;

                const otherHolidayMap = getAssignmentHolidayMap(resourceName);
                const otherEndDate = calculateEndDate(assignment.startDate, assignment.duration, otherHolidayMap);
                if (!otherEndDate) return;

                const overlapsRange = newStartDate <= otherEndDate && assignment.startDate <= targetEndDate;
                if (overlapsRange) overlaps.push(assignment);
              });
            });
          });
        });
        return overlaps;
      }, [findAssignmentContext, getAssignmentHolidayMap, projects]);

  if (!session) {
    // Show offline login if in offline mode, otherwise show Supabase auth
    if (isOfflineMode) {
      return (
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-slate-50 text-slate-600">Loading login...</div>}>
          <OfflineLoginScreen onLogin={setSession} />
        </React.Suspense>
      );
    }
    
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Master</h1>
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google']} />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="w-full max-w-lg px-6">
          <div className="flex items-center justify-center mb-4">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="font-medium">{dataLoadStatus.label || 'Loading plan...'}</span>
          </div>
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.max(6, dataLoadStatus.progress || 10)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Left Sidebar */}
      <aside className={`bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'w-16' : 'w-64'} h-full flex-shrink-0 z-[100] shadow-xl`}>
        <div className="h-16 flex items-center justify-center border-b border-slate-800">
          <div className="flex items-center gap-2 font-bold text-white text-lg overflow-hidden">
             <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">R</div>
             {!isSidebarCollapsed && <span>ResourceMaster</span>}
          </div>
        </div>

        <nav className="flex-1 py-4 flex flex-col gap-1 overflow-y-auto custom-scrollbar px-2">
           {NAV_ITEMS.map(item => (
               <button 
                key={item.id}
                onClick={() => setActiveTab(item.id)} 
                onMouseEnter={() => handleTabPrefetch(item.id)}
                onFocus={() => handleTabPrefetch(item.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${activeTab === item.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 text-slate-400 hover:text-white'}`}
               >
                  <item.icon size={20} />
                  {!isSidebarCollapsed && <span>{item.label}</span>}
               </button>
           ))}
        </nav>

        <div className="p-4 border-t border-slate-800 flex flex-col gap-2">
           {isOwner && (
               <button 
                   onClick={() => setShowShareModal(true)} 
                   className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 px-2'} py-2 rounded-lg text-indigo-400 hover:text-white hover:bg-slate-800 transition-colors`}
                   title="Share Project"
               >
                   <Share2 size={20} />
                   {!isSidebarCollapsed && <span className="text-sm font-medium">Share</span>}
               </button>
           )}
           
           <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 px-2'} py-2 overflow-hidden`}>
               <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {session.user.email?.charAt(0).toUpperCase()}
               </div>
               {!isSidebarCollapsed && (
                   <div className="flex flex-col overflow-hidden">
                       <span className="text-sm font-medium text-white truncate" title={session.user.email}>{session.user.email}</span>
                   </div>
               )}
           </div>
           
           <button onClick={() => {
             if (isOfflineMode) {
               mockAuthManager.clearMockSession();
               setSession(null);
             } else {
               supabase.auth.signOut();
             }
           }} className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3 px-2'} py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors`} title="Sign Out">
               <LogOut size={20}/> 
               {!isSidebarCollapsed && <span className="text-sm font-medium">Sign Out</span>}
           </button>

           <div className={`flex ${isSidebarCollapsed ? 'justify-center' : 'justify-end'} mt-2`}>
                <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="p-2 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-slate-800">
                   <Menu size={20}/>
                </button>
           </div>
        </div>
      </aside>

      {/* Main Content Area with Optional AI Panel */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-full">
         {(dataLoadStatus.active || isRefreshing || saveStatus === 'saving') && (
           <div className="h-9 border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 flex items-center gap-3 z-30">
             <div className="w-44 h-1.5 bg-slate-200 rounded-full overflow-hidden flex-shrink-0">
               <div
                 className={`h-full transition-all duration-300 ${dataLoadStatus.tone === 'error' ? 'bg-red-500' : dataLoadStatus.tone === 'success' ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                 style={{ width: `${Math.max(8, dataLoadStatus.progress || (isRefreshing ? 35 : saveStatus === 'saving' ? 45 : 15))}%` }}
               />
             </div>
             <span className={`text-xs font-medium ${dataLoadStatus.tone === 'error' ? 'text-red-600' : dataLoadStatus.tone === 'success' ? 'text-emerald-600' : 'text-slate-600'}`}>
               {dataLoadStatus.label || (isRefreshing ? 'Refreshing data...' : saveStatus === 'saving' ? 'Saving changes...' : 'Working...')}
             </span>
           </div>
         )}
         {activeTab !== 'planner' && (
             <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 z-20">
                 <div className="flex items-center gap-4">
                     <h1 className="text-xl font-bold text-slate-800 capitalize">{activeTab}</h1>
                     {isReadOnlyMode && <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded font-medium border border-slate-200">Read Only</span>}
                 </div>
                 <div className="flex items-center gap-2">
                     {isAIEnabled && (
                         <button
                           onClick={() => setIsAIPanelVisible(!isAIPanelVisible)}
                           onMouseEnter={() => preloadChunk('panel:ai', loadAIAssistant)}
                           onFocus={() => preloadChunk('panel:ai', loadAIAssistant)}
                           className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isAIPanelVisible ? 'text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'}`}
                           title={isAIPanelVisible ? 'Hide AI Copilot' : 'Show AI Copilot'}
                         >
                             <Sparkles size={16} /> {isAIPanelVisible ? 'Hide' : 'Show'} AI
                         </button>
                     )}
                     <button
                       onClick={() => setShowHistory(true)}
                       onMouseEnter={() => preloadChunk('modal:history', loadVersionHistory)}
                       onFocus={() => preloadChunk('modal:history', loadVersionHistory)}
                       className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                     >
                         <History size={16} /> History
                     </button>
                 </div>
             </header>
         )}

         <div className="flex-1 flex min-w-0 overflow-hidden">
             {/* Tab Content */}
             <div className={`flex-1 overflow-y-auto ${activeTab === 'planner' ? 'p-0 relative' : 'p-6'} bg-slate-50`}>
                 {activeTab === 'planner' && isAIEnabled && (
                     <button 
                         onClick={() => setIsAIPanelVisible(!isAIPanelVisible)}
                     onMouseEnter={() => preloadChunk('panel:ai', loadAIAssistant)}
                     onFocus={() => preloadChunk('panel:ai', loadAIAssistant)}
                        className={`absolute bottom-4 right-4 z-[120] flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${isAIPanelVisible ? 'text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100' : 'text-slate-600 bg-white border border-slate-200 hover:bg-slate-50'}`}
                         title={isAIPanelVisible ? 'Hide AI Copilot' : 'Show AI Copilot'}
                     >
                         <Sparkles size={16} /> {isAIPanelVisible ? 'Hide' : 'Show'} AI
                     </button>
                 )}
                   <React.Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading section...</div>}>
                 {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
                 {activeTab === 'planner' && (
                   <PlannerGrid 
                    projects={projects} 
                    holidays={holidays}
                    resources={resources}
                    collapseResourceRowsSignal={collapseResourceRowsSignal}
                    timelineStart={timelineStart}
                    timelineEnd={timelineEnd}
                    onUpdateAllocation={async (pid, mid, tid, aid, wid, val: number, day) => {
                      const previousProjects = projects;
                         const targetAssignment = projects
                           .find(p => p.id === pid)
                           ?.modules.find(m => m.id === mid)
                           ?.tasks.find(t => t.id === tid)
                           ?.assignments.find(a => a.id === aid);
                         const resourceName = targetAssignment?.resourceName || 'Unassigned';
                         const existingWeekAllocation = targetAssignment?.allocations.find(a => a.weekId === wid);
                         const proposedDays = day
                           ? { ...(existingWeekAllocation?.days || {}), [day]: val }
                           : existingWeekAllocation?.days;
                         const proposedWeekCount = day
                           ? Object.values(proposedDays || {}).reduce((sum: number, value: number) => sum + Number(value || 0), 0)
                           : val;

                         if (resourceName !== 'Unassigned') {
                           const otherAssignmentsWeekTotal = getWeeklyResourceAllocationWithoutAssignment(resourceName, wid, aid);
                           const projectedTotal = otherAssignmentsWeekTotal + proposedWeekCount;
                           if (projectedTotal > 1) {
                             const shouldContinue = window.confirm(`Resource ${resourceName} is projected at ${projectedTotal.toFixed(2)} for ${wid}. Continue anyway?`);
                             if (!shouldContinue) return;
                           }
                         }

                         // Optimistic Update
                         setProjects(prev => {
                             return prev.map(p => {
                                 if (p.id !== pid) return p;
                                 return {
                                     ...p,
                                     modules: p.modules.map(m => {
                                         if (m.id !== mid) return m;
                                         return {
                                             ...m,
                                             tasks: m.tasks.map(t => {
                                                 if (t.id !== tid) return t;
                                                 return {
                                                     ...t,
                                                     assignments: t.assignments.map(a => {
                                                         if (a.id !== aid) return a;
                                                         
                                                         // Calculate new allocation state
                                                         const existingAlloc = a.allocations.find(al => al.weekId === wid);
                                                         let newAlloc;
                                                         
                                                         if (day) {
                                                             const days = { ...(existingAlloc?.days || {}), [day]: val };
                                                             const newCount = Object.values(days).reduce((sum: number, v: number) => sum + v, 0);
                                                             newAlloc = { weekId: wid, count: newCount, days };
                                                         } else {
                                                             newAlloc = { weekId: wid, count: val, days: existingAlloc?.days };
                                                         }

                                                         const newAllocations = existingAlloc 
                                                            ? a.allocations.map(al => al.weekId === wid ? newAlloc : al)
                                                            : [...a.allocations, newAlloc];

                                                         return { ...a, allocations: newAllocations };
                                                     })
                                                 };
                                             })
                                         };
                                     })
                                 };
                             });
                         });

                         // Database Update (Async)
                         let payload: any = { count: val };
                         if (day) {
                             const alloc = projects.find(p=>p.id===pid)?.modules.find(m=>m.id===mid)?.tasks.find(t=>t.id===tid)?.assignments.find(a=>a.id===aid)?.allocations.find(a=>a.weekId===wid);
                             const days = { ...(alloc?.days || {}), [day]: val };
                             payload = { count: Object.values(days).reduce((a: number, b: number) => a + b, 0), days };
                         }
                         const result = await callSupabase('Allocation', payload, supabase.from('resource_allocations').upsert({ assignment_id: aid, week_id: wid, user_id: session.user.id, ...payload }, { onConflict: 'assignment_id, week_id' }));
                         if (result?.error) {
                           setProjects(previousProjects);
                         }
                    }}
                    onUpdateAssignmentResourceName={async (pid, mid, tid, aid, name) => {
                        const previousProjects = projects;
                        // Optimistic Update
                        setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                                ...p,
                                modules: p.modules.map(m => {
                                    if (m.id !== mid) return m;
                                    return {
                                        ...m,
                                        tasks: m.tasks.map(t => {
                                            if (t.id !== tid) return t;
                                            return {
                                                ...t,
                                                assignments: t.assignments.map(a => {
                                                    if (a.id !== aid) return a;
                                                    return { ...a, resourceName: name };
                                                })
                                            };
                                        })
                                    };
                                })
                            };
                        }));
                        const result = await callSupabase('Update Resource', {resource_name: name}, supabase.from('task_assignments').update({ resource_name: name }).eq('id', aid));
                        if (result?.error) {
                          setProjects(previousProjects);
                        }
                    }}
                      onUpdateAssignmentDependency={async (aid, pid) => {
                        const previousProjects = projects;
                        let nextStartDate: string | undefined;

                        if (pid && pid === aid) {
                          window.alert('Assignment cannot depend on itself.');
                          return;
                        }

                        if (pid && !findAssignmentInProjects(pid)) {
                          window.alert('Parent assignment no longer exists. Please refresh and try again.');
                          return;
                        }

                        if (pid && hasDependencyCycle(aid, pid)) {
                          window.alert('This dependency would create a circular chain.');
                          return;
                        }

                        if (pid) {
                          const parentAssignment = findAssignmentInProjects(pid);
                          const childAssignment = findAssignmentInProjects(aid);

                          if (parentAssignment?.startDate && parentAssignment.duration) {
                            const parentHolidayMap = getAssignmentHolidayMap(parentAssignment.resourceName);
                            const parentEndDate = calculateEndDate(parentAssignment.startDate, parentAssignment.duration, parentHolidayMap);
                            const childHolidayMap = getAssignmentHolidayMap(childAssignment?.resourceName);
                            nextStartDate = findNextWorkingDay(parentEndDate, childHolidayMap);
                          }
                        }

                        setProjects(prev => prev.map(p => ({
                          ...p,
                          modules: p.modules.map(m => ({
                            ...m,
                            tasks: m.tasks.map(t => ({
                              ...t,
                              assignments: t.assignments.map(a => a.id === aid ? { ...a, parentAssignmentId: pid || undefined, ...(nextStartDate ? { startDate: nextStartDate } : {}) } : a)
                            }))
                          }))
                        })));

                        const payload: Record<string, any> = { parent_assignment_id: pid };
                        if (nextStartDate) {
                          payload.start_date = nextStartDate;
                        }

                        const result = await runMutation(
                          'Update Assignment Dependency',
                          { assignment_id: aid, ...payload },
                          supabase.from('task_assignments').update(payload).eq('id', aid)
                        );

                        if (result?.error) {
                          setProjects(previousProjects);
                        }
                      }}
                    onAddTask={async (pid, mid, tid, name, role) => {
                        const newAssignId = createSafeId();
                        const today = new Date().toISOString().split('T')[0];
                        if (!isOfflineMode) {
                          await callSupabase('New Task', {name}, supabase.from('tasks').insert({ id: tid, module_id: mid, name, user_id: session.user.id }));
                          const { data: newAssign } = await callSupabase('New Assign', {role}, supabase.from('task_assignments').insert({ task_id: tid, role, resource_name: 'Unassigned', start_date: today, duration: 5, user_id: session.user.id }).select().single());
                          if (newAssign) {
                            setProjects(prev => prev.map(p => {
                                if (p.id !== pid) return p;
                                return {
                                    ...p,
                                    modules: p.modules.map(m => {
                                        if (m.id !== mid) return m;
                                        return {
                                            ...m,
                                            tasks: [...m.tasks, {
                                                id: tid,
                                                name: name,
                                                assignments: [{
                                                    id: newAssign.id,
                                                    role: newAssign.role,
                                                    resourceName: newAssign.resource_name,
                                                    startDate: newAssign.start_date,
                                                    duration: newAssign.duration,
                                                    progress: 0,
                                                    allocations: []
                                                }],
                                            }]
                                        };
                                    })
                                };
                            }));
                          }
                        } else {
                          // Offline mode: add directly to state
                          setProjects(prev => prev.map(p => {
                              if (p.id !== pid) return p;
                              return {
                                  ...p,
                                  modules: p.modules.map(m => {
                                      if (m.id !== mid) return m;
                                      return {
                                          ...m,
                                          tasks: [...m.tasks, {
                                              id: tid,
                                              name: name,
                                              assignments: [{
                                                  id: newAssignId,
                                                  role: role,
                                                  resourceName: 'Unassigned',
                                                  startDate: today,
                                                  duration: 5,
                                                  progress: 0,
                                                  allocations: []
                                              }],
                                          }]
                                      };
                                  })
                              };
                          }));
                        }
                    }}
                    onAddAssignment={async (pid, mid, tid, role) => {
                        const newAssignId = createSafeId();
                        const today = new Date().toISOString().split('T')[0];
                        if (!isOfflineMode) {
                          const { data: newAssign } = await callSupabase('Add Assign', {role}, supabase.from('task_assignments').insert({ task_id: tid, role, resource_name: 'Unassigned', start_date: today, duration: 5, user_id: session.user.id }).select().single());
                          if (newAssign) {
                            setProjects(prev => prev.map(p => {
                                if (p.id !== pid) return p;
                                return {
                                    ...p,
                                    modules: p.modules.map(m => {
                                        if (m.id !== mid) return m;
                                        return {
                                            ...m,
                                            tasks: m.tasks.map(t => {
                                                if (t.id !== tid) return t;
                                                return {
                                                    ...t,
                                                    assignments: [...t.assignments, {
                                                        id: newAssign.id,
                                                        role: newAssign.role,
                                                        resourceName: newAssign.resource_name,
                                                        startDate: newAssign.start_date,
                                                        duration: newAssign.duration,
                                                        progress: 0,
                                                        allocations: []
                                                    }]
                                                };
                                            })
                                        };
                                    })
                                };
                            }));
                          }
                        } else {
                          // Offline mode: add directly to state
                          setProjects(prev => prev.map(p => {
                              if (p.id !== pid) return p;
                              return {
                                  ...p,
                                  modules: p.modules.map(m => {
                                      if (m.id !== mid) return m;
                                      return {
                                          ...m,
                                          tasks: m.tasks.map(t => {
                                              if (t.id !== tid) return t;
                                              return {
                                                  ...t,
                                                  assignments: [...t.assignments, {
                                                      id: newAssignId,
                                                      role: role,
                                                      resourceName: 'Unassigned',
                                                      startDate: today,
                                                      duration: 5,
                                                      progress: 0,
                                                      allocations: []
                                                  }]
                                              };
                                          })
                                      };
                                  })
                              };
                          }));
                        }
                    }}
                    onCopyAssignment={async (pid, mid, tid, aid) => {
                        if (isOfflineMode) {
                          // Offline: copy locally
                          setProjects(prev => prev.map(p => {
                              if (p.id !== pid) return p;
                              return {
                                  ...p,
                                  modules: p.modules.map(m => {
                                      if (m.id !== mid) return m;
                                      return {
                                          ...m,
                                          tasks: m.tasks.map(t => {
                                              if (t.id !== tid) return t;
                                              const orig = t.assignments.find(a => a.id === aid);
                                              if (!orig) return t;
                                              return {
                                                  ...t,
                                                  assignments: [...t.assignments, {
                                                      ...orig,
                                                      id: createSafeId(),
                                                      allocations: orig.allocations.map(al => ({...al}))
                                                  }]
                                              };
                                          })
                                      };
                                  })
                              };
                          }));
                          return;
                        }
                        const { data: org } = await supabase.from('task_assignments').select('*').eq('id', aid).single();
                        if(org) {
                          const { data: newA } = await runMutation(
                            'Copy Assignment',
                            { source_assignment_id: aid, task_id: tid },
                            supabase.from('task_assignments').insert({ task_id: tid, role: org.role, resource_name: org.resource_name, start_date: org.start_date, duration: org.duration, user_id: session.user.id }).select().single()
                          );
                          const { data: allocs } = await supabase.from('resource_allocations').select('*').eq('assignment_id', aid);
                          if (allocs && newA) {
                            await runMutation(
                              'Copy Assignment Allocations',
                              { source_assignment_id: aid, target_assignment_id: newA.id },
                              supabase.from('resource_allocations').insert(allocs.map(a => ({ assignment_id: newA.id, week_id: a.week_id, count: a.count, days: a.days || {}, user_id: session.user.id })))
                            );
                          }
                          await fetchData(true);
                        }
                    }}
                    onReorderModules={async (pid, sIdx, tIdx) => {
                        if (sIdx === tIdx) return;
                          const previousProjects = projects;
                          const project = projects.find(x => x.id === pid);
                          if (!project) return;
                          const reorderedModules = reorderList(project.modules, sIdx, tIdx).map((module, index) => ({ ...module, sort_order: index }));
                          setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: reorderedModules }));
                          if (reorderedModules.length > 0) {
                            const updates = reorderedModules.map((module, index) => supabase.from('modules').update({ sort_order: index }).eq('id', module.id));
                            const result = await callSupabase('Reorder Modules', null, Promise.all(updates).then(()=>({data:'ok', error:null})));
                            if (result?.error) {
                              setProjects(previousProjects);
                            }
                        }
                    }}
                    onReorderTasks={async (pid, mid, sIdx, tIdx) => {
                        if (sIdx === tIdx) return;
                          const previousProjects = projects;
                          const project = projects.find(x => x.id === pid);
                          const module = project?.modules.find(x => x.id === mid);
                          if (!module) return;
                          const reorderedTasks = reorderList(module.tasks, sIdx, tIdx).map((task, index) => ({ ...task, sort_order: index }));
                          setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                              ...p,
                              modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: reorderedTasks })
                            };
                          }));
                          if (reorderedTasks.length > 0) {
                            const updates = reorderedTasks.map((task, index) => supabase.from('tasks').update({ sort_order: index }).eq('id', task.id));
                            const result = await callSupabase('Reorder Tasks', null, Promise.all(updates).then(()=>({data:'ok', error:null})));
                            if (result?.error) {
                              setProjects(previousProjects);
                            }
                        }
                    }}
                    onMoveTask={async (pid, sMid, tMid, sIdx, tIdx) => {
                          const previousProjects = projects;
                          const project = projects.find(x => x.id === pid);
                          const sourceModule = project?.modules.find(x => x.id === sMid);
                          if (!project || !sourceModule) return;
                          const taskToMove = sourceModule.tasks[sIdx];
                          if (!taskToMove) return;
                          setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                              ...p,
                              modules: p.modules.map(m => {
                                if (m.id === sMid) {
                                  return { ...m, tasks: m.tasks.filter((_, index) => index !== sIdx) };
                                }
                                if (m.id === tMid) {
                                  const newTasks = [...m.tasks];
                                  newTasks.splice(tIdx, 0, taskToMove);
                                  return { ...m, tasks: newTasks };
                                }
                                return m;
                              })
                            };
                          }));
                          if (!isOfflineMode) {
                              const result = await callSupabase('Move Task', null, supabase.from('tasks').update({ module_id: tMid }).eq('id', taskToMove.id));
                              if (result?.error) {
                               setProjects(previousProjects);
                               return;
                              }
                              fetchData(true);
                          }
                    }}
                    onUpdateModuleType={(pid, mid, type) => genericUpdate('modules', mid, { type })}
                    onReorderAssignments={async (pid, mid, tid, sIdx, tIdx) => {
                        if (sIdx === tIdx) return;
                          const previousProjects = projects;
                          const project = projects.find(p => p.id === pid);
                          const module = project?.modules.find(m => m.id === mid);
                          const task = module?.tasks.find(t => t.id === tid);
                          if (!task) return;
                          const reorderedAssignments = reorderList(task.assignments, sIdx, tIdx).map((assignment, index) => ({ ...assignment, sort_order: index }));
                          setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                              ...p,
                              modules: p.modules.map(m => {
                                if (m.id !== mid) return m;
                                return {
                                  ...m,
                                  tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: reorderedAssignments })
                                };
                              })
                            };
                          }));
                          if (reorderedAssignments.length > 0) {
                            const updates = reorderedAssignments.map((assignment, index) => 
                              supabase.from('task_assignments').update({ sort_order: index }).eq('id', assignment.id)
                            );
                          const result = await runMutation('Reorder Assignments', { task_id: tid }, Promise.all(updates).then(() => ({ data: 'ok', error: null })));
                          if (result?.error) {
                            setProjects(previousProjects);
                          }
                        }
                    }}
                                        onShiftTask={async (pid, mid, tid, dir) => {
                                            const previousProjects = projects;
                                            const project = projects.find(p => p.id === pid);
                                            const module = project?.modules.find(m => m.id === mid);
                                            const task = module?.tasks.find(t => t.id === tid);
                                            if (!task) return;

                                            const shiftByWorkingDays = (dateText: string, deltaWorkingDays: number, holidayMap: Map<string, number>) => {
                                              const pointer = new Date(dateText.replace(/-/g, '/'));
                                              let remaining = Math.abs(deltaWorkingDays);
                                              const step = deltaWorkingDays >= 0 ? 1 : -1;

                                              while (remaining > 0) {
                                                pointer.setDate(pointer.getDate() + step);
                                                const day = pointer.getDay();
                                                const dayKey = pointer.toISOString().split('T')[0];
                                                const holidayDuration = holidayMap.get(dayKey) || 0;
                                                const isWorkingDay = day !== 0 && day !== 6 && holidayDuration < 1;
                                                if (isWorkingDay) {
                                                  remaining -= 1;
                                                }
                                              }

                                              return pointer.toISOString().split('T')[0];
                                            };

                                            const shiftedAssignments = task.assignments.map(assignment => (
                                              assignment.startDate
                                                ? {
                                                    ...assignment,
                                                    startDate: dir === 'left' || dir === 'right'
                                                      ? shiftDateTextByDays(assignment.startDate, dir === 'left' ? -7 : 7)
                                                      : shiftByWorkingDays(assignment.startDate, dir === 'left-working' ? -5 : 5, getAssignmentHolidayMap(assignment.resourceName))
                                                  }
                                                : assignment
                                            ));

                                            setProjects(prev => prev.map(p => {
                                              if (p.id !== pid) return p;
                                              return {
                                                ...p,
                                                modules: p.modules.map(m => {
                                                  if (m.id !== mid) return m;
                                                  return {
                                                    ...m,
                                                    tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: shiftedAssignments })
                                                  };
                                                })
                                              };
                                            }));

                                            if (isOfflineMode) return;

                                            const updates = shiftedAssignments
                                              .filter((assignment): assignment is typeof assignment & { startDate: string } => Boolean(assignment.startDate))
                                              .map(assignment => supabase.from('task_assignments').update({ start_date: assignment.startDate }).eq('id', assignment.id));

                                            if (updates.length > 0) {
                                              const result = await runMutation(
                                                'Shift Task Timeline',
                                                { task_id: tid, direction: dir },
                                                Promise.all(updates).then(() => ({ data: 'ok', error: null }))
                                              );
                                              if (result?.error) {
                                                setProjects(previousProjects);
                                              }
                                            }
                                        }}
                    onUpdateAssignmentSchedule={async (aid, start, dur) => {
                        const previousProjects = projects;
                        const conflicts = findScheduleConflicts(aid, start, dur);
                        if (conflicts.length > 0) {
                          const names = conflicts.slice(0, 3).map((assignment) => assignment.resourceName || 'Unassigned').join(', ');
                          const confirmProceed = window.confirm(`Schedule overlaps with ${conflicts.length} assignment(s) for the same resource (${names}). Continue anyway?`);
                          if (!confirmProceed) return;
                        }

                        setProjects(prev => prev.map(p => ({
                            ...p,
                            modules: p.modules.map(m => ({
                                ...m,
                                tasks: m.tasks.map(t => ({
                                    ...t,
                                    assignments: t.assignments.map(a => a.id === aid ? { ...a, startDate: start, duration: dur } : a)
                                }))
                            }))
                        })));
                        const result = await callSupabase('Update Schedule', {start_date: start, duration: dur}, supabase.from('task_assignments').update({ start_date: start, duration: dur }).eq('id', aid));
                        if (result?.error) {
                          setProjects(previousProjects);
                        }
                    }}
                      onUpdateAssignmentProgress={async (aid, val) => {
                        const previousProjects = projects;
                        setProjects(prev => prev.map(p => ({
                          ...p,
                          modules: p.modules.map(m => ({
                            ...m,
                            tasks: m.tasks.map(t => ({
                              ...t,
                              assignments: t.assignments.map(a => a.id === aid ? { ...a, progress: val } : a)
                            }))
                          }))
                        })));
                        const result = await runMutation(
                          'Update Assignment Progress',
                          { assignment_id: aid, progress: val },
                          supabase.from('task_assignments').update({ progress: val }).eq('id', aid)
                        );
                        if (result?.error) {
                          setProjects(previousProjects);
                        }
                      }}
                    onAddProject={async () => {
                        if (isOfflineMode) {
                          const newId = createSafeId();
                          setProjects(prev => [...prev, { id: newId, name: 'New Project', modules: [], user_id: session.user.id, currentUserRole: 'owner', ownerEmail: session.user.email }]);
                          return;
                        }
                        await genericInsert('projects', { name: 'New Project', user_id: session.user.id }, true);
                    }}
                    onAddModule={async (pid) => {
                        if (isOfflineMode) {
                          const newId = createSafeId();
                          setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: [...p.modules, { id: newId, name: 'New Module', type: 'STANDARD' as any, legacyFunctionPoints: 0, functionPoints: 0, tasks: [], sort_order: p.modules.length }] }));
                          return;
                        }
                        await genericInsert('modules', { project_id: pid, name: 'New Module', user_id: session.user.id }, true);
                    }}
                    onUpdateProjectName={async (id, name) => {
                      const previousProjects = projects;
                        setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
                      const result = await callSupabase('Update Project Name', {name}, supabase.from('projects').update({ name }).eq('id', id));
                      if (result?.error) {
                        setProjects(previousProjects);
                      }
                    }}
                    onUpdateModuleName={async (pid, mid, name) => {
                      const previousProjects = projects;
                        setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                                ...p,
                                modules: p.modules.map(m => m.id === mid ? { ...m, name } : m)
                            };
                        }));
                      const result = await callSupabase('Update Module Name', {name}, supabase.from('modules').update({ name }).eq('id', mid));
                      if (result?.error) {
                        setProjects(previousProjects);
                      }
                    }}
                    onUpdateTaskName={async (pid, mid, tid, name) => {
                      const previousProjects = projects;
                        setProjects(prev => prev.map(p => {
                            if (p.id !== pid) return p;
                            return {
                                ...p,
                                modules: p.modules.map(m => {
                                    if (m.id !== mid) return m;
                                    return {
                                        ...m,
                                        tasks: m.tasks.map(t => t.id === tid ? { ...t, name } : t)
                                    };
                                })
                            };
                        }));
                        const result = await callSupabase('Update Task Name', {name}, supabase.from('tasks').update({ name }).eq('id', tid));
                        if (result?.error) {
                          setProjects(previousProjects);
                        }
                    }}
                    onDeleteProject={async (id) => {
                        if (!confirm('Delete?')) return;
                        if (isOfflineMode) { setProjects(prev => prev.filter(p => p.id !== id)); return; }
                      await genericDelete('projects', id);
                    }}
                    onDeleteModule={async (pid, mid) => {
                        if (!confirm('Delete?')) return;
                        if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.filter(m => m.id !== mid) })); return; }
                      await genericDelete('modules', mid);
                    }}
                    onDeleteTask={async (pid, mid, tid) => {
                        if (!confirm('Delete?')) return;
                        if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.filter(t => t.id !== tid) }) })); return; }
                      await genericDelete('tasks', tid);
                    }}
                    onDeleteAssignment={async (pid, mid, tid, aid) => {
                        if (!confirm('Delete?')) return;
                        if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: t.assignments.filter(a => a.id !== aid) }) }) })); return; }
                      await genericDelete('task_assignments', aid);
                    }}
                    onImportPlan={()=>{ alert("Import feature placeholder"); }}
                    onShowHistory={() => setShowHistory(true)}
                    onRefresh={() => fetchData(true)}
                    onUndo={handleUndo}
                    canUndo={canUndo}
                    saveStatus={saveStatus}
                    isRefreshing={isRefreshing}
                    isReadOnly={isReadOnlyMode}
                    onSetActualDate={async (aid, actualDate) => {
                      const normalized = actualDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDate) ? actualDate : null;
                      // Optimistic update in state
                      setProjects(prev => prev.map(p => ({
                        ...p,
                        modules: p.modules.map(m => ({
                          ...m,
                          tasks: m.tasks.map(t => ({
                            ...t,
                            assignments: t.assignments.map(a => a.id === aid ? { ...a, actualDate: normalized ?? undefined } : a)
                          }))
                        }))
                      })));
                      if (!isOfflineMode) {
                        await runMutation(
                          'Set Actual Date',
                          { assignment_id: aid, actual_date: normalized },
                          supabase.from('task_assignments').update({ actual_date: normalized }).eq('id', aid)
                        );
                      }
                    }}
                 />
             )}
             {activeTab === 'estimator' && (
                 <Estimator 
                    projects={projects} 
                    holidays={holidays}
                    smartsheetToken={smartsheetToken}
                    onUpdateModuleEstimates={(pid, mid, ...args) => { /* complex update logic */ fetchData(false); }}
                    onUpdateTaskEstimates={(pid, mid, tid, updates) => { 
                        const dbUpdates: any = {};
                        if (updates.frontendFunctionPoints !== undefined) dbUpdates.frontend_function_points = updates.frontendFunctionPoints;
                        // ... map other fields
                        genericUpdate('tasks', tid, dbUpdates);
                    }}
                    onUpdateModuleComplexity={(pid, mid, type, comp) => {
                         const field = type === 'frontend' ? 'frontend_complexity' : type === 'backend' ? 'backend_complexity' : 'complexity';
                         genericUpdate('modules', mid, { [field]: comp });
                    }}
                    onUpdateModuleStartDate={(pid, mid, date) => genericUpdate('modules', mid, { start_date: date })}
                    onUpdateModuleDeliveryTask={(pid, mid, tid) => genericUpdate('modules', mid, { delivery_task_id: tid })}
                    onUpdateModuleStartTask={(pid, mid, tid) => genericUpdate('modules', mid, { start_task_id: tid })}
                    onReorderModules={()=>{}}
                    onDeleteModule={async (pid, mid) => { if(confirm('Delete?')) { await genericDelete('modules', mid); } }}
                    onBulkImportTasks={async (projectId, rows) => {
                      const targetProject = projects.find(p => p.id === projectId);
                      const targetModuleId = targetProject?.modules?.[0]?.id;
                      if (!targetModuleId) {
                        alert('Please create at least one module in this project before importing from Smartsheet.');
                        return;
                      }

                      for (const row of rows) {
                        const taskId = createSafeId();
                        const today = new Date().toISOString().split('T')[0];
                        
                        // Create task
                        await genericInsert('tasks', {
                          id: taskId,
                          module_id: targetModuleId,
                          name: row.title,
                          user_id: session.user.id
                        }, false);
                        
                        // Create assignment with estimate if provided
                        const assignmentData: any = {
                          task_id: taskId,
                          role: 'EP Dev Team',
                          resource_name: row.assignee || 'Unassigned',
                          start_date: today,
                          duration: row.estimate ? Math.ceil(row.estimate / 8) : 5, // Convert hours to working days
                          user_id: session.user.id
                        };
                        
                        await genericInsert('task_assignments', assignmentData, false);
                      }
                      
                      // Refresh data
                      await fetchData(true);
                    }}
                    isReadOnly={isReadOnlyMode}
                 />
             )}
             {activeTab === 'resources' && (
                 <Resources 
                    resources={resources} 
                    onAddResource={async (name, cat, reg, type, prog) => { await genericInsert('resources', { name, category: cat, holiday_region: reg, type, program: prog, user_id: session.user.id }, true); }}
                    onDeleteResource={async (id) => { if(confirm('Delete?')) { await genericDelete('resources', id); } }}
                    onUpdateResourceCategory={(id, val) => genericUpdate('resources', id, { category: val })}
                    onUpdateResourceRegion={(id, val) => genericUpdate('resources', id, { holiday_region: val })}
                    onUpdateResourceType={(id, val) => genericUpdate('resources', id, { type: val })}
                    onUpdateResourceName={(id, val) => genericUpdate('resources', id, { name: val })}
                    onAddIndividualHoliday={async (rid, items) => { 
                        const payload = items.map(i => ({ resource_id: rid, date: i.date, name: i.name, duration: i.duration, user_id: session.user.id }));
                      await genericInsert('individual_holidays', payload, true);
                    }}
                    onDeleteIndividualHoliday={async (id) => { await genericDelete('individual_holidays', id); }}
                    isReadOnly={isReadOnlyMode}
                 />
             )}
             {activeTab === 'holidays' && (
                 <AdminSettings 
                    holidays={holidays}
                    onAddHolidays={async (items) => { 
                        const payload = items.map(i => ({ ...i, user_id: session.user.id }));
                      await genericInsert('holidays', payload, true);
                    }}
                    onDeleteHoliday={async (id) => { await genericDelete('holidays', id); }}
                    onDeleteHolidaysByCountry={async (c) => { await genericDeleteWhere('holidays', 'country', c); }}
                    onUpdateHolidayDuration={async (id, d) => genericUpdate('holidays', id, { duration: d }, true)}
                    isReadOnly={isReadOnlyMode}
                 />
             )}
             {activeTab === 'settings' && (
               <Settings 
                    isDebugLogEnabled={isDebugLogEnabled}
                    setIsDebugLogEnabled={setIsDebugLogEnabled}
                    isAIEnabled={isAIEnabled}
                    setIsAIEnabled={setIsAIEnabled}
                    smartsheetToken={smartsheetToken}
                    onSmartsheetTokenChange={(token) => {
                      setSmartsheetToken(token);
                      localStorage.setItem('oms_smartsheet_token', token);
                    }}
                    onOpenDatabaseFix={() => {}}
                 />
             )}
               </React.Suspense>
         </div>
         
         {/* AI Assistant Panel - Right Sidebar */}
         {isAIEnabled && (
           <aside className={`${isAIPanelVisible ? 'w-80 bg-white border-l border-slate-200 flex flex-col flex-shrink-0 overflow-hidden' : 'hidden'}`}>
             <React.Suspense fallback={<div className="p-3 text-xs text-slate-500">Loading AI panel...</div>}>
                 <AIAssistant
                   projects={projects}
                   resources={resources}
                   githubToken={githubToken}
                   githubUser={githubUser}
                   githubLoginStatus={githubLoginStatus}
                   githubDeviceCode={githubDeviceCode}
                   githubLoginMessage={githubLoginMessage}
                   isGitHubCheckNowLoading={isGithubCheckNowLoading}
                   githubClientId={githubClientId}
                   onGitHubClientIdChange={setGithubClientId}
                   onGitHubLogin={startGithubDeviceFlow}
                   onGitHubCheckNow={checkGithubAuthorizationNow}
                   onGitHubLogout={handleGithubLogout}
                   onAddProject={async () => {
                     if (isOfflineMode) {
                       const newId = createSafeId();
                       setProjects(prev => [...prev, { id: newId, name: 'New Project', modules: [], user_id: session.user.id, currentUserRole: 'owner', ownerEmail: session.user.email }]);
                       return;
                     }
                     await genericInsert('projects', { name: 'New Project', user_id: session.user.id }, true);
                   }}
                   onAddModule={async (pid) => {
                     if (isOfflineMode) {
                       const newId = createSafeId();
                       setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: [...p.modules, { id: newId, name: 'New Module', type: 'STANDARD' as any, legacyFunctionPoints: 0, functionPoints: 0, tasks: [], sort_order: p.modules.length }] }));
                       return;
                     }
                     await genericInsert('modules', { project_id: pid, name: 'New Module', user_id: session.user.id }, true);
                   }}
                   onAddTask={async (pid, mid, tid, name, role) => {
                     const newAssignId = createSafeId();
                     const today = new Date().toISOString().split('T')[0];
                     if (!isOfflineMode) {
                       await callSupabase('New Task', {name}, supabase.from('tasks').insert({ id: tid, module_id: mid, name, user_id: session.user.id }));
                       const { data: newAssign } = await callSupabase('New Assign', {role}, supabase.from('task_assignments').insert({ task_id: tid, role, resource_name: 'Unassigned', start_date: today, duration: 5, user_id: session.user.id }).select().single());
                       if (newAssign) {
                         setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: [...m.tasks, { id: tid, name, assignments: [{ id: newAssign.id, role: newAssign.role, resourceName: newAssign.resource_name, startDate: newAssign.start_date, duration: newAssign.duration, progress: 0, allocations: [] }] }] }) }));
                       }
                     } else {
                       setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: [...m.tasks, { id: tid, name, assignments: [{ id: newAssignId, role, resourceName: 'Unassigned', startDate: today, duration: 5, progress: 0, allocations: [] }] }] }) }));
                     }
                   }}
                   onAddAssignment={async (pid, mid, tid, role) => {
                     const newAssignId = createSafeId();
                     const today = new Date().toISOString().split('T')[0];
                     if (!isOfflineMode) {
                       const { data: newAssign } = await callSupabase('New Assign', {role}, supabase.from('task_assignments').insert({ task_id: tid, role, resource_name: 'Unassigned', start_date: today, duration: 5, user_id: session.user.id }).select().single());
                       if (newAssign) {
                         setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: [...t.assignments, { id: newAssign.id, role: newAssign.role, resourceName: newAssign.resource_name, startDate: newAssign.start_date, duration: newAssign.duration, progress: 0, allocations: [] }] }) }) }));
                       }
                     } else {
                       setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: [...t.assignments, { id: newAssignId, role, resourceName: 'Unassigned', startDate: today, duration: 5, progress: 0, allocations: [] }] }) }) }));
                     }
                   }}
                   onUpdateProjectName={async (id, name) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
                     const result = await callSupabase('Update Project Name', {name}, supabase.from('projects').update({ name }).eq('id', id));
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateModuleName={async (pid, mid, name) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id === mid ? { ...m, name } : m) }));
                     const result = await callSupabase('Update Module Name', {name}, supabase.from('modules').update({ name }).eq('id', mid));
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateTaskName={async (pid, mid, tid, name) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id === tid ? { ...t, name } : t) }) }));
                     const result = await callSupabase('Update Task Name', {name}, supabase.from('tasks').update({ name }).eq('id', tid));
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateAssignmentResourceName={async (pid, mid, tid, aid, name) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: t.assignments.map(a => a.id !== aid ? a : { ...a, resourceName: name }) }) }) }));
                     const result = await callSupabase('Update Resource', {resource_name: name}, supabase.from('task_assignments').update({ resource_name: name }).eq('id', aid));
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateAssignmentSchedule={async (aid, start, dur) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => ({ ...p, modules: p.modules.map(m => ({ ...m, tasks: m.tasks.map(t => ({ ...t, assignments: t.assignments.map(a => a.id === aid ? { ...a, startDate: start, duration: dur } : a) })) })) })));
                     const result = await callSupabase('Update Schedule', {start_date: start, duration: dur}, supabase.from('task_assignments').update({ start_date: start, duration: dur }).eq('id', aid));
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateAssignmentProgress={async (aid, val) => {
                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => ({ ...p, modules: p.modules.map(m => ({ ...m, tasks: m.tasks.map(t => ({ ...t, assignments: t.assignments.map(a => a.id === aid ? { ...a, progress: val } : a) })) })) })));
                     const result = await runMutation(
                       'Update Assignment Progress (AI Panel)',
                       { assignment_id: aid, progress: val },
                       supabase.from('task_assignments').update({ progress: val }).eq('id', aid)
                     );
                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onUpdateAssignmentActualDate={async (aid, actualDate) => {
                     const normalized = actualDate && /^\d{4}-\d{2}-\d{2}$/.test(actualDate) ? actualDate : null;
                     // Optimistic update in state
                     setProjects(prev => prev.map(p => ({
                       ...p,
                       modules: p.modules.map(m => ({
                         ...m,
                         tasks: m.tasks.map(t => ({
                           ...t,
                           assignments: t.assignments.map(a => a.id === aid ? { ...a, actualDate: normalized ?? undefined } : a)
                         }))
                       }))
                     })));
                     if (!isOfflineMode) {
                       await runMutation(
                         'Set Actual Date (AI Panel)',
                         { assignment_id: aid, actual_date: normalized },
                         supabase.from('task_assignments').update({ actual_date: normalized }).eq('id', aid)
                       );
                     }
                     try {
                       const raw = localStorage.getItem('oms_assignment_actual_dates_v1');
                       const parsed = raw ? JSON.parse(raw) as Record<string, string> : {};
                       if (normalized) {
                         parsed[aid] = normalized;
                       } else {
                         delete parsed[aid];
                       }
                       localStorage.setItem('oms_assignment_actual_dates_v1', JSON.stringify(parsed));
                     } catch {
                       // Ignore storage failures and still notify listeners.
                     }

                     if (typeof window !== 'undefined') {
                       window.dispatchEvent(new CustomEvent('oms-actual-date-updated', {
                         detail: { assignmentId: aid, actualDate: normalized }
                       }));
                     }
                   }}
                   onUpdateAllocationByAssignment={async (aid, wid, val, dayDate) => {
                     const locate = () => {
                       for (const p of projects) {
                         for (const m of p.modules) {
                           for (const t of m.tasks) {
                             if (t.assignments.some(a => a.id === aid)) {
                               return { pid: p.id, mid: m.id, tid: t.id };
                             }
                           }
                         }
                       }
                       return null;
                     };

                     const loc = locate();
                     if (!loc) return;

                     const previousProjects = projects;
                     setProjects(prev => prev.map(p => {
                       if (p.id !== loc.pid) return p;
                       return {
                         ...p,
                         modules: p.modules.map(m => {
                           if (m.id !== loc.mid) return m;
                           return {
                             ...m,
                             tasks: m.tasks.map(t => {
                               if (t.id !== loc.tid) return t;
                               return {
                                 ...t,
                                 assignments: t.assignments.map(a => {
                                   if (a.id !== aid) return a;
                                   const existingAlloc = a.allocations.find(al => al.weekId === wid);
                                   let nextAlloc: any;
                                   if (dayDate) {
                                     const days = { ...(existingAlloc?.days || {}), [dayDate]: val };
                                     const total = Object.values(days).reduce((sum, v) => sum + Number(v || 0), 0);
                                     nextAlloc = { weekId: wid, count: total, days };
                                   } else {
                                     nextAlloc = { weekId: wid, count: val, days: existingAlloc?.days };
                                   }
                                   const nextAllocs = existingAlloc
                                     ? a.allocations.map(al => al.weekId === wid ? nextAlloc : al)
                                     : [...a.allocations, nextAlloc];
                                   return { ...a, allocations: nextAllocs };
                                 })
                               };
                             })
                           };
                         })
                       };
                     }));

                     if (isOfflineMode) return;

                     let payload: any = { count: val };
                     if (dayDate) {
                       const alloc = previousProjects
                         .find(p => p.id === loc.pid)?.modules.find(m => m.id === loc.mid)?.tasks
                         .find(t => t.id === loc.tid)?.assignments.find(a => a.id === aid)?.allocations
                         .find(a => a.weekId === wid);
                       const days = { ...(alloc?.days || {}), [dayDate]: val };
                       payload = { count: Object.values(days).reduce((a: number, b: any) => a + Number(b || 0), 0), days };
                     }

                     const result = await runMutation(
                       'Update Allocation (AI Panel)',
                       { assignment_id: aid, week_id: wid, ...payload },
                       supabase.from('resource_allocations').upsert({ assignment_id: aid, week_id: wid, user_id: session.user.id, ...payload }, { onConflict: 'assignment_id, week_id' })
                     );
                     if (result?.error) setProjects(previousProjects);
                   }}
                   onCopyAssignmentById={async (aid) => {
                     const locate = () => {
                       for (const p of projects) {
                         for (const m of p.modules) {
                           for (const t of m.tasks) {
                             if (t.assignments.some(a => a.id === aid)) {
                               return { pid: p.id, mid: m.id, tid: t.id };
                             }
                           }
                         }
                       }
                       return null;
                     };
                     const loc = locate();
                     if (!loc) return;

                     if (isOfflineMode) {
                       setProjects(prev => prev.map(p => p.id !== loc.pid ? p : {
                         ...p,
                         modules: p.modules.map(m => m.id !== loc.mid ? m : {
                           ...m,
                           tasks: m.tasks.map(t => t.id !== loc.tid ? t : {
                             ...t,
                             assignments: (() => {
                               const orig = t.assignments.find(a => a.id === aid);
                               if (!orig) return t.assignments;
                               return [...t.assignments, { ...orig, id: createSafeId(), allocations: orig.allocations.map(al => ({ ...al })) }];
                             })()
                           })
                         })
                       }));
                       return;
                     }

                     const { data: org } = await supabase.from('task_assignments').select('*').eq('id', aid).single();
                     if (!org) return;

                     const { data: newA } = await runMutation(
                       'Copy Assignment (AI Panel)',
                       { source_assignment_id: aid, task_id: loc.tid },
                       supabase.from('task_assignments').insert({ task_id: loc.tid, role: org.role, resource_name: org.resource_name, start_date: org.start_date, duration: org.duration, user_id: session.user.id }).select().single()
                     );
                     const { data: allocs } = await supabase.from('resource_allocations').select('*').eq('assignment_id', aid);
                     if (allocs && newA) {
                       await runMutation(
                         'Copy Assignment Allocations (AI Panel)',
                         { source_assignment_id: aid, target_assignment_id: newA.id },
                         supabase.from('resource_allocations').insert(allocs.map(a => ({ assignment_id: newA.id, week_id: a.week_id, count: a.count, days: a.days || {}, user_id: session.user.id })))
                       );
                     }
                     await fetchData(true);
                   }}
                   onReorderModules={async (pid, sIdx, tIdx) => {
                     if (sIdx === tIdx) return;
                     const previousProjects = projects;
                     const project = projects.find(x => x.id === pid);
                     if (!project) return;
                     const reorderedModules = reorderList(project.modules, sIdx, tIdx).map((module, index) => ({ ...module, sort_order: index }));
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: reorderedModules }));
                     if (!isOfflineMode && reorderedModules.length > 0) {
                       const updates = reorderedModules.map((module, index) => supabase.from('modules').update({ sort_order: index }).eq('id', module.id));
                       const result = await runMutation('Reorder Modules (AI Panel)', { project_id: pid }, Promise.all(updates).then(() => ({ data: 'ok', error: null })));
                       if (result?.error) setProjects(previousProjects);
                     }
                   }}
                   onReorderTasks={async (pid, mid, sIdx, tIdx) => {
                     if (sIdx === tIdx) return;
                     const previousProjects = projects;
                     const project = projects.find(x => x.id === pid);
                     const module = project?.modules.find(x => x.id === mid);
                     if (!module) return;
                     const reorderedTasks = reorderList(module.tasks, sIdx, tIdx).map((task, index) => ({ ...task, sort_order: index }));
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: reorderedTasks }) }));
                     if (!isOfflineMode && reorderedTasks.length > 0) {
                       const updates = reorderedTasks.map((task, index) => supabase.from('tasks').update({ sort_order: index }).eq('id', task.id));
                       const result = await runMutation('Reorder Tasks (AI Panel)', { module_id: mid }, Promise.all(updates).then(() => ({ data: 'ok', error: null })));
                       if (result?.error) setProjects(previousProjects);
                     }
                   }}
                   onMoveTask={async (pid, sMid, tMid, sIdx, tIdx) => {
                     const previousProjects = projects;
                     const project = projects.find(x => x.id === pid);
                     const sourceModule = project?.modules.find(x => x.id === sMid);
                     if (!project || !sourceModule) return;
                     const taskToMove = sourceModule.tasks[sIdx];
                     if (!taskToMove) return;

                     setProjects(prev => prev.map(p => {
                       if (p.id !== pid) return p;
                       return {
                         ...p,
                         modules: p.modules.map(m => {
                           if (m.id === sMid) return { ...m, tasks: m.tasks.filter((_, index) => index !== sIdx) };
                           if (m.id === tMid) {
                             const newTasks = [...m.tasks];
                             newTasks.splice(tIdx, 0, taskToMove);
                             return { ...m, tasks: newTasks };
                           }
                           return m;
                         })
                       };
                     }));

                     if (!isOfflineMode) {
                       const result = await runMutation('Move Task (AI Panel)', { task_id: taskToMove.id, target_module_id: tMid }, supabase.from('tasks').update({ module_id: tMid }).eq('id', taskToMove.id));
                       if (result?.error) {
                         setProjects(previousProjects);
                         return;
                       }
                       await fetchData(true);
                     }
                   }}
                   onUpdateModuleType={async (_pid, mid, type) => {
                     await genericUpdate('modules', mid, { type });
                   }}
                   onReorderAssignments={async (pid, mid, tid, sIdx, tIdx) => {
                     if (sIdx === tIdx) return;
                     const previousProjects = projects;
                     const project = projects.find(p => p.id === pid);
                     const module = project?.modules.find(m => m.id === mid);
                     const task = module?.tasks.find(t => t.id === tid);
                     if (!task) return;
                     const reorderedAssignments = reorderList(task.assignments, sIdx, tIdx).map((assignment, index) => ({ ...assignment, sort_order: index }));
                     setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: reorderedAssignments }) }) }));
                     if (!isOfflineMode && reorderedAssignments.length > 0) {
                       const updates = reorderedAssignments.map((assignment, index) => supabase.from('task_assignments').update({ sort_order: index }).eq('id', assignment.id));
                       const result = await runMutation('Reorder Assignments (AI Panel)', { task_id: tid }, Promise.all(updates).then(() => ({ data: 'ok', error: null })));
                       if (result?.error) setProjects(previousProjects);
                     }
                   }}
                   onShiftTask={async (pid, mid, tid, dir) => {
                     const previousProjects = projects;
                     const project = projects.find(p => p.id === pid);
                     const module = project?.modules.find(m => m.id === mid);
                     const task = module?.tasks.find(t => t.id === tid);
                     if (!task) return;

                     const shiftByWorkingDays = (dateText: string, deltaWorkingDays: number, holidayMap: Map<string, number>) => {
                       const pointer = new Date(dateText.replace(/-/g, '/'));
                       let remaining = Math.abs(deltaWorkingDays);
                       const step = deltaWorkingDays >= 0 ? 1 : -1;
                       while (remaining > 0) {
                         pointer.setDate(pointer.getDate() + step);
                         const day = pointer.getDay();
                         const dayKey = pointer.toISOString().split('T')[0];
                         const holidayDuration = holidayMap.get(dayKey) || 0;
                         const isWorkingDay = day !== 0 && day !== 6 && holidayDuration < 1;
                         if (isWorkingDay) remaining -= 1;
                       }
                       return pointer.toISOString().split('T')[0];
                     };

                     const shiftedAssignments = task.assignments.map(assignment => (
                       assignment.startDate
                         ? {
                             ...assignment,
                             startDate: dir === 'left' || dir === 'right'
                               ? shiftDateTextByDays(assignment.startDate, dir === 'left' ? -7 : 7)
                               : shiftByWorkingDays(assignment.startDate, dir === 'left-working' ? -5 : 5, getAssignmentHolidayMap(assignment.resourceName))
                           }
                         : assignment
                     ));

                     setProjects(prev => prev.map(p => p.id !== pid ? p : {
                       ...p,
                       modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: shiftedAssignments }) })
                     }));

                     if (isOfflineMode) return;
                     const updates = shiftedAssignments
                       .filter((assignment): assignment is typeof assignment & { startDate: string } => Boolean(assignment.startDate))
                       .map(assignment => supabase.from('task_assignments').update({ start_date: assignment.startDate }).eq('id', assignment.id));

                     if (updates.length > 0) {
                       const result = await runMutation('Shift Task Timeline (AI Panel)', { task_id: tid, direction: dir }, Promise.all(updates).then(() => ({ data: 'ok', error: null })));
                       if (result?.error) setProjects(previousProjects);
                     }
                   }}
                      onUpdateAssignmentDependency={async (aid, pid) => {
                            const previousProjects = projects;
                        if (pid === aid) {
                          alert('An assignment cannot depend on itself.');
                          return;
                        }
                        if (pid && !findAssignmentInProjects(pid)) {
                          alert('The selected parent assignment was not found.');
                          return;
                        }
                        if (pid && hasDependencyCycle(aid, pid)) {
                          alert('This dependency creates a circular reference.');
                          return;
                        }

                     let nextStartDate: string | undefined;
                     if (pid) {
                       const parentAssignment = findAssignmentInProjects(pid);
                       const childAssignment = findAssignmentInProjects(aid);
                       if (parentAssignment?.startDate && parentAssignment.duration) {
                         const parentHolidayMap = getAssignmentHolidayMap(parentAssignment.resourceName);
                         const parentEndDate = calculateEndDate(parentAssignment.startDate, parentAssignment.duration, parentHolidayMap);
                         const childHolidayMap = getAssignmentHolidayMap(childAssignment?.resourceName);
                         nextStartDate = findNextWorkingDay(parentEndDate, childHolidayMap);
                       }
                     }
                     setProjects(prev => prev.map(p => ({ ...p, modules: p.modules.map(m => ({ ...m, tasks: m.tasks.map(t => ({ ...t, assignments: t.assignments.map(a => a.id === aid ? { ...a, parentAssignmentId: pid || undefined, ...(nextStartDate ? { startDate: nextStartDate } : {}) } : a) })) })) })));
                     const payload: Record<string, any> = { parent_assignment_id: pid };
                     if (nextStartDate) payload.start_date = nextStartDate;
                     const result = await runMutation(
                       'Update Assignment Dependency (AI Panel)',
                       { assignment_id: aid, ...payload },
                       supabase.from('task_assignments').update(payload).eq('id', aid)
                     );

                     if (result?.error) {
                       setProjects(previousProjects);
                     }
                   }}
                   onDeleteProject={async (id) => {
                     if (isOfflineMode) { setProjects(prev => prev.filter(p => p.id !== id)); return; }
                     await genericDelete('projects', id);
                   }}
                   onDeleteModule={async (pid, mid) => {
                     if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.filter(m => m.id !== mid) })); return; }
                     await genericDelete('modules', mid);
                   }}
                   onDeleteTask={async (pid, mid, tid) => {
                     if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.filter(t => t.id !== tid) }) })); return; }
                     await genericDelete('tasks', tid);
                   }}
                   onDeleteAssignment={async (pid, mid, tid, aid) => {
                     if (isOfflineMode) { setProjects(prev => prev.map(p => p.id !== pid ? p : { ...p, modules: p.modules.map(m => m.id !== mid ? m : { ...m, tasks: m.tasks.map(t => t.id !== tid ? t : { ...t, assignments: t.assignments.filter(a => a.id !== aid) }) }) })); return; }
                     await genericDelete('task_assignments', aid);
                   }}
                   onCollapseAllResourceRows={() => setCollapseResourceRowsSignal(prev => prev + 1)}
                 />
               </React.Suspense>
             </aside>
         )}
         </div>
      </main>

      {isDebugLogEnabled && (
        <React.Suspense fallback={null}>
          <DebugLog entries={logEntries} setEntries={setLogEntries} />
        </React.Suspense>
      )}
      
      {showHistory && (
        <React.Suspense fallback={<div className="fixed inset-0 bg-black/10 z-40" />}>
          <VersionHistory onClose={() => setShowHistory(false)} onRestore={()=>{}} onSaveCurrent={async (n) => { await genericInsert('versions', { name: n, data: { projects, resources, holidays } }); }} />
        </React.Suspense>
      )}
      {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} projectId={selectedProjectId} session={session} ownerEmail={currentProject?.ownerEmail} />}
    </div>
  );
};