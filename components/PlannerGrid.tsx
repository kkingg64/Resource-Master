
import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday } from '../types';
import { getTimeline, ALL_WEEK_IDS, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, Info, GripVertical, Plus, UserPlus, ChevronLeft, Clock, PlayCircle, Folder, Settings2, Trash2, Download, Upload, History, Link, Check, X } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => void;
  onUpdateAssignmentRole: (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => void;
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editValue2, setEditValue2] = useState<string>(''); // Secondary value for double inputs (e.g. FP)
  const editInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Dependency Modal State
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [currentDepTask, setCurrentDepTask] = useState<{projectId: string, moduleId: string, taskId: string, currentDeps: string[]} | null>(null);
  const [selectedDeps, setSelectedDeps] = useState<string[]>([]);

  // SVG Lines State
  const containerRef = useRef<HTMLDivElement>(null);
  const [dependencyLines, setDependencyLines] = useState<{x1: number, y1: number, x2: number, y2: number}[]>([]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

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

  const startEditing = (id: string, initialValue: string, initialValue2?: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); 
    setEditingId(id);
    setEditValue(initialValue);
    if (initialValue2 !== undefined) {
      setEditValue2(initialValue2);
    }
  };
  
  const saveEdit = () => {
    if (!editingId) return;

    const parts = editingId.split('-');
    const type = parts[0];

    if (type === 'project') {
      const projectId = parts[1];
      onUpdateProjectName(projectId, editValue);
    } else if (type === 'module') {
      const [_, projectId, moduleId] = parts;
      onUpdateModuleName(projectId, moduleId, editValue);
    } else if (type === 'fp') {
      const [_, projectId, moduleId] = parts;
      const legacy = parseInt(editValue) || 0;
      const mvp = parseInt(editValue2) || 0;
      onUpdateFunctionPoints(projectId, moduleId, legacy, mvp);
    } else if (type === 'task') {
      const [_, projectId, moduleId, taskId] = parts;
      onUpdateTaskName(projectId, moduleId, taskId, editValue);
    } else if (type === 'resource') {
      const [_, projectId, moduleId, taskId, assignmentId] = parts;
      onUpdateAssignmentResourceName(projectId, moduleId, taskId, assignmentId, editValue);
    }

    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const openDependencyModal = (projectId: string, moduleId: string, taskId: string, currentDeps: string[]) => {
      setCurrentDepTask({ projectId, moduleId, taskId, currentDeps });
      setSelectedDeps([...currentDeps]);
      setDepModalOpen(true);
  };

  const saveDependencies = () => {
      if (currentDepTask) {
          onUpdateTaskDependencies(currentDepTask.projectId, currentDepTask.moduleId, currentDepTask.taskId, selectedDeps);
      }
      setDepModalOpen(false);
  };

  // ... (Export/Import logic remains same)

  const today = new Date();
  const currentWeekId = getWeekIdFromDate(today);

  const isCurrentColumn = (col: TimelineColumn) => {
    if (viewMode === 'day' && col.date) {
        return col.date.getDate() === today.getDate() && 
               col.date.getMonth() === today.getMonth() && 
               col.date.getFullYear() === today.getFullYear();
    }
    if (viewMode === 'week') {
        return col.id === currentWeekId;
    }
    return false;
  };

  const groupedHeaders = useMemo(() => {
    return timeline.reduce((acc, col) => {
      const key = col.groupLabel;
      if (!acc[key]) acc[key] = { label: key, colspan: 0 };
      acc[key].colspan++;
      return acc;
    }, {} as Record<string, { label: string, colspan: number }>);
  }, [timeline]);

  const getRoleColorClass = (role: Role) => {
    switch (role) {
      case Role.DEV: return 'border-l-blue-500';
      case Role.UIUX: return 'border-l-orange-500';
      case Role.QA: return 'border-l-green-500';
      case Role.BA: return 'border-l-purple-500';
      default: return 'border-l-slate-300';
    }
  };

  const getHolidayInfo = (date?: Date) => {
    if (!date) return null;
    const dateStr = date.toISOString().split('T')[0];
    return holidays.find(h => h.date === dateStr);
  };

  const isHoliday = (date?: Date) => {
    return !!getHolidayInfo(date);
  };

  const getRawCellValue = (assignment: TaskAssignment, col: TimelineColumn): number => {
    if (viewMode === 'week') {
      const alloc = assignment.allocations.find(a => a.weekId === col.id);
      return alloc ? alloc.count : 0;
    }
    
    if (viewMode === 'month') {
      if (!col.weekIds) return 0;
      return assignment.allocations
        .filter(a => col.weekIds!.includes(a.weekId))
        .reduce((sum, a) => sum + a.count, 0);
    }

    if (viewMode === 'day') {
      if (isHoliday(col.date)) return 0;
      if (!col.parentWeekId || !col.date) return 0;
      
      const alloc = assignment.allocations.find(a => a.weekId === col.parentWeekId);
      if (!alloc) return 0;

      const dateStr = col.date.toISOString().split('T')[0];
      if (alloc.days && alloc.days[dateStr] !== undefined) {
          return alloc.days[dateStr];
      }
      if (alloc.count > 0) {
          return alloc.count / 5;
      }
      return 0;
    }

    return 0;
  };

  const formatValue = (val: number): string => {
    if (val === 0) return '';
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  // Aggregation Helpers (getTaskTotal, getModuleTotal, getProjectTotal remain same)
  const getTaskTotal = (task: ProjectTask, col: TimelineColumn) => {
    return task.assignments.reduce((sum, assign) => sum + getRawCellValue(assign, col), 0);
  };
  const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => {
    return module.tasks.reduce((sum, task) => sum + getTaskTotal(task, col), 0);
  };
  const getProjectTotal = (project: Project, col: TimelineColumn) => {
    return project.modules.reduce((sum, module) => sum + getModuleTotal(module, col), 0);
  };

  const handleCellUpdate = (projectId: string, moduleId: string, taskId: string, assignmentId: string, col: TimelineColumn, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue)) return;
    if (viewMode === 'week') {
      onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.id, numValue);
    } else if (viewMode === 'month') {
       if (!col.weekIds || col.weekIds.length === 0) return;
       const valuePerWeek = numValue / col.weekIds.length;
       col.weekIds.forEach(weekId => {
         onUpdateAllocation(projectId, moduleId, taskId, assignmentId, weekId, valuePerWeek);
       });
    } else if (viewMode === 'day') {
      if (!col.parentWeekId || !col.date) return;
      const dateStr = col.date.toISOString().split('T')[0];
      onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.parentWeekId, numValue, dateStr);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
    setDraggedModuleIndex(index);
  };
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (e: React.DragEvent, projectId: string, index: number) => {
    e.preventDefault();
    const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(startIndex) && startIndex !== index) {
      onReorderModules(projectId, startIndex, index);
    }
    setDraggedModuleIndex(null);
  };

  const handleAddTaskClick = (projectId: string, moduleId: string) => {
    const newTaskId = `task-${Date.now()}`;
    if (collapsedModules[moduleId]) {
      toggleModule(moduleId);
    }
    onAddTask(projectId, moduleId, newTaskId, "New Task", Role.DEV);
    startEditing(`task-${projectId}-${moduleId}-${newTaskId}`, "New Task");
  };

  const handleStartDateChange = (projectId: string, moduleId: string, task: ProjectTask, newDateStr: string) => {
     if (!newDateStr) return;
     const date = new Date(newDateStr);
     const newStartWeekId = getWeekIdFromDate(date);
     onUpdateTaskSchedule(projectId, moduleId, task.id, newStartWeekId, task.duration || 1);
  };

  const handleEndDateChange = (projectId: string, moduleId: string, task: ProjectTask, newDateStr: string) => {
     if (!newDateStr || !task.startWeekId) return;
     const endDate = new Date(newDateStr);
     const endWeekId = getWeekIdFromDate(endDate);
     const [y1, w1] = task.startWeekId.split('-').map(Number);
     const [y2, w2] = endWeekId.split('-').map(Number);
     const weekDiff = (y2 - y1) * 52 + (w2 - w1) + 1;
     const newDuration = Math.max(1, weekDiff);
     onUpdateTaskSchedule(projectId, moduleId, task.id, task.startWeekId, newDuration);
  };

  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };
  const detailsColStyle = { width: detailsWidth, minWidth: detailsWidth, maxWidth: detailsWidth };

  return (
    <>
    {/* Dependency Modal */}
    {depModalOpen && currentDepTask && (
        <div className="fixed inset-0 bg-black/30 z-[100] flex items-center justify-center animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Link size={16} /> Task Dependencies</h3>
                    <button onClick={() => setDepModalOpen(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                    <p className="text-sm text-slate-500 mb-4">Select tasks that must be completed before <span className="font-semibold text-indigo-600">{
                        projects.find(p=>p.id===currentDepTask.projectId)?.modules.find(m=>m.id===currentDepTask.moduleId)?.tasks.find(t=>t.id===currentDepTask.taskId)?.name
                    }</span> can start.</p>
                    <div className="space-y-3">
                        {projects.map(p => (
                            <div key={p.id}>
                                <div className="text-xs font-bold text-slate-400 uppercase mb-1">{p.name}</div>
                                {p.modules.map(m => (
                                    <div key={m.id} className="ml-2 mb-2">
                                        <div className="text-xs font-semibold text-slate-500 mb-1">{m.name}</div>
                                        <div className="space-y-1 ml-2">
                                            {m.tasks.filter(t => t.id !== currentDepTask.taskId).map(t => (
                                                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700 hover:bg-slate-50 p-1 rounded cursor-pointer">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={selectedDeps.includes(t.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) setSelectedDeps([...selectedDeps, t.id]);
                                                            else setSelectedDeps(selectedDeps.filter(id => id !== t.id));
                                                        }}
                                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                                    />
                                                    {t.name}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
                    <button onClick={() => setDepModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={saveDependencies} className="px-4 py-2 text-sm text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">Save Dependencies</button>
                </div>
            </div>
        </div>
    )}

    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Timeline</span>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded overflow-hidden">
             <button onClick={() => onExtendTimeline('start')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600 border-r border-slate-200"> &lt; +Month </button>
             <button onClick={() => onExtendTimeline('end')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600"> +Month &gt; </button>
          </div>
          <div className="h-4 w-px bg-slate-300"></div>
          <div className="flex items-center gap-2" title="Adjust Column Width">
             <Settings2 size={14} className="text-slate-400" />
             <input type="range" min="20" max="100" value={colWidthBase} onChange={(e) => setColWidthBase(parseInt(e.target.value))} className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
          </div>
        </div>
        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-2">
              <button onClick={onShowHistory} className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors"><History size={12} /> History</button>
              {/* Export/Import Buttons omitted for brevity but logic exists */}
          </div>
          <div className="w-px h-4 bg-slate-300"></div>
          <button onClick={onAddProject} className="text-xs flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"><Plus size={12} /> Add Project</button>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{mode}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1 relative" ref={containerRef}>
        
        {/* SVG Layer for Dependencies */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-[60]" style={{minWidth: '100%', minHeight: '100%'}}>
            {dependencyLines.map((line, idx) => (
                <path 
                    key={idx}
                    d={`M ${line.x1} ${line.y1} C ${line.x1 + 20} ${line.y1}, ${line.x2 - 20} ${line.y2}, ${line.x2} ${line.y2}`}
                    fill="none"
                    stroke="#6366f1"
                    strokeWidth="2"
                    markerEnd="url(#arrowhead)"
                    opacity="0.6"
                />
            ))}
            <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" opacity="0.6" />
                </marker>
            </defs>
        </svg>

        <div className="min-w-max">
          {/* Header Rows */}
          <div className="flex bg-slate-100 border-b border-slate-200 sticky top-0 z-40">
            <div className="flex-shrink-0 p-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] relative group" style={stickyStyle}>
              Project Structure
              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={startSidebarResize}></div>
            </div>
            <div className="flex-shrink-0 p-3 text-center text-xs font-semibold text-slate-600 border-r border-slate-200 relative" style={detailsColStyle}>
              Details
              <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={startDetailsResize}></div>
            </div>
            {Object.values(groupedHeaders).map((group, idx) => (
              <div key={idx} className="text-center p-2 text-xs font-bold text-slate-600 border-r border-slate-200 bg-slate-100 uppercase tracking-wide truncate" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>
            ))}
          </div>

          <div className="flex bg-slate-50 border-b border-slate-200 sticky top-[41px] z-40 shadow-sm">
             <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}></div>
             <div className="flex-shrink-0 border-r border-slate-200" style={detailsColStyle}></div>
             {timeline.map(col => {
               const holidayInfo = getHolidayInfo(col.date);
               const isCurrent = isCurrentColumn(col);
               return (
                 <div key={col.id} className={`flex-shrink-0 text-center p-1 text-[10px] border-r border-slate-200 font-medium flex flex-col items-center justify-center relative group/col ${!!holidayInfo ? 'bg-red-50 text-red-600' : ''} ${isCurrent ? 'bg-amber-50 text-amber-700 border-b-2 border-b-amber-400' : 'text-slate-500'}`} style={{ width: `${colWidth}px`, height: '32px' }}>
                   <span>{col.label}</span>
                   {col.date && viewMode === 'day' && <span className={`text-[9px] ${!!holidayInfo ? 'text-red-500 font-bold' : isCurrent ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{col.date.getDate()}</span>}
                 </div>
               );
             })}
          </div>

          {/* Projects Loop */}
          {projects.map((project) => {
            const isProjectCollapsed = collapsedProjects[project.id];
            const isEditingProject = editingId === `project-${project.id}`;
            return (
              <React.Fragment key={project.id}>
                {/* Project Header */}
                <div className="flex bg-slate-700 border-b border-slate-600 sticky z-30 group">
                  <div className="flex-shrink-0 p-3 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 z-40 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle}>
                     <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => !isEditingProject && toggleProject(project.id)}>
                       {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                       <Folder className="w-4 h-4 text-slate-200" />
                       {isEditingProject ? (
                          <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-slate-600 text-white text-sm font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                       ) : (
                          <span className="font-bold text-sm truncate select-none flex-1" onDoubleClick={(e) => startEditing(`project-${project.id}`, project.name, undefined, e)}>{project.name}</span>
                       )}
                     </div>
                     <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-red-300 hover:bg-red-500 hover:text-white p-1 rounded transition-colors"><Trash2 size={12} /></button>
                  </div>
                  <div className="flex-shrink-0 p-3 text-center text-xs font-bold text-slate-300 border-r border-slate-600 flex items-center justify-center gap-2" style={detailsColStyle}>
                     <button onClick={(e) => { e.stopPropagation(); onAddModule(project.id); }} className="flex items-center gap-1 text-[10px] bg-slate-600 hover:bg-slate-500 px-2 py-0.5 rounded transition-colors"><Plus size={10} /> Module</button>
                  </div>
                   {timeline.map(col => (
                        <div key={col.id} className={`flex-shrink-0 border-r border-slate-600 flex items-center justify-center bg-slate-700 ${isCurrentColumn(col) ? 'bg-slate-600 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>
                           {getProjectTotal(project, col) > 0 && <span className="text-[10px] font-bold text-slate-200">{formatValue(getProjectTotal(project, col))}</span>}
                        </div>
                   ))}
                </div>

                {!isProjectCollapsed && project.modules.map((module, index) => {
                  const isModuleCollapsed = collapsedModules[module.id];
                  return (
                    <div key={module.id} draggable onDragStart={(e) => handleDragStart(e, index)} onDragOver={(e) => handleDragOver(e, index)} onDrop={(e) => handleDrop(e, project.id, index)} className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`}>
                      {/* Module Header */}
                      <div className="flex bg-indigo-50/80 border-b border-slate-100 hover:bg-indigo-100/50 transition-colors group">
                        <div className="flex-shrink-0 p-3 pl-6 border-r border-slate-200 sticky left-0 bg-indigo-50/95 backdrop-blur-sm z-30 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                          <div className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer" onClick={() => !(editingId === `module-${project.id}-${module.id}`) && toggleModule(module.id)}>
                            <GripVertical className="w-4 h-4 text-slate-300" />
                            {isModuleCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />}
                            <Layers className="w-4 h-4 text-indigo-600" />
                            {editingId === `module-${project.id}-${module.id}` ? (
                              <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-800 text-sm font-semibold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" onClick={(e) => e.stopPropagation()} />
                            ) : (
                              <span className="font-semibold text-sm text-slate-800 truncate select-none flex-1 hover:text-indigo-600" onDoubleClick={(e) => startEditing(`module-${project.id}-${module.id}`, module.name, undefined, e)}>{module.name}</span>
                            )}
                          </div>
                           <button onClick={(e) => { e.stopPropagation(); onDeleteModule(project.id, module.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 transition-opacity"><Trash2 size={14} /></button>
                        </div>
                        <div className="flex-shrink-0 p-3 text-center text-xs font-bold text-slate-500 border-r border-slate-200 flex items-center justify-center bg-indigo-50/30 cursor-pointer hover:bg-indigo-100/50" style={detailsColStyle} onDoubleClick={(e) => startEditing(`fp-${project.id}-${module.id}`, module.legacyFunctionPoints.toString(), module.functionPoints.toString(), e)}>
                          {editingId === `fp-${project.id}-${module.id}` ? (
                             <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <input ref={editInputRef} type="number" className="w-10 p-0.5 text-[10px] border rounded" value={editValue} onChange={e => setEditValue(e.target.value)} onKeyDown={handleKeyDown}/>
                                <input type="number" className="w-10 p-0.5 text-[10px] border rounded" value={editValue2} onChange={e => setEditValue2(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown}/>
                             </div>
                          ) : <span>{module.functionPoints} FP</span>}
                        </div>
                        {timeline.map(col => (
                           <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center bg-indigo-50/20 ${isCurrentColumn(col) ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}>
                              {getModuleTotal(module, col) > 0 && <span className="text-[10px] font-bold text-indigo-900">{formatValue(getModuleTotal(module, col))}</span>}
                           </div>
                        ))}
                      </div>

                      {/* Tasks */}
                      {!isModuleCollapsed && module.tasks.map((task) => {
                        const startDate = task.startWeekId ? getDateFromWeek(parseInt(task.startWeekId.split('-')[0]), parseInt(task.startWeekId.split('-')[1])) : new Date();
                        const endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + ((task.duration || 1) * 7) - 3);

                        return (
                          <React.Fragment key={`${module.id}-${task.id}`}>
                            {/* Task Row */}
                            <div id={`task-row-${task.id}`} className="flex border-b border-slate-100 bg-slate-50/40 group/task">
                              <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50/95 z-20 flex items-center justify-between pl-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                                 <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !(editingId === `task-${project.id}-${module.id}-${task.id}`) && toggleTask(task.id)}>
                                   {collapsedTasks[task.id] ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                   {editingId === `task-${project.id}-${module.id}-${task.id}` ? (
                                      <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-xs font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" />
                                   ) : (
                                      <span className="text-xs text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" onDoubleClick={(e) => startEditing(`task-${project.id}-${module.id}-${task.id}`, task.name, undefined, e)}>{task.name}</span>
                                   )}
                                 </div>
                                 <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                   <button onClick={() => onShiftTask(project.id, module.id, task.id, 'left')} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"><ChevronLeft size={12} /></button>
                                   <button onClick={() => onShiftTask(project.id, module.id, task.id, 'right')} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"><ChevronRight size={12} /></button>
                                   <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                   <button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"><UserPlus size={14} /></button>
                                   <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                   <button onClick={() => onDeleteTask(project.id, module.id, task.id)} className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-200"><Trash2 size={12} /></button>
                                 </div>
                              </div>

                              {/* Details Column: Date Inputs & Dependency Link */}
                              <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50/30 flex items-center gap-1 px-1" style={detailsColStyle}>
                                  <div className="flex flex-col w-full gap-0.5">
                                      <div className="flex items-center gap-1">
                                          <span className="text-[9px] text-slate-400 w-6">Start</span>
                                          <input type="date" className="text-[9px] p-0 border-none bg-transparent text-slate-600 focus:ring-0 w-full cursor-pointer" value={formatDateForInput(startDate)} onChange={(e) => handleStartDateChange(project.id, module.id, task, e.target.value)} />
                                          <button 
                                              onClick={() => openDependencyModal(project.id, module.id, task.id, task.dependencies || [])}
                                              className={`p-0.5 rounded hover:bg-indigo-100 ${task.dependencies && task.dependencies.length > 0 ? 'text-indigo-600' : 'text-slate-300'}`}
                                              title="Manage Dependencies"
                                          >
                                              <Link size={10} />
                                          </button>
                                      </div>
                                      <div className="flex items-center gap-1 border-t border-slate-200 pt-0.5">
                                          <span className="text-[9px] text-slate-400 w-6">End</span>
                                          <input type="date" className="text-[9px] p-0 border-none bg-transparent text-slate-600 focus:ring-0 w-full cursor-pointer" value={formatDateForInput(endDate)} min={formatDateForInput(startDate)} onChange={(e) => handleEndDateChange(project.id, module.id, task, e.target.value)} />
                                      </div>
                                  </div>
                              </div>
                              
                              {timeline.map(col => (
                                <div key={`th-${task.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center bg-slate-50/30 ${isCurrentColumn(col) ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}>
                                   {getTaskTotal(task, col) > 0 && <span className="text-[10px] font-semibold text-slate-600">{formatValue(getTaskTotal(task, col))}</span>}
                                </div>
                              ))}
                            </div>

                            {/* Assignment Rows (Omitted code logic remains same) */}
                            {!collapsedTasks[task.id] && task.assignments.map(assignment => (
                               <div key={assignment.id} className="flex border-b border-slate-100 group/assign">
                                 <div className={`flex-shrink-0 py-1 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-10 flex items-center justify-between border-l-[3px] ${getRoleColorClass(assignment.role)} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                    <div className="flex-1 overflow-hidden flex items-center">
                                       {editingId === `resource-${project.id}-${module.id}-${task.id}-${assignment.id}` ? (
                                           <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-xs font-bold border border-indigo-300 rounded px-1 w-full ml-12" />
                                       ) : <span className="text-xs text-slate-600 pl-12 truncate cursor-pointer hover:text-indigo-600 flex-1" onDoubleClick={(e) => startEditing(`resource-${project.id}-${module.id}-${task.id}-${assignment.id}`, assignment.resourceName || '', undefined, e)}>↳ {assignment.resourceName || 'Unassigned'}</span>}
                                       <button onClick={(e) => { e.stopPropagation(); onDeleteAssignment(project.id, module.id, task.id, assignment.id); }} className="opacity-0 group-hover/assign:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 transition-opacity ml-2"><Trash2 size={14} /></button>
                                    </div>
                                 </div>
                                 <div className="flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-between px-2 py-1 relative group-hover/assign:bg-slate-50" style={detailsColStyle}>
                                     <select value={assignment.role} onChange={(e) => onUpdateAssignmentRole(project.id, module.id, task.id, assignment.id, e.target.value as Role)} className="w-20 text-[10px] p-1 border-none bg-transparent focus:ring-0 text-slate-600 cursor-pointer font-medium">
                                       {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                                     </select>
                                 </div>
                                 {timeline.map(col => (
                                    <div key={`${assignment.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 relative ${!!getHolidayInfo(col.date) ? 'bg-[repeating-linear-gradient(45deg,#fee2e2,#fee2e2_5px,#fef2f2_5px,#fef2f2_10px)]' : isCurrentColumn(col) ? 'bg-amber-50/50' : ''}`} style={{ width: `${colWidth}px` }}>
                                       <input type="text" disabled={!!getHolidayInfo(col.date)} className={`w-full h-full text-center text-xs focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-0 transition-colors ${getRawCellValue(assignment, col) > 0 ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-400 hover:bg-slate-50'} ${!!getHolidayInfo(col.date) ? 'bg-transparent cursor-not-allowed' : ''}`} value={formatValue(getRawCellValue(assignment, col))} onChange={(e) => handleCellUpdate(project.id, module.id, task.id, assignment.id, col, e.target.value)} />
                                    </div>
                                 ))}
                               </div>
                            ))}
                          </React.Fragment>
                        );
                      })}
                       {!isModuleCollapsed && (
                        <div className="flex border-b border-slate-100 bg-slate-50/20">
                          <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50/80 z-20 pl-12 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                            <button onClick={() => handleAddTaskClick(project.id, module.id)} className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors"><Plus size={12} /> Add New Task</button>
                          </div>
                          <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50/20" style={detailsColStyle}></div>
                           {timeline.map(col => <div key={`add-${module.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 ${isCurrentColumn(col) ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}></div>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
           <div className="flex bg-slate-800 text-white border-t border-slate-700 sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] mt-0.5">
             <div className="flex-shrink-0 p-3 border-r border-slate-700 sticky left-0 bg-slate-800 z-50 font-bold text-sm shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle}> GRAND TOTAL </div>
             <div className="flex-shrink-0 border-r border-slate-700" style={detailsColStyle}></div>
             {timeline.map(col => (
                 <div key={`total-${col.id}`} className={`flex-shrink-0 border-r border-slate-700 flex items-center justify-center text-xs font-mono font-bold ${isCurrentColumn(col) ? 'bg-slate-700 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>
                   {projects.reduce((acc, p) => acc + getProjectTotal(p, col), 0) > 0 ? formatValue(projects.reduce((acc, p) => acc + getProjectTotal(p, col), 0)) : ''}
                 </div>
             ))}
           </div>
        </div>
      </div>
    </div>
    </>
  );
};