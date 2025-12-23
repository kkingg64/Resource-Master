
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Project, Role, TaskAssignment, ViewMode, TimelineColumn, Resource, Holiday, ModuleType, MODULE_TYPE_DISPLAY_NAMES, ProjectModule, ProjectTask } from '../types';
import { ChevronDown, ChevronRight, GripVertical, Plus, UserPlus, Folder, MoreHorizontal, Copy, Trash2, Calendar, ChevronLeft, Link2, Minimize2, Lock, Unlock, Clock } from 'lucide-react';
import { getTimeline, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween } from '../constants';
import { DependencyLines } from './DependencyLines';

interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  resources: Resource[];
  timelineStart: { year: number; week: number };
  timelineEnd: { year: number; week: number };
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => void;
  onUpdateAssignmentDependency: (assignmentId: string, parentAssignmentId: string | null) => void;
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onCopyAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onReorderTasks: (projectId: string, moduleId: string, startIndex: number, endIndex: number) => void;
  onMoveTask: (projectId: string, sourceModuleId: string, targetModuleId: string, sourceIndex: number, targetIndex: number) => void;
  onUpdateModuleType: (projectId: string, moduleId: string, type: ModuleType) => void;
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
  onImportPlan: (projects: Project[], holidays: Holiday[]) => void;
  onShowHistory: () => void;
  onRefresh: () => void;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  isRefreshing: boolean;
  isReadOnly?: boolean;
}

const MODULE_TYPE_STYLES: Record<ModuleType, { bgColor: string, iconColor: string, textColor: string, hoverBgColor: string, hoverTextColor: string, totalTextColor: string, icon: any, ganttBarColor: string, ganttGridColor: string }> = {
  [ModuleType.Development]: { 
      bgColor: 'bg-white', iconColor: 'text-slate-400', textColor: 'text-slate-700', hoverBgColor: 'hover:bg-slate-50', hoverTextColor: 'group-hover:text-indigo-600', totalTextColor: 'text-slate-400', icon: Folder,
      ganttBarColor: 'bg-slate-400/50', ganttGridColor: 'bg-slate-100 text-slate-500' 
  },
  [ModuleType.Preparation]: { 
      bgColor: 'bg-amber-50', iconColor: 'text-amber-500', textColor: 'text-amber-800', hoverBgColor: 'hover:bg-amber-100', hoverTextColor: 'group-hover:text-amber-900', totalTextColor: 'text-amber-600', icon: Folder,
      ganttBarColor: 'bg-amber-400/50', ganttGridColor: 'bg-amber-100 text-amber-700'
  },
  [ModuleType.PostDevelopment]: { 
      bgColor: 'bg-teal-50', iconColor: 'text-teal-500', textColor: 'text-teal-800', hoverBgColor: 'hover:bg-teal-100', hoverTextColor: 'group-hover:text-teal-900', totalTextColor: 'text-teal-600', icon: Folder,
      ganttBarColor: 'bg-teal-400/50', ganttGridColor: 'bg-teal-100 text-teal-700'
  },
  [ModuleType.MVP]: { 
      bgColor: 'bg-sky-50', iconColor: 'text-sky-500', textColor: 'text-sky-800', hoverBgColor: 'hover:bg-sky-100', hoverTextColor: 'group-hover:text-sky-900', totalTextColor: 'text-sky-600', icon: Folder,
      ganttBarColor: 'bg-sky-400/50', ganttGridColor: 'bg-sky-100 text-sky-700'
  },
  [ModuleType.Production]: { 
      bgColor: 'bg-slate-100', iconColor: 'text-slate-500', textColor: 'text-slate-800', hoverBgColor: 'hover:bg-slate-200', hoverTextColor: 'group-hover:text-black', totalTextColor: 'text-slate-500', icon: Folder,
      ganttBarColor: 'bg-slate-500/50', ganttGridColor: 'bg-slate-200 text-slate-600'
  },
};

const DatePicker: React.FC<{ value: Date, onChange: (date: Date) => void, onClose: () => void }> = ({ value, onChange, onClose }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            onChange(new Date(e.target.value));
        }
    };
    return (
        <div className="bg-white p-2 rounded shadow-lg border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <input 
                type="date" 
                value={formatDateForInput(value)} 
                onChange={handleChange}
                className="text-xs p-1 border rounded"
                autoFocus
            />
        </div>
    );
};

interface GridNumberInputProps {
    value: number;
    onChange: (val: number) => void;
    onNavigate: (dir: string) => void;
    rowIndex: number;
    colIndex: number;
    width: number;
    holidayDuration?: number;
    isCurrent?: boolean;
    holidayName?: any;
    disabled?: boolean;
}

const GridNumberInput: React.FC<GridNumberInputProps> = React.memo(({ value, onChange, onNavigate, rowIndex, colIndex, width, holidayDuration, isCurrent, holidayName, disabled }) => {
    const [localValue, setLocalValue] = useState(value === 0 ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value === 0 ? '' : String(value));
        }
    }, [value, isEditing]);

    const commit = () => {
        if (disabled) return;
        setIsEditing(false);
        const num = parseFloat(localValue);
        const validNum = isNaN(num) ? 0 : num;
        if (validNum !== value) {
            onChange(validNum);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            commit();
            onNavigate(e.key);
        }
        if (e.key === 'Enter') { e.currentTarget.blur(); }
    };

    let bgClass = isCurrent ? 'bg-amber-50' : 'bg-white';
    let textClass = 'text-slate-600';
    let displayValue = isEditing ? localValue : (value === 0 ? '' : value);
    let title = '';

    if (holidayDuration && holidayDuration > 0) {
        if (holidayDuration === 1) {
            bgClass = 'bg-red-50'; // Full holiday
            textClass = 'text-red-300';
            displayValue = isEditing ? localValue : 'H';
            title = holidayName?.name || 'Holiday';
        } else {
            bgClass = 'bg-orange-50'; // Half day
            title = `${holidayName?.name} (0.5d)`;
        }
    }

    if (isCurrent && !holidayDuration) bgClass = 'bg-amber-100/50';

    return (
        <div className={`flex-shrink-0 border-r border-slate-100 border-b border-slate-100 h-full flex items-center justify-center relative group/cell ${bgClass}`} style={{ width: `${width}px` }} title={title}>
            <input 
                type="text" 
                data-r={rowIndex}
                data-c={colIndex}
                className={`w-full h-full text-center text-[10px] bg-transparent border-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 p-0 ${textClass} font-medium disabled:cursor-not-allowed`}
                value={displayValue}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={commit}
                onFocus={(e) => { if(!disabled) { setIsEditing(true); e.target.select(); } }}
                onKeyDown={handleKeyDown}
                disabled={disabled}
            />
        </div>
    );
});

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
  onMoveTask,
  onUpdateModuleType,
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
  isReadOnly = false
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [displayMode, setDisplayMode] = useState<'allocation' | 'gantt'>('allocation');
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null);
  const [draggedTask, setDraggedTask] = useState<{ moduleId: string; index: number } | null>(null);
  const [draggedAssignment, setDraggedAssignment] = useState<{ taskId: string; index: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ type: 'project' | 'module' | 'task' | 'assignment'; x: number; y: number; projectId: string; moduleId?: string; taskId?: string; assignmentId?: string; } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);
  const [datePickerState, setDatePickerState] = useState<{ assignmentId: string | null }>({ assignmentId: null });
  const datePickerContainerRef = useRef<HTMLDivElement>(null);
  
  // Column Width Management
  const [startColWidth, setStartColWidth] = useState(60);
  const [durationColWidth, setDurationColWidth] = useState(40);
  const [dependencyColWidth, setDependencyColWidth] = useState(30);
  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  // Freezing/Sticky Logic
  const [isDetailsFrozen, setIsDetailsFrozen] = useState(true);

  // Filters
  const [filterText, setFilterText] = useState('');
  
  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);
  
  const colWidth = viewMode === 'month' ? 60 : viewMode === 'week' ? 40 : 30;
  
  // Sidebar Constants
  const sidebarWidth = 250; 
  
  // Calculate freeze offsets
  const startColLeft = sidebarWidth; // 250
  const durationColLeft = startColLeft + startColWidth;
  const dependencyColLeft = durationColLeft + durationColWidth;
  const totalStickyWidth = sidebarWidth + (isDetailsFrozen ? (startColWidth + durationColWidth + dependencyColWidth) : 0);
  const stickyLeftOffset = sidebarWidth + startColWidth + durationColWidth + dependencyColWidth;
  
  const stickyStyle = { left: 0, width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };

  const toggleProject = (id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTask = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const scrollLeft = e.currentTarget.scrollLeft;
      if (scrollLeft < 50) onExtendTimeline('start');
      if (e.currentTarget.scrollWidth - (scrollLeft + e.currentTarget.clientWidth) < 50) onExtendTimeline('end');
  };

  const handleResizeStart = (col: string, currentWidth: number, e: React.MouseEvent) => {
      setResizingCol(col);
      resizeStartX.current = e.clientX;
      resizeStartWidth.current = currentWidth;
      document.body.style.cursor = 'col-resize';
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
      if (!resizingCol) return;
      const diff = e.clientX - resizeStartX.current;
      const newWidth = Math.max(20, resizeStartWidth.current + diff);
      if (resizingCol === 'start') setStartColWidth(newWidth);
      if (resizingCol === 'duration') setDurationColWidth(newWidth);
      if (resizingCol === 'dependency') setDependencyColWidth(newWidth);
  };

  const handleResizeEnd = () => {
      setResizingCol(null);
      document.body.style.cursor = 'default';
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
  };

  const isCircularDependency = (assignmentId: string, parentId: string): boolean => {
      if (assignmentId === parentId) return true;
      return false; 
  };

  const groupedResources = useMemo(() => {
      const groups: Record<string, Resource[]> = {};
      resources.forEach(r => {
          if (!groups[r.category]) groups[r.category] = [];
          groups[r.category].push(r);
      });
      return groups;
  }, [resources]);

  const resourceHolidaysMap = useMemo(() => {
      const map = new Map<string, { holidayMap: Map<string, number>, holidays: any[] }>();
      const defaultMap = new Map<string, number>();
      const defaultHolidays = holidays.filter(h => h.country === 'HK');
      defaultHolidays.forEach(h => defaultMap.set(h.date, h.duration || 1));
      map.set('Unassigned', { holidayMap: defaultMap, holidays: defaultHolidays });

      resources.forEach(r => {
          const rMap = new Map<string, number>();
          const rHolidays: any[] = [];
          
          const region = r.holiday_region || 'HK';
          holidays.filter(h => h.country === region).forEach(h => {
              rMap.set(h.date, h.duration || 1);
              rHolidays.push(h);
          });
          (r.individual_holidays || []).forEach(h => {
              rMap.set(h.date, h.duration || 1);
              rHolidays.push(h);
          });
          map.set(r.name, { holidayMap: rMap, holidays: rHolidays });
      });
      return map;
  }, [resources, holidays]);
  
  const projectHolidayMap = resourceHolidaysMap.get('Unassigned')!.holidayMap;

  // Render Helpers
  const getProjectTotal = (p: Project, col: TimelineColumn) => 0; // Simplified
  const getModuleTotal = (m: ProjectModule, col: TimelineColumn) => 0; // Simplified
  const getTaskTotal = (t: ProjectTask, col: TimelineColumn) => 0; // Simplified
  const getRawCellValue = (a: TaskAssignment, col: TimelineColumn) => {
      if (viewMode === 'week') {
          const alloc = a.allocations.find(al => al.weekId === col.id);
          return alloc ? alloc.count : 0;
      }
      if (viewMode === 'day' && col.date) {
          const weekId = col.parentWeekId || getWeekIdFromDate(col.date);
          const alloc = a.allocations.find(al => al.weekId === weekId);
          if (alloc && alloc.days) {
              return alloc.days[formatDateForInput(col.date)] || 0;
          }
          return 0;
      }
      return 0;
  };

  const handleCellUpdate = (pid: string, mid: string, tid: string, aid: string, col: TimelineColumn, val: number) => {
      if (viewMode === 'week') {
          onUpdateAllocation(pid, mid, tid, aid, col.id, val);
      } else if (viewMode === 'day' && col.date) {
          const weekId = col.parentWeekId || getWeekIdFromDate(col.date);
          onUpdateAllocation(pid, mid, tid, aid, weekId, val, formatDateForInput(col.date));
      }
  };

  const handleNavigate = (dir: string, r: number, c: number) => {
      // Grid nav logic
  };

  const startEditing = (id: string, val: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setEditingId(id);
      setEditValue(val);
  };

  const saveEdit = () => {
      setEditingId(null);
  };
  
  const saveDuration = (assignment: TaskAssignment) => {
      const newDuration = parseInt(editValue);
      if (!isNaN(newDuration) && assignment.startDate) {
          onUpdateAssignmentSchedule(assignment.id, assignment.startDate, newDuration);
      }
      setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') saveEdit();
      if (e.key === 'Escape') setEditingId(null);
  };

  const handleAssignmentStartDateChange = (assignment: TaskAssignment, newDate: string) => {
      if (assignment.duration) {
          onUpdateAssignmentSchedule(assignment.id, newDate, assignment.duration);
      }
  };

  const filteredProjects = projects.filter(p => p.name.toLowerCase().includes(filterText.toLowerCase()));

  // Setup render data for Dependencies
  const allAssignmentsMap = new Map<string, TaskAssignment>();
  const assignmentRenderInfo = new Map<string, { rowIndex: number, y: number, startDate: string | undefined, endDate: string }>();
  let gridRowIndex = 0;
  const rowHeight = 33; // Explicit row height for accurate dependency drawing

  const showMonthRow = viewMode !== 'month';
  
  // Calculate vertical offsets
  // Header height = 32px (top) + 32px (months if visible) + 32px (days/weeks) = ~96px
  // But our gridRowIndex logic is for content rows.
  // The first content row starts after the sticky headers.
  // We approximate the start Y position for the first row.
  const headerHeight = showMonthRow ? 96 : 64; 
  
  projects.forEach(p => {
      // Project Row
      gridRowIndex++;
      if (!collapsedProjects[p.id]) {
          p.modules.forEach(m => {
              // Module Row
              gridRowIndex++;
              if (!collapsedModules[m.id]) {
                  m.tasks.forEach(t => {
                      // Task Row
                      gridRowIndex++;
                      if (!collapsedTasks[t.id]) {
                          t.assignments.forEach(a => {
                              allAssignmentsMap.set(a.id, a);
                              let endDateStr = '';
                              if (a.startDate && a.duration) {
                                  const holidays = resourceHolidaysMap.get(a.resourceName || 'Unassigned')?.holidayMap;
                                  endDateStr = calculateEndDate(a.startDate, a.duration, holidays || new Map());
                              }
                              
                              // Calculate exact Y center for this assignment row
                              // rowIndex (0-based for calculation) * rowHeight + half row height
                              // + header offset
                              const y = (gridRowIndex * rowHeight) + (rowHeight / 2) + 10; // +10 adjustment for header spacing visual

                              assignmentRenderInfo.set(a.id, {
                                  rowIndex: gridRowIndex,
                                  y: y,
                                  startDate: a.startDate,
                                  endDate: endDateStr
                              });
                              gridRowIndex++; // Increment for Assignment Row
                          });
                      }
                  });
              }
          });
      }
  });

  const totalGridHeight = (gridRowIndex + 1) * rowHeight + headerHeight;

  // Reset for actual render loop
  gridRowIndex = 0; 

  // Dependencies prep
  const allAssignmentsForDependencies = Array.from(allAssignmentsMap.values()).map(a => ({ id: a.id, name: `${a.role} (${a.resourceName})`, groupLabel: 'All' })); 

  // Drag handlers (simplified)
  const handleModuleDragStart = (e: any, index: number) => {};
  const handleModuleDragOver = (e: any) => e.preventDefault();
  const handleModuleDrop = (e: any, pid: string, mid: string, index: number) => {};
  const handleTaskDragStart = (e: any, pid: string, mid: string, index: number) => {};
  const handleTaskDragOver = (e: any) => e.preventDefault();
  const handleTaskDrop = (e: any, pid: string, mid: string, index: number) => {};
  const handleAssignmentDragStart = (e: any, tid: string, index: number) => {};
  const handleAssignmentDragOver = (e: any) => e.preventDefault();
  const handleAssignmentDrop = (e: any, pid: string, mid: string, tid: string, index: number) => {};
  
  const handleAddTaskClick = (pid: string, mid: string) => onAddTask(pid, mid, crypto.randomUUID(), 'New Task', Role.DEV);

  // Z-Index Constants
  const Z_HEADER_TOP = 60;
  const Z_HEADER_BOTTOM = 50;
  const Z_SIDEBAR = 40;
  const Z_DETAILS = 30;
  const Z_GRID_CONTENT = 10;

  // Render setup
  const currentWeekId = getWeekIdFromDate(new Date());
  const currentColumnIndex = timeline.findIndex(col => col.id === currentWeekId || (col.weekIds && col.weekIds.includes(currentWeekId)));
  const isCurrentColumn = (col: TimelineColumn) => col.id === currentWeekId;
  const formatValue = (val: number) => val === 0 ? '' : val % 1 === 0 ? val : val.toFixed(1);
  const getRoleStyle = (role: Role) => ({ border: 'border-l-indigo-500', bar: 'bg-indigo-200', fill: 'bg-indigo-500' }); 

  // Header grouping
  const yearHeaders: Record<string, { label: string, colspan: number }> = {};
  const monthHeaders: Record<string, { label: string, colspan: number }> = {};
  timeline.forEach(col => {
      if (!yearHeaders[col.yearLabel]) yearHeaders[col.yearLabel] = { label: col.yearLabel, colspan: 0 };
      yearHeaders[col.yearLabel].colspan++;
      if (!monthHeaders[col.monthLabel]) monthHeaders[col.monthLabel] = { label: col.monthLabel, colspan: 0 };
      monthHeaders[col.monthLabel].colspan++;
  });

  return (
    <>
      <div className="flex flex-col h-full bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm relative">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-2 border-b border-slate-200 bg-slate-50">
           <div className="flex items-center gap-2">
               <div className="flex bg-slate-200 p-0.5 rounded-lg">
                   <button onClick={() => setViewMode('day')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Day</button>
                   <button onClick={() => setViewMode('week')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Week</button>
                   <button onClick={() => setViewMode('month')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Month</button>
               </div>
               <div className="h-4 w-px bg-slate-300 mx-1"></div>
               <div className="flex bg-slate-200 p-0.5 rounded-lg">
                   <button onClick={() => setDisplayMode('allocation')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${displayMode === 'allocation' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Allocation</button>
                   <button onClick={() => setDisplayMode('gantt')} className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${displayMode === 'gantt' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Gantt</button>
               </div>
               <div className="h-4 w-px bg-slate-300 mx-1"></div>
               <button onClick={() => setIsDetailsFrozen(!isDetailsFrozen)} className={`p-1.5 rounded-md transition-colors ${isDetailsFrozen ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-200'}`} title="Freeze/Unfreeze Details Columns">
                   {isDetailsFrozen ? <Lock size={14} /> : <Unlock size={14} />}
               </button>
           </div>
           
           <div className="flex items-center gap-2">
               <input type="text" placeholder="Filter projects..." value={filterText} onChange={e => setFilterText(e.target.value)} className="text-xs border border-slate-300 rounded px-2 py-1 focus:ring-2 focus:ring-indigo-500 outline-none w-48" />
               <button onClick={onAddProject} disabled={isReadOnly} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"><Plus size={14} /> New Project</button>
           </div>
        </div>

        <div className="flex-1 overflow-auto relative custom-scrollbar" onScroll={handleScroll}>
          <div className="inline-block min-w-full relative">
              {/* Dependency Lines Overlay */}
              <DependencyLines 
                  allAssignmentsMap={allAssignmentsMap} 
                  assignmentRenderInfo={assignmentRenderInfo} 
                  timeline={timeline}
                  colWidth={colWidth}
                  totalHeight={totalGridHeight}
                  sidebarWidth={stickyLeftOffset}
              />

              <>
                <div className={`flex bg-slate-100 border-b border-slate-200 sticky top-0 h-8 items-center shadow-sm z-[${Z_HEADER_TOP}]`}>
                  {/* Sticky Sidebar Header */}
                  <div className={`flex-shrink-0 px-3 py-1.5 font-bold text-xs text-slate-700 uppercase tracking-wider border-r border-slate-200 sticky left-0 bg-slate-100 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full z-[${Z_HEADER_TOP}]`} style={stickyStyle}>
                    <span>Project Structure</span>
                  </div>
                  
                  {/* Sticky Detail Headers */}
                  <div title="Start Date" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_TOP}] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                    <Calendar size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('start', startColWidth, e)}></div>
                  </div>
                  <div title="Duration (Days)" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_TOP}] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                    <Clock size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('duration', durationColWidth, e)}></div>
                  </div>
                  
                  {/* Dependency Column Header */}
                  <div title="Dependency" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_TOP}] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}>
                    <Link2 size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('dependency', dependencyColWidth, e)}></div>
                  </div>

                  {Object.values(yearHeaders).map((group: any, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-700 border-r border-slate-300 uppercase tracking-wider h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                </div>
                {showMonthRow && (
                  <div className={`flex bg-slate-100 border-b border-slate-200 sticky top-8 h-8 items-center z-[${Z_HEADER_BOTTOM}]`}>
                    <div className={`flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-100 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full z-[${Z_HEADER_BOTTOM}]`} style={stickyStyle}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                    {Object.values(monthHeaders).map((group: any, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-600 border-r border-slate-200 uppercase h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                  </div>
                )}
                <div className={`flex bg-slate-50 border-b border-slate-200 sticky shadow-sm h-8 items-center ${showMonthRow ? 'top-16' : 'top-8'} z-[${Z_HEADER_BOTTOM}]`}>
                  <div className={`flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full z-[${Z_HEADER_BOTTOM}]`} style={stickyStyle}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_HEADER_BOTTOM}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                  {timeline.map(col => {
                      const isCurrent = isCurrentColumn(col);
                      let isFullDayHoliday = false;
                      let isHalfDayHoliday = false;
                      let holidayName = '';
                      
                      if (viewMode === 'day' && col.date) {
                          const dateStr = formatDateForInput(col.date);
                          const holiday = holidays.find(h => h.country === 'HK' && h.date === dateStr);
                          if (holiday) { 
                              if (holiday.duration === 0.5) isHalfDayHoliday = true;
                              else isFullDayHoliday = true;
                              holidayName = holiday.name; 
                          }
                      }
                      let className = `flex-shrink-0 text-center text-[10px] border-r border-slate-200 font-medium flex flex-col items-center justify-center relative group/col h-full`;
                      if (isFullDayHoliday) { className += ' bg-red-50 text-red-700'; } 
                      else if (isHalfDayHoliday) { className += ' bg-orange-50 text-orange-700'; }
                      else if (isCurrent) { className += ' bg-amber-100 text-amber-800 border-b-4 border-b-amber-500'; } else { className += ' text-slate-500'; }
                      if (isCurrent && !isFullDayHoliday) { className += ''; } 
                      return (<div key={col.id} className={className} style={{ width: `${colWidth}px` }} title={holidayName || (isCurrent ? 'Current Date' : '')}><span>{col.label}</span>{viewMode === 'day' && col.date && <span className={`text-[9px] ${isFullDayHoliday ? 'text-red-600 font-bold' : isHalfDayHoliday ? 'text-orange-600 font-bold' : isCurrent ? 'text-amber-800 font-bold' : 'text-slate-400'}`}>{col.date.getDate()}</span>}</div>);
                  })}
                </div>
              </>

            {/* Today/Current Column Highlighter Overlay */}
            {currentColumnIndex !== -1 && (
                <div 
                    className="absolute top-0 bottom-0 pointer-events-none z-30 border-l-2 border-r-2 border-amber-400 bg-amber-400/10"
                    style={{
                        left: stickyLeftOffset + (currentColumnIndex * colWidth),
                        width: colWidth
                    }}
                />
            )}

            {filteredProjects.map((project) => {
              const isProjectCollapsed = collapsedProjects[project.id];
              const isEditingProject = editingId === `project::${project.id}`;

              return (
                <React.Fragment key={project.id}>
                  <div className={`flex bg-slate-700 border-b border-slate-600 group relative h-[33px]`}>
                    <div className={`flex-shrink-0 px-3 py-1.5 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)] z-[${Z_SIDEBAR}]`} style={stickyStyle} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'project', x: e.pageX, y: e.pageY, projectId: project.id }); }}>
                      <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => !isEditingProject && toggleProject(project.id)}>
                        {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                        <Folder className="w-3.5 h-3.5 text-slate-200" />
                        {isEditingProject ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-slate-600 text-white text-xs font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="font-bold text-xs truncate select-none flex-1" onDoubleClick={(e) => startEditing(`project::${project.id}`, project.name, e)} title="Double click to rename">{project.name}</span> )}
                      </div>
                    </div>
                    {/* Project Row Spacers - z-49 */}
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                    
                    <div className="flex relative z-[${Z_GRID_CONTENT}]">
                      {timeline.map(col => { const total = getProjectTotal(project, col); return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-600 flex items-center justify-center bg-slate-700`} style={{ width: `${colWidth}px` }}>{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-bold text-slate-200">{formatValue(total)}</span>)}</div> ); })}
                    </div>
                  </div>

                  {!isProjectCollapsed && project.modules.map((module, index) => {
                    const isModuleCollapsed = collapsedModules[module.id];
                    const moduleEditId = `module::${project.id}::${module.id}`;
                    const isEditingModule = editingId === moduleEditId;
                    const moduleType = module.type || ModuleType.Development;
                    const style = MODULE_TYPE_STYLES[moduleType];
                    const Icon = style.icon;

                    let moduleEarliestStartDate: string | null = null;
                    let moduleLatestEndDate: Date | null = null;
                    let moduleTotalDuration = 0;
                    
                    const allAssignments = module.tasks.flatMap(t => t.assignments);
                    if (allAssignments.length > 0) {
                        let earliestDateObj: Date | null = null;
                        
                        allAssignments.forEach(assignment => {
                            if (!assignment.startDate || !assignment.duration) return;
                            const startDate = new Date(assignment.startDate.replace(/-/g, '/'));
                            if (!earliestDateObj || startDate < earliestDateObj) {
                                earliestDateObj = startDate;
                            }
                            const resourceName = assignment.resourceName || 'Unassigned';
                            const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
                            const endDateStr = calculateEndDate(assignment.startDate!, assignment.duration, assignmentHolidaysMap);
                            const endDate = new Date(endDateStr.replace(/-/g, '/'));
                            if (!moduleLatestEndDate || endDate > moduleLatestEndDate) {
                                moduleLatestEndDate = endDate;
                            }
                        });
                        
                        if (earliestDateObj && moduleLatestEndDate) {
                            moduleEarliestStartDate = formatDateForInput(earliestDateObj);
                            moduleTotalDuration = calculateWorkingDaysBetween(moduleEarliestStartDate, formatDateForInput(moduleLatestEndDate), projectHolidayMap);
                        }
                    }

                    const { moduleStartIndex, moduleEndIndex } = (() => {
                        if (!moduleEarliestStartDate || !moduleLatestEndDate) return { moduleStartIndex: -1, moduleEndIndex: -1 };
                        
                        let startIdx = -1, endIdx = -1;
                        const modEndDateStr = formatDateForInput(moduleLatestEndDate);

                        if (viewMode === 'day') {
                            startIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === moduleEarliestStartDate!);
                            endIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === modEndDateStr);
                        } else if (viewMode === 'week') {
                            const startWeekId = getWeekIdFromDate(new Date(moduleEarliestStartDate!.replace(/-/g, '/')));
                            const endWeekId = getWeekIdFromDate(new Date(modEndDateStr.replace(/-/g, '/')));
                            startIdx = timeline.findIndex(c => c.id === startWeekId);
                            endIdx = timeline.findIndex(c => c.id === endWeekId);
                        } else if (viewMode === 'month') {
                            const startWeekId = getWeekIdFromDate(new Date(moduleEarliestStartDate!.replace(/-/g, '/')));
                            const endWeekId = getWeekIdFromDate(new Date(modEndDateStr.replace(/-/g, '/')));
                            startIdx = timeline.findIndex(c => c.weekIds?.includes(startWeekId));
                            endIdx = timeline.findIndex(c => c.weekIds?.includes(endWeekId));
                        }
                        return { moduleStartIndex: startIdx, moduleEndIndex: endIdx };
                    })();


                    return (
                      <div key={module.id} draggable={!isReadOnly} onDragStart={(e) => handleModuleDragStart(e, index)} onDragOver={handleModuleDragOver} onDrop={(e) => handleModuleDrop(e, project.id, module.id, index)} className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'module', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id }); }}>
                        <div className={`flex ${style.bgColor} border-b border-slate-100 ${style.hoverBgColor} transition-colors group relative h-[33px]`}>
                          <div className={`flex-shrink-0 py-1.5 px-3 pl-6 border-r border-slate-200 sticky left-0 ${style.bgColor} z-[${Z_SIDEBAR}] flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                            <div className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer" onClick={() => !isEditingModule && toggleModule(module.id)}>
                              {!isReadOnly && <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder"><GripVertical className="w-4 h-4" /></div>}
                               <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isReadOnly) return;
                                  const moduleTypes = Object.values(ModuleType);
                                  const currentTypeIndex = moduleTypes.indexOf(moduleType);
                                  const nextType = moduleTypes[(currentTypeIndex + 1) % moduleTypes.length];
                                  onUpdateModuleType(project.id, module.id, nextType);
                                }}
                                className="p-0.5 rounded-full hover:bg-black/10 transition-colors"
                                title={`Type: ${MODULE_TYPE_DISPLAY_NAMES[moduleType]}`}
                                disabled={isReadOnly}
                              >
                                <Icon className={`w-4 h-4 ${style.iconColor}`} />
                              </button>
                              {isModuleCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className={`w-4 h-4 ${style.iconColor}`} />}
                              {isEditingModule ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-800 text-xs font-semibold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" onClick={(e) => e.stopPropagation()} /> ) : ( <span className={`font-semibold text-xs ${style.textColor} truncate select-none flex-1 ${style.hoverTextColor}`} onDoubleClick={(e) => startEditing(moduleEditId, module.name, e)} title="Double click to rename">{module.name}</span> )}
                            </div>
                          </div>
                          
                          {/* Module Details Columns - z-39 */}
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                            {isModuleCollapsed && moduleEarliestStartDate && <span title="Earliest Start Date" className={`${style.ganttGridColor} rounded p-1`}>{moduleEarliestStartDate}</span>}
                          </div>
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                            {isModuleCollapsed && moduleTotalDuration > 0 && <span title="Total Duration" className={`${style.ganttGridColor} rounded p-1`}>{moduleTotalDuration}d</span>}
                          </div>
                          <div className={`flex-shrink-0 border-r border-slate-200 ${style.bgColor} ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>

                          <div className={`flex relative z-[${Z_GRID_CONTENT}]`}>
                             {isModuleCollapsed && displayMode === 'gantt' && moduleStartIndex > -1 && moduleEndIndex > -1 && (
                                <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-4 z-10 ${style.ganttBarColor} rounded-md flex items-center overflow-hidden`}
                                    style={{
                                        left: `${moduleStartIndex * colWidth + 2}px`,
                                        width: `${(moduleEndIndex - moduleStartIndex + 1) * colWidth - 4}px`,
                                    }}
                                    title={`Duration: ${moduleTotalDuration} working days`}
                                />
                             )}
                            {timeline.map(col => {
                                const total = getModuleTotal(module, col);
                                return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center ${style.bgColor} relative`} style={{ width: `${colWidth}px` }}>
                                    {total > 0 && displayMode === 'allocation' && (<span className={`text-[10px] font-bold ${style.totalTextColor} relative z-10`}>{formatValue(total)}</span>)}
                                </div> );
                            })}
                          </div>

                        </div>

                        {!isModuleCollapsed && module.tasks.map((task, taskIndex) => {
                          const taskEditId = `task::${project.id}::${module.id}::${task.id}`;
                          const isTaskCollapsed = collapsedTasks[task.id];
                          const isEditingTask = editingId === taskEditId;
                          let earliestStartDate: string | null = null;
                          let latestEndDate: Date | null = null;
                          let totalDuration = 0;

                          if (task.assignments.length > 0) {
                              let earliestDateObj: Date | null = null;
                              task.assignments.forEach(assignment => {
                                  if (!assignment.startDate || !assignment.duration) return;
                                  const startDate = new Date(assignment.startDate.replace(/-/g, '/'));
                                  if (!earliestDateObj || startDate < earliestDateObj) {
                                      earliestDateObj = startDate;
                                  }
                                  const resourceName = assignment.resourceName || 'Unassigned';
                                  const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
                                  const endDateStr = calculateEndDate(assignment.startDate!, assignment.duration, assignmentHolidaysMap);
                                  const endDate = new Date(endDateStr.replace(/-/g, '/'));
                                  if (!latestEndDate || endDate > latestEndDate) {
                                      latestEndDate = endDate;
                                  }
                              });
                              if (earliestDateObj && latestEndDate) {
                                  earliestStartDate = formatDateForInput(earliestDateObj);
                                  totalDuration = calculateWorkingDaysBetween(earliestStartDate, formatDateForInput(latestEndDate), projectHolidayMap);
                              }
                          }
                          
                          const { taskStartIndex, taskEndIndex } = (() => {
                                if (!earliestStartDate || !latestEndDate) return { taskStartIndex: -1, taskEndIndex: -1 };
                                let startIdx = -1, endIdx = -1;
                                const tEndDateStr = formatDateForInput(latestEndDate);
                                if (viewMode === 'day') {
                                    startIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === earliestStartDate);
                                    endIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === tEndDateStr);
                                } else if (viewMode === 'week') {
                                    const startWeekId = getWeekIdFromDate(new Date(earliestStartDate.replace(/-/g, '/')));
                                    const endWeekId = getWeekIdFromDate(new Date(tEndDateStr.replace(/-/g, '/')));
                                    startIdx = timeline.findIndex(c => c.id === startWeekId);
                                    endIdx = timeline.findIndex(c => c.id === endWeekId);
                                } else if (viewMode === 'month') {
                                    const startWeekId = getWeekIdFromDate(new Date(earliestStartDate.replace(/-/g, '/')));
                                    const endWeekId = getWeekIdFromDate(new Date(tEndDateStr.replace(/-/g, '/')));
                                    startIdx = timeline.findIndex(c => c.weekIds?.includes(startWeekId));
                                    endIdx = timeline.findIndex(c => c.weekIds?.includes(endWeekId));
                                }
                                return { taskStartIndex: startIdx, taskEndIndex: endIdx };
                          })();

                          return (
                            <React.Fragment key={task.id}>
                              <div draggable={!isReadOnly} onDragStart={(e) => handleTaskDragStart(e, project.id, module.id, taskIndex)} onDragOver={handleTaskDragOver} onDrop={(e) => handleTaskDrop(e, project.id, module.id, taskIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'task', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id }); }} className={`flex border-b border-slate-100 bg-slate-50 group/task ${draggedTask?.moduleId === module.id && draggedTask?.index === taskIndex ? 'opacity-30' : ''} h-[33px]`}>
                                <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-[${Z_SIDEBAR}] flex items-center justify-between pl-6 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingTask && toggleTask(task.id)}>
                                    {!isReadOnly && <div className="cursor-grab text-slate-400 hover:text-slate-600" title="Drag to reorder task"><GripVertical size={14} /></div>}
                                    {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                    {isEditingTask ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-[11px] font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="text-[11px] text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" title="Double click to rename" onDoubleClick={(e) => startEditing(taskEditId, task.name, e)}>{task.name}</span> )}
                                  </div>
                                  {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.EA)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add another resource to this task"><UserPlus size={14} /></button></div>}
                                </div>
                                
                                {/* Task Details Columns - z-34 */}
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                                  {isTaskCollapsed && earliestStartDate && <span title="Earliest Start Date" className="bg-slate-200/50 rounded p-1">{earliestStartDate}</span>}
                                </div>
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                                  {isTaskCollapsed && totalDuration > 0 && <span title="Total Duration" className="bg-slate-200/50 rounded p-1">{totalDuration}d</span>}
                                </div>
                                <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>

                                <div className={`flex relative z-[${Z_GRID_CONTENT}]`}>
                                    {isTaskCollapsed && displayMode === 'gantt' && taskStartIndex > -1 && taskEndIndex > -1 && (
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-4 z-10 bg-slate-400 rounded-md flex items-center overflow-hidden"
                                            style={{
                                                left: `${taskStartIndex * colWidth + 2}px`,
                                                width: `${(taskEndIndex - taskStartIndex + 1) * colWidth - 4}px`,
                                            }}
                                            title={`Duration: ${totalDuration} working days`}
                                        />
                                    )}
                                    {timeline.map(col => {
                                      const total = getTaskTotal(task, col);
                                      return ( <div key={`th-${task.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center bg-slate-50 relative`} style={{ width: `${colWidth}px` }}>
                                          {total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-semibold text-slate-600 relative z-10">{formatValue(total)}</span>)}
                                      </div> );
                                    })}
                                </div>
                              </div>

                              {!isTaskCollapsed && task.assignments.map((assignment, assignmentIndex) => {
                                const hasSchedule = assignment.startDate && assignment.duration && assignment.duration > 0;
                                let assignmentStartDate: Date | null = null;
                                let assignmentEndDate: Date | null = null;
                                let endDateStr = '';
                                
                                if (hasSchedule) {
                                  assignmentStartDate = new Date(assignment.startDate!.replace(/-/g, '/'));
                                  const resourceName = assignment.resourceName || 'Unassigned'; 
                                  const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); 
                                  const assignmentHolidaysMap = resourceHolidayData?.holidayMap || new Map<string, number>();
                                  endDateStr = calculateEndDate(assignment.startDate!, assignment.duration!, assignmentHolidaysMap);
                                  assignmentEndDate = new Date(endDateStr.replace(/-/g, '/'));
                                } else {
                                  // Fallback for display if no schedule
                                  assignmentStartDate = new Date();
                                }
                                
                                const { startIndex, endIndex } = (() => {
                                    if (!hasSchedule) return { startIndex: -1, endIndex: -1 };
                                    
                                    let startIdx = -1, endIdx = -1;
                                    if (viewMode === 'day') {
                                        const startDateStr = formatDateForInput(assignmentStartDate!);
                                        startIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === startDateStr);
                                        endIdx = timeline.findIndex(c => c.date && formatDateForInput(c.date) === endDateStr);
                                    } else if (viewMode === 'week') {
                                        const startWeekId = getWeekIdFromDate(assignmentStartDate!);
                                        const endWeekId = getWeekIdFromDate(assignmentEndDate!);
                                        startIdx = timeline.findIndex(c => c.id === startWeekId);
                                        endIdx = timeline.findIndex(c => c.id === endWeekId);
                                    } else if (viewMode === 'month') {
                                        const startWeekId = getWeekIdFromDate(assignmentStartDate!);
                                        const endWeekId = getWeekIdFromDate(assignmentEndDate!);
                                        startIdx = timeline.findIndex(c => c.weekIds?.includes(startWeekId));
                                        endIdx = timeline.findIndex(c => c.weekIds?.includes(endWeekId));
                                    }
                                    return { startIndex: startIdx, endIndex: endIdx };
                                })();


                                const possibleParents = allAssignmentsForDependencies.filter(parent => parent.id !== assignment.id && !isCircularDependency(assignment.id, parent.id)); 
                                const groupedParents = possibleParents.reduce((acc, parent) => { if (!acc[parent.groupLabel]) acc[parent.groupLabel] = []; acc[parent.groupLabel].push(parent); return acc; }, {} as Record<string, typeof possibleParents>);
                                const isEditingDuration = editingId === `duration::${assignment.id}`; 
                                const roleStyle = getRoleStyle(assignment.role);
                                const currentRowIndex = gridRowIndex++;

                                return (
                                <div key={assignment.id} className={`flex border-b border-slate-100 group/assign ${draggedAssignment?.taskId === task.id && draggedAssignment?.index === assignmentIndex ? 'opacity-30' : ''} ${datePickerState.assignmentId === assignment.id ? 'relative z-[40]' : ''} h-[33px]`} draggable={!isReadOnly} onDragStart={(e) => handleAssignmentDragStart(e, task.id, assignmentIndex)} onDragOver={handleAssignmentDragOver} onDrop={(e) => handleAssignmentDrop(e, project.id, module.id, task.id, assignmentIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'assignment', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id, assignmentId: assignment.id }); }}>
                                  <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-[${Z_SIDEBAR}] flex items-center justify-between border-l-[3px] ${roleStyle.border} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                    <div className="flex-1 overflow-hidden flex items-center gap-2 pl-12">
                                      <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="w-full text-[11px] text-slate-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-600 disabled:cursor-default disabled:hover:text-slate-600">
                                          <option value="Unassigned">Unassigned</option>
                                          {Object.entries(groupedResources).map(([category, resList]) => ( <optgroup label={category} key={category}>{(resList as Resource[]).map(r => <option key={r.id} value={r.name}>{r.name} {r.type === 'External' ? '(Ext.)' : ''}</option>)}</optgroup> ))}
                                      </select>
                                    </div>
                                  </div>
                                  
                                  {/* Assignment Details Columns - Increased Z-Index to prevent overlap with Gantt bars */}
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center px-2 py-1.5 relative group-hover/assign:bg-slate-50 ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]` : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                                    {assignment.startDate ? (
                                        <div className="relative group/date">
                                            <button 
                                                onClick={() => !isReadOnly && setDatePickerState({ assignmentId: assignment.id })} 
                                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-slate-100 ${isReadOnly ? 'cursor-default' : ''}`}
                                            >
                                                {assignment.startDate}
                                            </button>
                                            {datePickerState.assignmentId === assignment.id && (
                                                <div ref={datePickerContainerRef} className="absolute top-full left-0 mt-1 z-50">
                                                    <DatePicker 
                                                        value={new Date(assignment.startDate.replace(/-/g, '/'))} 
                                                        onChange={(date) => {
                                                            handleAssignmentStartDateChange(assignment, formatDateForInput(date));
                                                            setDatePickerState({ assignmentId: null });
                                                        }} 
                                                        onClose={() => setDatePickerState({ assignmentId: null })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-300">-</span>
                                    )}
                                  </div>
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-center ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                                    {isEditingDuration ? (
                                        <input 
                                            ref={editInputRef} 
                                            type="number" 
                                            value={editValue} 
                                            onChange={(e) => setEditValue(e.target.value)} 
                                            onBlur={() => saveDuration(assignment)} 
                                            onKeyDown={(e) => { if(e.key === 'Enter') saveDuration(assignment); else if(e.key === 'Escape') setEditingId(null); }}
                                            className="w-10 text-[10px] text-center border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                            autoFocus
                                        />
                                    ) : (
                                        <span 
                                            className={`text-[10px] font-mono px-1 rounded cursor-pointer ${!isReadOnly && 'hover:bg-slate-100'}`}
                                            onClick={(e) => !isReadOnly && startEditing(`duration::${assignment.id}`, assignment.duration?.toString() || '0', e)}
                                        >
                                            {assignment.duration || 0}d
                                        </span>
                                    )}
                                  </div>

                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-center px-1 overflow-hidden relative group/dep ${isDetailsFrozen ? `sticky z-[${Z_DETAILS}]` : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}>
                                     {assignment.parentAssignmentId ? (
                                         <div className="flex items-center gap-1 w-full" title={`Depends on: ${allAssignmentsMap.get(assignment.parentAssignmentId)?.resourceName || 'Unknown'}`}>
                                            <Link2 size={10} className="text-indigo-500 flex-shrink-0" />
                                            <span className="text-[9px] text-slate-500 truncate flex-1">
                                                {allAssignmentsMap.get(assignment.parentAssignmentId)?.resourceName || '...'}
                                            </span>
                                            {!isReadOnly && <button onClick={() => onUpdateAssignmentDependency(assignment.id, null)} className="opacity-0 group-hover/dep:opacity-100 p-0.5 hover:text-red-500 rounded"><Trash2 size={8}/></button>}
                                         </div>
                                     ) : (
                                         !isReadOnly && (
                                            <div className="opacity-0 group-hover/dep:opacity-100 w-full flex justify-center">
                                                <select 
                                                    className="w-4 h-4 opacity-0 absolute inset-0 cursor-pointer" 
                                                    value="" 
                                                    onChange={(e) => onUpdateAssignmentDependency(assignment.id, e.target.value)}
                                                >
                                                    <option value="">Add Dependency...</option>
                                                    {Object.entries(groupedParents).map(([group, opts]) => (
                                                        <optgroup key={group} label={group}>
                                                            {(opts as typeof possibleParents).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                        </optgroup>
                                                    ))}
                                                </select>
                                                <Link2 size={10} className="text-slate-300 hover:text-indigo-500" />
                                            </div>
                                         )
                                     )}
                                  </div>

                                  <div className={`flex relative z-[${Z_GRID_CONTENT}]`}>
                                    {displayMode === 'gantt' && startIndex > -1 && endIndex > -1 && hasSchedule && (
                                        <>
                                            {/* Progress Bar Background */}
                                            <div
                                                className={`absolute top-1.5 h-4 z-20 ${roleStyle.bar} rounded flex items-center overflow-hidden transition-all duration-300 group/bar`}
                                                style={{
                                                    left: `${startIndex * colWidth + 2}px`,
                                                    width: `${(endIndex - startIndex + 1) * colWidth - 4}px`,
                                                }}
                                                title={`${assignment.role} - ${assignment.resourceName}\nDuration: ${assignment.duration} days\n${formatDateForInput(assignmentStartDate!)} -> ${endDateStr}`}
                                            >
                                                {/* Actual Progress Fill */}
                                                <div 
                                                    className={`h-full ${roleStyle.fill} transition-all duration-300`} 
                                                    style={{ width: `${assignment.progress || 0}%` }}
                                                ></div>
                                                
                                                {/* Percentage Text (visible on hover) */}
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/90 font-bold opacity-0 group-hover/bar:opacity-100 drop-shadow-md select-none pointer-events-none">
                                                    {assignment.progress || 0}%
                                                </span>

                                                {/* Progress Adjuster (Invisible Slider) */}
                                                {!isReadOnly && <input 
                                                    type="range" 
                                                    min="0" 
                                                    max="100" 
                                                    step="5"
                                                    value={assignment.progress || 0} 
                                                    onChange={(e) => onUpdateAssignmentProgress && onUpdateAssignmentProgress(assignment.id, parseInt(e.target.value))}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-e-resize z-20"
                                                    title="Drag to adjust progress"
                                                />}
                                            </div>
                                            {/* Label next to bar */}
                                            <div 
                                                className="absolute top-1.5 h-4 z-20 flex items-center pl-1 pointer-events-none"
                                                style={{
                                                    left: `${(endIndex + 1) * colWidth}px`,
                                                }}
                                            >
                                                <span className="text-[9px] text-slate-400 whitespace-nowrap">{assignment.resourceName}</span>
                                            </div>
                                        </>
                                    )}

                                    {timeline.map(col => {
                                      const isCurrent = isCurrentColumn(col);
                                      const rawValue = getRawCellValue(assignment, col);
                                      let isHKHoliday = false;
                                      let holidayName: string | any = '';

                                      if (viewMode === 'day' && col.date) {
                                          const dateStr = formatDateForInput(col.date);
                                          const resourceName = assignment.resourceName || 'Unassigned';
                                          const resourceData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned');
                                          const hol = resourceData?.holidays.find((h: any) => h.date === dateStr);
                                          if (hol) {
                                              isHKHoliday = true;
                                              holidayName = hol; // Pass the whole object for advanced rendering in Input
                                          }
                                      }

                                      return (
                                        <GridNumberInput
                                          key={`${assignment.id}-${col.id}`}
                                          value={rawValue}
                                          onChange={(val) => handleCellUpdate(project.id, module.id, task.id, assignment.id, col, val)}
                                          onNavigate={(dir) => handleNavigate(dir, currentRowIndex, timeline.indexOf(col))}
                                          rowIndex={currentRowIndex}
                                          colIndex={timeline.indexOf(col)}
                                          width={colWidth}
                                          holidayDuration={isHKHoliday ? (typeof holidayName === 'object' ? holidayName.duration : 1) : 0}
                                          isCurrent={isCurrent}
                                          holidayName={holidayName}
                                          disabled={isReadOnly || isHKHoliday && (typeof holidayName === 'object' ? holidayName.duration === 1 : true) || displayMode === 'gantt'}
                                        />
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })}
                  
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <div className="fixed bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-50 text-sm min-w-[160px] animate-in fade-in zoom-in-95 duration-100" style={{ top: contextMenu.y, left: contextMenu.x }}>
            {contextMenu.type === 'project' && (
              <>
                <button onClick={() => { onAddModule(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} /> Add Module</button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button onClick={() => { onDeleteProject(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Project</button>
              </>
            )}
            {contextMenu.type === 'module' && contextMenu.moduleId && (
              <>
                <button onClick={() => { handleAddTaskClick(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} /> Add Task</button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button onClick={() => { onDeleteModule(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Module</button>
              </>
            )}
            {contextMenu.type === 'task' && contextMenu.moduleId && contextMenu.taskId && (
              <>
                 <button onClick={() => { onAddAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, Role.EA); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><UserPlus size={14} /> Add Assignment</button>
                 <div className="h-px bg-slate-100 my-1"></div>
                 <button onClick={() => { onDeleteTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Task</button>
              </>
            )}
            {contextMenu.type === 'assignment' && contextMenu.moduleId && contextMenu.taskId && contextMenu.assignmentId && (
               <>
                 <button onClick={() => { onCopyAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, contextMenu.assignmentId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Copy size={14} /> Duplicate</button>
                 <div className="h-px bg-slate-100 my-1"></div>
                 <div className="px-3 py-1 text-xs text-slate-400 font-bold uppercase">Shift Timeline</div>
                 <button onClick={() => { onShiftTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, 'left'); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><ChevronLeft size={14} /> Shift -1 Week</button>
                 <button onClick={() => { onShiftTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, 'right'); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><ChevronRight size={14} /> Shift +1 Week</button>
                 <div className="h-px bg-slate-100 my-1"></div>
                 <button onClick={() => { onDeleteAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, contextMenu.assignmentId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Remove Assignment</button>
               </>
            )}
          </div>
        )}
      </div>
    </>
  );
};
