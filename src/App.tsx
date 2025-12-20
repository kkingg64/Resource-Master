import React, { useState, useEffect, useCallback } from 'react';
import { Database, Check, Users, X, UserPlus, Share2, LayoutDashboard, Calendar as CalendarIcon, Calculator, Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { supabase } from './lib/supabaseClient';
import { Project, Resource, Holiday, Role, ProjectRole, LogEntry, ProjectMember, ModuleType } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Resources } from './components/Resources';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { AIAssistant } from './components/AIAssistant';
import { DebugLog } from './components/DebugLog';
import { VersionHistory } from './components/VersionHistory';
import { DEFAULT_START, DEFAULT_END } from './constants';

// Fix DB Screen Component
const FixRecursionScreen: React.FC<{ onRetry: () => void }> = ({ onRetry }) => {
  const sql = `-- FIX PERMISSIONS & RECURSION
-- This script sets up secure access policies for all tables.

-- 1. Helper: Check if user is a member of a project
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

-- 2. Helper: Check if user owns a project
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

-- 3. Helper: Check if user can access resources of another user
-- (Allowed if you are a member of ANY project owned by that user)
CREATE OR REPLACE FUNCTION can_access_user_data(_target_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- Access own data
  IF _target_user_id = auth.uid() THEN RETURN true; END IF;
  
  -- Access data of project owners we are working with
  RETURN EXISTS (
    SELECT 1 FROM projects p
    JOIN project_members pm ON p.id = pm.project_id
    WHERE p.user_id = _target_user_id
    AND pm.user_email = auth.email()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Enable RLS on all tables (idempotent)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE individual_holidays ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to start fresh
DROP POLICY IF EXISTS "Projects Select Policy" ON projects;
DROP POLICY IF EXISTS "Projects Manage Policy" ON projects;
DROP POLICY IF EXISTS "Members Select Policy" ON project_members;
DROP POLICY IF EXISTS "Members Manage Policy" ON project_members;
DROP POLICY IF EXISTS "Modules Select" ON modules;
DROP POLICY IF EXISTS "Modules Manage" ON modules;
DROP POLICY IF EXISTS "Tasks Select" ON tasks;
DROP POLICY IF EXISTS "Tasks Manage" ON tasks;
DROP POLICY IF EXISTS "Assignments Select" ON task_assignments;
DROP POLICY IF EXISTS "Assignments Manage" ON task_assignments;
DROP POLICY IF EXISTS "Allocations Select" ON resource_allocations;
DROP POLICY IF EXISTS "Allocations Manage" ON resource_allocations;
DROP POLICY IF EXISTS "Resources Select" ON resources;
DROP POLICY IF EXISTS "Resources Manage" ON resources;
DROP POLICY IF EXISTS "Holidays Select" ON holidays;
DROP POLICY IF EXISTS "Holidays Manage" ON holidays;
DROP POLICY IF EXISTS "Indiv Holidays Select" ON individual_holidays;
DROP POLICY IF EXISTS "Indiv Holidays Manage" ON individual_holidays;

-- 6. Define Policies

-- PROJECTS
CREATE POLICY "Projects Select Policy" ON projects FOR SELECT USING (
  user_id = auth.uid() OR is_project_member(id)
);
CREATE POLICY "Projects Manage Policy" ON projects FOR ALL USING (user_id = auth.uid());

-- MEMBERS
CREATE POLICY "Members Select Policy" ON project_members FOR SELECT USING (
  user_email = auth.email() OR is_project_owner(project_id)
);
CREATE POLICY "Members Manage Policy" ON project_members FOR ALL USING (
  is_project_owner(project_id)
);

-- HIERARCHICAL DATA (Modules, Tasks, etc.)
-- We rely on the fact that if you can see the project, you can see its children.
-- But for simplicity and performance in RLS, we often check project ownership or membership directly if project_id is available.
-- For deep nested items, we might need joins.

-- MODULES
CREATE POLICY "Modules Select" ON modules FOR SELECT USING (
  EXISTS (SELECT 1 FROM projects WHERE id = modules.project_id AND (user_id = auth.uid() OR is_project_member(id)))
);
CREATE POLICY "Modules Manage" ON modules FOR ALL USING (
  EXISTS (SELECT 1 FROM projects WHERE id = modules.project_id AND (user_id = auth.uid() OR is_project_member(id)))
);

-- TASKS (using module -> project link is expensive, so we trust if you can see the module you can see the task? 
-- No, we must check permissions. A simpler approach for nested data is to check if you are owner or member of the project linked via module)
-- Optimization: Add project_id to tasks/assignments? No, schema is normalized.
-- We will use a subquery chain.
CREATE POLICY "Tasks Select" ON tasks FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM modules m 
    JOIN projects p ON p.id = m.project_id 
    WHERE m.id = tasks.module_id 
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);
CREATE POLICY "Tasks Manage" ON tasks FOR ALL USING (
  EXISTS (
    SELECT 1 FROM modules m 
    JOIN projects p ON p.id = m.project_id 
    WHERE m.id = tasks.module_id 
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);

-- ASSIGNMENTS
CREATE POLICY "Assignments Select" ON task_assignments FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN modules m ON m.id = t.module_id
    JOIN projects p ON p.id = m.project_id
    WHERE t.id = task_assignments.task_id
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);
CREATE POLICY "Assignments Manage" ON task_assignments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM tasks t
    JOIN modules m ON m.id = t.module_id
    JOIN projects p ON p.id = m.project_id
    WHERE t.id = task_assignments.task_id
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);

-- ALLOCATIONS
CREATE POLICY "Allocations Select" ON resource_allocations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN modules m ON m.id = t.module_id
    JOIN projects p ON p.id = m.project_id
    WHERE ta.id = resource_allocations.assignment_id
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);
CREATE POLICY "Allocations Manage" ON resource_allocations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM task_assignments ta
    JOIN tasks t ON t.id = ta.task_id
    JOIN modules m ON m.id = t.module_id
    JOIN projects p ON p.id = m.project_id
    WHERE ta.id = resource_allocations.assignment_id
    AND (p.user_id = auth.uid() OR is_project_member(p.id))
  )
);

-- RESOURCES & HOLIDAYS (User Scoped)
-- Allow access if resource belongs to you OR to a project owner you work with
CREATE POLICY "Resources Select" ON resources FOR SELECT USING (
  can_access_user_data(user_id)
);
CREATE POLICY "Resources Manage" ON resources FOR ALL USING (
  user_id = auth.uid()
);

CREATE POLICY "Holidays Select" ON holidays FOR SELECT USING (
  can_access_user_data(user_id) OR user_id IS NULL
);
CREATE POLICY "Holidays Manage" ON holidays FOR ALL USING (
  user_id = auth.uid()
);

CREATE POLICY "Indiv Holidays Select" ON individual_holidays FOR SELECT USING (
  can_access_user_data(user_id)
);
CREATE POLICY "Indiv Holidays Manage" ON individual_holidays FOR ALL USING (
  user_id = auth.uid()
);`;

  return (
    <div className="fixed inset-0 bg-slate-50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white max-w-3xl w-full rounded-xl shadow-2xl border border-red-200 overflow-hidden animate-in fade-in zoom-in-95">
        <div className="bg-red-50 p-6 border-b border-red-100 flex items-start gap-4">
          <div className="p-3 bg-red-100 rounded-full text-red-600">
            <Database size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-900">Database Policy Update</h2>
            <p className="text-red-700 mt-1">Updates needed for Viewers/Editors to see all data.</p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-slate-600 mb-4 text-sm">
            To ensure all team members can see resources, holidays, and tasks correctly, please update your database policies.
            <br/><br/>
            <strong>Instructions:</strong> Run the following SQL script in your Supabase SQL Editor.
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
          // user_id is typically linked via a trigger or manually if you know the ID, 
          // for simplicity we assume the system maps email to user_id later or uses email for lookup
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
      const { error } = await supabase.from('project_members').update({ role }).eq('id', memberId);
      if (error) alert('Failed to update role');
      else fetchMembers();
  };

  const removeMember = async (memberId: string) => {
      if (!confirm("Remove this member?")) return;
      const { error } = await supabase.from('project_members').delete().eq('id', memberId);
      if (error) alert('Failed to remove member');
      else fetchMembers();
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

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [projects, setProjects] = useState<Project[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [session, setSession] = useState<any>(null);
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [showFixDb, setShowFixDb] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Load Data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
        const { data: projectsData } = await supabase.from('projects').select('*');
        const { data: modulesData } = await supabase.from('modules').select('*');
        const { data: tasksData } = await supabase.from('tasks').select('*');
        const { data: assignmentsData } = await supabase.from('task_assignments').select('*');
        const { data: allocationsData } = await supabase.from('resource_allocations').select('*');
        
        const { data: resData } = await supabase.from('resources').select('*, individual_holidays(*)');
        const { data: holData } = await supabase.from('holidays').select('*');

        if (projectsData) {
            const assembledProjects: Project[] = projectsData.map((p: any) => ({
                ...p,
                modules: modulesData?.filter((m: any) => m.project_id === p.id).map((m: any) => ({
                    ...m,
                    tasks: tasksData?.filter((t: any) => t.module_id === m.id).map((t: any) => ({
                        ...t,
                        assignments: assignmentsData?.filter((a: any) => a.task_id === t.id).map((a: any) => ({
                            ...a,
                            allocations: allocationsData?.filter((al: any) => al.assignment_id === a.id) || []
                        })) || []
                    })) || []
                })) || []
            }));
            setProjects(assembledProjects);
        }
        if (resData) setResources(resData);
        if (holData) setHolidays(holData);

    } catch (e) {
        console.error(e);
    }
  }, [refreshTrigger, session]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  // Placeholder handlers for Props (to satisfy TS)
  const noop = async () => {};
  
  if (!session) {
      return (
        <div className="flex flex-col items-center justify-center h-screen bg-slate-100 gap-4">
            <h1 className="text-2xl font-bold text-slate-800">Resource Master</h1>
            <button onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })} className="px-6 py-3 bg-indigo-600 text-white rounded-lg shadow-lg hover:bg-indigo-700 transition-colors font-semibold">
                Sign In with Google
            </button>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-16 bg-slate-900 flex flex-col items-center py-4 gap-4 z-50">
            <div className="p-2 bg-indigo-600 rounded-lg mb-4">
                <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            
            <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Dashboard">
                <LayoutDashboard size={20} />
            </button>
            <button onClick={() => setActiveTab('planner')} className={`p-3 rounded-xl transition-all ${activeTab === 'planner' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Planner">
                <CalendarIcon size={20} />
            </button>
            <button onClick={() => setActiveTab('estimator')} className={`p-3 rounded-xl transition-all ${activeTab === 'estimator' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Estimator">
                <Calculator size={20} />
            </button>
            <button onClick={() => setActiveTab('resources')} className={`p-3 rounded-xl transition-all ${activeTab === 'resources' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Resources">
                <Users size={20} />
            </button>
             <button onClick={() => setActiveTab('admin')} className={`p-3 rounded-xl transition-all ${activeTab === 'admin' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Admin Settings">
                <ShieldCheck size={20} />
            </button>
            <div className="mt-auto">
                 <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-xl transition-all ${activeTab === 'settings' ? 'bg-white text-indigo-600 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`} title="Settings">
                    <SettingsIcon size={20} />
                </button>
            </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
             {activeTab === 'dashboard' && <div className="p-6 overflow-auto h-full"><Dashboard projects={projects} resources={resources} holidays={holidays} /></div>}
             {activeTab === 'planner' && <div className="p-6 overflow-hidden h-full flex flex-col"><PlannerGrid 
                projects={projects} holidays={holidays} resources={resources}
                timelineStart={DEFAULT_START} timelineEnd={DEFAULT_END}
                onExtendTimeline={noop as any} onUpdateAllocation={noop as any} onUpdateAssignmentResourceName={noop as any}
                onUpdateAssignmentDependency={noop as any} onAddTask={noop as any} onAddAssignment={noop as any}
                onCopyAssignment={noop as any} onReorderModules={noop as any} onReorderTasks={noop as any}
                onMoveTask={noop as any} onUpdateModuleType={noop as any} onReorderAssignments={noop as any}
                onShiftTask={noop as any} onUpdateAssignmentSchedule={noop as any} onUpdateAssignmentProgress={noop as any}
                onAddProject={noop as any} onAddModule={noop as any} onUpdateProjectName={noop as any}
                onUpdateModuleName={noop as any} onUpdateTaskName={noop as any} onDeleteProject={noop as any}
                onDeleteModule={noop as any} onDeleteTask={noop as any} onDeleteAssignment={noop as any}
                onImportPlan={noop as any} onShowHistory={noop as any} onRefresh={() => setRefreshTrigger(p => p + 1)}
                saveStatus="idle" isRefreshing={false}
             /></div>}
             {activeTab === 'estimator' && <div className="p-6 overflow-auto h-full"><Estimator 
                projects={projects} holidays={holidays}
                onUpdateModuleEstimates={noop as any} onUpdateTaskEstimates={noop as any} onUpdateModuleComplexity={noop as any}
                onUpdateModuleStartDate={noop as any} onUpdateModuleDeliveryTask={noop as any} onUpdateModuleStartTask={noop as any}
                onReorderModules={noop as any} onDeleteModule={noop as any}
             /></div>}
             {activeTab === 'resources' && <div className="p-6 overflow-auto h-full"><Resources 
                resources={resources} onAddResource={noop as any} onDeleteResource={noop as any}
                onUpdateResourceCategory={noop as any} onUpdateResourceRegion={noop as any} onUpdateResourceType={noop as any}
                onUpdateResourceName={noop as any} onAddIndividualHoliday={noop as any} onDeleteIndividualHoliday={noop as any}
             /></div>}
             {activeTab === 'admin' && <div className="p-6 overflow-auto h-full"><AdminSettings 
                holidays={holidays} onAddHolidays={noop as any} onDeleteHoliday={noop as any} onDeleteHolidaysByCountry={noop as any}
             /></div>}
             {activeTab === 'settings' && <div className="p-6 overflow-auto h-full"><Settings 
                isDebugLogEnabled={isDebugLogEnabled} setIsDebugLogEnabled={setIsDebugLogEnabled}
                isAIEnabled={isAIEnabled} setIsAIEnabled={setIsAIEnabled} onOpenDatabaseFix={() => setShowFixDb(true)}
             /></div>}
        </div>
        
        {showFixDb && <FixRecursionScreen onRetry={() => setShowFixDb(false)} />}
        {isDebugLogEnabled && <DebugLog entries={debugLogs} setEntries={setDebugLogs} />}
        {isAIEnabled && <AIAssistant projects={projects} resources={resources} onAddTask={noop as any} onAssignResource={noop as any} />}
    </div>
  );
}