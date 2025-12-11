
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
      const numericValue = parseFloat(localValue);
      const originalValue = value;
      
      if (localValue === '' && originalValue !== 0) {
        onChange('0');
      } else if (!isNaN(numericValue) && numericValue !== originalValue) {
        onChange(localValue);
      } else if (localValue !== originalValue.toString()) {
        // Revert if not a valid number and it was changed
        setLocalValue(originalValue === 0 ? '' : originalValue.toString());
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

  const startEditing = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); 
    setEditingId(id);
  };
  
  const saveEdit = (value: string, value2?: string) => {
    if (!editingId) return;

    const parts = editingId.split('-');
    const type = parts[0];

    if (type === 'project') {
      const projectId = parts[1];
      onUpdateProjectName(projectId, value);
    } else if (type === 'module') {
      const [_, projectId, moduleId] = parts;
      onUpdateModuleName(projectId, moduleId, value);
    } else if (type === 'fp') {
      const [_, projectId, moduleId] = parts;
      const legacy = parseInt(value) || 0;
      const mvp = parseInt(value2 || '0') || 0;
      onUpdateFunctionPoints(projectId, moduleId, legacy, mvp);
    } else if (type === 'task') {
      const [_, projectId, moduleId, taskId] = parts;
      onUpdateTaskName(projectId, moduleId, taskId, value);
    } else if (type === 'resource') {
      const [_, projectId, moduleId, taskId, assignmentId] = parts;
      onUpdateAssignmentResourceName(projectId, moduleId, taskId, assignmentId, value);
    }

    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const openDependencyModal = (projectId: string, moduleId: string, taskId: string, currentDeps: string[]) => {
    setCurrentDepTask({ projectId, moduleId, taskId, currentDeps });
    setSelectedDeps(currentDeps);
    setDepModalOpen(true);
  };
  
  const handleDepChange = (depId: string) => {
    setSelectedDeps(prev => 
      prev.includes(depId) ? prev.filter(d => d !== depId) : [...prev, depId]
    );
  };

  const saveDependencies = () => {
    if (currentDepTask) {
      onUpdateTaskDependencies(
        currentDepTask.projectId,
        currentDepTask.moduleId,
        currentDepTask.taskId,
        selectedDeps
      );
    }
    setDepModalOpen(false);
    setCurrentDepTask(null);
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedModuleIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, projectId: string, index: number) => {
    e.preventDefault();
    const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(startIndex) && startIndex !== index) {
      onReorderModules(projectId, startIndex, index);
    }
    setDraggedModuleIndex(null);
  };
  
  const availableTasksForDependencies = useMemo(() => {
    if (!currentDepTask) return [];
    const allTasks: {id: string, name: string}[] = [];
    projects.forEach(p => p.modules.forEach(m => m.tasks.forEach(t => {
      // A task cannot depend on itself
      if (t.id !== currentDepTask.taskId) {
        allTasks.push({ id: t.id, name: t.name });
      }
    })));
    return allTasks;
  }, [projects, currentDepTask]);

  const holidayDates = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  const todayDate = useMemo(() => formatDateForInput(new Date()), []);

  const handleAllocationChange = (
    pId: string, mId: string, tId: string, aId: string, 
    col: TimelineColumn,
    value: string
  ) => {
     const parsedValue = parseFloat(value) || 0;
     const weekId = viewMode === 'day' ? col.parentWeekId! : col.id;
     const dayDate = viewMode === 'day' ? formatDateForInput(col.date!) : undefined;
     onUpdateAllocation(pId, mId, tId, aId, weekId, parsedValue, dayDate);
  };
  
  return (
    <div ref={containerRef} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col relative">
      {/* Toolbar */}
      <div className="p-2 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between flex-shrink-0">
         <div className="flex items-center gap-2">
           <button onClick={onAddProject} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200"><Folder size={14} className="text-indigo-500"/> Add Project</button>
           <div className="w-px h-5 bg-slate-200" />
           <button onClick={onShowHistory} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200"><History size={14} /> History</button>
           <button onClick={() => {}} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200"><Upload size={14} /> Import</button>
           <button onClick={() => {}} className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200"><Download size={14} /> Export</button>
         </div>
         <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">Zoom:</span>
            <input type="range" min="20" max="100" value={colWidthBase} onChange={e => setColWidthBase(Number(e.target.value))} className="w-24 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
            <div className="flex items-center bg-white border border-slate-200 rounded-md p-0.5">
              <button onClick={() => setViewMode('day')} className={`px-2 py-1 text-xs font-medium rounded ${viewMode === 'day' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Day</button>
              <button onClick={() => setViewMode('week')} className={`px-2 py-1 text-xs font-medium rounded ${viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Week</button>
              <button onClick={() => setViewMode('month')} className={`px-2 py-1 text-xs font-medium rounded ${viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Month</button>
            </div>
         </div>
      </div>
      
      {/* Main Grid */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-white">
          <div className="flex text-center text-xs font-semibold text-slate-500 border-b border-slate-200 bg-slate-50/70 select-none">
            <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-slate-50/70 border-r border-slate-200 p-2 z-10 flex items-center justify-between">
                <span>PROJECT STRUCTURE</span>
                <div onMouseDown={startSidebarResize} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize" />
            </div>
            {/* FIX: Merged duplicate style attributes */}
            <div className="sticky z-10 border-r border-slate-200 p-2 flex items-center justify-between" style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px`, backgroundColor: '#fafafa' }}>
                <span>DETAILS</span>
                <div onMouseDown={startDetailsResize} className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize" />
            </div>
            {Object.entries(timeline.reduce((acc, col) => ({...acc, [col.groupLabel]: [...(acc[col.groupLabel] || []), col]}), {} as Record<string, TimelineColumn[]>)).map(([group, cols]) => (
              <div key={group} style={{ width: `${cols.length * colWidth}px` }} className="border-r border-slate-100 flex-shrink-0 p-1">
                {group}
              </div>
            ))}
          </div>
          <div className="flex text-center text-xs font-medium text-slate-400 border-b border-slate-200 shadow-sm">
            <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-white border-r border-slate-200 p-2 z-10"></div>
            {/* FIX: Merged duplicate style attributes */}
            <div style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px`, backgroundColor: '#ffffff' }} className="sticky z-10 border-r border-slate-200 p-2"></div>
            {timeline.map(col => (
              <div key={col.id} style={{ width: `${colWidth}px` }} className={`border-r border-slate-100 flex-shrink-0 p-1 ${col.type === 'day' && (new Date(col.date!).getDay() === 0 || new Date(col.date!).getDay() === 6) ? 'bg-slate-50' : ''}`}>
                {col.label}
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="text-xs">
          {projects.map((p, pIndex) => (
            <React.Fragment key={p.id}>
              {/* Project Row */}
              <div className="flex border-b-2 border-slate-200 bg-slate-100/50 font-bold sticky top-[65px] z-10">
                 <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-slate-100/50 border-r border-slate-200 p-2 z-10 flex items-center gap-2">
                    <button onClick={() => toggleProject(p.id)} className="p-0.5 rounded hover:bg-slate-200">{collapsedProjects[p.id] ? <ChevronRight size={14} /> : <ChevronDown size={14}/>}</button>
                    {editingId === `project-${p.id}` ? (
                      <InlineInput value={p.name} onSave={(val) => saveEdit(val)} onCancel={cancelEdit} />
                    ) : (
                      <span className="truncate" onDoubleClick={() => startEditing(`project-${p.id}`)}>{p.name}</span>
                    )}
                 </div>
                 {/* FIX: Merged duplicate style attributes */}
                 <div style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px`, backgroundColor: '#f1f5f9' }} className="sticky flex items-center gap-2 p-2">
                    <button onClick={() => onAddModule(p.id)} title="Add Module" className="text-slate-400 hover:text-indigo-600"><Plus size={14}/></button>
                    <button onClick={() => onDeleteProject(p.id)} title="Delete Project" className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                 </div>
                 <div className="flex-1 h-full"></div>
              </div>
              {/* Modules */}
              {!collapsedProjects[p.id] && p.modules.map((m, mIndex) => (
                 <React.Fragment key={m.id}>
                    <div 
                      className="flex border-b border-slate-100" 
                      draggable onDragStart={(e) => handleDragStart(e, mIndex)} 
                      onDragOver={handleDragOver} 
                      onDrop={(e) => handleDrop(e, p.id, mIndex)}
                      style={{ opacity: draggedModuleIndex === mIndex ? 0.5 : 1}}
                    >
                      <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-white border-r border-slate-200 p-2 z-10 flex items-center gap-2">
                        <GripVertical size={14} className="text-slate-300 cursor-grab" />
                        <button onClick={() => toggleModule(m.id)} className="p-0.5 rounded hover:bg-slate-100">{collapsedModules[m.id] ? <ChevronRight size={14} /> : <ChevronDown size={14}/>}</button>
                        {editingId === `module-${p.id}-${m.id}` ? (
                            <InlineInput value={m.name} onSave={(val) => saveEdit(val)} onCancel={cancelEdit} />
                        ) : (
                           <span className="font-semibold text-slate-700 truncate" onDoubleClick={() => startEditing(`module-${p.id}-${m.id}`)}>{m.name}</span>
                        )}
                      </div>
                      {/* FIX: Merged duplicate style attributes */}
                      <div style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px` }} className="sticky flex items-center gap-2 p-2 bg-white">
                        <button onClick={() => onAddTask(p.id, m.id, `task-${Date.now()}`, 'New Task', Role.DEV)} title="Add Task" className="text-slate-400 hover:text-indigo-600"><Plus size={14}/></button>
                        <button onClick={() => onDeleteModule(p.id, m.id)} title="Delete Module" className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                      </div>
                      <div className="flex-1 flex h-full">
                        {timeline.map(col => <div key={col.id} style={{width: `${colWidth}px`}} className="border-r border-slate-100 flex-shrink-0" />)}
                      </div>
                    </div>
                    {/* Tasks */}
                    {!collapsedModules[m.id] && m.tasks.map((t, tIndex) => (
                      <React.Fragment key={t.id}>
                        <div className="flex border-b border-slate-100 bg-slate-50/30" id={`task-row-${t.id}`}>
                          <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-slate-50/30 border-r border-slate-200 p-2 z-10 flex items-center gap-2">
                            <span className="pl-8"><button onClick={() => toggleTask(t.id)} className="p-0.5 rounded hover:bg-slate-200">{collapsedTasks[t.id] ? <ChevronRight size={14} /> : <ChevronDown size={14}/>}</button></span>
                            {editingId === `task-${p.id}-${m.id}-${t.id}` ? (
                                <InlineInput value={t.name} onSave={(val) => saveEdit(val)} onCancel={cancelEdit} />
                            ) : (
                              <span className="text-slate-600 truncate" onDoubleClick={() => startEditing(`task-${p.id}-${m.id}-${t.id}`)}>{t.name}</span>
                            )}
                          </div>
                          {/* FIX: Merged duplicate style attributes */}
                          <div style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px` }} className="sticky flex items-center gap-2 p-2 bg-slate-50/30">
                            <button onClick={() => onAddAssignment(p.id, m.id, t.id, Role.DEV)} title="Add Assignment" className="text-slate-400 hover:text-indigo-600"><UserPlus size={14}/></button>
                            <button onClick={() => openDependencyModal(p.id, m.id, t.id, t.dependencies || [])} title="Manage Dependencies" className="text-slate-400 hover:text-indigo-600"><Link size={14}/></button>
                            <button onClick={() => onDeleteTask(p.id, m.id, t.id)} title="Delete Task" className="text-slate-400 hover:text-red-600"><Trash2 size={14}/></button>
                          </div>
                          <div className="flex-1 flex h-full">
                            {timeline.map(col => <div key={col.id} style={{width: `${colWidth}px`}} className="border-r border-slate-100 flex-shrink-0" />)}
                          </div>
                        </div>
                        {/* Assignments */}
                        {!collapsedTasks[t.id] && t.assignments.map((a, aIndex) => (
                          <div key={a.id} className="flex border-b border-slate-100 hover:bg-sky-50/20">
                            <div style={{ width: `${sidebarWidth}px` }} className="sticky left-0 bg-white hover:bg-sky-50/20 border-r border-slate-200 p-2 z-10 flex items-center gap-2">
                              <span className="pl-14"></span>
                               {editingId === `resource-${p.id}-${m.id}-${t.id}-${a.id}` ? (
                                  <InlineInput value={a.resourceName || ''} onSave={(val) => saveEdit(val)} onCancel={cancelEdit} />
                               ) : (
                                 <span className="text-slate-500 truncate" onDoubleClick={() => startEditing(`resource-${p.id}-${m.id}-${t.id}-${a.id}`)}>{a.resourceName}</span>
                               )}
                            </div>
                            {/* FIX: Merged duplicate style attributes */}
                            <div style={{ width: `${detailsWidth}px`, left: `${sidebarWidth}px` }} className="sticky flex items-center gap-2 p-2 bg-white hover:bg-sky-50/20">
                               <select value={a.role} onChange={e => onUpdateAssignmentRole(p.id, m.id, t.id, a.id, e.target.value as Role)} className="text-xs p-0.5 border border-transparent hover:border-slate-200 rounded bg-transparent">
                                 {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                               </select>
                               <button onClick={() => onDeleteAssignment(p.id, m.id, t.id, a.id)} title="Delete Assignment" className="text-slate-300 hover:text-red-600"><Trash2 size={12}/></button>
                            </div>
                            <div className="flex-1 flex h-full">
                               {timeline.map(col => {
                                 const allocation = a.allocations.find(al => al.weekId === (col.parentWeekId || col.id));
                                 const dayDate = viewMode === 'day' ? formatDateForInput(col.date!) : undefined;
                                 
                                 const value = viewMode === 'day' 
                                   ? (allocation?.days?.[dayDate!] ?? 0)
                                   : (allocation?.count ?? 0);

                                 const isCurrent = viewMode === 'day' && dayDate === todayDate;
                                 const isHoliday = viewMode === 'day' && holidayDates.has(dayDate!);

                                 return (
                                    <AllocationCell 
                                      key={col.id}
                                      value={value}
                                      onChange={(val) => handleAllocationChange(p.id, m.id, t.id, a.id, col, val)}
                                      disabled={viewMode === 'month'}
                                      isHoliday={isHoliday}
                                      isCurrent={isCurrent}
                                      width={colWidth}
                                    />
                                  );
                               })}
                            </div>
                          </div>
                        ))}
                      </React.Fragment>
                    ))}
                 </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>
        
        {/* Timeline Extend Triggers */}
        <div className="h-8 flex items-center justify-between px-4">
            <button onClick={() => onExtendTimeline('start')} className="text-xs text-indigo-600 hover:underline">Load Previous</button>
            <button onClick={() => onExtendTimeline('end')} className="text-xs text-indigo-600 hover:underline">Load More</button>
        </div>

        {/* Dependency Lines SVG */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
          {dependencyLines.map((line, i) => (
             <path 
               key={i} 
               d={`M ${line.x1} ${line.y1} C ${line.x1 + 30} ${line.y1}, ${line.x2 - 30} ${line.y2}, ${line.x2} ${line.y2}`}
               stroke="#4f46e5" 
               strokeWidth="1.5"
               fill="none" 
               markerEnd="url(#arrow)"
             />
          ))}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4f46e5" />
            </marker>
          </defs>
        </svg>

      </div>
      
      {depModalOpen && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setDepModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <header className="p-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Manage Dependencies for: {currentDepTask?.taskId}</h3>
            </header>
            <main className="p-6 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                {availableTasksForDependencies.map(task => (
                  <label key={task.id} className="flex items-center gap-2 p-2 border rounded-md hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" checked={selectedDeps.includes(task.id)} onChange={() => handleDepChange(task.id)} className="accent-indigo-600"/>
                    <span className="text-sm text-slate-700">{task.name}</span>
                  </label>
                ))}
              </div>
            </main>
            <footer className="p-4 bg-slate-50 border-t flex justify-end gap-3">
              <button onClick={() => setDepModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border rounded-lg hover:bg-slate-50">Cancel</button>
              <button onClick={saveDependencies} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">Save Dependencies</button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
};
