import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { Session } from '@supabase/supabase-js';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { Project, Holiday, Resource, LogEntry, Role, ModuleType } from './types';
import { Dashboard } from './components/Dashboard';
import { PlannerGrid } from './components/PlannerGrid';
import { Estimator } from './components/Estimator';
import { Resources } from './components/Resources';
import { AdminSettings } from './components/AdminSettings';
import { Settings } from './components/Settings';
import { DebugLog } from './components/DebugLog';
import { AIAssistant } from './components/AIAssistant';
import { VersionHistory } from './components/VersionHistory';
import { DEFAULT_START, DEFAULT_END, addWeeksToPoint } from './constants';
import { Layout, Calendar, BarChart3, Calculator, Users, Settings as SettingsIcon, Shield, LogOut } from 'lucide-react';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [activeTab, setActiveTab] = useState('planner');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isDebugLogEnabled, setIsDebugLogEnabled] = useState(false);
  const [isAIEnabled, setIsAIEnabled] = useState(false);
  const [timelineStart, setTimelineStart] = useState(DEFAULT_START);
  const [timelineEnd, setTimelineEnd] = useState(DEFAULT_END);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDatabaseFix, setShowDatabaseFix] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchData = useCallback(async () => {
    if (!session) return;
    setIsRefreshing(true);
    try {
        const { data: pData } = await supabase.from('projects').select('*');
        if (pData) setProjects(pData as any);
        
        const { data: rData } = await supabase.from('resources').select('*');
        if (rData) setResources(rData);

        const { data: hData } = await supabase.from('holidays').select('*');
        if (hData) setHolidays(hData);
    } catch (e) {
        console.error("Error fetching data", e);
        addLog('Error fetching data', e, 'error');
    }
    setIsRefreshing(false);
  }, [session]);

  useEffect(() => {
    if (session) {
        fetchData();
    }
  }, [session, fetchData]);

  const addLog = (message: string, payload?: any, status: 'pending' | 'success' | 'error' = 'pending') => {
      if (!isDebugLogEnabled) return;
      setLogs(prev => [{ id: Date.now(), timestamp: new Date().toISOString(), message, payload, status }, ...prev]);
  };

  const handleExtendTimeline = (direction: 'start' | 'end') => {
    if (direction === 'start') setTimelineStart(prev => addWeeksToPoint(prev, -4));
    else setTimelineEnd(prev => addWeeksToPoint(prev, 4));
  };
  
  // Handlers
  const onUpdateAllocation = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => {
    addLog('Update Allocation', { projectId, moduleId, taskId, assignmentId, weekId, value, dayDate }, 'success');
  };
  const onUpdateAssignmentResourceName = async (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => {
    addLog('Update Resource Name', { projectId, moduleId, taskId, assignmentId, name }, 'success');
  };
  const onUpdateAssignmentDependency = async (assignmentId: string, parentAssignmentId: string | null) => {
    addLog('Update Dependency', { assignmentId, parentAssignmentId }, 'success');
  };
  const onAddTask = async (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => {
    addLog('Add Task', { projectId, moduleId, taskId, taskName, role }, 'success');
  };
  const onAddAssignment = async (projectId: string, moduleId: string, taskId: string, role: Role) => {
    addLog('Add Assignment', { projectId, moduleId, taskId, role }, 'success');
  };
  const onCopyAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => {
    addLog('Copy Assignment', { projectId, moduleId, taskId, assignmentId }, 'success');
  };
  const onReorderModules = async (projectId: string, startIndex: number, endIndex: number) => {
    addLog('Reorder Modules', { projectId, startIndex, endIndex }, 'success');
  };
  const onReorderTasks = async (projectId: string, moduleId: string, startIndex: number, endIndex: number) => {
    addLog('Reorder Tasks', { projectId, moduleId, startIndex, endIndex }, 'success');
  };
  const onMoveTask = async (projectId: string, sourceModuleId: string, targetModuleId: string, sourceIndex: number, targetIndex: number) => {
    addLog('Move Task', { projectId, sourceModuleId, targetModuleId, sourceIndex, targetIndex }, 'success');
  };
  const onUpdateModuleType = async (projectId: string, moduleId: string, type: ModuleType) => {
    addLog('Update Module Type', { projectId, moduleId, type }, 'success');
  };
  const onReorderAssignments = async (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => {
    addLog('Reorder Assignments', { projectId, moduleId, taskId, startIndex, endIndex }, 'success');
  };
  const onShiftTask = async (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => {
    addLog('Shift Task', { projectId, moduleId, taskId, direction }, 'success');
  };
  const onUpdateAssignmentSchedule = async (assignmentId: string, startDate: string, duration: number) => {
    addLog('Update Schedule', { assignmentId, startDate, duration }, 'success');
  };
  const onAddProject = async () => addLog('Add Project', null, 'success');
  const onAddModule = async (projectId: string) => addLog('Add Module', { projectId }, 'success');
  const onUpdateProjectName = async (projectId: string, name: string) => addLog('Update Project Name', { projectId, name }, 'success');
  const onUpdateModuleName = async (projectId: string, moduleId: string, name: string) => addLog('Update Module Name', { projectId, moduleId, name }, 'success');
  const onUpdateTaskName = async (projectId: string, moduleId: string, taskId: string, name: string) => addLog('Update Task Name', { projectId, moduleId, taskId, name }, 'success');
  const onDeleteProject = async (projectId: string) => addLog('Delete Project', { projectId }, 'success');
  const onDeleteModule = async (projectId: string, moduleId: string) => addLog('Delete Module', { projectId, moduleId }, 'success');
  const onDeleteTask = async (projectId: string, moduleId: string, taskId: string) => addLog('Delete Task', { projectId, moduleId, taskId }, 'success');
  const onDeleteAssignment = async (projectId: string, moduleId: string, taskId: string, assignmentId: string) => addLog('Delete Assignment', { projectId, moduleId, taskId, assignmentId }, 'success');

  const onImportPlan = async (importedProjects: Project[], importedHolidays: Holiday[]) => {
      console.log('Import requested', importedProjects);
      alert('Import functionality is partially implemented. Please use the Database Repair Tool in Settings if you encounter data issues.');
  };
  
  const onShowHistory = () => setShowVersionHistory(true);
  const onRefresh = () => fetchData();

  // Resource handlers
  const onAddResource = async (name: string, category: Role, region: string, type: 'Internal' | 'External') => addLog('Add Resource', { name, category, region, type }, 'success');
  const onDeleteResource = async (id: string) => addLog('Delete Resource', { id }, 'success');
  const onUpdateResourceCategory = async (id: string, category: Role) => addLog('Update Resource Category', { id, category }, 'success');
  const onUpdateResourceRegion = async (id: string, region: string | null) => addLog('Update Resource Region', { id, region }, 'success');
  const onUpdateResourceType = async (id: string, type: 'Internal' | 'External') => addLog('Update Resource Type', { id, type }, 'success');
  const onUpdateResourceName = async (id: string, name: string) => addLog('Update Resource Name', { id, name }, 'success');
  const onAddIndividualHoliday = async (resourceId: string, items: any[]) => addLog('Add Individual Holiday', { resourceId, items }, 'success');
  const onDeleteIndividualHoliday = async (holidayId: string) => addLog('Delete Individual Holiday', { holidayId }, 'success');
  
  // Estimator handlers
  const onUpdateModuleEstimates = async () => addLog('Update Module Estimates', null, 'success');
  const onUpdateTaskEstimates = async () => addLog('Update Task Estimates', null, 'success');
  const onUpdateModuleComplexity = async () => addLog('Update Module Complexity', null, 'success');
  const onUpdateModuleStartDate = async () => addLog('Update Module Start Date', null, 'success');
  const onUpdateModuleDeliveryTask = async () => addLog('Update Module Delivery Task', null, 'success');
  const onUpdateModuleStartTask = async () => addLog('Update Module Start Task', null, 'success');

  // Admin handlers
  const onAddHolidays = async () => addLog('Add Holidays', null, 'success');
  const onDeleteHoliday = async () => addLog('Delete Holiday', null, 'success');
  const onDeleteHolidaysByCountry = async () => addLog('Delete Holidays By Country', null, 'success');
  const onUpdateHolidayDuration = async () => addLog('Update Holiday Duration', null, 'success');

  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-full max-w-md p-8 bg-white rounded-xl shadow-lg border border-slate-200">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 text-center">Resource Master</h1>
            <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa }} providers={[]} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
        <aside className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-6 z-50 shadow-xl">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-900/50 mb-4">
                <Layout className="text-white w-6 h-6" />
            </div>
            
            <nav className="flex flex-col gap-4 w-full px-2">
                <button onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <BarChart3 size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Dashboard</span>
                </button>
                <button onClick={() => setActiveTab('planner')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'planner' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <Calendar size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Planner</span>
                </button>
                <button onClick={() => setActiveTab('estimator')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'estimator' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <Calculator size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Estimator</span>
                </button>
                <button onClick={() => setActiveTab('resources')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'resources' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <Users size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Resources</span>
                </button>
                 <button onClick={() => setActiveTab('admin')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'admin' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <Shield size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Admin</span>
                </button>
            </nav>

            <div className="mt-auto flex flex-col gap-4 px-2 mb-4">
                 <button onClick={() => setActiveTab('settings')} className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === 'settings' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                    <SettingsIcon size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Settings</span>
                </button>
                 <button onClick={() => supabase.auth.signOut()} className="p-3 rounded-xl text-slate-400 hover:bg-red-900/30 hover:text-red-400 transition-all duration-200 group relative">
                    <LogOut size={20} />
                    <span className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 border border-slate-700">Sign Out</span>
                </button>
            </div>
        </aside>

        <main className="flex-1 overflow-hidden flex flex-col relative">
            <div className="flex-1 overflow-auto p-2">
                {activeTab === 'dashboard' && <Dashboard projects={projects} resources={resources} holidays={holidays} />}
                {activeTab === 'planner' && (
                    <PlannerGrid 
                        projects={projects} 
                        holidays={holidays}
                        resources={resources}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        onExtendTimeline={handleExtendTimeline}
                        onUpdateAllocation={onUpdateAllocation}
                        onUpdateAssignmentResourceName={onUpdateAssignmentResourceName}
                        onUpdateAssignmentDependency={onUpdateAssignmentDependency}
                        onAddTask={onAddTask}
                        onAddAssignment={onAddAssignment}
                        onCopyAssignment={onCopyAssignment}
                        onReorderModules={onReorderModules}
                        onReorderTasks={onReorderTasks}
                        onMoveTask={onMoveTask}
                        onUpdateModuleType={onUpdateModuleType}
                        onReorderAssignments={onReorderAssignments}
                        onShiftTask={onShiftTask}
                        onUpdateAssignmentSchedule={onUpdateAssignmentSchedule}
                        onAddProject={onAddProject}
                        onAddModule={onAddModule}
                        onUpdateProjectName={onUpdateProjectName}
                        onUpdateModuleName={onUpdateModuleName}
                        onUpdateTaskName={onUpdateTaskName}
                        onDeleteProject={onDeleteProject}
                        onDeleteModule={onDeleteModule}
                        onDeleteTask={onDeleteTask}
                        onDeleteAssignment={onDeleteAssignment}
                        onImportPlan={onImportPlan}
                        onShowHistory={onShowHistory}
                        onRefresh={onRefresh}
                        saveStatus={saveStatus}
                        isRefreshing={isRefreshing}
                    />
                )}
                {activeTab === 'estimator' && (
                    <Estimator 
                        projects={projects}
                        holidays={holidays}
                        onUpdateModuleEstimates={onUpdateModuleEstimates}
                        onUpdateTaskEstimates={onUpdateTaskEstimates}
                        onUpdateModuleComplexity={onUpdateModuleComplexity}
                        onUpdateModuleStartDate={onUpdateModuleStartDate}
                        onUpdateModuleDeliveryTask={onUpdateModuleDeliveryTask}
                        onUpdateModuleStartTask={onUpdateModuleStartTask}
                        onReorderModules={onReorderModules}
                        onDeleteModule={onDeleteModule}
                    />
                )}
                {activeTab === 'resources' && (
                    <Resources 
                        resources={resources}
                        onAddResource={onAddResource}
                        onDeleteResource={onDeleteResource}
                        onUpdateResourceCategory={onUpdateResourceCategory}
                        onUpdateResourceRegion={onUpdateResourceRegion}
                        onUpdateResourceType={onUpdateResourceType}
                        onUpdateResourceName={onUpdateResourceName}
                        onAddIndividualHoliday={onAddIndividualHoliday}
                        onDeleteIndividualHoliday={onDeleteIndividualHoliday}
                    />
                )}
                {activeTab === 'admin' && (
                    <AdminSettings 
                        holidays={holidays}
                        onAddHolidays={onAddHolidays}
                        onDeleteHoliday={onDeleteHoliday}
                        onDeleteHolidaysByCountry={onDeleteHolidaysByCountry}
                        onUpdateHolidayDuration={onUpdateHolidayDuration}
                    />
                )}
                 {activeTab === 'settings' && (
                    <Settings 
                        isDebugLogEnabled={isDebugLogEnabled}
                        setIsDebugLogEnabled={setIsDebugLogEnabled}
                        isAIEnabled={isAIEnabled}
                        setIsAIEnabled={setIsAIEnabled}
                        onOpenDatabaseFix={() => setShowDatabaseFix(true)}
                    />
                )}
            </div>
        </main>

        {isAIEnabled && (
            <AIAssistant 
                projects={projects} 
                resources={resources}
                onAddTask={onAddTask}
                onAssignResource={onUpdateAssignmentResourceName}
            />
        )}
        
        {isDebugLogEnabled && <DebugLog entries={logs} setEntries={setLogs} />}
        {showVersionHistory && <VersionHistory onClose={() => setShowVersionHistory(false)} onRestore={() => {}} onSaveCurrent={async () => {}} />}

        {showDatabaseFix && (
         <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center animate-in fade-in">
            <div className="bg-white p-6 rounded-lg max-w-md shadow-xl border border-slate-200">
                <h3 className="text-lg font-bold mb-4 text-slate-800">Database Repair Tool</h3>
                <p className="text-sm text-slate-600 mb-4">This tool would reset database policies in a real deployment to fix recursion issues.</p>
                <div className="flex justify-end gap-2">
                    <button onClick={() => setShowDatabaseFix(false)} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium">Close</button>
                    <button onClick={() => setShowDatabaseFix(false)} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-medium">Run Fix</button>
                </div>
            </div>
         </div>
       )}
    </div>
  );
}