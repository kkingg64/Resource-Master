import React, { useState, useMemo } from 'react';
import { Project, Holiday, Resource, WeekPoint, ViewMode, Role, TimelineColumn } from '../types';
import { getTimeline, formatDateForInput, getWeekIdFromDate } from '../constants';
import { 
  ChevronRight, ChevronDown, Plus, RefreshCw, Check, 
  User, Copy, Trash2, History,
} from 'lucide-react';

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
  isReadOnly?: boolean;
}

export const PlannerGrid: React.FC<PlannerGridProps> = ({
  projects,
  holidays,
  resources,
  timelineStart,
  timelineEnd,
  onExtendTimeline,
  onUpdateAllocation,
  onUpdateAssignmentResourceName,
  onUpdateAssignmentDependency,
  onAddTask,
  onAddAssignment,
  onCopyAssignment,
  onReorderModules,
  onReorderTasks,
  onReorderAssignments,
  onShiftTask,
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
  onImportPlan,
  onShowHistory,
  onRefresh,
  saveStatus,
  isRefreshing,
  isReadOnly
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  
  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);
  const colWidth = viewMode === 'week' ? 40 : viewMode === 'month' ? 120 : 30;
  
  const toggleProject = (id: string) => {
    setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const isCurrentColumn = (col: TimelineColumn) => {
    const today = new Date();
    const currentWeekId = getWeekIdFromDate(today);
    return col.id === currentWeekId;
  };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-2">
            <button onClick={onRefresh} className={`p-1.5 rounded hover:bg-white hover:shadow-sm ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-slate-500'}`}><RefreshCw size={16} /></button>
            <div className="h-4 w-px bg-slate-300 mx-1"></div>
            <div className="flex bg-slate-200 rounded p-0.5">
                <button onClick={() => setViewMode('day')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'day' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Day</button>
                <button onClick={() => setViewMode('week')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'week' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                <button onClick={() => setViewMode('month')} className={`px-3 py-1 text-xs font-medium rounded ${viewMode === 'month' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
            </div>
            <div className="h-4 w-px bg-slate-300 mx-1"></div>
            <button onClick={() => onExtendTimeline('start')} className="px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">{'< Extend Start'}</button>
            <button onClick={() => onExtendTimeline('end')} className="px-2 py-1 text-xs bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600">{'Extend End >'}</button>
        </div>
        <div className="flex items-center gap-2">
            {!isReadOnly && <button onClick={onAddProject} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded hover:bg-indigo-700"><Plus size={14} /> New Project</button>}
            <div className="h-4 w-px bg-slate-300 mx-1"></div>
            <button onClick={onShowHistory} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-white rounded"><History size={16} /></button>
            <div className="flex items-center gap-1 text-xs text-slate-400 px-2">
                {saveStatus === 'saving' && <span className="text-amber-500 flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Saving...</span>}
                {saveStatus === 'success' && <span className="text-green-500 flex items-center gap-1"><Check size={12} /> Saved</span>}
                {saveStatus === 'error' && <span className="text-red-500">Error saving</span>}
            </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="flex-1 overflow-auto relative">
        <div className="flex min-w-max">
            {/* Sidebar (Left Pane) */}
            <div className="sticky left-0 z-20 w-80 bg-white border-r border-slate-200 flex-shrink-0">
                 <div className="h-8 border-b border-slate-200 bg-slate-50 px-2 flex items-center text-xs font-bold text-slate-500 sticky top-0 z-30">
                     PROJECT / MODULE / TASK
                 </div>
                 <div className="divide-y divide-slate-100">
                     {projects.length === 0 && <div className="p-4 text-center text-xs text-slate-400 italic">No projects. Click 'New Project' to start.</div>}
                     {projects.map(project => (
                         <div key={project.id}>
                             <div className="flex items-center justify-between px-2 py-1.5 bg-slate-50 hover:bg-slate-100 group">
                                 <div className="flex items-center gap-1 flex-1 overflow-hidden">
                                     <button onClick={() => toggleProject(project.id)} className="p-0.5 text-slate-400 hover:text-slate-600">
                                         {collapsedProjects[project.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                     </button>
                                     {!isReadOnly ? (
                                        <input 
                                            className="bg-transparent text-sm font-bold text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 w-full truncate"
                                            value={project.name}
                                            onChange={(e) => onUpdateProjectName(project.id, e.target.value)}
                                        />
                                     ) : (
                                        <span className="text-sm font-bold text-slate-800 px-1 truncate">{project.name}</span>
                                     )}
                                 </div>
                                 {!isReadOnly && (
                                     <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button onClick={() => onAddModule(project.id)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Add Module"><Plus size={12} /></button>
                                         <button onClick={() => onDeleteProject(project.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Project"><Trash2 size={12} /></button>
                                     </div>
                                 )}
                             </div>
                             
                             {!collapsedProjects[project.id] && (
                                 <div>
                                     {project.modules.map(module => (
                                         <div key={module.id}>
                                             <div className="flex items-center justify-between px-2 py-1 bg-white hover:bg-slate-50 border-t border-slate-50 pl-6 group">
                                                  <div className="flex items-center gap-1 flex-1 overflow-hidden">
                                                     {!isReadOnly ? (
                                                        <input 
                                                            className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 w-full truncate"
                                                            value={module.name}
                                                            onChange={(e) => onUpdateModuleName(project.id, module.id, e.target.value)}
                                                        />
                                                     ) : (
                                                        <span className="text-xs font-semibold text-slate-700 px-1 truncate">{module.name}</span>
                                                     )}
                                                  </div>
                                                  {!isReadOnly && (
                                                     <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                         <button onClick={() => onAddTask(project.id, module.id, crypto.randomUUID(), 'New Task', Role.DEV)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Add Task"><Plus size={12} /></button>
                                                         <button onClick={() => onDeleteModule(project.id, module.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Module"><Trash2 size={12} /></button>
                                                     </div>
                                                  )}
                                             </div>
                                             
                                             <div>
                                                 {module.tasks.map(task => (
                                                     <div key={task.id} className="relative">
                                                         <div className="flex items-center justify-between px-2 py-1 bg-white hover:bg-slate-50 pl-10 group border-l-2 border-transparent hover:border-indigo-500">
                                                              <div className="flex items-center gap-1 flex-1 overflow-hidden">
                                                                 {!isReadOnly ? (
                                                                    <input 
                                                                        className="bg-transparent text-xs text-slate-600 focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded px-1 w-full truncate"
                                                                        value={task.name}
                                                                        onChange={(e) => onUpdateTaskName(project.id, module.id, task.id, e.target.value)}
                                                                    />
                                                                 ) : (
                                                                    <span className="text-xs text-slate-600 px-1 truncate">{task.name}</span>
                                                                 )}
                                                              </div>
                                                              {!isReadOnly && (
                                                                 <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                     <button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)} className="p-1 text-indigo-600 hover:bg-indigo-50 rounded" title="Add Assignment"><User size={12} /></button>
                                                                     <button onClick={() => onDeleteTask(project.id, module.id, task.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Task"><Trash2 size={12} /></button>
                                                                 </div>
                                                              )}
                                                         </div>
                                                         
                                                         {/* Assignments */}
                                                         {task.assignments.map(assignment => (
                                                             <div key={assignment.id} className="flex items-center justify-between px-2 py-1 bg-slate-50/50 hover:bg-slate-100 pl-14 text-xs group">
                                                                  <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                                      <div className="w-16 flex-shrink-0">
                                                                         <span className="px-1 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px]">{assignment.role}</span>
                                                                      </div>
                                                                      {!isReadOnly ? (
                                                                          <select 
                                                                            value={assignment.resourceName || 'Unassigned'} 
                                                                            onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)}
                                                                            className="bg-transparent hover:bg-white border-none focus:ring-0 text-slate-700 text-xs w-full cursor-pointer"
                                                                          >
                                                                              <option value="Unassigned">Unassigned</option>
                                                                              {resources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                                          </select>
                                                                      ) : (
                                                                          <span className="text-slate-700 truncate">{assignment.resourceName || 'Unassigned'}</span>
                                                                      )}
                                                                  </div>
                                                                  {!isReadOnly && (
                                                                     <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                         <button onClick={() => onCopyAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-white rounded" title="Copy Assignment"><Copy size={10} /></button>
                                                                         <button onClick={() => onDeleteAssignment(project.id, module.id, task.id, assignment.id)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete Assignment"><Trash2 size={10} /></button>
                                                                     </div>
                                                                  )}
                                                             </div>
                                                         ))}
                                                     </div>
                                                 ))}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                         </div>
                     ))}
                 </div>
            </div>

            {/* Timeline Grid */}
            <div className="flex-1">
                 {/* Timeline Header */}
                 <div className="h-8 flex sticky top-0 z-10 bg-white border-b border-slate-200">
                      {timeline.map(col => {
                          const isCurrent = isCurrentColumn(col);
                          let isHKHoliday = false;
                          let holidayName = '';
                          if (viewMode === 'day' && col.date) {
                              const dateStr = formatDateForInput(col.date);
                              const holiday = holidays.find(h => h.country === 'HK' && h.date === dateStr);
                              if (holiday) { isHKHoliday = true; holidayName = holiday.name; }
                          }
                          
                          return (
                            <div 
                                key={col.id} 
                                style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }} 
                                className={`flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-100 text-[10px] font-medium 
                                    ${isHKHoliday ? 'bg-red-50 text-red-700' : isCurrent ? 'bg-amber-50 text-amber-700 border-b-2 border-b-amber-400' : 'text-slate-500'}
                                `}
                                title={holidayName || col.label}
                            >
                                <span>{col.label}</span>
                                {viewMode === 'day' && col.date && <span className="text-[9px] opacity-70">{col.date.getDate()}</span>}
                            </div>
                          );
                      })}
                 </div>

                 {/* Grid Body */}
                 <div>
                     {projects.map(project => (
                        <div key={project.id}>
                            <div className="h-[34px] bg-slate-50/50 border-b border-slate-100"></div> {/* Project Row Placeholder */}
                            {!collapsedProjects[project.id] && project.modules.map(module => (
                                <div key={module.id}>
                                    <div className="h-[28px] border-b border-slate-100"></div> {/* Module Row Placeholder */}
                                    {module.tasks.map(task => (
                                        <div key={task.id}>
                                            <div className="h-[28px] border-b border-slate-100 bg-slate-50/10"></div> {/* Task Row Placeholder */}
                                            {task.assignments.map(assignment => (
                                                <div key={assignment.id} className="h-[26px] flex border-b border-slate-100">
                                                    {timeline.map(col => {
                                                        const targetWeekId = col.parentWeekId || col.id;
                                                        const alloc = assignment.allocations.find(a => a.weekId === targetWeekId);
                                                        
                                                        let value = 0;
                                                        if (alloc) {
                                                            if (viewMode === 'day' && col.date) {
                                                                const dateStr = formatDateForInput(col.date);
                                                                value = alloc.days?.[dateStr] || 0;
                                                            } else {
                                                                value = alloc.count;
                                                            }
                                                        }
                                                        
                                                        const isAssigned = value > 0;
                                                        
                                                        return (
                                                            <div 
                                                                key={col.id} 
                                                                style={{ width: `${colWidth}px`, minWidth: `${colWidth}px` }} 
                                                                className={`flex-shrink-0 border-r border-slate-50 flex items-center justify-center text-[9px]
                                                                    ${isAssigned ? 'bg-indigo-50 text-indigo-700 font-medium' : ''}
                                                                `}
                                                            >
                                                                {!isReadOnly ? (
                                                                    <input 
                                                                        type="text" 
                                                                        value={value === 0 ? '' : value}
                                                                        onChange={(e) => {
                                                                            const val = parseFloat(e.target.value) || 0;
                                                                            if (viewMode === 'day' && col.date) {
                                                                                const dateStr = formatDateForInput(col.date);
                                                                                onUpdateAllocation(project.id, module.id, task.id, assignment.id, targetWeekId, val, dateStr);
                                                                            } else {
                                                                                onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.id, val);
                                                                            }
                                                                        }}
                                                                        className="w-full h-full bg-transparent text-center focus:outline-none focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-sm"
                                                                    />
                                                                ) : (
                                                                    <span>{value === 0 ? '' : value}</span>
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
