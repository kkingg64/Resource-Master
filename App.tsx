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

const structureProjectsData = (projects: any[], modules: any[], tasks: any[], assignments: any[], allocations: any[], currentUserId: string, members: any[] = [], currentUserEmail: string = ''): Project[] => {
  const allocationsByAssignment = new Map<string, any[]>();
  allocations.forEach(a => {
    if (!allocationsByAssignment.has(a.assignment_id)) allocationsByAssignment.set(a.assignment_id, []);
    allocationsByAssignment.get(a.assignment_id)!.push({ weekId: a.week_id, count: a.count, days: a.days || {} });
  });
  const assignmentsByTask = new Map<string, any[]>();
  assignments.forEach(a => {
    if (!assignmentsByTask.has(a.task_id)) assignmentsByTask.set(a.task_id, []);
    assignmentsByTask.get(a.task_id)!.push({ id: a.id, role: a.role, resourceName: a.resource_name, startDate: a.start_date, duration: a.duration, progress: a.progress || 0, parentAssignmentId: a.parent_assignment_id, sort_order: a.sort_order, allocations: allocationsByAssignment.get(a.id) || [] });
  });
  const tasksByModule = new Map<string, any[]>();
  tasks.forEach(t => {
    if (!tasksByModule.has(t.module_id)) tasksByModule.set(t.module_id, []);
    tasksByModule.get(t.module_id)!.push({ id: t.id, name: t.name, startDate: t.start_date, sort_order: t.sort_order, frontendFunctionPoints: t.frontend_function_points || 0, backendFunctionPoints: t.backend_function_points || 0, assignments: (assignmentsByTask.get(t.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) });
  });
  const modulesByProject = new Map<string, any[]>();
  modules.forEach(m => {
    if (!modulesByProject.has(m.project_id)) modulesByProject.set(m.project_id, []);
    modulesByProject.get(m.project_id)!.push({ id: m.id, name: m.name, type: m.type || ModuleType.Development, functionPoints: m.function_points, legacyFunctionPoints: m.legacy_function_points, sort_order: m.sort_order, tasks: (tasksByModule.get(m.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) });
  });
  return projects.map(p => {
    let role: ProjectRole = p.user_id === currentUserId ? 'owner' : (members.find(m => m.project_id === p.id && m.user_email === currentUserEmail)?.role || 'viewer');
    return { id: p.id, name: p.name, modules: (modulesByProject.get(p.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)), currentUserRole: role, user_id: p.user_id };
  }).sort((a,b) => a.name.localeCompare(b.name));
};

const App: React.FC = () => {
  const [session, setSession] = useState<any | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'estimator' | 'settings' | 'resources' | 'holidays'>('planner');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => authListener?.subscription?.unsubscribe();
  }, []);

  useEffect(() => { if (session) fetchData(); }, [session]);

  const fetchData = async () => {
    if (!session) return;
    setLoading(true);
    try {
        const { data: ownedProjects } = await supabase.from('projects').select('*').eq('user_id', session.user.id);
        const { data: memberData } = await supabase.from('project_members').select('*, projects(*)').eq('user_email', session.user.email);
        const sharedProjects = memberData?.map((m: any) => m.projects).filter(Boolean) || [];
        const uniqueProjects = Array.from(new Map([...(ownedProjects || []), ...sharedProjects].map(p => [p.id, p])).values());

        if (uniqueProjects.length > 0) {
            if (!selectedProjectId || !uniqueProjects.find(p => p.id === selectedProjectId)) setSelectedProjectId(uniqueProjects[0].id);
            const { data: modD } = await supabase.from('modules').select('*').in('project_id', uniqueProjects.map(p => p.id));
            const { data: taskD } = await supabase.from('tasks').select('*').in('module_id', modD?.map(m => m.id) || []);
            const { data: assignD } = await supabase.from('task_assignments').select('*').in('task_id', taskD?.map(t => t.id) || []);
            const { data: allocD } = await supabase.from('resource_allocations').select('*').in('assignment_id', assignD?.map(a => a.id) || []);
            const { data: resD } = await supabase.from('resources').select('*, individual_holidays(*)').in('user_id', uniqueProjects.map(p => p.user_id));
            const { data: holD } = await supabase.from('holidays').select('*').in('user_id', uniqueProjects.map(p => p.user_id));

            setResources(resD || []);
            setHolidays(holD || []);
            setProjects(structureProjectsData(uniqueProjects, modD || [], taskD || [], assignD || [], allocD || [], session.user.id, memberData || [], session.user.email));
        }
    } catch (e) { console.error("Fetch error", e); }
    setLoading(false);
  };

  const handleUpdateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => {
    setSaveStatus('saving');
    const { error } = await supabase.from('resource_allocations').upsert({ assignment_id: assignmentId, week_id: weekId, count, days: dayDate ? { [dayDate]: count } : {}, user_id: session.user.id });
    setSaveStatus(error ? 'error' : 'success');
    if (!error) fetchData();
  };

  const currentProject = projects.find(p => p.id === selectedProjectId);
  const isReadOnlyMode = currentProject?.currentUserRole === 'viewer';

  if (!session) return (
    <div className="flex h-screen items-center justify-center bg-slate-100">
      <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-md w-full">
        <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Master</h1>
        <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={['google']} />
      </div>
    </div>
  );

  if (loading) return <div className="flex h-screen items-center justify-center text-slate-400">Loading plan...</div>;

  return (
    <div className="flex h-screen w-full bg-slate-100 overflow-hidden font-sans">
       <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 shadow-xl z-50">
          <div className="p-4 flex items-center gap-3 border-b border-slate-800 h-16">
            <div className="w-8 h-8 rounded bg-indigo-600 flex items-center justify-center text-white font-bold">RM</div>
            <span className="font-bold text-white tracking-tight">Resource Master</span>
          </div>
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-2 rounded-lg ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard size={20} /> Dashboard</button>
            <button onClick={() => setActiveTab('planner')} className={`w-full flex items-center gap-3 p-2 rounded-lg ${activeTab === 'planner' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Calendar size={20} /> Planner</button>
            <button onClick={() => setActiveTab('estimator')} className={`w-full flex items-center gap-3 p-2 rounded-lg ${activeTab === 'estimator' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Calculator size={20} /> Estimator</button>
            <div className="h-px bg-slate-800 my-2 mx-2" />
            <button onClick={() => setActiveTab('resources')} className={`w-full flex items-center gap-3 p-2 rounded-lg ${activeTab === 'resources' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Users size={20} /> Resources</button>
            <button onClick={() => setActiveTab('holidays')} className={`w-full flex items-center gap-3 p-2 rounded-lg ${activeTab === 'holidays' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}><Globe size={20} /> Holidays</button>
          </nav>
          <div className="p-2 border-t border-slate-800">
             <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-red-900/30 text-slate-400"><LogOut size={18} /> Sign Out</button>
          </div>
       </aside>
       <main className="flex-1 flex flex-col h-full bg-white relative overflow-auto custom-scrollbar">
          {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
          {activeTab === 'planner' && <PlannerGrid projects={projects} holidays={holidays} resources={resources} timelineStart={DEFAULT_START} timelineEnd={DEFAULT_END} onExtendTimeline={() => {}} onUpdateAllocation={handleUpdateAllocation} onUpdateAssignmentResourceName={() => {}} onUpdateAssignmentDependency={() => {}} onAddTask={() => {}} onAddAssignment={() => {}} onCopyAssignment={() => {}} onReorderModules={() => {}} onReorderTasks={() => {}} onMoveTask={() => {}} onUpdateModuleType={() => {}} onReorderAssignments={() => {}} onShiftTask={() => {}} onUpdateAssignmentSchedule={() => {}} onAddProject={() => {}} onAddModule={() => {}} onUpdateProjectName={() => {}} onUpdateModuleName={() => {}} onUpdateTaskName={() => {}} onDeleteProject={() => {}} onDeleteModule={() => {}} onDeleteTask={() => {}} onDeleteAssignment={() => {}} onImportPlan={() => {}} onShowHistory={() => {}} onRefresh={fetchData} saveStatus={saveStatus} isRefreshing={false} isReadOnly={isReadOnlyMode} />}
          {activeTab === 'estimator' && <Estimator projects={projects} holidays={holidays} onUpdateModuleEstimates={() => {}} onUpdateTaskEstimates={() => {}} onUpdateModuleComplexity={() => {}} onUpdateModuleStartDate={() => {}} onUpdateModuleDeliveryTask={() => {}} onUpdateModuleStartTask={() => {}} onReorderModules={() => {}} onDeleteModule={() => {}} isReadOnly={isReadOnlyMode} />}
       </main>
    </div>
  );
};
export default App;