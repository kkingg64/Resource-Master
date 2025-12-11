import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday } from '../types';
import { getTimeline, ALL_WEEK_IDS, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, Info, GripVertical, Plus, UserPlus, ChevronLeft, Clock, PlayCircle, Folder, Settings2, Trash2, Download, Upload, History, Link, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// --- Optimized Sub-Components ---

const InlineInput = ({ value, onSave, onCancel, type = 'text', autoFocus = true }: { value: string, onSave: (val: string) => void, onCancel: () => void, type?: string, autoFocus?: boolean }) => {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleSave = () => {
    const trimmedValue = localValue.trim();
    if (trimmedValue && trimmedValue !== value) {
      onSave(trimmedValue);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      className="bg-white text-slate-900 text-xs font-bold border border-indigo-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm"
    />
  );
};

const AllocationCell = React.memo(({ value, onChange, disabled, isHoliday, isCurrent, width }: { value: number, onChange: (val: string) => void, disabled: boolean, isHoliday: boolean, isCurrent: boolean, width: number }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : value.toString());
  
  useEffect(() => {
     setLocalValue(value === 0 ? '' : value.toString());
  }, [value]);

  const handleBlur = () => {
      if (localValue !== (value === 0 ? '' : value.toString())) {
        onChange(localValue);
      }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
      if(e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
      }
  };

  return (
    <div className={`flex-shrink-0 border-r border-slate-100 relative ${isHoliday ? 'bg-[repeating-linear-gradient(45deg,#fee2e2,#fee2e2_5px,#fef2f2_5px,#fef2f2_10px)]' : isCurrent ? 'bg-amber-50/50' : ''}`} style={{ width: `${width}px` }}>
       <input 
         type="text" 
         disabled={disabled}
         className={`w-full h-full text-center text-xs focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-0 transition-colors ${value > 0 ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-400 hover:bg-slate-50'} ${disabled ? 'bg-transparent cursor-not-allowed' : ''}`}
         value={localValue} 
         onChange={(e) => setLocalValue(e.target.value)}
         onBlur={handleBlur}
         onKeyDown={handleKeyDown}
       />
    </div>
  );
});

type EditingTarget = {
  type: 'project';
  projectId: string;
} | {
  type: 'module';
  projectId: string;
  moduleId: string;
} | {
  type: 'task';
  projectId: string;
  moduleId: string;
  taskId: string;
} | {
  type: 'resource';
  projectId: string;
  moduleId: string;
  taskId: string;
  assignmentId: string;
};

interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => void;
  onUpdateAssignmentRole: (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => void;
  onAddTask: (projectId: string, moduleId: string) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onShiftTask: (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => void;
  onShiftAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string, direction: 'left' | 'right') => void;
  onUpdateTaskSchedule: (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => void;
  onAddProject: () => void;
  onAddModule: (projectId: string) => void;
  onUpdateProjectName: (projectId: string, name: string) => void;
  onUpdateModuleName: (projectId: string, moduleId: string, name: string) => void;
  onUpdateTaskName: (projectId: string, moduleId: string, taskId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onDeleteModule: (projectId: string, moduleId: string) => void;
  onDeleteTask: (projectId: string, moduleId: string, taskId: string) => void;
  onDeleteAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onImportPlan: (projects: Project[], holidays: Holiday[]) => void;
  onShowHistory: () => void;
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => void;
  onUpdateTaskDependencies: (projectId: string, moduleId: string, taskId: string, dependencies: string[]) => void;
}

export const PlannerGrid: React.FC<PlannerGridProps> = ({ 
  projects, 
  holidays,
  timelineStart,
  timelineEnd,
  onExtendTimeline,
  onUpdateAllocation, 
  onUpdateAssignmentRole, 
  onUpdateAssignmentResourceName,
  onAddTask, 
  onAddAssignment,
  onReorderModules,
  onShiftTask,
  onShiftAssignment,
  onUpdateTaskSchedule,
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
  onUpdateFunctionPoints,
  onUpdateTaskDependencies
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null);

  // Column Width States
  const [colWidthBase, setColWidthBase] = useState<number>(40);
  const [sidebarWidth, setSidebarWidth] = useState<number>(256); // Default w-64
  const sidebarResizing = useRef(false);
  const [detailsWidth, setDetailsWidth] = useState<number>(128); // Default w-32
  const detailsResizing = useRef(false);

  // Editing State
  const [editingTarget, setEditingTarget] = useState<EditingTarget | null>(null);
  
  // Dependency Modal State
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [currentDepTask, setCurrentDepTask] = useState<{projectId: string, moduleId: string, taskId: string, currentDeps: string[]} | null>(null);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  // SVG Lines State
  const containerRef = useRef<HTMLDivElement>(null);
  const [dependencyLines, setDependencyLines] = useState<{x1: number, y1: number, x2: number, y2: number}[]>([]);

  // Handle Column Resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarResizing.current) {
        const newWidth = Math.max(200, Math.min(600, e.clientX));
        setSidebarWidth(newWidth);
      }
      if (detailsResizing.current) {
        const newWidth = Math.max(100, Math.min(500, e.clientX - sidebarWidth));
        setDetailsWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      sidebarResizing.current = false;
      detailsResizing.current = false;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [sidebarWidth]);

  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);
  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;

  // Calculate Dependency Lines
  useLayoutEffect(() => {
      if (!containerRef.current) return;
      
      const newLines: {x1: number, y1: number, x2: number, y2: number}[] = [];
      const containerRect = containerRef.current.getBoundingClientRect();
      const stickyOffset = sidebarWidth + detailsWidth;
      
      // Helper to find task position
      const getTaskPos = (taskId: string, weekId: string | undefined, duration: number | undefined): {x: number, y: number} | null => {
         const el = document.getElementById(`task-row-${taskId}`);
         if (!el || !weekId) return null;
         
         const rect = el.getBoundingClientRect();
         const y = (rect.top - containerRect.top) + (rect.height / 2);
         
         // Find week index
         const weekIndex = timeline.findIndex(w => w.id === weekId || w.parentWeekId === weekId);
         if (weekIndex === -1) return null;
         
         const x = stickyOffset + (weekIndex * colWidth);
         return { x, y };
      };

      projects.forEach(p => {
         if (collapsedProjects[p.id]) return;
         p.modules.forEach(m => {
            if (collapsedModules[m.id]) return;
            m.tasks.forEach(t => {
               if (collapsedTasks[t.id]) return;
               if (t.dependencies && t.dependencies.length > 0) {
                  const targetPos = getTaskPos(t.id, t.startWeekId, t.duration);
                  if (targetPos) {
                     t.dependencies.forEach(depId => {
                        // Find predecessor
                        let predTask: ProjectTask | undefined;
                        projects.forEach(proj => proj.modules.forEach(mod => {
                           const found = mod.tasks.find(tk => tk.id === depId);
                           if (found) predTask = found;
                        }));

                        if (predTask && predTask.startWeekId) {
                           const predStartPos = getTaskPos(predTask.id, predTask.startWeekId, predTask.duration);
                           if (predStartPos) {
                              const predEndX = predStartPos.x + ((predTask.duration || 1) * 7 / (viewMode === 'day' ? 1 : 7) * colWidth);
                              newLines.push({
                                 x1: predEndX,
                                 y1: predStartPos.y,
                                 x2: targetPos.x,
                                 y2: targetPos.y
                              });
                           }
                        }
                     });
                  }
               }
            });
         });
      });
      setDependencyLines(newLines);
  }, [projects, collapsedProjects, collapsedModules, collapsedTasks, timeline, colWidth, sidebarWidth, detailsWidth, viewMode]);

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };
  
  const startDetailsResize = (e: React.MouseEvent) => {
    e.preventDefault();
    detailsResizing.current = true;
    document.body.style.cursor = 'col-resize';
  };

  const toggleProject = (id: string) => {
    setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleModule = (id: string) => {
    setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTask = (id: string) => {
    setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const cancelEdit = () => {
    setEditingTarget(null);
  };

  const saveEdit = (value: string) => {
    if (!editingTarget) {
      cancelEdit();
      return;
    }

    switch (editingTarget.type) {
      case 'project':
        onUpdateProjectName(editingTarget.projectId, value);
        break;
      case 'module':
        onUpdateModuleName(editingTarget.projectId, editingTarget.moduleId, value);
        break;
      case 'task':
        onUpdateTaskName(editingTarget.projectId, editingTarget.moduleId, editingTarget.taskId, value);
        break;
      case 'resource':
        onUpdateAssignmentResourceName(editingTarget.projectId, editingTarget.moduleId, editingTarget.taskId, editingTarget.assignmentId, value);
        break;
    }
    cancelEdit();
  };


  const openDependencyModal = (projectId: string, moduleId: string, taskId: string, currentDeps: string[]) => {
    setCurrentDepTask({ projectId, moduleId, taskId, currentDeps: currentDeps || [] });
    setSelectedDeps(currentDeps || []);
    setDepModalOpen(true);
  };

  const closeDependencyModal = () => {
    setDepModalOpen(false);
    setCurrentDepTask(null);
    setSelectedDeps([]);
  };

  const saveDependencies = () => {
    if (currentDepTask) {
      onUpdateTaskDependencies(currentDepTask.projectId, currentDepTask.moduleId, currentDepTask.taskId, selectedDeps);
    }
    closeDependencyModal();
  };
  
  const availableTasksForDependencies = useMemo(() => {
    if (!currentDepTask) return [];
    const allTasks: { id: string; name: string; module: string }[] = [];
    projects.forEach(p => {
        p.modules.forEach(m => {
            m.tasks.forEach(t => {
                if (t.id !== currentDepTask.taskId) {
                    allTasks.push({ id: t.id, name: t.name, module: m.name });
                }
            });
        });
    });
    return allTasks;
  }, [projects, currentDepTask]);

  const handleModuleDragStart = (e: React.DragEvent, index: number, projectId: string) => {
    e.dataTransfer.setData("text/plain", `${projectId},${index}`);
    setDraggedModuleIndex(index);
  };

  const handleModuleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleModuleDrop = (e: React.DragEvent, index: number, projectId: string) => {
    e.preventDefault();
    const [draggedProjectId, startIndexStr] = e.dataTransfer.getData("text/plain").split(',');
    const startIndex = parseInt(startIndexStr, 10);
    if (draggedProjectId === projectId && !isNaN(startIndex) && startIndex !== index) {
      onReorderModules(projectId, startIndex, index);
    }
    setDraggedModuleIndex(null);
  };
  
  const currentWeekId = getWeekIdFromDate(new Date());
  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex-shrink-0 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
            {(['day', 'week', 'month'] as ViewMode[]).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
           <div className="flex items-center gap-1">
             <button onClick={() => onExtendTimeline('start')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md"><ChevronLeft size={16} /></button>
             <span className="text-xs font-semibold text-slate-600 w-48 text-center">
                {timeline[0]?.groupLabel} - {timeline[timeline.length - 1]?.groupLabel}
             </span>
             <button onClick={() => onExtendTimeline('end')} className="p-2 text-slate-500 hover:bg-slate-100 rounded-md"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={onShowHistory} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"><History size={16} /> History</button>
           <button onClick={() => {
              const data = projects.map(p => p.modules.flatMap(m => m.tasks.flatMap(t => t.assignments.flatMap(a => a.allocations.map(al => ({ Project: p.name, Module: m.name, Task: t.name, Role: a.role, Resource: a.resourceName, Week: al.weekId, Days: al.count }))))));
              const ws = XLSX.utils.json_to_sheet(data.flat());
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Allocations");
              XLSX.writeFile(wb, "resource-plan.xlsx");
           }} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg"><Download size={16} /> Export</button>
           <button onClick={onAddProject} className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"><Plus size={16} /> Add Project</button>
        </div>
      </div>

      <div className="flex-1 flex overflow-auto custom-scrollbar relative">
        <div className="flex sticky top-0 left-0 z-20">
            {/* Sidebar */}
            <div style={{ width: `${sidebarWidth}px` }} className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
                <div className="h-12 flex-shrink-0 border-b border-slate-100 px-4 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-500" />
                        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Project Structure</h3>
                    </div>
                </div>
            </div>
            {/* Resizer */}
            <div onMouseDown={startSidebarResize} className="w-1.5 h-full cursor-col-resize bg-slate-100 hover:bg-indigo-200 transition-colors flex-shrink-0"></div>
            {/* Details */}
             <div style={{ width: `${detailsWidth}px` }} className="flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
                <div className="h-12 flex-shrink-0 border-b border-slate-100 px-2 grid grid-cols-2 bg-slate-50/50">
                    <div className="flex items-center"><h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Role</h3></div>
                    <div className="flex items-center"><h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Resource</h3></div>
                </div>
            </div>
            {/* Resizer */}
            <div onMouseDown={startDetailsResize} className="w-1.5 h-full cursor-col-resize bg-slate-100 hover:bg-indigo-200 transition-colors flex-shrink-0"></div>
        </div>
        
        <div className="absolute top-0 left-0 w-full h-full">
            <div style={{ paddingLeft: `${sidebarWidth + detailsWidth + 6}px`}} className="h-full">
                {/* Timeline Header */}
                <div className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200 shadow-sm">
                    <div className="flex relative h-6 border-b border-slate-100">
                        {timeline.filter(c => c.type !== 'day').map(c => <div key={c.id} style={{width: `${(c.weekIds?.length || 1) * (viewMode === 'day' ? colWidth * 5 : colWidth)}px`}} className="flex-shrink-0 text-center text-xs font-bold text-slate-600 border-r border-slate-200">{c.groupLabel}</div>)}
                    </div>
                    <div className="flex relative h-6">
                        {timeline.map(c => <div key={c.id} style={{width: `${colWidth}px`}} className="flex-shrink-0 text-center text-xs font-medium text-slate-500 border-r border-slate-200">{c.label}</div>)}
                    </div>
                </div>

                {/* Main Content */}
                <div className="relative">
                    {projects.map(p => (
                        <div key={p.id}>
                            <div className="h-10 flex items-center bg-slate-100/30 border-b border-slate-100"></div>
                            {!collapsedProjects[p.id] && p.modules.map((m, moduleIndex) => (
                                <div key={m.id}>
                                    <div className="h-8 flex items-center bg-white border-b border-slate-100"></div>
                                    {!collapsedModules[m.id] && m.tasks.map(t => (
                                        <div key={t.id}>
                                            <div id={`task-row-${t.id}`} className="h-8 flex items-center bg-slate-50/50 border-b border-slate-100"></div>
                                            {!collapsedTasks[t.id] && t.assignments.map(a => (
                                                <div key={a.id} className="h-8 flex items-center border-b border-slate-100 bg-white hover:bg-slate-50/50">
                                                    {timeline.map(col => {
                                                        const alloc = a.allocations.find(al => viewMode === 'day' ? col.parentWeekId === al.weekId : col.id === al.weekId);
                                                        const value = viewMode === 'day' && col.date && alloc?.days ? (alloc.days[formatDateForInput(col.date)] || 0) : (alloc?.count || 0);
                                                        return <AllocationCell key={col.id} width={colWidth} value={value} disabled={viewMode === 'week' || viewMode === 'month'} isCurrent={col.parentWeekId === currentWeekId || col.id === currentWeekId} isHoliday={col.date ? holidayDates.has(formatDateForInput(col.date)) : false} onChange={(val) => onUpdateAllocation(p.id, m.id, t.id, a.id, viewMode === 'day' ? col.parentWeekId! : col.id, parseFloat(val) || 0, viewMode === 'day' ? formatDateForInput(col.date!) : undefined)} />
                                                    })}
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                     <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                        <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#4f46e5" /></marker></defs>
                        {dependencyLines.map((line, i) => <path key={i} d={`M ${line.x1} ${line.y1} L ${line.x1 + 10} ${line.y1} L ${line.x1 + 10} ${line.y2} L ${line.x2} ${line.y2}`} stroke="#4f46e5" strokeWidth="1.5" fill="none" markerEnd="url(#arrow)" />)}
                    </svg>
                </div>
            </div>
        </div>
        
        <div className="absolute top-0 left-0 h-full overflow-y-scroll custom-scrollbar" style={{ width: `${sidebarWidth + detailsWidth + 6}px`, zIndex: 5 }}>
            <div className="h-12 sticky top-0 bg-transparent pointer-events-none"></div>
             {projects.map(p => (
                <div key={p.id}>
                    <div className="h-10 flex items-center bg-slate-100 border-b border-slate-200 group">
                        <div style={{width: `${sidebarWidth}px`}} className="flex items-center px-2 gap-2">
                            <button onClick={() => toggleProject(p.id)} className="p-1 hover:bg-slate-200 rounded">{collapsedProjects[p.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                            {editingTarget?.type === 'project' && editingTarget.projectId === p.id ? <InlineInput value={p.name} onSave={saveEdit} onCancel={cancelEdit} /> : <span className="font-bold text-sm text-slate-800 truncate" onDoubleClick={() => setEditingTarget({ type: 'project', projectId: p.id })}>{p.name}</span>}
                            <div className="ml-auto flex items-center">
                                <button onClick={() => onAddModule(p.id)} title="Add Module" className="text-slate-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50">
                                    <Plus size={14} />
                                </button>
                                <button onClick={() => { if(window.confirm(`Are you sure you want to delete project "${p.name}"? This action cannot be undone.`)) onDeleteProject(p.id) }} title="Delete Project" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-opacity">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                    {!collapsedProjects[p.id] && p.modules.map((m, moduleIndex) => (
                        <div key={m.id} draggable onDragStart={(e) => handleModuleDragStart(e, moduleIndex, p.id)} onDragOver={handleModuleDragOver} onDrop={(e) => handleModuleDrop(e, moduleIndex, p.id)} className={`${draggedModuleIndex === moduleIndex ? 'opacity-50' : ''}`}>
                             <div className="h-8 flex items-center bg-white border-b border-slate-100 hover:bg-slate-50 group">
                                <div style={{width: `${sidebarWidth}px`}} className="flex items-center px-2 gap-2 pl-6">
                                    <button onClick={() => toggleModule(m.id)} className="p-1 hover:bg-slate-200 rounded">{collapsedModules[m.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                                    <GripVertical size={12} className="text-slate-300 cursor-grab" />
                                    {editingTarget?.type === 'module' && editingTarget.moduleId === m.id ? <InlineInput value={m.name} onSave={saveEdit} onCancel={cancelEdit} /> : <span className="font-semibold text-xs text-slate-700 truncate" onDoubleClick={() => setEditingTarget({ type: 'module', projectId: p.id, moduleId: m.id })}>{m.name}</span>}
                                    <div className="ml-auto flex items-center">
                                        <button onClick={() => onAddTask(p.id, m.id)} title="Add Task" className="text-slate-400 hover:text-indigo-600 p-1 rounded-full hover:bg-indigo-50">
                                            <Plus size={14} />
                                        </button>
                                        <button onClick={() => { if(window.confirm(`Delete module "${m.name}"?`)) onDeleteModule(p.id, m.id) }} title="Delete Module" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-opacity">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {!collapsedModules[m.id] && m.tasks.map(t => (
                                <div key={t.id}>
                                    <div className="h-8 flex items-center bg-slate-50/50 border-b border-slate-100 hover:bg-slate-100/70 group">
                                       <div style={{width: `${sidebarWidth}px`}} className="flex items-center px-2 gap-2 pl-12">
                                          <button onClick={() => toggleTask(t.id)} className="p-1 hover:bg-slate-200 rounded">{collapsedTasks[t.id] ? <ChevronRight size={14} /> : <ChevronDown size={14} />}</button>
                                          {editingTarget?.type === 'task' && editingTarget.taskId === t.id ? <InlineInput value={t.name} onSave={saveEdit} onCancel={cancelEdit} /> : <span className="text-xs text-slate-600 truncate" onDoubleClick={() => setEditingTarget({ type: 'task', projectId: p.id, moduleId: m.id, taskId: t.id })}>{t.name}</span>}
                                          <div className="ml-auto flex items-center">
                                              <button onClick={() => openDependencyModal(p.id, m.id, t.id, t.dependencies || [])} title="Set Dependencies" className="text-slate-400 hover:text-indigo-600 p-0.5 rounded"><Link size={12} /></button>
                                              <button onClick={() => onAddAssignment(p.id, m.id, t.id, Role.DEV)} title="Add Assignment" className="ml-1 text-slate-400 hover:text-indigo-600 p-0.5 rounded"><UserPlus size={12} /></button>
                                              <button onClick={() => { if(window.confirm(`Delete task "${t.name}"?`)) onDeleteTask(p.id, m.id, t.id) }} title="Delete Task" className="ml-1 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-0.5 rounded transition-opacity">
                                                  <Trash2 size={12} />
                                              </button>
                                          </div>
                                       </div>
                                    </div>
                                    {!collapsedTasks[t.id] && t.assignments.map(a => (
                                        <div key={a.id} className="h-8 flex items-center border-b border-slate-100 bg-white hover:bg-slate-50/50 group">
                                             <div style={{width: `${sidebarWidth}px`}} className="pl-16 pr-2"></div>
                                             <div style={{width: `${detailsWidth}px`}} className="grid grid-cols-[1fr_1fr] text-xs px-2 h-full">
                                                <div className="border-r border-slate-100 h-full flex items-center pr-1">
                                                    <select value={a.role} onChange={(e) => onUpdateAssignmentRole(p.id, m.id, t.id, a.id, e.target.value as Role)} className="w-full bg-transparent focus:outline-none focus:bg-white text-xs">
                                                        {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                                    </select>
                                                </div>
                                                <div className="h-full flex items-center justify-between pl-1">
                                                   {editingTarget?.type === 'resource' && editingTarget.assignmentId === a.id ? <InlineInput value={a.resourceName || ''} onSave={saveEdit} onCancel={cancelEdit} /> : <span className="truncate" onDoubleClick={() => setEditingTarget({ type: 'resource', projectId: p.id, moduleId: m.id, taskId: t.id, assignmentId: a.id })}>{a.resourceName || 'Unassigned'}</span>}
                                                    <button onClick={() => { if(window.confirm(`Delete this assignment?`)) onDeleteAssignment(p.id, m.id, t.id, a.id) }} title="Delete Assignment" className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-opacity">
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                             </div>
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
       {depModalOpen && currentDepTask && (
            <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={closeDependencyModal}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
                    <header className="p-4 border-b border-slate-200"><h2 className="font-bold text-slate-800">Set Dependencies</h2><p className="text-sm text-slate-500">Select tasks that must be completed before this one can start.</p></header>
                    <main className="p-6 max-h-[60vh] overflow-y-auto">
                        <ul className="space-y-2">
                           {availableTasksForDependencies.map(task => (
                               <li key={task.id}><label className="flex items-center gap-3 p-3 rounded-lg border hover:bg-slate-50 cursor-pointer">
                                   <input type="checkbox" checked={selectedDeps.includes(task.id)} onChange={() => { setSelectedDeps(prev => prev.includes(task.id) ? prev.filter(id => id !== task.id) : [...prev, task.id])}} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"/>
                                   <div><span className="font-medium text-slate-700">{task.name}</span><span className="text-xs text-slate-400 ml-2">({task.module})</span></div>
                               </label></li>
                           ))}
                        </ul>
                    </main>
                    <footer className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                        <button onClick={closeDependencyModal} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                        <button onClick={saveDependencies} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm">Save Dependencies</button>
                    </footer>
                </div>
            </div>
        )}
    </div>
  );
};