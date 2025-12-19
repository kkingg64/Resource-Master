import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DEFAULT_START, DEFAULT_END, addWeeksToPoint, WeekPoint, getWeekIdFromDate, getDateFromWeek, formatDateForInput, calculateEndDate, findNextWorkingDay } from './constants';
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

// Helper to structure data from Supabase
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
      startDate: a.start_date,
      duration: a.duration,
      progress: a.progress || 0,
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

  return projects.map(p => {
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

const shiftWeekIdByAmount = (weekId: string, amount: number): string => {
    if (amount === 0) return weekId;
    const [yearStr, weekStr] = weekId.split('-');
    if (!yearStr || !weekStr) return weekId;
    const point = { year: parseInt(yearStr), week: parseInt(weekStr) };
    if (isNaN(point.year) || isNaN(point.week)) return weekId;
    const newPoint = addWeeksToPoint(point, amount);
    return `${newPoint.year}-${String(newPoint.week).padStart(2, '0')}`;
};

const FixRecursionScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const sql = `-- REPAIR SQL --
CREATE OR REPLACE FUNCTION is_project_member(_project_id uuid) RETURNS boolean AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM project_members WHERE project_id = _project_id AND user_email = auth.email()); END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`;

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-xl shadow-2xl border border-red-200 p-6">
        <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2"><AlertTriangle /> Database Policy Repair</h2>
        <p className="text-sm text-slate-600 mb-4">Please run the repair SQL in your Supabase dashboard.</p>
        <pre className="bg-slate-900 text-slate-300 p-4 rounded text-xs overflow-auto mb-4">{sql}</pre>
        <button onClick={onRetry} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700">Retry Loading</button>
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

  useEffect(() => { fetchMembers(); }, [projectId]);

  const fetchMembers = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('project_members').select('*').eq('project_id', projectId);
      if (!error && data) setMembers(data);
      setIsLoading(false);
  };

  const addMember = async () => {
      if (!newEmail.trim()) return;
      setIsAdding(true);
      const { error } = await supabase.from('project_members').insert({ project_id: projectId, user_email: newEmail.trim(), role: newRole });
      if (error) alert('Failed: ' + error.message); else { setNewEmail(''); fetchMembers(); }
      setIsAdding(false);
  };

  if (!session || !session.user) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Users className="text-indigo-600" /> Manage Access</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X /></button>
        </div>
        <div className="mb-6">
            <label className="text-xs font-bold text-slate-700 mb-2 block uppercase">Invite Teammate</label>
            <div className="flex gap-2">
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@example.com" className="flex-1 border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-indigo-500"/>
                <select value={newRole} onChange={e => setNewRole(e.target.value as ProjectRole)} className="border rounded-lg px-3 py-2 text-sm outline-none">
                    <option value="viewer">Viewer</option>
                    <option value="editor">Editor</option>
                </select>
                <button onClick={addMember} disabled={isAdding || !newEmail} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">Invite</button>
            </div>
        </div>
        <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                <span className="text-sm font-medium">{session.user.email} (You)</span>
                <span className="text-xs text-slate-500">Owner</span>
            </div>
            {members.map(m => (
                <div key={m.id} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium">{m.user_email}</span>
                    <span className="text-xs text-slate-500 capitalize">{m.role}</span>
                </div>
            ))}
        </div>
        <button onClick={onClose} className="w-full mt-6 bg-slate-100 py-2 rounded-lg text-sm font-medium hover:bg-slate-200">Close</button>
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
  const [dbError, setDbError] = useState<any>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const currentRole: ProjectRole = currentProject?.currentUserRole || 'owner';
  const isReadOnlyMode = currentRole === 'viewer';
  const isOwner = currentRole === 'owner';

  const activeProjectResources = useMemo(() => resources.filter(r => currentProject && (r.user_id === currentProject.user_id || !r.user_id)), [resources, currentProject]);
  const activeProjectHolidays = useMemo(() => holidays.filter(h => currentProject && (h.user_id === currentProject.user_id || !h.user_id)), [holidays, currentProject]);

  const [timelineStart, setTimelineStart] = useState<WeekPoint>(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState<WeekPoint>(DEFAULT_END);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => authListener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const fetchData = async (isRefresh: boolean = false) => {
    if (!session) return;
    if (isRefresh) setIsRefreshing(true); else setLoading(true);
    setDbError(null);

    try {
        const { data: ownedProjects } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
        const { data: memberData } = await supabase.from('project_members').select('*, projects(*)').eq('user_email', session.user.email);
        
        let sharedProjects = memberData?.map((m: any) => m.projects).filter(Boolean) || [];
        const uniqueProjects = Array.from(new Map([...(ownedProjects || []), ...sharedProjects].map(p => [p.id, p])).values());

        if (uniqueProjects.length > 0) {
            if (!selectedProjectId || !uniqueProjects.find(p => p.id === selectedProjectId)) {
                setSelectedProjectId(uniqueProjects[0].id);
            }
            const ownerIds = Array.from(new Set(uniqueProjects.map(p => p.user_id)));
            const { data: modD } = await supabase.from('modules').select('*').in('project_id', uniqueProjects.map(p => p.id));
            const { data: taskD } = await supabase.from('tasks').select('*').in('module_id', modD?.map(m => m.id) || []);
            const { data: assignD } = await supabase.from('task_assignments').select('*').in('task_id', taskD?.map(t => t.id) || []);
            const { data: allocD } = await supabase.from('resource_allocations').select('*').in('assignment_id', assignD?.map(a => a.id) || []);
            const { data: resD } = await supabase.from('resources').select('*, individual_holidays(*)').in('user_id', ownerIds);
            const { data: holD } = await supabase.from('holidays').select('*').in('user_id', ownerIds);

            setResources(resD || []);
            setHolidays(holD || []);
            setProjects(structureProjectsData(uniqueProjects, modD || [], taskD || [], assignD || [], allocD || [], session.user.id, memberData || [], session.user.email));
        }
    } catch (e) { setDbError(e); }
    if (isRefresh) setIsRefreshing(false); else setLoading(false);
  };

  const callSupabase = async (msg: string, payload: any, promise: PromiseLike<any>) => {
    if (isReadOnlyMode) return { data: null, error: 'Read Only' };
    setSaveStatus('saving');
    const result = await promise;
    setSaveStatus(result.error ? 'error' : 'success');
    setTimeout(() => setSaveStatus('idle'), 2000);
    return result;
  };

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Master</h1>
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google']} />
        </div>
      </div>
    );
  }

  if (dbError) return <FixRecursionScreen onRetry={() => fetchData()} />;
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">Loading plan...</div>;

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
       <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 border-r border-slate-800 shadow-xl z-50`}>
          <div className="p-4 flex items-center gap-3 border-b border-slate-800 h-16">
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold">RM</div>
            {!isSidebarCollapsed && <span className="font-bold text-white tracking-tight">Resource Master</span>}
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><LayoutDashboard size={20} /> {!isSidebarCollapsed && <span>Dashboard</span>}</button>
            <button onClick={() => setActiveTab('planner')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Calendar size={20} /> {!isSidebarCollapsed && <span>Planner</span>}</button>
            <button onClick={() => setActiveTab('estimator')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Calculator size={20} /> {!isSidebarCollapsed && <span>Estimator</span>}</button>
            <div className="h-px bg-slate-800 my-2 mx-2"></div>
            <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Users size={20} /> {!isSidebarCollapsed && <span>Resources</span>}</button>
            <button onClick={() => setActiveTab('holidays')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'holidays' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><Globe size={20} /> {!isSidebarCollapsed && <span>Holidays</span>}</button>
            {isOwner && <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-slate-800 hover:text-white'}`}><SettingsIcon size={20} /> {!isSidebarCollapsed && <span>Settings</span>}</button>}
          </nav>
          <div className="p-2 border-t border-slate-800">
             <button onClick={() => setShowShareModal(true)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-slate-400"><Share2 size={18} /> {!isSidebarCollapsed && <span className="text-sm">Share</span>}</button>
             <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 text-slate-400">{isSidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />} {!isSidebarCollapsed && <span className="text-sm">Collapse</span>}</button>
             <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/30 text-slate-400"><LogOut size={18} /> {!isSidebarCollapsed && <span className="text-sm">Sign Out</span>}</button>
          </div>
       </aside>

       <main className="flex-1 flex flex-col h-full bg-white relative">
          <div className="flex-1 h-full p-4 overflow-auto custom-scrollbar">
            {activeTab === 'dashboard' && <Dashboard projects={projects} resources={activeProjectResources} holidays={activeProjectHolidays} />}
            {activeTab === 'planner' && <PlannerGrid projects={projects} holidays={activeProjectHolidays} resources={activeProjectResources} timelineStart={timelineStart} timelineEnd={timelineEnd} onExtendTimeline={dir => setTimelineStart(prev => addWeeksToPoint(prev, dir === 'start' ? -4 : 4))} onUpdateAllocation={() => {}} onUpdateAssignmentResourceName={() => {}} onUpdateAssignmentDependency={() => {}} onAddTask={() => {}} onAddAssignment={() => {}} onCopyAssignment={() => {}} onReorderModules={() => {}} onReorderTasks={() => {}} onMoveTask={() => {}} onUpdateModuleType={() => {}} onReorderAssignments={() => {}} onShiftTask={() => {}} onUpdateAssignmentSchedule={() => {}} onAddProject={() => {}} onAddModule={() => {}} onUpdateProjectName={() => {}} onUpdateModuleName={() => {}} onUpdateTaskName={() => {}} onDeleteProject={() => {}} onDeleteModule={() => {}} onDeleteTask={() => {}} onDeleteAssignment={() => {}} onImportPlan={() => {}} onShowHistory={() => setShowHistory(true)} onRefresh={() => fetchData(true)} saveStatus={saveStatus} isRefreshing={isRefreshing} isReadOnly={isReadOnlyMode} />}
            {activeTab === 'estimator' && <Estimator projects={projects} holidays={activeProjectHolidays} onUpdateModuleEstimates={() => {}} onUpdateTaskEstimates={() => {}} onUpdateModuleComplexity={() => {}} onUpdateModuleStartDate={() => {}} onUpdateModuleDeliveryTask={() => {}} onUpdateModuleStartTask={() => {}} onReorderModules={() => {}} onDeleteModule={() => {}} isReadOnly={isReadOnlyMode} />}
            {activeTab === 'resources' && <Resources resources={activeProjectResources} onAddResource={async () => {}} onDeleteResource={async () => {}} onUpdateResourceCategory={async () => {}} onUpdateResourceRegion={async () => {}} onUpdateResourceType={async () => {}} onUpdateResourceName={async () => {}} onAddIndividualHoliday={async () => {}} onDeleteIndividualHoliday={async () => {}} isReadOnly={isReadOnlyMode} />}
            {activeTab === 'settings' && <Settings isDebugLogEnabled={isDebugLogEnabled} setIsDebugLogEnabled={setIsDebugLogEnabled} isAIEnabled={isAIEnabled} setIsAIEnabled={setIsAIEnabled} onOpenDatabaseFix={() => fetchData()} />}
            {activeTab === 'holidays' && <AdminSettings holidays={activeProjectHolidays} onAddHolidays={async () => {}} onDeleteHoliday={async () => {}} onDeleteHolidaysByCountry={async () => {}} isReadOnly={isReadOnlyMode} />}
          </div>
       </main>

       {isAIEnabled && <AIAssistant projects={projects} resources={activeProjectResources} onAddTask={() => {}} onAssignResource={() => {}} />}
       {showShareModal && <ShareModal onClose={() => setShowShareModal(false)} projectId={selectedProjectId} session={session} />}
       {showHistory && <VersionHistory onClose={() => setShowHistory(false)} onRestore={() => {}} onSaveCurrent={async () => {}} />}
    </div>
  );
};

export default App;