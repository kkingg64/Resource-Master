import React, { useState, useMemo, useEffect } from 'react';
import { Project, Holiday, Resource, Role, WeekPoint } from '../types';
import { getTimeline } from '../constants';
import { ChevronRight, ChevronDown, Plus, Trash2, RotateCcw, ZoomIn, ZoomOut, RefreshCw, ArrowRight, ArrowLeft, Copy, Save } from 'lucide-react';

interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  resources: Resource[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => void;
  onUpdateAssignmentDependency: (assignmentId: string, parentAssignmentId: string | null) => void;
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onCopyAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onReorderTasks: (projectId: string, moduleId: string, startIndex: number, endIndex: number) => void;
  onReorderAssignments: (projectId: string, moduleId: string, taskId: string, startIndex: number, endIndex: number) => void;
  onShiftTask: (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => void;
  onUpdateAssignmentSchedule: (assignmentId: string, startDate: string, duration: number) => void;
  onUpdateAssignmentProgress: (assignmentId: string, progress: number) => void;
  onAddProject: () => void;
  onAddModule: (projectId: string) => void;
  onUpdateProjectName: (projectId: string, name: string) => void;
  onUpdateModuleName: (projectId: string, moduleId: string, name: string) => void;
  onUpdateTaskName: (projectId: string, moduleId: string, taskId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteModule: (projectId: string, moduleId: string) => void;
  onDeleteTask: (projectId: string, moduleId: string, taskId: string) => void;
  onDeleteAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onImportPlan: (projects: Project[]) => void;
  onShowHistory: () => void;
  onRefresh: () => void;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  isRefreshing: boolean;
  isReadOnly: boolean;
}

export const PlannerGrid: React.FC<PlannerGridProps> = ({
  projects,
  resources,
  timelineStart,
  timelineEnd,
  onExtendTimeline,
  onUpdateAllocation,
  onUpdateAssignmentResourceName,
  onAddTask,
  onAddAssignment,
  onCopyAssignment,
  onUpdateAssignmentSchedule,
  onUpdateAssignmentProgress,
  onAddProject,
  onAddModule,
  onUpdateProjectName,
  onUpdateModuleName,
  onUpdateTaskName,
  onDeleteProject,
  onDeleteModule,
  onDeleteTask,
  onDeleteAssignment,
  onShowHistory,
  onRefresh,
  saveStatus,
  isRefreshing,
  isReadOnly
}) => {
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [startColWidth] = useState(85);
  const [durationColWidth] = useState(35);
  const [progressColWidth] = useState(35);

  const [colWidthBase, setColWidthBase] = useState(40);
  
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  const timelineData = useMemo(() => getTimeline('week', timelineStart, timelineEnd), [timelineStart, timelineEnd]);

  useEffect(() => {
    const newExpandedProjects: Record<string, boolean> = {};
    const newExpandedModules: Record<string, boolean> = {};
    projects.forEach(p => {
        newExpandedProjects[p.id] = true;
        p.modules.forEach(m => {
            newExpandedModules[m.id] = true;
        });
    });
    setExpandedProjects(prev => ({ ...newExpandedProjects, ...prev }));
    setExpandedModules(prev => ({ ...newExpandedModules, ...prev }));
  }, [projects.length]);

  const toggleProject = (id: string) => setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
           <button onClick={() => onExtendTimeline('start')} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="Extend Start"><ArrowLeft size={16}/></button>
           <button onClick={() => onExtendTimeline('end')} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="Extend End"><ArrowRight size={16}/></button>
           <div className="h-4 w-px bg-slate-300 mx-2"></div>
           <button onClick={() => setColWidthBase(Math.max(20, colWidthBase - 5))} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="Zoom Out"><ZoomOut size={16}/></button>
           <button onClick={() => setColWidthBase(Math.min(100, colWidthBase + 5))} className="p-1 hover:bg-slate-200 rounded text-slate-500" title="Zoom In"><ZoomIn size={16}/></button>
        </div>
        <div className="flex items-center gap-2">
            {!isReadOnly && <button onClick={onAddProject} className="flex items-center gap-1 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded hover:bg-indigo-700 font-medium"><Plus size={14}/> Project</button>}
            <button onClick={onRefresh} className={`p-1.5 hover:bg-slate-200 rounded text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={16}/></button>
            <button onClick={onShowHistory} className="p-1.5 hover:bg-slate-200 rounded text-slate-500"><RotateCcw size={16}/></button>
             {saveStatus === 'saving' && <span className="text-xs text-slate-400 flex items-center gap-1"><span className="animate-pulse">●</span> Saving...</span>}
             {saveStatus === 'success' && <span className="text-xs text-green-600 font-medium"><Save size={14}/></span>}
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden relative flex">
         <div style={{ width: sidebarWidth }} className="flex-shrink-0 border-r border-slate-200 bg-white flex flex-col h-full overflow-hidden">
             <div className="h-10 border-b border-slate-200 bg-slate-50 flex items-center px-2 font-bold text-xs text-slate-600 flex-shrink-0">
                  <div className="flex-1">Structure</div>
                  <div style={{ width: startColWidth }} className="text-center px-1 border-l border-slate-200">Start</div>
                  <div style={{ width: durationColWidth }} className="text-center px-1 border-l border-slate-200">Dur</div>
                  <div style={{ width: progressColWidth }} className="text-center px-1 border-l border-slate-200">%</div>
             </div>
             <div className="flex-1 overflow-y-hidden hover:overflow-y-auto custom-scrollbar">
               {projects.map(project => (
                   <div key={project.id}>
                     <div className="flex items-center h-8 bg-slate-100 border-b border-slate-200 px-2 font-bold text-xs text-slate-700 hover:bg-slate-200 group">
                        <button onClick={() => toggleProject(project.id)} className="mr-1 text-slate-500">
                           {expandedProjects[project.id] ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </button>
                        {!isReadOnly ? <input className="bg-transparent focus:bg-white rounded px-1 flex-1 min-w-0" value={project.name} onChange={(e) => onUpdateProjectName(project.id, e.target.value)} /> : <span className="flex-1 truncate">{project.name}</span>}
                        {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center"><button onClick={() => onAddModule(project.id)} className="p-1 text-indigo-600 hover:bg-indigo-100 rounded"><Plus size={12}/></button><button onClick={() => onDeleteProject(project.id)} className="p-1 text-red-600 hover:bg-red-100 rounded"><Trash2 size={12}/></button></div>}
                     </div>
                     {expandedProjects[project.id] && project.modules.map(module => (
                        <div key={module.id}>
                            <div className="flex items-center h-8 bg-slate-50 border-b border-slate-200 px-2 pl-6 font-semibold text-xs text-slate-600 hover:bg-slate-100 group">
                                <button onClick={() => toggleModule(module.id)} className="mr-1 text-slate-400">
                                   {expandedModules[module.id] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                                </button>
                                {!isReadOnly ? <input className="bg-transparent focus:bg-white rounded px-1 flex-1 min-w-0" value={module.name} onChange={(e) => onUpdateModuleName(project.id, module.id, e.target.value)} /> : <span className="flex-1 truncate">{module.name}</span>}
                                {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1"><button onClick={() => onAddTask(project.id, module.id, crypto.randomUUID(), 'New Task', Role.DEV)} className="p-1 text-slate-500 hover:bg-slate-200 rounded"><Plus size={12}/></button><button onClick={() => onDeleteModule(project.id, module.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={12}/></button></div>}
                            </div>
                            {expandedModules[module.id] && module.tasks.map(task => (
                                <div key={task.id}>
                                    <div className="flex items-center h-8 bg-white border-b border-slate-100 px-2 pl-10 text-xs text-slate-600 group hover:bg-slate-50">
                                        {!isReadOnly ? <input className="bg-transparent focus:bg-white rounded px-1 flex-1 min-w-0" value={task.name} onChange={(e) => onUpdateTaskName(project.id, module.id, task.id, e.target.value)} /> : <span className="flex-1 truncate">{task.name}</span>}
                                        {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Plus size={12}/></button><button onClick={() => onDeleteTask(project.id, module.id, task.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={12}/></button></div>}
                                    </div>
                                    {task.assignments.map(assignment => (
                                        <div key={assignment.id} className="flex items-center h-8 bg-white border-b border-slate-100 px-2 pl-12 text-xs text-slate-500 group hover:bg-slate-50">
                                            <div className="flex-1 min-w-0 flex items-center gap-1 pr-2">
                                                <select className="w-full bg-transparent border-none p-0 text-xs focus:ring-0 cursor-pointer text-indigo-600 font-medium" value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} disabled={isReadOnly}>
                                                    <option value="Unassigned">Unassigned</option>
                                                    {resources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                </select>
                                            </div>
                                            <div style={{ width: startColWidth }} className="px-1 border-l border-slate-100 h-full flex items-center">
                                                <input type="date" className="w-full bg-transparent border-none p-0 text-[10px] text-center focus:ring-0" value={assignment.startDate || ''} onChange={(e) => onUpdateAssignmentSchedule(assignment.id, e.target.value, assignment.duration || 1)} disabled={isReadOnly} />
                                            </div>
                                            <div style={{ width: durationColWidth }} className="px-1 border-l border-slate-100 h-full flex items-center">
                                                <input type="number" min="1" className="w-full bg-transparent border-none p-0 text-[10px] text-center focus:ring-0" value={assignment.duration || 0} onChange={(e) => onUpdateAssignmentSchedule(assignment.id, assignment.startDate || '', parseInt(e.target.value) || 0)} disabled={isReadOnly} />
                                            </div>
                                            <div style={{ width: progressColWidth }} className="px-1 border-l border-slate-100 h-full flex items-center">
                                                <input type="number" min="0" max="100" className="w-full bg-transparent border-none p-0 text-[10px] text-center focus:ring-0 text-slate-400" value={assignment.progress || 0} onChange={(e) => onUpdateAssignmentProgress(assignment.id, parseInt(e.target.value) || 0)} disabled={isReadOnly} />
                                            </div>
                                            {!isReadOnly && <div className="hidden group-hover:flex absolute left-2 bg-white shadow rounded border"><button onClick={() => onCopyAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 hover:bg-slate-100 text-slate-500"><Copy size={12}/></button><button onClick={() => onDeleteAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 hover:bg-slate-100 text-red-500"><Trash2 size={12}/></button></div>}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                     ))}
                   </div>
               ))}
               <div className="h-20"></div>
             </div>
         </div>

         <div className="flex-1 overflow-auto flex flex-col h-full">
            <div className="flex h-10 border-b border-slate-200 bg-slate-50 sticky top-0 z-10 w-max">
               {timelineData.map((col) => (
                   <div key={col.id} style={{ width: colWidthBase, minWidth: colWidthBase }} className="flex-shrink-0 border-r border-slate-200 text-[10px] text-slate-500 flex flex-col items-center justify-center text-center overflow-hidden">
                       <span className="font-bold">{col.monthLabel.split(' ')[0]}</span>
                       <span>{col.label}</span>
                   </div>
               ))}
            </div>
            <div className="w-max">
               {projects.map(project => (
                   <div key={project.id}>
                     <div className="h-8 border-b border-slate-200 bg-slate-100/50"></div>
                     {expandedProjects[project.id] && project.modules.map(module => (
                        <div key={module.id}>
                            <div className="h-8 border-b border-slate-200 bg-slate-50/50"></div>
                            {expandedModules[module.id] && module.tasks.map(task => (
                                <div key={task.id}>
                                    <div className="h-8 border-b border-slate-100"></div>
                                    {task.assignments.map(assignment => (
                                        <div key={assignment.id} className="flex h-8 border-b border-slate-100">
                                            {timelineData.map(col => {
                                                const alloc = assignment.allocations.find(a => a.weekId === col.id);
                                                const val = alloc ? alloc.count : 0;
                                                const isAllocated = val > 0;
                                                return (
                                                    <div key={col.id} style={{ width: colWidthBase, minWidth: colWidthBase }} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center p-0.5 ${isAllocated ? 'bg-indigo-50' : ''}`}>
                                                        <input type="text" className={`w-full h-full text-center text-[10px] bg-transparent border-none p-0 focus:ring-0 ${isAllocated ? 'font-bold text-indigo-700' : 'text-slate-300 focus:text-slate-600'}`} value={val > 0 ? val : ''} placeholder="-" onChange={(e) => { const num = parseFloat(e.target.value); onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.id, isNaN(num) ? 0 : num); }} disabled={isReadOnly} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                     ))}
                   </div>
               ))}
               <div className="h-20"></div>
            </div>
         </div>
      </div>
    </div>
  );
};