
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSave(localValue);
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
      onBlur={() => onSave(localValue)}
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

  const openDependencyModal = (projectId: string, moduleId: string, taskId: string, currentDeps: string[]) =>