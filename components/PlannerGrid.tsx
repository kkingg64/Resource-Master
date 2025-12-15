import React, { useState, useMemo } from 'react';
import { Project, Holiday, Resource, Role, ViewMode } from '../types';
import { ChevronRight, ChevronDown, Plus, Trash2, Copy, RefreshCw, History, ArrowLeft, ArrowRight, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { getTimeline, formatDateForInput, WeekPoint } from '../constants';

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
  onUpdateProjectName,
  onUpdateModuleName,
  onUpdateTaskName,
  onAddProject,
  onAddModule,
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
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [colWidthBase, setColWidthBase] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);

  const toggleProject = (id: string) => setExpandedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setExpandedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTask = (id: string) => setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="flex flex-col h-full border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2">
           <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
              <button 
                onClick={() => setViewMode('day')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'day' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Day
              </button>
              <button 
                onClick={() => setViewMode('week')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'week' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Week
              </button>
              <button 
                onClick={() => setViewMode('month')} 
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'month' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                Month
              </button>
           </div>
           
           <div className="h-6 w-px bg-slate-300 mx-1"></div>
           
           <button onClick={() => onExtendTimeline('start')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500" title="Load Previous Weeks"><ArrowLeft size={14}/></button>
           <button onClick={() => onExtendTimeline('end')} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500" title="Load Next Weeks"><ArrowRight size={14}/></button>
           
           <div className="h-6 w-px bg-slate-300 mx-1"></div>
           <div className="flex items-center gap-2 ml-2">
              <span className="text-[10px] text-slate-400 uppercase font-bold">Width</span>
              <input 
                type="range" 
                min="20" 
                max="100" 
                value={colWidthBase} 
                onChange={(e) => setColWidthBase(Number(e.target.value))}
                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />
           </div>
        </div>

        <div className="flex items-center gap-2">
            {saveStatus === 'saving' && <span className="text-xs text-slate-500 flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Saving...</span>}
            {saveStatus === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Saved</span>}
            {saveStatus === 'error' && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} /> Error</span>}
            
            <button onClick={onRefresh} disabled={isRefreshing} className={`p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} title="Refresh Data"><RefreshCw size={14}/></button>
            <button onClick={onShowHistory} className="p-1.5 hover:bg-white rounded border border-transparent hover:border-slate-200 text-slate-500" title="Version History"><History size={14}/></button>
            
            {!isReadOnly && <button onClick={onAddProject} className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded hover:bg-indigo-700 transition-colors">
                <Plus size={14} /> Project
            </button>}
        </div>
      </div>

      <div className="flex-1 overflow-hidden relative flex">
         {/* Sidebar */}
         <div 
            className="flex-shrink-0 flex flex-col border-r border-slate-200 bg-white z-10" 
            style={{ width: sidebarWidth }}
         >
            <div className="h-10 border-b border-slate-200 flex items-center px-4 bg-slate-50/50">
               <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Project Structure</span>
            </div>
            
            <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                {projects.map(project => (
                    <div key={project.id}>
                        <div className="flex items-center px-2 py-1 hover:bg-slate-50 border-b border-slate-100 group">
                             <button onClick={() => toggleProject(project.id)} className="p-1 text-slate-400 hover:text-indigo-600">
                                {expandedProjects[project.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                             </button>
                             {!isReadOnly ? (
                                 <input 
                                    className="flex-1 text-sm font-bold text-slate-800 bg-transparent focus:bg-white px-1 rounded border border-transparent focus:border-indigo-300 focus:outline-none truncate"
                                    value={project.name}
                                    onChange={(e) => onUpdateProjectName(project.id, e.target.value)}
                                 />
                             ) : (
                                 <span className="flex-1 text-sm font-bold text-slate-800 px-1 truncate">{project.name}</span>
                             )}
                             {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                <button onClick={() => onAddModule(project.id)} className="p-1 text-slate-400 hover:text-indigo-600" title="Add Module"><Plus size={12}/></button>
                                <button onClick={() => onDeleteProject(project.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete Project"><Trash2 size={12}/></button>
                             </div>}
                        </div>
                        
                        {expandedProjects[project.id] && project.modules.map(module => (
                            <div key={module.id} className="pl-4">
                                <div className="flex items-center px-2 py-1 hover:bg-slate-50 border-b border-slate-100 group">
                                     <button onClick={() => toggleModule(module.id)} className="p-1 text-slate-400 hover:text-indigo-600">
                                        {expandedModules[module.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                     </button>
                                     {!isReadOnly ? (
                                         <input 
                                            className="flex-1 text-xs font-semibold text-slate-700 bg-transparent focus:bg-white px-1 rounded border border-transparent focus:border-indigo-300 focus:outline-none truncate"
                                            value={module.name}
                                            onChange={(e) => onUpdateModuleName(project.id, module.id, e.target.value)}
                                         />
                                     ) : (
                                         <span className="flex-1 text-xs font-semibold text-slate-700 px-1 truncate">{module.name}</span>
                                     )}
                                     {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                        <button onClick={() => onAddTask(project.id, module.id, crypto.randomUUID(), 'New Task', Role.DEV)} className="p-1 text-slate-400 hover:text-indigo-600" title="Add Task"><Plus size={12}/></button>
                                        <button onClick={() => onDeleteModule(project.id, module.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete Module"><Trash2 size={12}/></button>
                                     </div>}
                                </div>

                                {expandedModules[module.id] && module.tasks.map(task => (
                                    <div key={task.id} className="pl-4">
                                        <div className="flex items-center px-2 py-1 hover:bg-slate-50 border-b border-slate-100 group">
                                            <button onClick={() => toggleTask(task.id)} className="p-1 text-slate-400 hover:text-indigo-600">
                                                {expandedTasks[task.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                            </button>
                                            {!isReadOnly ? (
                                                <input 
                                                    className="flex-1 text-xs text-slate-600 bg-transparent focus:bg-white px-1 rounded border border-transparent focus:border-indigo-300 focus:outline-none truncate"
                                                    value={task.name}
                                                    onChange={(e) => onUpdateTaskName(project.id, module.id, task.id, e.target.value)}
                                                />
                                            ) : (
                                                <span className="flex-1 text-xs text-slate-600 px-1 truncate">{task.name}</span>
                                            )}
                                            {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                <button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)} className="p-1 text-slate-400 hover:text-indigo-600" title="Add Assignment"><User size={12}/></button>
                                                <button onClick={() => onDeleteTask(project.id, module.id, task.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete Task"><Trash2 size={12}/></button>
                                            </div>}
                                        </div>

                                        {expandedTasks[task.id] && task.assignments.map(assignment => (
                                            <div key={assignment.id} className="pl-6 flex items-center px-2 py-1 hover:bg-indigo-50/30 border-b border-slate-100 group h-[34px]">
                                                <div className="flex-1 flex items-center gap-2">
                                                    {!isReadOnly ? (
                                                        <select 
                                                            className="text-[10px] border-none bg-transparent focus:ring-0 text-slate-500 font-medium cursor-pointer w-20"
                                                            value={assignment.role}
                                                            onChange={(e) => { /* Role update logic if needed */ }}
                                                            disabled
                                                        >
                                                            {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span className="text-[10px] text-slate-500 font-medium w-20 truncate">{assignment.role}</span>
                                                    )}
                                                    {!isReadOnly ? (
                                                        <select 
                                                            className="flex-1 text-xs bg-transparent border-none focus:ring-0 text-slate-700 truncate cursor-pointer"
                                                            value={assignment.resourceName || 'Unassigned'}
                                                            onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)}
                                                        >
                                                            <option value="Unassigned">Unassigned</option>
                                                            {resources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                        </select>
                                                    ) : (
                                                        <span className="flex-1 text-xs text-slate-700 truncate">{assignment.resourceName || 'Unassigned'}</span>
                                                    )}
                                                </div>
                                                {!isReadOnly && <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                    <button onClick={() => onCopyAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 text-slate-400 hover:text-indigo-600" title="Duplicate"><Copy size={12}/></button>
                                                    <button onClick={() => onDeleteAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={12}/></button>
                                                </div>}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
         </div>

         {/* Main Grid Area */}
         <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar bg-slate-50">
            <div className="min-w-max">
                {/* Timeline Header */}
                <div className="flex sticky top-0 z-20 bg-white shadow-sm border-b border-slate-200">
                    {timeline.map((col) => (
                        <div key={col.id} className="flex-shrink-0 flex flex-col justify-end text-center border-r border-slate-100 px-1 py-2" style={{ width: colWidthBase }}>
                            <span className="text-[10px] text-slate-400 font-medium uppercase truncate">{col.monthLabel.split(' ')[0]}</span>
                            <span className="text-xs text-slate-600 font-bold">{col.label}</span>
                        </div>
                    ))}
                </div>

                {/* Grid Rows */}
                <div className="pb-20">
                    {projects.map(project => (
                        <div key={project.id}>
                            <div className="h-[29px] border-b border-slate-100 bg-slate-50/50"></div>
                            {expandedProjects[project.id] && project.modules.map(module => (
                                <div key={module.id}>
                                    <div className="h-[25px] border-b border-slate-100 bg-slate-50/30"></div>
                                    {expandedModules[module.id] && module.tasks.map(task => (
                                        <div key={task.id}>
                                            <div className="h-[25px] border-b border-slate-100"></div>
                                            {expandedTasks[task.id] && task.assignments.map(assignment => (
                                                <div key={assignment.id} className="flex h-[34px] border-b border-slate-100 relative bg-white hover:bg-indigo-50/10">
                                                    {timeline.map(col => {
                                                        const alloc = assignment.allocations.find(a => a.weekId === (viewMode === 'day' ? col.parentWeekId : col.id));
                                                        let val = 0;
                                                        if (viewMode === 'day' && alloc?.days) {
                                                            const dateStr = formatDateForInput(col.date!);
                                                            val = alloc.days[dateStr] || 0;
                                                        } else if (alloc) {
                                                            val = alloc.count;
                                                        }

                                                        return (
                                                            <div key={col.id} className="flex-shrink-0 border-r border-slate-100 flex items-center justify-center p-0.5" style={{ width: colWidthBase }}>
                                                                {!isReadOnly ? (
                                                                    <input 
                                                                        type="text"
                                                                        className={`w-full h-full text-center text-[10px] bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-sm ${val > 0 ? 'font-bold text-indigo-600 bg-indigo-50' : 'text-slate-300'}`}
                                                                        value={val > 0 ? val : ''}
                                                                        onChange={(e) => {
                                                                            const num = parseFloat(e.target.value) || 0;
                                                                            if (viewMode === 'day') {
                                                                                onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.parentWeekId!, num, formatDateForInput(col.date!));
                                                                            } else {
                                                                                onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.id, num);
                                                                            }
                                                                        }}
                                                                    />
                                                                ) : (
                                                                    <span className={`text-[10px] ${val > 0 ? 'font-bold text-indigo-600' : 'text-slate-300'}`}>
                                                                        {val > 0 ? val : ''}
                                                                    </span>
                                                                )}
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
                </div>
            </div>
         </div>
      </div>
    </div>
  );
};