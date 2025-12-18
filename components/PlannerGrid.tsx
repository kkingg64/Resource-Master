
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ResourceAllocation, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { getTimeline, GOV_HOLIDAYS_DB, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, GripVertical, Plus, UserPlus, Folder, Settings2, Trash2, Download, Upload, History, RefreshCw, CheckCircle, AlertTriangle, RotateCw, ChevronsDownUp, Copy, Pin, PinOff, Link, Link2, EyeOff, Eye, LayoutList, CalendarRange, Percent, ChevronLeft, Gem, ShieldCheck, Rocket, Server } from 'lucide-react';
import * as XLSX from 'xlsx';
import { DependencyLines } from './DependencyLines';

// --- Custom DatePicker Component ---
interface DatePickerProps {
  value: Date;
  onChange: (newDate: Date) => void;
  onClose: () => void;
}

const MONTH_NAMES_DP = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES_DP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DatePicker: React.FC<DatePickerProps> = ({ value, onChange, onClose }) => {
  const [viewDate, setViewDate] = useState(new Date(value.getFullYear(), value.getMonth(), 1));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Previous month's days
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthDays - i);
        days.push({ date, isCurrentMonth: false });
    }
    
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        days.push({ date, isCurrentMonth: true });
    }

    // Next month's days
    const remaining = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= remaining; i++) {
        const date = new Date(year, month + 1, i);
        days.push({ date, isCurrentMonth: false });
    }
    
    return days;
  }, [viewDate]);

  const changeMonth = (amount: number) => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
  };
  
  const handleDayClick = (day: { date: Date, isCurrentMonth: boolean }) => {
    onChange(day.date);
    onClose();
  };

  return (
    <div className="bg-white rounded-lg shadow-2xl border border-slate-200 p-3 w-72 animate-in fade-in zoom-in-95">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-slate-100 text-slate-500"><ChevronLeft size={20} /></button>
        <div className="font-semibold text-sm text-slate-700">
          {MONTH_NAMES_DP[viewDate.getMonth()]} {viewDate.getFullYear()}
        </div>
        <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-slate-100 text-slate-500"><ChevronRight size={20} /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs text-slate-500 font-medium mb-2">
        {DAY_NAMES_DP.map(day => <div key={day}>{day.slice(0, 1)}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {calendarGrid.map((day, i) => {
          const isSelected = day.date.getTime() === new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
          const isToday = day.date.getTime() === today.getTime();

          return (
            <button 
              key={i}
              onClick={() => handleDayClick(day)}
              className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors
                ${!day.isCurrentMonth ? 'text-slate-300' : 'text-slate-700'}
                ${day.isCurrentMonth && !isSelected ? 'hover:bg-slate-100' : ''}
                ${isToday && !isSelected ? 'border border-indigo-300' : ''}
                ${isSelected ? 'bg-indigo-600 text-white font-bold hover:bg-indigo-700' : ''}
              `}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};


interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  resources: Resource[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number, dayDate?: string) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, name: string) => void;
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
  onUpdateAssignmentProgress?: (assignmentId: string, progress: number) => void;
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

const SaveStatusIndicator: React.FC<{ status: PlannerGridProps['saveStatus'] }> = ({ status }) => {
  const statusConfig = {
    saving: { icon: <RotateCw size={14} className="animate-spin" />, text: 'Saving...', style: 'text-slate-600 bg-slate-100' },
    success: { icon: <CheckCircle size={14} />, text: 'Saved!', style: 'text-green-700 bg-green-100' },
    error: { icon: <AlertTriangle size={14} />, text: 'Error!', style: 'text-red-700 bg-red-100' },
    idle: { icon: <CheckCircle size={14} />, text: 'Up to date', style: 'text-slate-500 bg-white' },
  };
  
  const current = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-all ${current.style}`}>
      {current.icon}
      <span>{current.text}</span>
    </div>
  );
};

// --- Helper Component for Inputs with Navigation ---
interface GridNumberInputProps {
  value: number;
  onChange: (val: string) => void;
  onNavigate: (dir: string, r: number, c: number) => void;
  rowIndex: number;
  colIndex: number;
  width: number;
  isHoliday: boolean;
  isCurrent: boolean;
  holidayName?: string | any;
  disabled?: boolean;
}

const GridNumberInput: React.FC<GridNumberInputProps> = ({ value, onChange, onNavigate, rowIndex, colIndex, width, isHoliday, isCurrent, holidayName, disabled }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : String(value));
  const [isEditing, setIsEditing] = useState(false);

  // Sync with prop value only when not editing to allow free typing
  useEffect(() => {
      if (!isEditing) {
          setLocalValue(value === 0 ? '' : String(value));
      }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(e.target.value);
  };

  const commit = () => {
      onChange(localValue);
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          commit();
          onNavigate(e.key, rowIndex, colIndex);
      }
      if (e.key === 'Enter') {
          e.currentTarget.blur();
      }
  };

  return (
      <div 
          className={`flex-shrink-0 border-r border-slate-100 relative ${isHoliday ? 'bg-[repeating-linear-gradient(45deg,theme(colors.red.50),theme(colors.red.50)_5px,theme(colors.red.100)_5px,theme(colors.red.100)_10px)]' : isCurrent ? 'bg-amber-100 ring-1 ring-inset ring-amber-300' : ''}`} 
          style={{ width: `${width}px` }}
          title={typeof holidayName === 'string' ? holidayName : holidayName?.name}
      >
          {isHoliday && holidayName ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold text-red-700 select-none">
                {'country' in (holidayName as any) ? (holidayName as any).country : 'AL'}
              </div>
          ) : disabled ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-medium">
                {localValue}
              </div>
          ) : (
              <input 
                  type="text"
                  data-r={rowIndex}
                  data-c={colIndex}
                  data-grid="planner"
                  className={`w-full h-full text-center text-[10px] focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-0 transition-colors
                      ${(localValue && localValue !== '0') ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-400 hover:bg-slate-50/50'}
                  `}
                  value={localValue}
                  placeholder="-"
                  onChange={handleChange}
                  onBlur={commit}
                  onFocus={(e) => { setIsEditing(true); e.target.select(); }}
                  onKeyDown={handleKeyDown}
                  disabled={disabled}
              />
          )}
      </div>
  );
};


// Explicit Color Map to prevent Tailwind purging
const ROLE_STYLES: Record<string, { border: string, bg: string, bar: string, fill: string }> = {
  [Role.DEV]: { border: 'border-l-blue-500', bg: 'bg-blue-50', bar: 'bg-blue-200', fill: 'bg-blue-600' },
  [Role.BRAND_SOLUTIONS]: { border: 'border-l-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-200', fill: 'bg-orange-600' },
  [Role.PLM_D365]: { border: 'border-l-green-500', bg: 'bg-green-50', bar: 'bg-green-200', fill: 'bg-green-600' },
  [Role.BA]: { border: 'border-l-purple-500', bg: 'bg-purple-50', bar: 'bg-purple-200', fill: 'bg-purple-600' },
  [Role.APP_SUPPORT]: { border: 'border-l-red-500', bg: 'bg-red-50', bar: 'bg-red-200', fill: 'bg-red-600' },
  [Role.DM]: { border: 'border-l-yellow-500', bg: 'bg-yellow-50', bar: 'bg-yellow-200', fill: 'bg-yellow-600' },
  [Role.COE]: { border: 'border-l-cyan-500', bg: 'bg-cyan-50', bar: 'bg-cyan-200', fill: 'bg-cyan-600' },
  [Role.EA]: { border: 'border-l-pink-500', bg: 'bg-pink-50', bar: 'bg-pink-200', fill: 'bg-pink-600' },
  [Role.PREP_DEV]: { border: 'border-l-teal-500', bg: 'bg-teal-50', bar: 'bg-teal-200', fill: 'bg-teal-600' },
  [Role.CNF]: { border: 'border-l-slate-500', bg: 'bg-slate-50', bar: 'bg-slate-200', fill: 'bg-slate-600' },
  'default': { border: 'border-l-slate-400', bg: 'bg-slate-50', bar: 'bg-slate-200', fill: 'bg-slate-500' }
};

const getRoleStyle = (role: Role) => ROLE_STYLES[role] || ROLE_STYLES['default'];

const MODULE_TYPE_STYLES = {
  [ModuleType.Development]: {
    icon: Layers,
    iconColor: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    hoverBgColor: 'hover:bg-indigo-100/50',
    textColor: 'text-slate-800',
    hoverTextColor: 'hover:text-indigo-600',
    ganttBarColor: 'bg-indigo-400',
    ganttGridColor: 'bg-indigo-200',
    totalTextColor: 'text-indigo-900',
  },
  [ModuleType.Preparation]: {
    icon: Gem,
    iconColor: 'text-amber-600',
    bgColor: 'bg-amber-100',
    hoverBgColor: 'hover:bg-amber-200/50',
    textColor: 'text-amber-900',
    hoverTextColor: 'hover:text-amber-700',
    ganttBarColor: 'bg-amber-500',
    ganttGridColor: 'bg-amber-200',
    totalTextColor: 'text-amber-900',
  },
  [ModuleType.PostDevelopment]: {
    icon: ShieldCheck,
    iconColor: 'text-teal-600',
    bgColor: 'bg-teal-100',
    hoverBgColor: 'hover:bg-teal-200/50',
    textColor: 'text-teal-900',
    hoverTextColor: 'hover:text-teal-700',
    ganttBarColor: 'bg-teal-500',
    ganttGridColor: 'bg-teal-200',
    totalTextColor: 'text-teal-900',
  },
  [ModuleType.MVP]: {
    icon: Rocket,
    iconColor: 'text-sky-600',
    bgColor: 'bg-sky-100',
    hoverBgColor: 'hover:bg-sky-200/50',
    textColor: 'text-sky-900',
    hoverTextColor: 'hover:text-sky-700',
    ganttBarColor: 'bg-sky-500',
    ganttGridColor: 'bg-sky-200',
    totalTextColor: 'text-sky-900',
  },
  [ModuleType.Production]: {
    icon: Server,
    iconColor: 'text-slate-600',
    bgColor: 'bg-slate-100',
    hoverBgColor: 'hover:bg-slate-200/50',
    textColor: 'text-slate-900',
    hoverTextColor: 'hover:text-slate-700',
    ganttBarColor: 'bg-slate-500',
    ganttGridColor: 'bg-slate-200',
    totalTextColor: 'text-slate-900',
  },
};


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
  isReadOnly = false,
}) => {
  // --- Persistent State Initialization ---
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_projects');
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_modules');
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_tasks');
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // --- Persistence Effects ---
  useEffect(() => {
    localStorage.setItem('oms_collapsed_projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);

  useEffect(() => {
    localStorage.setItem('oms_collapsed_modules', JSON.stringify(collapsedModules));
  }, [collapsedModules]);

  useEffect(() => {
    localStorage.setItem('oms_collapsed_tasks', JSON.stringify(collapsedTasks));
  }, [collapsedTasks]);


  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [displayMode, setDisplayMode] = useState<'allocation' | 'gantt'>('allocation');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null);
  const [draggedTask, setDraggedTask] = useState<{ moduleId: string, index: number } | null>(null);
  const [draggedAssignment, setDraggedAssignment] = useState<{ taskId: string, index: number } | null>(null);
  
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [userHasResizedSidebar, setUserHasResizedSidebar] = useState(false);
  const [startColWidth, setStartColWidth] = useState(95);
  const [durationColWidth, setDurationColWidth] = useState(50);
  const [dependencyColWidth, setDependencyColWidth] = useState(50);

  const [colWidthBase, setColWidthBase] = useState(20);
  const [isDetailsFrozen, setIsDetailsFrozen] = useState(true);
  
  const [showToggleMenu, setShowToggleMenu] = useState(false);

  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'project' | 'module' | 'task' | 'assignment';
    projectId: string; 
    moduleId?: string; 
    taskId?: string; 
    assignmentId?: string; 
  } | null>(null);

  const [datePickerState, setDatePickerState] = useState<{ assignmentId: string | null }>({ assignmentId: null });
  
  const importInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerContainerRef = useRef<HTMLDivElement>(null);

  // --- Performance: Ghost Resize Refs ---
  const resizeGhostRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeData = useRef({ col: '', startX: 0, startWidth: currentWidth: 0 });

  // Use a consistent project-level holiday calendar (HK) for duration calculations.
  const projectHolidaySet = useMemo(() => new Set(
    holidays.filter(h => h.country === 'HK').map(h => h.date)
  ), [holidays]);

  // Auto-fit sidebar width based on longest text
  useEffect(() => {
    if (userHasResizedSidebar) return;
    if (!projects || projects.length === 0) return;

    const calculateOptimalWidth = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return 350; // Fallback

        // Font settings matching UI (Inter, text-xs/12px)
        context.font = 'bold 12px Inter, ui-sans-serif, system-ui, sans-serif'; 

        let maxPixelWidth = 200; // Minimum start width

        projects.forEach(p => {
            // Project row padding: ~60px (icons, gap, chevron)
            const pWidth = context.measureText(p.name).width + 60; 
            if (pWidth > maxPixelWidth) maxPixelWidth = pWidth;

            p.modules.forEach(m => {
                // Module row padding: ~80px (indent, icons, gap)
                const mWidth = context.measureText(m.name).width + 80; 
                if (mWidth > maxPixelWidth) maxPixelWidth = mWidth;

                m.tasks.forEach(t => {
                    // Task row padding: ~100px (indent, icons, gap)
                    const tWidth = context.measureText(t.name).width + 100; 
                    if (tWidth > maxPixelWidth) maxPixelWidth = tWidth;
                });
            });
        });
        
        // Add a small breathing room
        maxPixelWidth += 20;

        // Clamp values
        return Math.min(Math.max(250, maxPixelWidth), 600);
    };

    setSidebarWidth(calculateOptimalWidth());
  }, [projects, userHasResizedSidebar]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      // Only select content if it's a text input or the duration number input
      if (editInputRef.current.type === 'text' || editInputRef.current.type === 'number') {
        editInputRef.current.select();
      }
    }
  }, [editingId]);

  useEffect(() => {
    const handleClick = () => {
        setContextMenu(null);
        setShowToggleMenu(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!datePickerState.assignmentId) return;

    const handleClickOutside = (event: MouseEvent) => {
        if (datePickerContainerRef.current && !datePickerContainerRef.current.contains(event.target as Node)) {
             setDatePickerState({ assignmentId: null });
        }
    };
    
    // Use timeout to avoid closing immediately on the same click that opened it
    setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [datePickerState.assignmentId]);

  const toggleProject = (id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTask = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const handleToggleModules = () => {
    const allModuleIds = projects.flatMap(p => p.modules.map(m => m.id));
    const areSomeCollapsed = allModuleIds.some(id => collapsedModules[id]);
    const newCollapsedState = areSomeCollapsed ? {} : allModuleIds.reduce((acc, id) => ({ ...acc, [id]: true }), {});
    setCollapsedModules(newCollapsedState);
  };

  const handleToggleResources = () => {
    const allTaskIds = projects.flatMap(p => p.modules.flatMap(m => m.tasks.map(t => t.id)));
    const areSomeCollapsed = allTaskIds.some(id => collapsedTasks[id]);
    const newCollapsedState = areSomeCollapsed ? {} : allTaskIds.reduce((acc, id) => ({ ...acc, [id]: true }), {});
    setCollapsedTasks(newCollapsedState);
  };
  
  // --- Optimized Resize Handlers (Ghost Resize) ---
  const handleResizeStart = (col: string, currentWidth: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeData.current = { col, startX: e.clientX, startWidth: currentWidth };
    
    if (resizeGhostRef.current) {
        resizeGhostRef.current.style.display = 'block';
        resizeGhostRef.current.style.left = `${e.clientX}px`;
    }
    
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      if (resizeGhostRef.current) {
          resizeGhostRef.current.style.left = `${e.clientX}px`;
      }
  };

  const handleResizeEnd = (e: MouseEvent) => {
      if (!isResizing.current) return;
      isResizing.current = false;
      
      const delta = e.clientX - resizeData.current.startX;
      const newWidth = resizeData.current.startWidth + delta;
      const col = resizeData.current.col;

      if (col === 'sidebar') {
          setSidebarWidth(Math.max(200, Math.min(600, newWidth)));
          setUserHasResizedSidebar(true);
      }
      if (col === 'start') setStartColWidth(Math.max(80, Math.min(200, newWidth)));
      if (col === 'duration') setDurationColWidth(Math.max(40, Math.min(150, newWidth)));
      if (col === 'dependency') setDependencyColWidth(Math.max(40, Math.min(400, newWidth)));

      if (resizeGhostRef.current) resizeGhostRef.current.style.display = 'none';
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
  };

  const resourceHolidaysMap = useMemo(() => {
    const map = new Map<string, { holidays: (Omit<Holiday, 'id'> | IndividualHoliday)[], dateSet: Set<string> }>();
    
    const availableRegions = Array.from(new Set(holidays.map(h => h.country)));
    const defaultRegion = availableRegions.includes('HK') ? 'HK' : availableRegions[0];
    const defaultHolidays = defaultRegion ? holidays.filter(h => h.country === defaultRegion) : [];
    
    map.set('Unassigned', {
        holidays: defaultHolidays,
        dateSet: new Set(defaultHolidays.map(h => h.date))
    });

    resources.forEach(resource => {
        const regional = resource.holiday_region 
            ? holidays.filter(h => h.country === resource.holiday_region)
            : [];
            
        const individual = resource.individual_holidays || [];
        const allHolidays = [...regional, ...individual];
        map.set(resource.name, {
            holidays: allHolidays,
            dateSet: new Set(allHolidays.map(h => h.date))
        });
    });
    return map;
  }, [resources, holidays]);

  const groupedResources = useMemo(() => {
    return resources.reduce((acc, resource) => {
      const category = resource.category || 'Uncategorized';
      if (!acc[category]) acc[category] = [];
      acc[category].push(resource);
      return acc;
    }, {} as Record<string, Resource[]>);
  }, [resources]);

  const allAssignmentsMap = useMemo(() => {
    const map = new Map<string, TaskAssignment>();
    projects.forEach(p => p.modules.forEach(m => m.tasks.forEach(t => t.assignments.forEach(a => map.set(a.id, a)))));
    return map;
  }, [projects]);

  const allAssignmentsForDependencies = useMemo(() => {
    const flatList: { id: string; name: string; parentAssignmentId?: string; groupLabel: string }[] = [];
    projects.forEach(p => {
      p.modules.forEach(m => {
        const groupLabel = `📦 ${m.name}  (Project: ${p.name})`;
        m.tasks.forEach(t => {
          t.assignments.forEach(a => {
            flatList.push({
              id: a.id,
              name: `${t.name} • ${a.resourceName || 'Unassigned'}`,
              parentAssignmentId: a.parentAssignmentId,
              groupLabel
            });
          });
        });
      });
    });
    return flatList;
  }, [projects]);

  const isCircularDependency = (childId: string, potentialParentId: string | null): boolean => {
    let currentId = potentialParentId;
    const visited = new Set<string>();
    while (currentId && !visited.has(currentId)) {
        visited.add(currentId);
        if (currentId === childId) return true;
        const parent = allAssignmentsMap.get(currentId);
        currentId = parent?.parentAssignmentId || null;
    }
    return false;
  };


  const startEditing = (id: string, initialValue: string, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditingId(id);
    setEditValue(initialValue);
  };

  const saveEdit = () => {
    if (!editingId || isReadOnly) return;
    const [type, ...parts] = editingId.split('::');

    if (type === 'project') {
      const [projectId] = parts;
      onUpdateProjectName(projectId, editValue);
    } else if (type === 'module') {
      const [projectId, moduleId] = parts;
      onUpdateModuleName(projectId, moduleId, editValue);
    } else if (type === 'task') {
      const [projectId, moduleId, taskId] = parts;
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

  const handleExportExcel = () => {
    const planData: any[] = [];
    const weekHeaders = getTimeline('week', timelineStart, timelineEnd).map(w => w.id);
    projects.forEach(p => {
      p.modules.forEach(m => {
        m.tasks.forEach(t => {
          t.assignments.forEach(a => {
            const row: any = { 'Project': p.name, 'Module': m.name, 'Task': t.name, 'Role': a.role, 'Resource': a.resourceName || 'Unassigned' };
            a.allocations.forEach(alloc => { if (weekHeaders.includes(alloc.weekId)) { row[alloc.weekId] = alloc.count; } });
            planData.push(row);
          });
        });
      });
    });
    const wb = XLSX.utils.book_new();
    const planWs = XLSX.utils.json_to_sheet(planData, { header: ['Project', 'Module', 'Task', 'Role', 'Resource', ...weekHeaders] });
    XLSX.utils.book_append_sheet(wb, planWs, 'Resource Plan');
    XLSX.writeFile(wb, `oms-resource-plan-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const planSheet = workbook.Sheets['Resource Plan'];
        if (!planSheet) throw new Error('Resource Plan sheet not found');
        const planJson = XLSX.utils.sheet_to_json<any>(planSheet);
        const importedProjects: Project[] = [];
        let currentProject: Project | null = null;
        let currentModule: ProjectModule | null = null;
        let currentTask: ProjectTask | null = null;
        planJson.forEach((row, index) => {
            if (row.Project && row.Project !== currentProject?.name) { currentProject = { id: `p-${index}`, name: row.Project, modules: [] }; importedProjects.push(currentProject); currentModule = null; currentTask = null; }
            if (!currentProject) return;
            if (row.Module && row.Module !== currentModule?.name) { currentModule = { id: `m-${index}`, name: row.Module, tasks: [], functionPoints: 0, legacyFunctionPoints: 0 }; currentProject.modules.push(currentModule); currentTask = null; }
            if (!currentModule) return;
            if (row.Task && row.Task !== currentTask?.name) { currentTask = { id: `t-${index}`, name: row.Task, assignments: [] }; currentModule.tasks.push(currentTask); }
            if (!currentTask) return;
            const allocations: { weekId: string, count: number }[] = [];
            Object.keys(row).forEach(key => { if (/^\d{4}-\d{2}$/.test(key)) { allocations.push({ weekId: key, count: Number(row[key]) }); } });
            const assignment: TaskAssignment = { id: `a-${index}`, role: row.Role as Role, resourceName: row.Resource, allocations };
            currentTask.assignments.push(assignment);
        });
        if (window.confirm('This will overwrite your current plan. Are you sure?')) { onImportPlan(importedProjects, []); }
      } catch (error: any) { alert(`Failed to import plan: ${error.message}`); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
  };

  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);

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

  const yearHeaders = useMemo(() => {
    return timeline.reduce((acc, col) => {
      const key = col.yearLabel;
      if (!acc[key]) acc[key] = { label: key, colspan: 0 };
      acc[key].colspan++;
      return acc;
    }, {} as Record<string, { label: string, colspan: number }>);
  }, [timeline]);

  const monthHeaders = useMemo(() => {
    return timeline.reduce((acc, col) => {
      const key = col.monthLabel;
      if (!acc[key]) acc[key] = { label: key.split(' ')[0], colspan: 0 };
      acc[key].colspan++;
      return acc;
    }, {} as Record<string, { label: string, colspan: number }>);
  }, [timeline]);

  const getRoleColorClass = (role: Role) => {
    const style = getRoleStyle(role);
    return style.border;
  };

  const getRawCellValue = (assignment: TaskAssignment, col: TimelineColumn): number => {
    const resourceName = assignment.resourceName || 'Unassigned';
    const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned');

    if (viewMode === 'day') {
        if (!col.date) return 0;
        const dateStr = formatDateForInput(col.date);
        if (resourceHolidayData?.dateSet.has(dateStr)) return 0;
    }

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
      if (!col.parentWeekId || !col.date) return 0;
      
      const alloc = assignment.allocations.find(a => a.weekId === col.parentWeekId);
      if (!alloc) return 0;

      const dateStr = formatDateForInput(col.date);
      if (alloc.days && alloc.days[dateStr] !== undefined) {
          return alloc.days[dateStr];
      }
      if (alloc.count > 0 && Object.keys(alloc.days || {}).length === 0) {
          const weekdaysInWeek = 5; // simplified
          return alloc.count / weekdaysInWeek;
      }
      return 0;
    }
    return 0;
  };

  const formatValue = (val: number): string => {
    if (val === 0) return '';
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  const getTaskTotal = (task: ProjectTask, col: TimelineColumn) => task.assignments.reduce((sum, assign) => sum + getRawCellValue(assign, col), 0);
  const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => module.tasks.reduce((sum, task) => sum + getTaskTotal(task, col), 0);
  const getProjectTotal = (project: Project, col: TimelineColumn) => project.modules.reduce((sum, module) => sum + getModuleTotal(module, col), 0);

  const handleCellUpdate = (projectId: string, moduleId: string, taskId: string, assignmentId: string, col: TimelineColumn, value: string) => {
    if (isReadOnly) return;
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue)) return;

    if (viewMode === 'week') {
      onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.id, numValue);
    } else if (viewMode === 'month') {
       if (!col.weekIds || col.weekIds.length === 0) return;
       const valuePerWeek = numValue / col.weekIds.length;
       col.weekIds.forEach(weekId => {
         onUpdateAllocation(projectId, moduleId, taskId,