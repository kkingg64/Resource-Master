
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ResourceAllocation, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { getTimeline, GOV_HOLIDAYS_DB, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween, calculateTimeBasedProgress, findNextWorkingDay } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, GripVertical, Plus, UserPlus, Folder, Settings2, Trash2, History, RefreshCw, CheckCircle, AlertTriangle, RotateCw, RotateCcw, ChevronsDownUp, Copy, Pin, PinOff, Link, Link2, EyeOff, Eye, LayoutList, CalendarRange, Percent, ChevronLeft, Gem, ShieldCheck, Rocket, Server, Search, X, Filter, CheckSquare, Square, Undo2 } from 'lucide-react';

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
  onShiftTask: (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right' | 'left-working' | 'right-working') => void;
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
  onUndo?: () => void;
  canUndo?: boolean;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  isRefreshing: boolean;
  isReadOnly?: boolean;
  collapseResourceRowsSignal?: number;
  onSetActualDate?: (assignmentId: string, actualDate: string | null) => void;
}

const SaveStatusIndicator: React.FC<{ status: PlannerGridProps['saveStatus'] }> = ({ status }) => {
  const statusConfig = {
    saving: { icon: <RotateCw size={16} className="animate-spin" />, text: 'Saving...', style: 'text-slate-600 bg-slate-100' },
    success: { icon: <CheckCircle size={16} />, text: 'Saved!', style: 'text-green-700 bg-green-100' },
    error: { icon: <AlertTriangle size={16} />, text: 'Error!', style: 'text-red-700 bg-red-100' },
    idle: { icon: <CheckCircle size={16} />, text: 'Up to date', style: 'text-slate-500 bg-white' },
  };
  
  const current = statusConfig[status];

  return (
    <div className={`flex items-center justify-center p-2 rounded-lg border border-slate-200 transition-all ${current.style}`} title={current.text}>
      {current.icon}
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
  holidayDuration: number;
  isCurrent: boolean;
  holidayName?: string | any;
  disabled?: boolean;
  isGanttMode?: boolean;
}

interface BaselineAssignmentSnapshot {
  startDate?: string;
  duration?: number;
}

const GridNumberInput = React.memo<GridNumberInputProps>(({ value, onChange, onNavigate, rowIndex, colIndex, width, holidayDuration, isCurrent, holidayName, disabled, isGanttMode }) => {
  const [localValue, setLocalValue] = useState(value === 0 ? '' : String(value));
  const [isEditing, setIsEditing] = useState(false);

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

  if (isGanttMode) {
      // Important: Use z-0 to ensure it sits behind the Gantt bar (which is z-20)
      return (
          <div className="flex-shrink-0 border-r border-slate-100 bg-transparent relative z-0" style={{ width: `${width}px` }}></div>
      );
  }

  let bgClass = '';
  if (holidayDuration === 1) {
      bgClass = 'bg-[repeating-linear-gradient(45deg,theme(colors.red.50),theme(colors.red.50)_5px,theme(colors.red.100)_5px,theme(colors.red.100)_10px)]';
  } else if (holidayDuration === 0.5) {
      bgClass = 'bg-[repeating-linear-gradient(45deg,theme(colors.orange.50),theme(colors.orange.50)_5px,theme(colors.orange.100)_5px,theme(colors.orange.100)_10px)]';
  } else if (isCurrent) {
      bgClass = 'bg-amber-100 ring-1 ring-inset ring-amber-300';
  }

  return (
      <div 
          className={`flex-shrink-0 border-r border-slate-100 relative ${bgClass}`} 
          style={{ width: `${width}px` }}
          title={typeof holidayName === 'string' ? holidayName : holidayName?.name}
      >
          {holidayDuration === 1 && holidayName ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold text-red-700 select-none">
                {'country' in (holidayName as any) ? (holidayName as any).country : 'AL'}
              </div>
          ) : holidayDuration === 0.5 && holidayName ? (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                 <div className="text-[8px] font-bold text-orange-700">0.5</div>
              </div>
          ) : null}
          
          {(holidayDuration !== 1 || !holidayName) && (
              disabled ? (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-medium relative z-10">
                    {localValue}
                  </div>
              ) : (
                  <input 
                      type="text"
                      data-r={rowIndex}
                      data-c={colIndex}
                      data-grid="planner"
                      className={`w-full h-full text-center text-[10px] focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-10 relative transition-colors
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
              )
          )}
      </div>
  );
}, (prev, next) => (
  prev.value === next.value &&
  prev.width === next.width &&
  prev.holidayDuration === next.holidayDuration &&
  prev.isCurrent === next.isCurrent &&
  prev.disabled === next.disabled &&
  prev.isGanttMode === next.isGanttMode
));


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
  [Role.CS]: { border: 'border-l-violet-500', bg: 'bg-violet-50', bar: 'bg-violet-200', fill: 'bg-violet-600' },
  [Role.PRODUCTION]: { border: 'border-l-emerald-500', bg: 'bg-emerald-50', bar: 'bg-emerald-200', fill: 'bg-emerald-600' },
  'default': { border: 'border-l-slate-400', bg: 'bg-slate-50', bar: 'bg-slate-200', fill: 'bg-slate-500' }
};

const getRoleStyle = (role: Role) => ROLE_STYLES[role] || ROLE_STYLES['default'];

const clampProgress = (value?: number): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const averageProgress = (values: number[]): number => {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

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


export const PlannerGrid: React.FC<PlannerGridProps> = React.memo(({ 
  projects, 
  holidays,
  resources,
  timelineStart,
  timelineEnd,
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
  onUndo,
  canUndo = false,
  saveStatus,
  isRefreshing,
  isReadOnly = false,
  collapseResourceRowsSignal = 0,
  onSetActualDate,
}) => {
  // Ref to always access the latest projects without adding projects as a dep in signal-based effects.
  const projectsRef = useRef(projects);
  useEffect(() => { projectsRef.current = projects; });

  // ... (State initialization omitted for brevity, logic preserved)
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_projects');
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Track whether localStorage had saved collapse state for modules only.
  const hadSavedModuleCollapse = useRef(!!localStorage.getItem('oms_collapsed_modules'));
  const collapseAllByDefault = !hadSavedModuleCollapse.current;

  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_modules');
        if (saved) return JSON.parse(saved);
        return {};
    } catch { return {}; }
  });

  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>(() => {
    try {
        const saved = localStorage.getItem('oms_collapsed_tasks');
        return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });

  // Auto-collapse all modules on first load if user hasn't set preferences yet.
  const hasInitializedCollapse = useRef(false);
  useEffect(() => {
    if (hasInitializedCollapse.current) return;
    if (projects.length === 0) return;
    const saved = localStorage.getItem('oms_collapsed_modules');
    if (saved) { hasInitializedCollapse.current = true; return; }
    // First time: collapse all modules for performance
    const allModuleIds: Record<string, boolean> = {};
    projects.forEach(p => p.modules.forEach(m => { allModuleIds[m.id] = true; }));
    setCollapsedModules(allModuleIds);
    // Also collapse all tasks
    const allTaskIds: Record<string, boolean> = {};
    projects.forEach(p => p.modules.forEach(m => m.tasks.forEach(t => { allTaskIds[t.id] = true; })));
    setCollapsedTasks(allTaskIds);
    hasInitializedCollapse.current = true;
  }, [projects]);

  // Always start with resources hidden (task rows collapsed) by default.
  const hasInitializedResourceCollapse = useRef(false);
  useEffect(() => {
    if (hasInitializedResourceCollapse.current) return;
    if (projects.length === 0) return;

    const allTaskIds: Record<string, boolean> = {};
    projects.forEach((p) => p.modules.forEach((m) => m.tasks.forEach((t) => { allTaskIds[t.id] = true; })));
    setCollapsedTasks(allTaskIds);
    hasInitializedResourceCollapse.current = true;
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('oms_collapsed_projects', JSON.stringify(collapsedProjects));
  }, [collapsedProjects]);

  useEffect(() => {
    localStorage.setItem('oms_collapsed_modules', JSON.stringify(collapsedModules));
  }, [collapsedModules]);

  useEffect(() => {
    localStorage.setItem('oms_collapsed_tasks', JSON.stringify(collapsedTasks));
  }, [collapsedTasks]);

  // Only re-collapse when the AI creation signal fires — NOT on every projects update.
  useEffect(() => {
    if (collapseResourceRowsSignal === 0) return;
    const cur = projectsRef.current;
    if (cur.length === 0) return;
    const allTaskIds: Record<string, boolean> = {};
    cur.forEach((p) => p.modules.forEach((m) => m.tasks.forEach((t) => { allTaskIds[t.id] = true; })));
    setCollapsedTasks(allTaskIds);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapseResourceRowsSignal]);


  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [displayMode, setDisplayMode] = useState<'allocation' | 'gantt'>('gantt'); 
  const [dependencyViewMode, setDependencyViewMode] = useState<'detailed' | 'summary' | 'none'>('detailed');
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

  const [colWidthBase, setColWidthBase] = useState(40);
  const [isDetailsFrozen, setIsDetailsFrozen] = useState(true);
  
  const [showToggleMenu, setShowToggleMenu] = useState(false);
  const [showResourceFilter, setShowResourceFilter] = useState(false);
  const [selectedResources, setSelectedResources] = useState<string[]>([]);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [isDependencyLinkMode, setIsDependencyLinkMode] = useState(false);
  const [pendingDependencySourceId, setPendingDependencySourceId] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<{ 
    x: number; 
    y: number; 
    type: 'project' | 'module' | 'task' | 'assignment';
    projectId: string; 
    moduleId?: string; 
    taskId?: string; 
    assignmentId?: string; 
  } | null>(null);

  const [datePickerState, setDatePickerState] = useState<{ assignmentId: string | null; mode: 'start' | 'actual' | null }>({ assignmentId: null, mode: null });
  const [showBaselineDiff, setShowBaselineDiff] = useState(false);
  const [baselineSnapshot, setBaselineSnapshot] = useState<Record<string, BaselineAssignmentSnapshot>>(() => {
    try {
      const saved = localStorage.getItem('oms_baseline_assignment_snapshot_v1');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  const importInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const datePickerContainerRef = useRef<HTMLDivElement>(null);
  const ganttSurfaceRef = useRef<HTMLDivElement>(null);
  const assignmentBarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const moduleBarRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [dependencyConnectorPaths, setDependencyConnectorPaths] = useState<Array<{ id: string; d: string; kind: 'summary' | 'detailed'; waypoints: Array<{x: number; y: number}> }>>([]);
  // User-adjusted waypoint offsets keyed by connector id → waypoint index → {dx,dy}
  // Offsets are relative to auto-routed waypoints so layout shifts do not break orthogonality.
  const waypointOverrides = useRef<Map<string, Map<number, {dx: number; dy: number}>>>(null!);
  if (waypointOverrides.current === null) {
    let map = new Map<string, Map<number, {dx: number; dy: number}>>();
    try {
      const saved = localStorage.getItem('oms_dependency_waypoint_offsets_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, Record<string, {dx: number; dy: number}>>;
        for (const [connId, indices] of Object.entries(parsed)) {
          const inner = new Map<number, {dx: number; dy: number}>();
          for (const [idx, pos] of Object.entries(indices)) {
            inner.set(Number(idx), { dx: Number(pos.dx) || 0, dy: Number(pos.dy) || 0 });
          }
          map.set(connId, inner);
        }
      }
    } catch {}
    waypointOverrides.current = map;
  }
  // Segment-level dragging: drag a whole horizontal/vertical line segment
  const [draggingSegment, setDraggingSegment] = useState<{
    connectorId: string;
    segmentIndex: number; // segment between allPoints[i] and allPoints[i+1]
    orientation: 'horizontal' | 'vertical';
    affectedWaypointIndices: number[]; // indices into the waypoints array
    startMouseX: number;
    startMouseY: number;
    startPositions: Array<{idx: number; x: number; y: number; startDx: number; startDy: number}>;
  } | null>(null);
  const [remeasureCounter, setRemeasureCounter] = useState(0);
  const [actualDateVersion, setActualDateVersion] = useState(0);

  const actualDateOverrides = useRef<Map<string, string>>(null!);
  if (actualDateOverrides.current === null) {
    const map = new Map<string, string>();
    // Seed from localStorage (offline/cached values)
    try {
      const saved = localStorage.getItem('oms_assignment_actual_dates_v1');
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        Object.entries(parsed).forEach(([assignmentId, actualDate]) => {
          if (typeof actualDate === 'string' && actualDate) {
            map.set(assignmentId, actualDate);
          }
        });
      }
    } catch {}
    // Seed from DB values (source of truth — overrides localStorage)
    projects.forEach((p) => p.modules.forEach((m) => m.tasks.forEach((t) => t.assignments.forEach((a) => {
      if (a.actualDate) map.set(a.id, a.actualDate);
    }))));
    actualDateOverrides.current = map;
  }

  useEffect(() => {
    // When projects reload from DB, re-seed the map with fresh DB values
    const map = new Map(actualDateOverrides.current);
    projects.forEach((p) => p.modules.forEach((m) => m.tasks.forEach((t) => t.assignments.forEach((a) => {
      if (a.actualDate) {
        map.set(a.id, a.actualDate);
      }
    }))));
    actualDateOverrides.current = map;
    setActualDateVersion((prev) => prev + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => {
    const syncActualDatesFromStorage = () => {
      const map = new Map<string, string>();
      try {
        const saved = localStorage.getItem('oms_assignment_actual_dates_v1');
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, string>;
          Object.entries(parsed).forEach(([assignmentId, actualDate]) => {
            if (typeof actualDate === 'string' && actualDate) {
              map.set(assignmentId, actualDate);
            }
          });
        }
      } catch {
        // Ignore malformed storage data.
      }
      // Merge DB values on top (DB wins)
      projects.forEach((p) => p.modules.forEach((m) => m.tasks.forEach((t) => t.assignments.forEach((a) => {
        if (a.actualDate) map.set(a.id, a.actualDate);
      }))));
      actualDateOverrides.current = map;
      setActualDateVersion((prev) => prev + 1);
    };

    if (typeof window === 'undefined') return;
    window.addEventListener('oms-actual-date-updated', syncActualDatesFromStorage);
    return () => window.removeEventListener('oms-actual-date-updated', syncActualDatesFromStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistWaypointOverrides = useCallback(() => {
    try {
      const obj: Record<string, Record<string, {dx: number; dy: number}>> = {};
      waypointOverrides.current.forEach((inner, connId) => {
        const indices: Record<string, {dx: number; dy: number}> = {};
        inner.forEach((pos, idx) => { indices[String(idx)] = pos; });
        obj[connId] = indices;
      });
      localStorage.setItem('oms_dependency_waypoint_offsets_v2', JSON.stringify(obj));
    } catch {}
  }, []);

  const persistActualDateOverrides = useCallback(() => {
    try {
      const obj: Record<string, string> = {};
      actualDateOverrides.current.forEach((actualDate, assignmentId) => {
        obj[assignmentId] = actualDate;
      });
      localStorage.setItem('oms_assignment_actual_dates_v1', JSON.stringify(obj));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('oms_baseline_assignment_snapshot_v1', JSON.stringify(baselineSnapshot));
    } catch {}
  }, [baselineSnapshot]);

  const captureBaselineSnapshot = useCallback(() => {
    const snapshot: Record<string, BaselineAssignmentSnapshot> = {};
    projects.forEach((project) => {
      project.modules.forEach((module) => {
        module.tasks.forEach((task) => {
          task.assignments.forEach((assignment) => {
            snapshot[assignment.id] = {
              startDate: assignment.startDate,
              duration: assignment.duration,
            };
          });
        });
      });
    });
    setBaselineSnapshot(snapshot);
    setShowBaselineDiff(true);
  }, [projects]);

  const baselineDiffSummary = useMemo(() => {
    let changed = 0;
    let added = 0;
    let removed = 0;
    const seen = new Set<string>();

    projects.forEach((project) => {
      project.modules.forEach((module) => {
        module.tasks.forEach((task) => {
          task.assignments.forEach((assignment) => {
            seen.add(assignment.id);
            const baseline = baselineSnapshot[assignment.id];
            if (!baseline) {
              added += 1;
              return;
            }
            if ((baseline.startDate || '') !== (assignment.startDate || '') || (baseline.duration || 0) !== (assignment.duration || 0)) {
              changed += 1;
            }
          });
        });
      });
    });

    Object.keys(baselineSnapshot).forEach((assignmentId) => {
      if (!seen.has(assignmentId)) removed += 1;
    });

    return { changed, added, removed, total: changed + added + removed };
  }, [baselineSnapshot, projects]);

  const resizeGhostRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeData = useRef({ col: '', startX: 0, startWidth: 0 });

  // --- Gantt Bar Drag State ---
  const ganttDragRef = useRef<{
    isDragging: boolean;
    type: 'move' | 'resize-right';
    assignmentId: string;
    barElement: HTMLDivElement;
    startX: number;
    originalLeft: number;
    originalWidth: number;
    originalStartDate: string;
    originalDuration: number;
    startIndex: number;
    endIndex: number;
  } | null>(null);

  const projectHolidayMap = useMemo(() => {
    const map = new Map<string, number>();
    holidays.filter(h => h.country === 'HK').forEach(h => {
        map.set(h.date, h.duration || 1);
    });
    return map;
  }, [holidays]);

  // Unique Resource Names for Filter
  const uniqueResourceNames = useMemo(() => {
    const names = new Set<string>();
    projects.forEach(p => p.modules.forEach(m => m.tasks.forEach(t => t.assignments.forEach(a => {
        if (a.resourceName && a.resourceName !== 'Unassigned') {
            names.add(a.resourceName);
        }
    }))));
    return Array.from(names).sort();
  }, [projects]);

  // Filtered Projects Logic
  const filteredProjects = useMemo<Project[]>(() => {
    if (selectedResources.length === 0) return projects;
    
    return projects.map(p => {
        const modules = p.modules.map(m => {
            const tasks = m.tasks.map(t => {
                // strict resource filtering on assignments
                const relevantAssignments = t.assignments.filter(a => selectedResources.includes(a.resourceName || 'Unassigned'));
                
                if (relevantAssignments.length > 0) {
                    // return task with ONLY the relevant assignments
                    return { ...t, assignments: relevantAssignments };
                }
                return null;
            }).filter(Boolean) as ProjectTask[];
            
            if (tasks.length > 0) return { ...m, tasks };
            return null;
        }).filter(Boolean) as ProjectModule[];
        
        if (modules.length > 0) return { ...p, modules };
        return null;
    }).filter(Boolean) as Project[];
  }, [projects, selectedResources]);

  const toggleResourceSelection = useCallback((name: string) => {
      setSelectedResources(prev => 
          prev.includes(name) ? prev.filter(r => r !== name) : [...prev, name]
      );
  }, []);

  // ... (Effect hooks for resizing, editing focus, clicking outside, etc. logic preserved)
  useEffect(() => {
    if (!filteredProjects || filteredProjects.length === 0) return;

    const calculateOptimalWidth = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return 350;

      context.font = 'bold 12px Inter, ui-sans-serif, system-ui, sans-serif';

      // Measure only labels currently visible in the left column view.
      let maxPixelWidth = userHasResizedSidebar ? 220 : 200;

      filteredProjects.forEach((project) => {
        const pWidth = context.measureText(project.name).width + 60;
        if (pWidth > maxPixelWidth) maxPixelWidth = pWidth;

        if (collapsedProjects[project.id]) return;

        project.modules.forEach((module) => {
          const mWidth = context.measureText(module.name).width + 80;
          if (mWidth > maxPixelWidth) maxPixelWidth = mWidth;

          const isModuleCollapsed = collapsedModules[module.id] || (collapseAllByDefault && !hasInitializedCollapse.current);
          if (isModuleCollapsed) return;

          module.tasks.forEach((task) => {
            const tWidth = context.measureText(task.name).width + 100;
            if (tWidth > maxPixelWidth) maxPixelWidth = tWidth;

            const isTaskCollapsed = collapsedTasks[task.id] || (collapseAllByDefault && !hasInitializedCollapse.current);
            if (isTaskCollapsed) return;

            task.assignments.forEach((assignment) => {
              const resourceLabel = assignment.resourceName || 'Unassigned';
              const aWidth = context.measureText(resourceLabel).width + 130;
              if (aWidth > maxPixelWidth) maxPixelWidth = aWidth;
            });
          });
        });
      });

      maxPixelWidth += 20;
      return Math.min(Math.max(250, maxPixelWidth), 600);
    };

    setSidebarWidth(calculateOptimalWidth());
  }, [filteredProjects, collapsedProjects, collapsedModules, collapsedTasks, collapseAllByDefault, userHasResizedSidebar]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      if (editInputRef.current.type === 'text' || editInputRef.current.type === 'number') {
        editInputRef.current.select();
      }
    }
  }, [editingId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        // Don't close if clicking inside specific menus
        if (filterButtonRef.current?.contains(e.target as Node)) return;
        if (toggleButtonRef.current?.contains(e.target as Node)) return;
        
        const target = e.target as HTMLElement;
        if (target.closest('.filter-menu') || target.closest('.toggle-menu')) return;

        setContextMenu(null);
        setShowToggleMenu(false);
        setShowResourceFilter(false);
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (!datePickerState.assignmentId) return;

    const handleClickOutside = (event: MouseEvent) => {
           if (datePickerContainerRef.current && !datePickerContainerRef.current.contains(event.target as Node)) {
             setDatePickerState({ assignmentId: null, mode: null });
        }
    };
    
    setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [datePickerState.assignmentId]);

  // Keep segment dragging active even when cursor leaves the SVG area.
  useEffect(() => {
    if (!draggingSegment) return;

    const handleWindowMove = (event: MouseEvent) => {
      const surface = ganttSurfaceRef.current;
      if (!surface) return;

      const rect = surface.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const dx = mouseX - draggingSegment.startMouseX;
      const dy = mouseY - draggingSegment.startMouseY;

      if (!waypointOverrides.current.has(draggingSegment.connectorId)) {
        waypointOverrides.current.set(draggingSegment.connectorId, new Map());
      }

      const overrideMap = waypointOverrides.current.get(draggingSegment.connectorId)!;
      const updates = new Map<number, {x: number; y: number}>();
      for (const sp of draggingSegment.startPositions) {
        const nextDx = draggingSegment.orientation === 'vertical' ? sp.startDx + dx : sp.startDx;
        const nextDy = draggingSegment.orientation === 'horizontal' ? sp.startDy + dy : sp.startDy;
        overrideMap.set(sp.idx, { dx: nextDx, dy: nextDy });

        const newPos = {
          x: draggingSegment.orientation === 'vertical' ? sp.x + dx : sp.x,
          y: draggingSegment.orientation === 'horizontal' ? sp.y + dy : sp.y,
        };
        updates.set(sp.idx, newPos);
      }

      setDependencyConnectorPaths(prev => prev.map(c => {
        if (c.id !== draggingSegment.connectorId) return c;
        const newWaypoints = c.waypoints.map((wp, i) => updates.get(i) ?? wp);
        const parts = c.d.split(/[ML]\s*/).filter(Boolean).map(s => {
          const [x, y] = s.trim().split(/\s+/).map(Number);
          return {x, y};
        });
        const start = parts[0];
        const end = parts[parts.length - 1];
        const allPts = [start, ...newWaypoints, end];
        const d = allPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return { ...c, d, waypoints: newWaypoints };
      }));
    };

    const handleWindowUp = () => {
      persistWaypointOverrides();
      setDraggingSegment(null);
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
    };
  }, [draggingSegment, persistWaypointOverrides]);

  // ... (Toggle functions, resize handlers, etc. logic preserved)
  const toggleProject = useCallback((id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] })), []);
  const toggleModule = useCallback((id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] })), []);
  const toggleTask = useCallback((id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] })), []);

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
    const map = new Map<string, { holidays: (Omit<Holiday, 'id'> | IndividualHoliday)[], holidayMap: Map<string, number> }>();
    
    const availableRegions = Array.from(new Set(holidays.map(h => h.country)));
    const defaultRegion = availableRegions.includes('HK') ? 'HK' : availableRegions[0];
    const defaultHolidays = defaultRegion ? holidays.filter(h => h.country === defaultRegion) : [];
    
    const defaultHolidayMap = new Map<string, number>();
    defaultHolidays.forEach(h => defaultHolidayMap.set(h.date, h.duration || 1));

    map.set('Unassigned', {
        holidays: defaultHolidays,
        holidayMap: defaultHolidayMap
    });

    resources.forEach(resource => {
        const regional = resource.holiday_region 
            ? holidays.filter(h => h.country === resource.holiday_region)
            : [];
            
        const individual = resource.individual_holidays || [];
        const allHolidays = [...regional, ...individual];
        const resHolidayMap = new Map<string, number>();
        allHolidays.forEach(h => resHolidayMap.set(h.date, h.duration || 1));

        map.set(resource.name, {
            holidays: allHolidays,
            holidayMap: resHolidayMap
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

  const getDependencyLabel = useCallback((assignmentId?: string | null) => {
    if (!assignmentId) return '';
    return allAssignmentsForDependencies.find((assignment) => assignment.id === assignmentId)?.name || 'Unknown dependency';
  }, [allAssignmentsForDependencies]);

  const getAvailableDependencies = useCallback((assignmentId: string) => {
    return allAssignmentsForDependencies.filter((candidate) => (
      candidate.id !== assignmentId && !isCircularDependency(assignmentId, candidate.id)
    ));
  }, [allAssignmentsForDependencies]);

  const pendingDependencySourceLabel = useMemo(() => {
    if (!pendingDependencySourceId) return '';
    return allAssignmentsForDependencies.find((assignment) => assignment.id === pendingDependencySourceId)?.name || 'Selected predecessor';
  }, [allAssignmentsForDependencies, pendingDependencySourceId]);

  const handleDependencyBarClick = useCallback((assignment: TaskAssignment) => {
    if (isReadOnly || !isDependencyLinkMode) return;

    if (!pendingDependencySourceId) {
      setPendingDependencySourceId(assignment.id);
      return;
    }

    if (pendingDependencySourceId === assignment.id) {
      setPendingDependencySourceId(null);
      return;
    }

    if (isCircularDependency(assignment.id, pendingDependencySourceId)) {
      alert('This dependency would create a circular dependency.');
      return;
    }

    onUpdateAssignmentDependency(assignment.id, pendingDependencySourceId);
  }, [isDependencyLinkMode, isReadOnly, onUpdateAssignmentDependency, pendingDependencySourceId]);

  useEffect(() => {
    if (displayMode !== 'gantt' && isDependencyLinkMode) {
      setIsDependencyLinkMode(false);
      setPendingDependencySourceId(null);
    }
  }, [displayMode, isDependencyLinkMode]);

  const setAssignmentBarRef = useCallback((assignmentId: string, node: HTMLDivElement | null) => {
    if (node) {
      assignmentBarRefs.current.set(assignmentId, node);
      return;
    }
    assignmentBarRefs.current.delete(assignmentId);
  }, []);

  const setModuleBarRef = useCallback((moduleId: string, node: HTMLDivElement | null) => {
    if (node) {
      moduleBarRefs.current.set(moduleId, node);
      return;
    }
    moduleBarRefs.current.delete(moduleId);
  }, []);


  const startEditing = useCallback((id: string, initialValue: string, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setEditingId(id);
    setEditValue(initialValue);
  }, [isReadOnly]);

  const saveEdit = useCallback(() => {
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
  }, [editingId, editValue, isReadOnly, onUpdateProjectName, onUpdateModuleName, onUpdateTaskName, onUpdateAssignmentResourceName]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEdit();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [saveEdit]);

  const timeline = useMemo<TimelineColumn[]>(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);

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

  const getRawCellValue = useCallback((assignment: TaskAssignment, col: TimelineColumn): number => {
    const resourceName = assignment.resourceName || 'Unassigned';
    const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned');

    if (viewMode === 'day') {
        if (!col.date) return 0;
        const dateStr = formatDateForInput(col.date);
        const holDuration = resourceHolidayData?.holidayMap.get(dateStr) || 0;
        if (holDuration === 1) return 0;
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
          const weekdaysInWeek = 5;
          return alloc.count / weekdaysInWeek;
      }
      return 0;
    }
    return 0;
  }, [viewMode, resourceHolidaysMap]);

  const formatValue = (val: number): string => {
    if (val === 0) return '';
    return Number.isInteger(val) ? val.toString() : val.toFixed(1);
  };

  const getTaskTotal = (task: ProjectTask, col: TimelineColumn) => task.assignments.reduce((sum, assign) => sum + getRawCellValue(assign, col), 0);
  const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => module.tasks.reduce((sum, task) => sum + getTaskTotal(task, col), 0);
  const getProjectTotal = (project: Project, col: TimelineColumn) => project.modules.reduce((sum, module) => sum + getModuleTotal(module, col), 0);

  const handleCellUpdate = useCallback((projectId: string, moduleId: string, taskId: string, assignmentId: string, col: TimelineColumn, value: string) => {
    if (isReadOnly) return;
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
      const dateStr = formatDateForInput(col.date);
      onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.parentWeekId, numValue, dateStr);
    }
  }, [isReadOnly, viewMode, onUpdateAllocation]);

  const handleNavigate = useCallback((direction: string, currentRow: number, currentCol: number) => {
    let targetRow = currentRow;
    let targetCol = currentCol;

    if (direction === 'ArrowUp') targetRow--;
    if (direction === 'ArrowDown') targetRow++;
    if (direction === 'ArrowLeft') targetCol--;
    if (direction === 'ArrowRight') targetCol++;

    const selector = `input[data-grid="planner"][data-r="${targetRow}"][data-c="${targetCol}"]`;
    const el = document.querySelector(selector) as HTMLInputElement;
    if (el) {
        el.focus();
        el.select();
    }
  }, []);

  const handleModuleDragStart = (e: React.DragEvent, index: number) => { if (isReadOnly) return; e.dataTransfer.setData("text/plain", index.toString()); e.dataTransfer.effectAllowed = "move"; setDraggedModuleIndex(index); };
  const handleModuleDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  
  const handleModuleDrop = (e: React.DragEvent, projectId: string, targetModuleId: string, targetModuleIndex: number) => {
    if (isReadOnly) return;
    e.preventDefault();
    setDraggedModuleIndex(null);

    // Handle module reordering
    if (e.dataTransfer.types.includes("text/plain")) {
        const startIndexStr = e.dataTransfer.getData("text/plain");
        if (startIndexStr) {
            const startIndex = parseInt(startIndexStr, 10);
            if (!isNaN(startIndex) && startIndex !== targetModuleIndex) {
                onReorderModules(projectId, startIndex, targetModuleIndex);
            }
        }
    }
    
    // Handle dropping a task onto a module
    if (e.dataTransfer.types.includes("application/json")) {
        try {
            const data = JSON.parse(e.dataTransfer.getData("application/json"));
            if (data.type === 'task' && data.projectId === projectId && data.moduleId !== targetModuleId) {
                const targetModule = projects.find(p => p.id === projectId)?.modules.find(m => m.id === targetModuleId);
                if (targetModule) {
                    onMoveTask(projectId, data.moduleId, targetModuleId, data.index, targetModule.tasks.length);
                }
            }
        } catch (err) {
            console.error("Error dropping task on module", err);
        }
    }
  };

  const handleTaskDragStart = (e: React.DragEvent, projectId: string, moduleId: string, taskIndex: number) => { if (isReadOnly) return; e.dataTransfer.setData("application/json", JSON.stringify({ type: 'task', projectId, moduleId, index: taskIndex })); e.dataTransfer.effectAllowed = "move"; setDraggedTask({ moduleId, index: taskIndex }); };
  const handleTaskDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  
  const handleTaskDrop = (e: React.DragEvent, targetProjectId: string, targetModuleId: string, targetTaskIndex: number) => { 
      if (isReadOnly) return; 
      e.preventDefault(); 
      setDraggedTask(null); 
      try { 
          const data = JSON.parse(e.dataTransfer.getData("application/json")); 
          if (data.type === 'task' && data.projectId === targetProjectId) {
              if (data.moduleId === targetModuleId) {
                  // Reorder within the same module
                  if (data.index !== targetTaskIndex) {
                      onReorderTasks(targetProjectId, data.moduleId, data.index, targetTaskIndex); 
                  }
              } else {
                  // Move to a different module
                  onMoveTask(targetProjectId, data.moduleId, targetModuleId, data.index, targetTaskIndex);
              }
          }
      } catch (err) { 
          console.error("Error dropping task", err); 
      } 
  };
  
  const handleAssignmentDragStart = (e: React.DragEvent, taskId: string, assignmentIndex: number) => { if (isReadOnly) return; e.dataTransfer.setData("application/json", JSON.stringify({ type: 'assignment', taskId, index: assignmentIndex })); e.dataTransfer.effectAllowed = "move"; setDraggedAssignment({ taskId, index: assignmentIndex }); };
  const handleAssignmentDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleAssignmentDrop = (e: React.DragEvent, projectId: string, moduleId: string, targetTaskId: string, targetAssignmentIndex: number) => { if (isReadOnly) return; e.preventDefault(); setDraggedAssignment(null); try { const data = JSON.parse(e.dataTransfer.getData("application/json")); if (data.type === 'assignment' && data.taskId === targetTaskId && data.index !== targetAssignmentIndex) { onReorderAssignments(projectId, moduleId, data.taskId, data.index, targetAssignmentIndex); } } catch (err) { console.error("Error dropping assignment", err); } };

  const handleAddTaskClick = (projectId: string, moduleId: string) => {
    if (isReadOnly) return;
    const newTaskId = crypto.randomUUID();
    if (collapsedModules[moduleId]) { toggleModule(moduleId); }
    onAddTask(projectId, moduleId, newTaskId, "New Task", Role.EA);
    startEditing(`task::${projectId}::${moduleId}::${newTaskId}`, "New Task");
  };

  const handleAssignmentStartDateChange = useCallback((assignment: TaskAssignment, newDateStr: string) => {
     if (isReadOnly || !newDateStr) return;
     onUpdateAssignmentSchedule(assignment.id, newDateStr, assignment.duration || 1);
  }, [isReadOnly, onUpdateAssignmentSchedule]);

  const saveDuration = useCallback((assignment: TaskAssignment) => {
    if (editingId !== `duration::${assignment.id}` || isReadOnly) return;
    let startDate = assignment.startDate;
    if (!startDate && assignment.startWeekId) { const d = getDateFromWeek(parseInt(assignment.startWeekId.split('-')[0]), parseInt(assignment.startWeekId.split('-')[1])); startDate = formatDateForInput(d); }
    if (!startDate) { setEditingId(null); return; }
    const newDuration = parseInt(editValue, 10);
    if (!isNaN(newDuration) && newDuration > 0 && newDuration !== assignment.duration) { onUpdateAssignmentSchedule(assignment.id, startDate, newDuration); }
    setEditingId(null);
  }, [editingId, editValue, isReadOnly, onUpdateAssignmentSchedule]);

  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;
  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };
  
  const startColLeft = sidebarWidth;
  const durationColLeft = sidebarWidth + startColWidth;
  const dependencyColLeft = sidebarWidth + startColWidth + durationColWidth;

  // --- Gantt Bar Drag Helpers ---
  const getDateFromColumn = useCallback((col: TimelineColumn, isEnd: boolean = false): string | null => {
    if (!col) return null;
    if (col.date) return formatDateForInput(col.date);
    if (col.type === 'week') {
      const [yearStr, weekStr] = col.id.split('-');
      const date = getDateFromWeek(parseInt(yearStr), parseInt(weekStr));
      if (isEnd) date.setDate(date.getDate() + 4); // Friday
      return formatDateForInput(date);
    }
    if (col.type === 'month' && col.weekIds && col.weekIds.length > 0) {
      const weekId = isEnd ? col.weekIds[col.weekIds.length - 1] : col.weekIds[0];
      const [yearStr, weekStr] = weekId.split('-');
      const date = getDateFromWeek(parseInt(yearStr), parseInt(weekStr));
      if (isEnd) date.setDate(date.getDate() + 4);
      return formatDateForInput(date);
    }
    return null;
  }, []);

  const handleGanttDragStart = useCallback((
    e: React.MouseEvent<HTMLDivElement>,
    type: 'move' | 'resize-right',
    assignmentId: string,
    startDate: string,
    duration: number,
    barEl: HTMLDivElement,
    startIdx: number,
    endIdx: number,
  ) => {
    if (isReadOnly) return;
    e.preventDefault();
    e.stopPropagation();
    ganttDragRef.current = {
      isDragging: true,
      type,
      assignmentId,
      barElement: barEl,
      startX: e.clientX,
      originalLeft: startIdx * colWidth + 2,
      originalWidth: Math.max(4, (endIdx - startIdx + 1) * colWidth - 4),
      originalStartDate: startDate,
      originalDuration: duration,
      startIndex: startIdx,
      endIndex: endIdx,
    };
    barEl.style.transition = 'none';
    barEl.style.opacity = '0.85';
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'col-resize';
    document.body.style.userSelect = 'none';
  }, [isReadOnly, colWidth]);

  // --- Ctrl+Z Undo Shortcut ---
  useEffect(() => {
    if (!onUndo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
        e.preventDefault();
        onUndo();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onUndo]);

  const showYearRow = viewMode === 'day' || viewMode === 'week' || viewMode === 'month';
  const showMonthRow = viewMode === 'day' || viewMode === 'week';

  // --- Grid Row Tracking ---
  let gridRowIndex = 0;

  // --- Column Virtualization ---
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Start with a small initial range to prevent first-render freeze
  const INITIAL_VISIBLE_COLS = 60;
  const [visibleColRange, setVisibleColRange] = useState<{start: number, end: number}>({start: 0, end: Math.min(INITIAL_VISIBLE_COLS, timeline.length)});
  const lastColRange = useRef({start: 0, end: Math.min(INITIAL_VISIBLE_COLS, timeline.length)});

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const frozenW = sidebarWidth + startColWidth + durationColWidth + dependencyColWidth;

    const updateVisibleColumns = () => {
      const sl = container.scrollLeft;
      const cw = container.clientWidth;
      const BUFFER = 5;
      const start = Math.max(0, Math.floor(sl / colWidth) - BUFFER);
      const end = Math.min(timeline.length, Math.ceil((sl + cw - frozenW) / colWidth) + BUFFER);

      if (start !== lastColRange.current.start || end !== lastColRange.current.end) {
        lastColRange.current = { start, end };
        setVisibleColRange({ start, end });
      }
    };

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateVisibleColumns();
          ticking = false;
        });
        ticking = true;
      }
    };

    updateVisibleColumns();
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [sidebarWidth, startColWidth, durationColWidth, dependencyColWidth, colWidth, timeline.length]);

  // --- Gantt Bar Drag: Document-level Mouse Listeners ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const drag = ganttDragRef.current;
      if (!drag || !drag.isDragging || !drag.barElement) return;
      const deltaX = e.clientX - drag.startX;
      const deltaCols = Math.round(deltaX / colWidth);
      if (drag.type === 'move') {
        drag.barElement.style.left = `${drag.originalLeft + deltaCols * colWidth}px`;
      } else if (drag.type === 'resize-right') {
        const newWidth = drag.originalWidth + deltaCols * colWidth;
        drag.barElement.style.width = `${Math.max(colWidth - 4, newWidth)}px`;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const drag = ganttDragRef.current;
      if (!drag || !drag.isDragging) return;

      const deltaX = e.clientX - drag.startX;
      const deltaCols = Math.round(deltaX / colWidth);

      if (deltaCols !== 0) {
        if (drag.type === 'move') {
          const newStartIdx = Math.max(0, Math.min(timeline.length - 1, drag.startIndex + deltaCols));
          const newStartDate = getDateFromColumn(timeline[newStartIdx]);
          if (newStartDate) {
            onUpdateAssignmentSchedule(drag.assignmentId, newStartDate, drag.originalDuration);
          }
        } else if (drag.type === 'resize-right') {
          let daysPerCol = 1;
          if (viewMode === 'week') daysPerCol = 5;
          else if (viewMode === 'month') daysPerCol = 20;
          const newDuration = Math.max(1, drag.originalDuration + deltaCols * daysPerCol);
          onUpdateAssignmentSchedule(drag.assignmentId, drag.originalStartDate, newDuration);
        }
      }

      // Reset bar styles
      drag.barElement.style.transition = '';
      drag.barElement.style.opacity = '';
      drag.barElement.style.left = `${drag.originalLeft}px`;
      drag.barElement.style.width = `${drag.originalWidth}px`;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      ganttDragRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [colWidth, timeline, viewMode, onUpdateAssignmentSchedule, getDateFromColumn]);

  const colStart = Math.min(visibleColRange.start, timeline.length);
  const colEnd = Math.min(visibleColRange.end, timeline.length);
  const leftSpacerW = colStart * colWidth;
  const rightSpacerW = Math.max(0, (timeline.length - colEnd) * colWidth);

  // --- Calculate Current Column for Overlay ---
  const currentColumnIndex = timeline.findIndex(c => isCurrentColumn(c));
  const stickyLeftOffset = sidebarWidth + startColWidth + durationColWidth + dependencyColWidth;

  const getColumnIndex = (dateStr: string): number => {
    if (!dateStr || timeline.length === 0) return -1;
    
    // 1. Try exact date match (Day View)
    const dayIndex = timeline.findIndex(col => col.date && formatDateForInput(col.date) === dateStr);
    if (dayIndex !== -1) return dayIndex;

    const date = new Date(dateStr.replace(/-/g, '/'));
    const weekId = getWeekIdFromDate(date);

    // 2. Try Week match (Week View)
    const weekIndex = timeline.findIndex(col => col.id === weekId);
    if (weekIndex !== -1) return weekIndex;

    // 3. Try Month match (Month View)
    const monthIndex = timeline.findIndex(col => col.weekIds?.includes(weekId));
    if (monthIndex !== -1) return monthIndex;

    // Boundary Logic
    const firstColDate = timeline[0].date || (timeline[0].id.includes('-W') ? getDateFromWeek(parseInt(timeline[0].id.split('-')[0]), parseInt(timeline[0].id.split('-')[1])) : new Date(timeline[0].id));
    if (date < firstColDate) return -1;
    
    return timeline.length - 1; // Default to end if after (clamping)
  };

  // Helper: matches the render code's collapse logic
  const isModuleEffectivelyCollapsed = useCallback((moduleId: string) => {
    return !!collapsedModules[moduleId] || (collapseAllByDefault && !hasInitializedCollapse.current);
  }, [collapsedModules, collapseAllByDefault]);

  const isTaskEffectivelyCollapsed = useCallback((taskId: string) => {
    return !!collapsedTasks[taskId] || (collapseAllByDefault && !hasInitializedCollapse.current);
  }, [collapsedTasks, collapseAllByDefault]);

  const dependencyConnectorDefs = useMemo(() => {
    if (displayMode !== 'gantt' || dependencyViewMode === 'none') return [] as Array<{ id: string; fromId: string; toId: string; kind: 'summary' | 'detailed' }>;

    const moduleOfAssignment = new Map<string, string>();
    const taskOfAssignment = new Map<string, string>();
    const visibleDetailedAssignments = new Set<string>(); // both task + module expanded
    const taskVisibleAssignments = new Set<string>();     // task collapsed, module expanded
    const expandedModules = new Set<string>();
    const expandedTasks = new Set<string>();

    filteredProjects.forEach((project) => {
      if (collapsedProjects[project.id]) return;

      project.modules.forEach((module) => {
        const modCollapsed = isModuleEffectivelyCollapsed(module.id);

        // Always map assignments → module and task
        module.tasks.forEach((task) => {
          task.assignments.forEach((a) => {
            moduleOfAssignment.set(a.id, module.id);
            taskOfAssignment.set(a.id, task.id);
          });
        });

        if (!modCollapsed) {
          expandedModules.add(module.id);
        }

        if (modCollapsed) return; // skip detail tracking for collapsed modules

        module.tasks.forEach((task) => {
          const taskCollapsed = isTaskEffectivelyCollapsed(task.id);
          if (taskCollapsed) {
            task.assignments.forEach((a) => {
              if (a.startDate && a.duration && a.duration > 0) {
                taskVisibleAssignments.add(a.id);
              }
            });
            return;
          }
          expandedTasks.add(task.id);
          task.assignments.forEach((a) => {
            if (a.startDate && a.duration && a.duration > 0) {
              visibleDetailedAssignments.add(a.id);
            }
          });
        });
      });
    });

    // Dedup maps: keyed by "fromId-toId" at each granularity level
    const summaryDefs  = new Map<string, { id: string; fromId: string; toId: string; kind: 'summary' }>();
    const taskDefs     = new Map<string, { id: string; fromId: string; toId: string; kind: 'detailed' }>();
    const assignDefs   = new Map<string, { id: string; fromId: string; toId: string; kind: 'detailed' }>();

    allAssignmentsMap.forEach((assignment, assignmentId) => {
      if (!assignment.parentAssignmentId) return;

      const childModuleId  = moduleOfAssignment.get(assignmentId);
      const parentModuleId = moduleOfAssignment.get(assignment.parentAssignmentId);
      if (!childModuleId || !parentModuleId) return;

      const childTaskId  = taskOfAssignment.get(assignmentId);
      const parentTaskId = taskOfAssignment.get(assignment.parentAssignmentId);

      const childVisible  = visibleDetailedAssignments.has(assignmentId) || taskVisibleAssignments.has(assignmentId);
      const parentVisible = visibleDetailedAssignments.has(assignment.parentAssignmentId) || taskVisibleAssignments.has(assignment.parentAssignmentId);
      if (!childVisible || !parentVisible) return;

      const isCrossModule = childModuleId !== parentModuleId;

      // ── Level 1: Module summary ──────────────────────────────────────────
      // Either module is collapsed → one summary line per module pair.
      if (isCrossModule && (!expandedModules.has(childModuleId) || !expandedModules.has(parentModuleId))) {
        summaryDefs.set(`${childModuleId}-${parentModuleId}`, {
          id: `${childModuleId}-${parentModuleId}`,
          fromId: parentModuleId,
          toId: childModuleId,
          kind: 'summary',
        });
        return;
      }

      // In summary view mode always collapse cross-module to one summary line.
      if (isCrossModule && dependencyViewMode === 'summary') {
        summaryDefs.set(`${childModuleId}-${parentModuleId}`, {
          id: `${childModuleId}-${parentModuleId}`,
          fromId: parentModuleId,
          toId: childModuleId,
          kind: 'summary',
        });
        return;
      }

      // ── Level 2: Task-level dedup ────────────────────────────────────────
      // Either task is collapsed (assignments share one bar) → one line per task pair.
      const bothTasksExpanded = !!childTaskId && !!parentTaskId
        && expandedTasks.has(childTaskId) && expandedTasks.has(parentTaskId);

      if (!bothTasksExpanded) {
        // Use the current assignment IDs as fromId/toId — they're all registered
        // to the same task bar when the task is collapsed, so dedup by task pair key.
        const tKey = `${childTaskId ?? assignmentId}-${parentTaskId ?? assignment.parentAssignmentId}`;
        taskDefs.set(tKey, {
          id: tKey,
          fromId: assignment.parentAssignmentId,
          toId: assignmentId,
          kind: 'detailed',
        });
        return;
      }

      // ── Level 3: Assignment-level ────────────────────────────────────────
      // Both tasks are expanded: show individual resource-level lines.
      assignDefs.set(`${assignmentId}-${assignment.parentAssignmentId}`, {
        id: `${assignmentId}-${assignment.parentAssignmentId}`,
        fromId: assignment.parentAssignmentId,
        toId: assignmentId,
        kind: 'detailed',
      });
    });

    return [...summaryDefs.values(), ...taskDefs.values(), ...assignDefs.values()];
  }, [allAssignmentsMap, collapsedModules, collapsedProjects, collapsedTasks, collapseAllByDefault, dependencyViewMode, displayMode, filteredProjects, isModuleEffectivelyCollapsed, isTaskEffectivelyCollapsed]);

  useEffect(() => {
    if (displayMode !== 'gantt') {
      setDependencyConnectorPaths([]);
      return;
    }

    const surface = ganttSurfaceRef.current;
    if (!surface) {
      setDependencyConnectorPaths([]);
      return;
    }

    const measure = () => {
      const surfaceRect = surface.getBoundingClientRect();
      let removedInvalidOverride = false;
      const nextPaths = dependencyConnectorDefs.flatMap((connector) => {
        const fromNode = connector.kind === 'summary'
          ? moduleBarRefs.current.get(connector.fromId)
          : assignmentBarRefs.current.get(connector.fromId);
        const toNode = connector.kind === 'summary'
          ? moduleBarRefs.current.get(connector.toId)
          : assignmentBarRefs.current.get(connector.toId);

        if (!fromNode || !toNode) return [];

        // For detailed connectors skip individually-invisible assignment bars.
        // For summary connectors the module bar may have class 'invisible' (visibility:hidden) when the
        // module is expanded, but visibility:hidden still reports correct getBoundingClientRect positions,
        // so we can safely measure it to draw the consolidated cross-module line.
        if (connector.kind === 'detailed') {
          if (fromNode.classList.contains('invisible') || toNode.classList.contains('invisible')) return [];
        }

        const fromRect = fromNode.getBoundingClientRect();
        const toRect = toNode.getBoundingClientRect();

        // Skip zero-size elements (not rendered)
        if (fromRect.width === 0 || toRect.width === 0) return [];

        const startX = fromRect.right - surfaceRect.left;
        const endX = toRect.left - surfaceRect.left;
        const endXRight = toRect.right - surfaceRect.left;
        const startY = fromRect.top - surfaceRect.top + (fromRect.height / 2);
        const endY = toRect.top - surfaceRect.top + (toRect.height / 2);

        // Compute edges of both bars for routing decisions
        const parentTop = fromRect.top - surfaceRect.top;
        const parentBottom = fromRect.bottom - surfaceRect.top;
        const childTop = toRect.top - surfaceRect.top;
        const childBottom = toRect.bottom - surfaceRect.top;
        const goingDown = endY >= startY;
        const pad = Math.max(6, Math.round(colWidth * 0.15));

        // Determine the vertical gap between bars
        const gapBetween = goingDown
          ? childTop - parentBottom
          : parentTop - childBottom;
        const MIN_GAP = 6;

        // Build waypoints (excluding start and end which are anchored to bars)
        let waypoints: Array<{x: number; y: number}>;
        if (endX >= startX) {
          const exitX = startX + pad;
          waypoints = [{x: exitX, y: startY}, {x: exitX, y: endY}];
        } else if (gapBetween >= MIN_GAP) {
          const maxRight = Math.max(startX, endXRight);
          const exitX = maxRight + pad;
          const laneY = goingDown
            ? (parentBottom + childTop) / 2
            : (childBottom + parentTop) / 2;
          waypoints = [{x: exitX, y: startY}, {x: exitX, y: laneY}, {x: endX - pad, y: laneY}, {x: endX - pad, y: endY}];
        } else {
          const maxRight = Math.max(startX, endXRight);
          const exitX = maxRight + pad;
          const allTop = Math.min(parentTop, childTop);
          const allBottom = Math.max(parentBottom, childBottom);
          const laneY = goingDown ? allBottom + 8 : allTop - 8;
          waypoints = [{x: exitX, y: startY}, {x: exitX, y: laneY}, {x: endX - pad, y: laneY}, {x: endX - pad, y: endY}];
        }

        // Apply user waypoint offsets (relative to the current auto-routed shape).
        const overrides = waypointOverrides.current.get(connector.id);
        if (overrides) {
          overrides.forEach((delta, idx) => {
            if (idx >= 0 && idx < waypoints.length) {
              waypoints[idx] = {
                x: waypoints[idx].x + (Number(delta.dx) || 0),
                y: waypoints[idx].y + (Number(delta.dy) || 0),
              };
            }
          });

          const tentativePoints = [{x: startX, y: startY}, ...waypoints, {x: endX, y: endY}];
          const isOrthogonal = tentativePoints.every((point, i) => {
            if (i === 0) return true;
            const prev = tentativePoints[i - 1];
            const sameX = Math.abs(point.x - prev.x) < 0.5;
            const sameY = Math.abs(point.y - prev.y) < 0.5;
            return sameX || sameY;
          });

          if (!isOrthogonal) {
            waypointOverrides.current.delete(connector.id);
            removedInvalidOverride = true;
            // Rebuild default waypoints for this connector without overrides.
            if (endX >= startX) {
              const exitX = startX + pad;
              waypoints = [{x: exitX, y: startY}, {x: exitX, y: endY}];
            } else if (gapBetween >= MIN_GAP) {
              const maxRight = Math.max(startX, endXRight);
              const exitX = maxRight + pad;
              const laneY = goingDown
                ? (parentBottom + childTop) / 2
                : (childBottom + parentTop) / 2;
              waypoints = [{x: exitX, y: startY}, {x: exitX, y: laneY}, {x: endX - pad, y: laneY}, {x: endX - pad, y: endY}];
            } else {
              const maxRight = Math.max(startX, endXRight);
              const exitX = maxRight + pad;
              const allTop = Math.min(parentTop, childTop);
              const allBottom = Math.max(parentBottom, childBottom);
              const laneY = goingDown ? allBottom + 8 : allTop - 8;
              waypoints = [{x: exitX, y: startY}, {x: exitX, y: laneY}, {x: endX - pad, y: laneY}, {x: endX - pad, y: endY}];
            }
          }
        }

        // Build SVG path from waypoints
        const allPoints = [{x: startX, y: startY}, ...waypoints, {x: endX, y: endY}];
        const d = allPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        return [{ id: connector.id, d, kind: connector.kind, waypoints }];
      });

      setDependencyConnectorPaths(nextPaths);
      if (removedInvalidOverride) persistWaypointOverrides();
    };

    // Triple-rAF: wait for React render + browser layout + paint to fully settle
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(measure);
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [allAssignmentsMap, colWidth, collapsedModules, collapsedTasks, collapsedProjects, dependencyConnectorDefs, displayMode, filteredProjects, stickyLeftOffset, visibleColRange, remeasureCounter, persistWaypointOverrides]);

  const getStoredActualDate = useCallback((assignmentId: string): string | null => {
    actualDateVersion;
    return actualDateOverrides.current.get(assignmentId) || null;
  }, [actualDateVersion]);

  const getPlannedAssignmentEndDate = useCallback((assignment: TaskAssignment): string | null => {
    if (!assignment.startDate || !assignment.duration || assignment.duration <= 0) return null;
    const resourceName = assignment.resourceName || 'Unassigned';
    const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
    return calculateEndDate(assignment.startDate, assignment.duration, assignmentHolidaysMap);
  }, [resourceHolidaysMap]);

  const getValidatedActualDate = useCallback((assignment: TaskAssignment): string | null => {
    const storedActualDate = getStoredActualDate(assignment.id);
    if (!storedActualDate || !assignment.startDate || !assignment.duration) return null;
    
    // Validate: actual date must be after start date
    if (storedActualDate < assignment.startDate) {
      return null;
    }
    
    return storedActualDate;
  }, [getStoredActualDate]);

  const getEffectiveAssignmentEndDate = useCallback((assignment: TaskAssignment): string | null => {
    const plannedEndDate = getPlannedAssignmentEndDate(assignment);
    if (!plannedEndDate) return null;
    const actualCompletionDate = getValidatedActualDate(assignment);
    return actualCompletionDate && actualCompletionDate > plannedEndDate ? actualCompletionDate : plannedEndDate;
  }, [getPlannedAssignmentEndDate, getValidatedActualDate]);

  const getLateCompletionWorkingDays = useCallback((assignment: TaskAssignment, plannedEndDate: string, actualCompletionDate: string | null): number => {
    if (!actualCompletionDate || actualCompletionDate <= plannedEndDate) return 0;
    const resourceName = assignment.resourceName || 'Unassigned';
    const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
    const totalInclusive = calculateWorkingDaysBetween(plannedEndDate, actualCompletionDate, assignmentHolidaysMap);
    const plannedEndDateObj = new Date(plannedEndDate.replace(/-/g, '/'));
    const plannedEndDay = plannedEndDateObj.getDay();
    const plannedEndHolidayDeduction = assignmentHolidaysMap.get(plannedEndDate) || 0;
    const plannedEndCapacity = (plannedEndDay !== 0 && plannedEndDay !== 6) ? Math.max(0, 1 - plannedEndHolidayDeduction) : 0;
    return Math.max(0, Math.round(totalInclusive - plannedEndCapacity));
  }, [resourceHolidaysMap]);

  const calculateActualProgressFromDate = useCallback((assignment: TaskAssignment, dateText: string | null): number => {
    if (!dateText || !assignment.startDate || !assignment.duration || assignment.duration <= 0) {
      return clampProgress(assignment.progress);
    }

    const resourceName = assignment.resourceName || 'Unassigned';
    const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
    const plannedEndDate = calculateEndDate(assignment.startDate, assignment.duration, assignmentHolidaysMap);
    if (dateText <= assignment.startDate) {
      return 0;
    } else if (dateText >= plannedEndDate) {
      return 100;
    } else {
      const totalInclusive = calculateWorkingDaysBetween(assignment.startDate, dateText, assignmentHolidaysMap);
      const startDateObj = new Date(assignment.startDate.replace(/-/g, '/'));
      const startDay = startDateObj.getDay();
      const startHolidayDeduction = assignmentHolidaysMap.get(assignment.startDate) || 0;
      const startCapacity = (startDay !== 0 && startDay !== 6) ? Math.max(0, 1 - startHolidayDeduction) : 0;
      const elapsedWorkingDays = Math.max(0, totalInclusive - startCapacity);
      return clampProgress(Math.round((elapsedWorkingDays / assignment.duration) * 100));
    }
  }, [resourceHolidaysMap]);

  const getEffectiveAssignmentActualProgress = useCallback((assignment: TaskAssignment): number | null => {
    const actualCompletionDate = getValidatedActualDate(assignment);
    if (actualCompletionDate) {
      return calculateActualProgressFromDate(assignment, actualCompletionDate);
    }

    if (typeof assignment.progress === 'number') {
      return clampProgress(assignment.progress);
    }

    return null;
  }, [calculateActualProgressFromDate, getValidatedActualDate]);

  const getAggregateActualProgress = useCallback((assignments: TaskAssignment[], fallbackProgress: number): number => {
    const actualValues = assignments
      .map((assignment) => getEffectiveAssignmentActualProgress(assignment))
      .filter((value): value is number => value !== null);

    return actualValues.length > 0 ? averageProgress(actualValues) : fallbackProgress;
  }, [getEffectiveAssignmentActualProgress]);

  const areAssignmentsComplete = useCallback((assignments: TaskAssignment[]): boolean => {
    const relevantAssignments = assignments.filter((assignment) => assignment.startDate && assignment.duration && assignment.duration > 0);
    const assignmentsToCheck = relevantAssignments.length > 0 ? relevantAssignments : assignments;

    return assignmentsToCheck.length > 0 && assignmentsToCheck.every((assignment) => {
      const actualCompletionDate = getValidatedActualDate(assignment);
      if (actualCompletionDate) return true;
      return clampProgress(assignment.progress) >= 100;
    });
  }, [getValidatedActualDate]);

  const setActualCompletionDate = useCallback((assignment: TaskAssignment, dateText: string) => {
    if (isReadOnly || !assignment.startDate || !assignment.duration || assignment.duration <= 0) return;

    const normalizedDate = dateText < assignment.startDate ? assignment.startDate : dateText;
    actualDateOverrides.current.set(assignment.id, normalizedDate);
    persistActualDateOverrides();
    setActualDateVersion(prev => prev + 1);
    onSetActualDate?.(assignment.id, normalizedDate);
  }, [isReadOnly, persistActualDateOverrides, onSetActualDate]);

  const clearActualCompletionDate = useCallback((assignment: TaskAssignment) => {
    if (isReadOnly) return;
    actualDateOverrides.current.delete(assignment.id);
    persistActualDateOverrides();
    setActualDateVersion(prev => prev + 1);
    onSetActualDate?.(assignment.id, null);
  }, [isReadOnly, persistActualDateOverrides, onSetActualDate]);

  const clearActualDatesForAssignments = useCallback((assignments: TaskAssignment[]) => {
    if (isReadOnly || assignments.length === 0) return;
    let changed = false;
    assignments.forEach((assignment) => {
      if (actualDateOverrides.current.has(assignment.id)) {
        actualDateOverrides.current.delete(assignment.id);
        changed = true;
      }
    });
    if (changed) {
      persistActualDateOverrides();
      setActualDateVersion(prev => prev + 1);
    }
  }, [isReadOnly, persistActualDateOverrides]);

  return (
    <>
      <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        {/* Ghost Resize Line */}
        <div 
            ref={resizeGhostRef} 
            className="fixed top-0 bottom-0 w-0.5 bg-indigo-500 z-[100] hidden pointer-events-none border-l border-dashed border-indigo-200"
            style={{ display: 'none' }}
        ></div>

        <div className="px-4 py-2.5 border-b border-slate-200/80 flex justify-between items-center bg-white/90 backdrop-blur-sm gap-3 relative z-[120]">
          <div className="flex items-center gap-2 flex-wrap">
             <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-200"><Calendar className="w-4 h-4 text-slate-500" /><span className="text-xs font-semibold uppercase tracking-wide text-slate-700">Timeline</span></div>
             <div className="relative">
                <button ref={toggleButtonRef} onClick={(e) => { e.stopPropagation(); setShowToggleMenu(!showToggleMenu); }} className="h-8 w-8 flex items-center justify-center gap-0.5 bg-white text-slate-600 rounded-md hover:bg-slate-50 border border-slate-300 transition-colors" title="View Options">
                  <Eye size={16} /> <ChevronDown size={10} />
                </button>
                {showToggleMenu && (
                  <div className="toggle-menu absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-[140] py-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { handleToggleModules(); setShowToggleMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><ChevronsDownUp size={14} /> Toggle All Modules</button>
                    <button onClick={() => { handleToggleResources(); setShowToggleMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><EyeOff size={14} /> Toggle Resources Only</button>
                  </div>
                )}
            </div>
            
            {/* Filter Input - Multi-select Dropdown with Search */}
            <div className="relative">
                <button 
                    ref={filterButtonRef}
                    onClick={() => setShowResourceFilter(!showResourceFilter)}
                  className={`h-8 w-8 flex items-center justify-center rounded-md border transition-colors relative ${selectedResources.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                    title="Filter Resources"
                >
                    <Filter size={16} />
                    {selectedResources.length > 0 && <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>}
                </button>
                {showResourceFilter && (
                    <div className="filter-menu absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-xl z-[140] animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-80">
                        <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-t-lg space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">Select Resources</span>
                                {selectedResources.length > 0 && (
                                    <button onClick={() => setSelectedResources([])} className="text-[10px] text-red-500 hover:text-red-700">Clear</button>
                                )}
                            </div>
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={resourceSearchTerm}
                                    onChange={(e) => setResourceSearchTerm(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full pl-6 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto p-1 custom-scrollbar">
                            {uniqueResourceNames
                                .filter(name => name.toLowerCase().includes(resourceSearchTerm.toLowerCase()))
                                .map(name => (
                                <label key={name} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer rounded text-xs text-slate-700">
                                    <input 
                                        type="checkbox" 
                                        className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                                        checked={selectedResources.includes(name)}
                                        onChange={() => toggleResourceSelection(name)}
                                    />
                                    <span className="truncate">{name}</span>
                                </label>
                            ))}
                            {uniqueResourceNames.filter(name => name.toLowerCase().includes(resourceSearchTerm.toLowerCase())).length === 0 && (
                                <div className="p-2 text-xs text-slate-400 text-center">No resources found</div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-md p-1">
                <button onClick={() => setDisplayMode('gantt')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${displayMode === 'gantt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Gantt View (Timeline Bars)"><CalendarRange size={14} /> Gantt</button>
                <button onClick={() => setDisplayMode('allocation')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${displayMode === 'allocation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Grid View (Allocations)"><LayoutList size={14} /> Grid</button>
            </div>
            {displayMode === 'gantt' && (
              <>
                <div className="h-4 w-px bg-slate-200"></div>
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-md p-1">
                  <button
                    onClick={() => setDependencyViewMode(dependencyViewMode === 'detailed' ? 'none' : 'detailed')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${dependencyViewMode === 'detailed' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Show assignment-level dependency lines (click again to hide)"
                  >
                    Detailed
                  </button>
                  <button
                    onClick={() => setDependencyViewMode(dependencyViewMode === 'summary' ? 'none' : 'summary')}
                    className={`px-2 py-1 text-[11px] font-medium rounded-md transition-colors ${dependencyViewMode === 'summary' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                    title="Show module-level summary dependency lines only (click again to hide)"
                  >
                    Summary
                  </button>
                </div>
                <button
                  onClick={() => {
                    setIsDependencyLinkMode(prev => {
                      const next = !prev;
                      if (!next) setPendingDependencySourceId(null);
                      return next;
                    });
                  }}
                  aria-label="Toggle Link Mode"
                  className={`h-8 w-8 flex items-center justify-center text-xs font-medium rounded-md border transition-colors ${isDependencyLinkMode ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                  title="Quick dependency linking"
                >
                  <Link2 size={14} />
                </button>
                {dependencyConnectorPaths.length > 0 && (
                  <button
                    onClick={() => {
                      waypointOverrides.current = new Map();
                      try { localStorage.removeItem('oms_dependency_waypoints'); } catch {}
                      setRemeasureCounter(c => c + 1);
                    }}
                    aria-label="Reset dependency lines"
                    className="h-8 w-8 flex items-center justify-center text-xs font-medium rounded-md border bg-white border-slate-300 text-slate-600 hover:bg-slate-50 transition-colors"
                    title="Reset all dependency line positions to auto"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
                {isDependencyLinkMode && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 bg-indigo-50/70 border border-indigo-100 rounded-lg px-2 py-1">
                    <span>Select predecessor, then click successor</span>
                    {pendingDependencySourceId && <span className="font-semibold text-indigo-700 truncate max-w-48">{pendingDependencySourceLabel}</span>}
                    {pendingDependencySourceId && (
                      <button onClick={() => setPendingDependencySourceId(null)} className="text-slate-400 hover:text-red-500">Clear</button>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="h-4 w-px bg-slate-200"></div>
            <button
              onClick={captureBaselineSnapshot}
              aria-label="Save baseline"
              className="h-8 w-8 text-xs flex items-center justify-center bg-white border border-slate-300 text-slate-600 rounded-md hover:bg-slate-50 transition-colors"
              title="Capture current start/duration as baseline"
            >
              <CheckSquare size={14} />
            </button>
            <button
              onClick={() => setShowBaselineDiff(prev => !prev)}
              disabled={Object.keys(baselineSnapshot).length === 0}
              aria-label="Toggle baseline delta"
              className={`h-8 w-8 text-xs flex items-center justify-center border rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${showBaselineDiff ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
              title="Toggle baseline difference badges"
            >
              {showBaselineDiff ? <CheckSquare size={14} /> : <Square size={14} />}
            </button>
            {baselineDiffSummary.total > 0 && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1" title="Assignments changed vs baseline">
                Delta {baselineDiffSummary.total}
              </span>
            )}
            <div className="h-4 w-px bg-slate-200"></div>
            <div className="h-8 flex items-center gap-2 px-2.5 rounded-md border border-slate-300 bg-white" title="Adjust Column Width">
              <Settings2 size={14} className="text-slate-400" />
              <input type="range" min="20" max="100" value={colWidthBase} onChange={(e) => setColWidthBase(parseInt(e.target.value))} className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
          </div>
          <div className="flex gap-2 items-center flex-wrap justify-end">
            <div className="flex items-center gap-2">
                {onUndo && (
                    <button onClick={onUndo} disabled={!canUndo} className="h-8 w-8 flex items-center justify-center bg-white text-slate-600 rounded-md hover:bg-slate-50 border border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
                        <Undo2 size={16} />
                    </button>
                )}
                <button onClick={onRefresh} disabled={isRefreshing} className="h-8 w-8 flex items-center justify-center bg-white text-slate-600 rounded-md hover:bg-slate-50 border border-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Refresh data">
                    <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                </button>
                <SaveStatusIndicator status={saveStatus} />
                <input type="file" ref={importInputRef} accept=".xlsx, .xls" className="hidden" />
            </div>
            <div className="w-px h-4 bg-slate-200"></div>
            {!isReadOnly && <button onClick={onAddProject} aria-label="Add Project" className="h-8 w-8 text-xs flex items-center justify-center bg-slate-900 text-white rounded-md hover:bg-slate-800 transition-colors" title="Add Project"><Plus size={14} /></button>}
            <div className="flex bg-slate-100 border border-slate-200 p-1 rounded-md">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{mode}</button>
              ))}
            </div>
            {displayMode === 'gantt' && (
              <div className="hidden xl:flex items-center gap-2 ml-1 pl-2 border-l border-slate-200">
                <div className="flex items-center gap-1" title="Actual Progress"><div className="w-2 h-2 rounded-full bg-slate-700"></div><span className="text-[9px] text-slate-400">Actual</span></div>
                <div className="flex items-center gap-1" title="Planned Progress"><div className="w-3 h-0.5 bg-white border border-slate-400"></div><span className="text-[9px] text-slate-400">Plan</span></div>
                <div className="flex items-center gap-1" title="In Progress"><div className="w-2 h-2 rounded-full bg-blue-400"></div><span className="text-[9px] text-slate-400">Active</span></div>
                <div className="flex items-center gap-1" title="Overdue"><div className="w-2 h-2 rounded-full bg-red-400 ring-1 ring-red-400"></div><span className="text-[9px] text-slate-400">Overdue</span></div>
                <div className="flex items-center gap-1" title="Completed"><div className="w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-emerald-400"></div><span className="text-[9px] text-slate-400">Done</span></div>
              </div>
            )}
          </div>
        </div>

        <div ref={scrollContainerRef} className="overflow-auto custom-scrollbar flex-1 relative">
          <div ref={ganttSurfaceRef} className="min-w-max relative">
              <>
                {/* Header Rows */}
                <div className="flex bg-slate-200 border-b border-slate-200 sticky top-0 z-[60] h-8 items-center">
                  <div className="flex-shrink-0 px-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-100 z-[60] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] relative group h-full flex items-center text-xs" style={stickyStyle}>
                    Project Structure
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('sidebar', sidebarWidth, e)}></div>
                  </div>
                  
                  {/* Start Column Header */}
                  <div className={`flex-shrink-0 flex items-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                    <div className="flex items-center justify-between w-full">
                        <button onClick={() => setIsDetailsFrozen(!isDetailsFrozen)} title={isDetailsFrozen ? 'Unfreeze columns' : 'Freeze columns'} className="text-slate-400 hover:text-indigo-600 mr-1">{isDetailsFrozen ? <PinOff size={14} /> : <Pin size={14} />}</button>
                        <span className="flex-1 text-center">Start</span>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('start', startColWidth, e)}></div>
                  </div>

                  {/* Duration Column Header */}
                  <div className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                    <span>Days</span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('duration', durationColWidth, e)}></div>
                  </div>

                  {/* Dependency Column Header */}
                  <div title="Dependency" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}>
                    <Link2 size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('dependency', dependencyColWidth, e)}></div>
                  </div>

                  {Object.values(yearHeaders).map((group: { label: string, colspan: number }, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-700 border-r border-slate-300 uppercase tracking-wider h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                </div>
                {showMonthRow && (
                  <div className="flex bg-slate-100 border-b border-slate-200 sticky top-8 z-[59] h-8 items-center">
                    <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-100 z-[60] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full" style={stickyStyle}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                    {Object.values(monthHeaders).map((group: { label: string, colspan: number }, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-600 border-r border-slate-200 uppercase h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                  </div>
                )}
                <div className={`flex bg-slate-50 border-b border-slate-200 sticky z-[58] shadow-sm h-8 items-center ${showMonthRow ? 'top-16' : 'top-8'}`}>
                  <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-[60] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full" style={stickyStyle}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky z-[50]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
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
                    className="absolute top-0 bottom-0 pointer-events-none z-[5] border-l-2 border-r-2 border-amber-400 bg-amber-400/10"
                    style={{
                        left: stickyLeftOffset + (currentColumnIndex * colWidth),
                        width: colWidth
                    }}
                />
            )}

            {displayMode === 'gantt' && dependencyConnectorPaths.length > 0 && (
                <svg
                  className="absolute inset-0 pointer-events-none z-[15] overflow-visible"
                  aria-hidden="true"
                  style={{ pointerEvents: draggingSegment ? 'auto' : 'none' }}
                >
                  <defs>
                    <marker id="dependency-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#6366f1" />
                    </marker>
                    <marker id="dependency-arrow-summary" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
                      <path d="M0,0 L7,3.5 L0,7 z" fill="#475569" />
                    </marker>
                  </defs>
                  {dependencyConnectorPaths.map((connector) => {
                    const allPoints = connector.d.split(/[ML]\s*/).filter(Boolean).map(s => {
                      const [x, y] = s.trim().split(/\s+/).map(Number);
                      return {x, y};
                    });
                    return (
                    <g key={connector.id}>
                      <path
                        d={connector.d}
                        fill="none"
                        stroke={connector.kind === 'summary' ? '#475569' : '#6366f1'}
                        strokeWidth={connector.kind === 'summary' ? '2' : '1.5'}
                        strokeDasharray={connector.kind === 'summary' ? '0' : '3 2'}
                        markerEnd={connector.kind === 'summary' ? 'url(#dependency-arrow-summary)' : 'url(#dependency-arrow)'}
                        opacity={connector.kind === 'summary' ? '0.8' : '0.9'}
                      />
                      {/* Draggable line segments — thick invisible hit targets over each segment */}
                      {!isReadOnly && allPoints.slice(0, -1).map((p1, segIdx) => {
                        const p2 = allPoints[segIdx + 1];
                        const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
                        // Which waypoint indices are affected (0-based into connector.waypoints)
                        // allPoints[0] = start (anchored), allPoints[last] = end (anchored)
                        // allPoints[k] = waypoints[k-1] for k in 1..waypoints.length
                        const existingOverrides = waypointOverrides.current.get(connector.id);
                        const affected: Array<{idx: number; x: number; y: number; startDx: number; startDy: number}> = [];
                        if (segIdx >= 1 && segIdx <= connector.waypoints.length) {
                          const wpIdx = segIdx - 1;
                          const saved = existingOverrides?.get(wpIdx);
                          affected.push({
                            idx: wpIdx,
                            x: connector.waypoints[wpIdx].x,
                            y: connector.waypoints[wpIdx].y,
                            startDx: saved?.dx ?? 0,
                            startDy: saved?.dy ?? 0,
                          });
                        }
                        if (segIdx + 1 >= 1 && segIdx + 1 <= connector.waypoints.length) {
                          const wpIdx = segIdx;
                          const saved = existingOverrides?.get(wpIdx);
                          affected.push({
                            idx: wpIdx,
                            x: connector.waypoints[wpIdx].x,
                            y: connector.waypoints[wpIdx].y,
                            startDx: saved?.dx ?? 0,
                            startDy: saved?.dy ?? 0,
                          });
                        }
                        if (affected.length === 0) return null; // both endpoints anchored, can't drag
                        return (
                          <line
                            key={`${connector.id}-seg-${segIdx}`}
                            x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                            stroke="transparent"
                            strokeWidth={12}
                            className={isHorizontal ? 'cursor-ns-resize' : 'cursor-ew-resize'}
                            style={{ pointerEvents: 'auto' }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const rect = (ganttSurfaceRef.current || e.currentTarget.closest('svg')!).getBoundingClientRect();
                              setDraggingSegment({
                                connectorId: connector.id,
                                segmentIndex: segIdx,
                                orientation: isHorizontal ? 'horizontal' : 'vertical',
                                affectedWaypointIndices: affected.map(a => a.idx),
                                startMouseX: e.clientX - rect.left,
                                startMouseY: e.clientY - rect.top,
                                startPositions: affected,
                              });
                            }}
                          />
                        );
                      })}
                    </g>
                    );
                  })}
                </svg>
            )}

            {filteredProjects.map((project) => {
              const isProjectCollapsed = collapsedProjects[project.id];
              const isEditingProject = editingId === `project::${project.id}`;
              
              // Calculate Project Summary Data
              let projectEarliestStart: string | null = null;
              let projectLatestEnd: Date | null = null;
              let projectPlannedLatestEnd: Date | null = null;
              const projectAssignments = project.modules.flatMap(m => m.tasks.flatMap(t => t.assignments));
              
              if (displayMode === 'gantt' && isProjectCollapsed) {
                  project.modules.forEach(m => {
                      m.tasks.forEach(t => {
                          t.assignments.forEach(a => {
                              if (a.startDate && a.duration) {
                                const endDateStr = getEffectiveAssignmentEndDate(a);
                                if (!endDateStr) return;
                                  const endDate = new Date(endDateStr.replace(/-/g, '/'));
                                  const plannedEndDateStr = getPlannedAssignmentEndDate(a);
                                  const plannedEndDate = plannedEndDateStr ? new Date(plannedEndDateStr.replace(/-/g, '/')) : null;
                                  
                                  if (!projectEarliestStart || a.startDate < projectEarliestStart) projectEarliestStart = a.startDate;
                                  if (!projectLatestEnd || endDate > projectLatestEnd) projectLatestEnd = endDate;
                                  if (plannedEndDate && (!projectPlannedLatestEnd || plannedEndDate > projectPlannedLatestEnd)) projectPlannedLatestEnd = plannedEndDate;
                              }
                          });
                      });
                  });
              }
              
              const projectPlannedEndForProgress = projectPlannedLatestEnd || projectLatestEnd;
              const projectProgress = (projectEarliestStart && projectPlannedEndForProgress) 
                  ? calculateTimeBasedProgress(projectEarliestStart, formatDateForInput(projectPlannedEndForProgress)) 
                  : 0;
              const projectIsComplete = areAssignmentsComplete(projectAssignments);
              const projectActualProgress = projectIsComplete
                ? 100
                : getAggregateActualProgress(projectAssignments, projectProgress);
                  
              const { projectStartIndex, projectEndIndex } = (() => {
                  if (!projectEarliestStart || !projectLatestEnd) return { projectStartIndex: -1, projectEndIndex: -1 };
                  const startIdx = getColumnIndex(projectEarliestStart);
                  const endIdx = getColumnIndex(formatDateForInput(projectLatestEnd));
                  return { projectStartIndex: startIdx, projectEndIndex: endIdx };
              })();

              return (
                <React.Fragment key={project.id}>
                  <div className="flex bg-slate-700 border-b border-slate-600 sticky z-[50] group">
                    <div className="flex-shrink-0 px-3 py-1.5 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 z-[50] cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'project', x: e.pageX, y: e.pageY, projectId: project.id }); }}>
                      <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => !isEditingProject && toggleProject(project.id)}>
                        {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                        <Folder className="w-3.5 h-3.5 text-slate-200" />
                        {isEditingProject ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-slate-600 text-white text-xs font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="font-bold text-xs truncate select-none flex-1" onDoubleClick={(e) => startEditing(`project::${project.id}`, project.name, e)} title="Double click to rename">{project.name}</span> )}
                      </div>
                    </div>
                    {/* Project Row Spacers - z-49 */}
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky z-[49]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky z-[49]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky z-[49]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                    
                    <div className="flex relative">
                      {isProjectCollapsed && displayMode === 'gantt' && projectStartIndex > -1 && projectEndIndex > -1 && (
                          <div
                              className="absolute top-1/2 -translate-y-1/2 h-3.5 z-10 bg-slate-500 rounded flex items-center overflow-hidden border border-slate-400 group/projbar"
                              style={{
                                  left: `${projectStartIndex * colWidth + 2}px`,
                                  width: `${(projectEndIndex - projectStartIndex + 1) * colWidth - 4}px`,
                              }}
                          >
                                <div className="absolute inset-y-0 left-0 bg-white/25 border-r border-white/50" style={{ width: `${projectProgress}%` }}></div>
                                <div className="h-full bg-slate-400" style={{ width: `${projectActualProgress}%` }}></div>
                                <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold">A{projectActualProgress}% / P{projectProgress}%</span>
                          </div>
                      )}
                      {leftSpacerW > 0 && <div className="flex-shrink-0" style={{width: leftSpacerW}} />}
                      {timeline.slice(colStart, colEnd).map(col => { const total = getProjectTotal(project, col); return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-600 flex items-center justify-center bg-slate-700`} style={{ width: `${colWidth}px` }}>{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-bold text-slate-200">{formatValue(total)}</span>)}</div> ); })}
                      {rightSpacerW > 0 && <div className="flex-shrink-0" style={{width: rightSpacerW}} />}
                    </div>
                  </div>

                  {!isProjectCollapsed && project.modules.map((module, index) => {
                    const isModuleCollapsed = collapsedModules[module.id] || (collapseAllByDefault && !hasInitializedCollapse.current);
                    const moduleEditId = `module::${project.id}::${module.id}`;
                    const isEditingModule = editingId === moduleEditId;
                    const moduleType = module.type || ModuleType.Development;
                      const style = MODULE_TYPE_STYLES[moduleType] || MODULE_TYPE_STYLES[ModuleType.Development];
                    const Icon = style.icon;

                    let moduleEarliestStartDate: string | null = null;
                    let moduleLatestEndDate: Date | null = null;
                    let modulePlannedLatestEnd: Date | null = null;
                    let moduleTotalDuration = 0;
                    
                    const allAssignments = module.tasks.flatMap(t => t.assignments);
                    if (allAssignments.length > 0) {
                        let earliestDateObj: Date | null = null;
                        
                        allAssignments.forEach(assignment => {
                            if (!assignment.startDate || !assignment.duration) return;
                            
                            // Calculate effective start date considering dependency delay
                            let effectiveStartDate = assignment.startDate;
                            if (assignment.parentAssignmentId) {
                                const parentAssignment = allAssignmentsMap.get(assignment.parentAssignmentId);
                                if (parentAssignment) {
                                    const parentEffectiveEnd = getEffectiveAssignmentEndDate(parentAssignment);
                                    const parentPlannedEnd = getPlannedAssignmentEndDate(parentAssignment);
                                    if (parentEffectiveEnd && parentPlannedEnd && parentEffectiveEnd > parentPlannedEnd) {
                                        const resourceName = assignment.resourceName || 'Unassigned';
                                        const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
                                        const pushedStart = findNextWorkingDay(parentEffectiveEnd, assignmentHolidaysMap);
                                        if (pushedStart > assignment.startDate) {
                                            effectiveStartDate = pushedStart;
                                        }
                                    }
                                }
                            }
                            
                            const startDate = new Date(effectiveStartDate.replace(/-/g, '/'));
                            if (!earliestDateObj || startDate < earliestDateObj) {
                                earliestDateObj = startDate;
                            }
                            
                            // Calculate effective end date with dependency-adjusted start
                            const resourceName = assignment.resourceName || 'Unassigned';
                            const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
                            const endDateWithDependency = calculateEndDate(effectiveStartDate, assignment.duration, assignmentHolidaysMap);
                            const plannedEndStr = getPlannedAssignmentEndDate(assignment);
                            const actualCompletionDate = getValidatedActualDate(assignment);
                            const endDateStr = actualCompletionDate && actualCompletionDate > endDateWithDependency ? actualCompletionDate : endDateWithDependency;
                            
                            if (!endDateStr) return;
                            const endDate = new Date(endDateStr.replace(/-/g, '/'));
                            if (!moduleLatestEndDate || endDate > moduleLatestEndDate) {
                                moduleLatestEndDate = endDate;
                            }
                            
                            if (plannedEndStr) {
                                const plannedEnd = new Date(plannedEndStr.replace(/-/g, '/'));
                                if (!modulePlannedLatestEnd || plannedEnd > modulePlannedLatestEnd) {
                                    modulePlannedLatestEnd = plannedEnd;
                                }
                            }
                        });
                        
                        if (earliestDateObj && moduleLatestEndDate) {
                            moduleEarliestStartDate = formatDateForInput(earliestDateObj);
                            moduleTotalDuration = calculateWorkingDaysBetween(moduleEarliestStartDate, formatDateForInput(moduleLatestEndDate), projectHolidayMap);
                        }
                    }
                    
                    const modulePlannedEndForProgress = modulePlannedLatestEnd || moduleLatestEndDate;
                    const moduleProgress = (moduleEarliestStartDate && modulePlannedEndForProgress)
                      ? calculateTimeBasedProgress(moduleEarliestStartDate, formatDateForInput(modulePlannedEndForProgress))
                      : 0;
                    const moduleIsComplete = areAssignmentsComplete(allAssignments);
                    const moduleActualProgress = moduleIsComplete ? 100 : getAggregateActualProgress(allAssignments, moduleProgress);

                    const { moduleStartIndex, moduleEndIndex, modulePlannedEndIndex } = (() => {
                        if (!moduleEarliestStartDate || !moduleLatestEndDate) return { moduleStartIndex: -1, moduleEndIndex: -1, modulePlannedEndIndex: -1 };
                        
                        const startIdx = getColumnIndex(moduleEarliestStartDate);
                        const endIdx = getColumnIndex(formatDateForInput(moduleLatestEndDate));
                        const plannedEndIdx = modulePlannedLatestEnd ? getColumnIndex(formatDateForInput(modulePlannedLatestEnd)) : endIdx;

                        return { moduleStartIndex: startIdx, moduleEndIndex: endIdx, modulePlannedEndIndex: plannedEndIdx };
                    })();
                    const moduleDelayColSpan = moduleEndIndex > modulePlannedEndIndex && modulePlannedEndIndex > -1 ? moduleEndIndex - modulePlannedEndIndex : 0;


                    return (
                      <div key={module.id} draggable={!isReadOnly} onDragStart={(e) => handleModuleDragStart(e, index)} onDragOver={handleModuleDragOver} onDrop={(e) => handleModuleDrop(e, project.id, module.id, index)} className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'module', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id }); }}>
                        <div className={`flex ${style.bgColor} border-b border-slate-100 ${style.hoverBgColor} transition-colors group`}>
                          <div className={`flex-shrink-0 py-1.5 px-3 pl-6 border-r border-slate-200 sticky left-0 ${style.bgColor} z-[40] flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
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
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? 'sticky z-[39]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                            {isModuleCollapsed && moduleEarliestStartDate && <span title="Earliest Start Date" className={`${style.ganttGridColor} rounded p-1`}>{moduleEarliestStartDate}</span>}
                          </div>
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? 'sticky z-[39]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                            {isModuleCollapsed && moduleTotalDuration > 0 && <span title="Total Duration" className={`${style.ganttGridColor} rounded p-1`}>{moduleTotalDuration}d</span>}
                          </div>
                          <div className={`flex-shrink-0 border-r border-slate-200 ${style.bgColor} ${isDetailsFrozen ? 'sticky z-[39]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>

                          <div className="flex relative">
                             {displayMode === 'gantt' && moduleStartIndex > -1 && moduleEndIndex > -1 && (
                                <>
                                <div
                                ref={(node) => setModuleBarRef(module.id, node)}
                                    className={`absolute top-1/2 -translate-y-1/2 h-4 z-10 ${style.ganttBarColor} rounded-md flex items-center overflow-hidden group/modbar ${(isModuleCollapsed || dependencyViewMode === 'summary' || dependencyViewMode === 'none') ? '' : 'invisible'}`}
                                    style={{
                                        left: `${moduleStartIndex * colWidth + 2}px`,
                                        width: `${((moduleDelayColSpan > 0 ? modulePlannedEndIndex : moduleEndIndex) - moduleStartIndex + 1) * colWidth - 4}px`,
                                    }}
                                    title={`Duration: ${moduleTotalDuration} working days`}
                                >
                                    <div className="absolute inset-y-0 left-0 bg-white/20 border-r border-white/40" style={{ width: `${moduleProgress}%` }}></div>
                                    <div className="h-full bg-black/10" style={{ width: `${moduleActualProgress}%` }}></div>
                                    <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/90 font-bold select-none pointer-events-none drop-shadow-md">
                                      A{moduleActualProgress}% / P{moduleProgress}%
                                    </span>
                                </div>
                                {moduleDelayColSpan > 0 && (
                                    <div
                                        className={`absolute top-1/2 -translate-y-1/2 h-4 z-[9] rounded-r pointer-events-none ${(isModuleCollapsed || dependencyViewMode === 'summary' || dependencyViewMode === 'none') ? '' : 'invisible'}`}
                                        style={{
                                            left: `${(modulePlannedEndIndex + 1) * colWidth}px`,
                                            width: `${moduleDelayColSpan * colWidth - 2}px`,
                                            background: 'repeating-linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.2) 3px, rgba(245,158,11,0.35) 3px, rgba(245,158,11,0.35) 6px)',
                                            borderTop: '1.5px solid rgb(245,158,11)',
                                            borderBottom: '1.5px solid rgb(245,158,11)',
                                            borderRight: '1.5px solid rgb(245,158,11)',
                                        }}
                                        title={`Actual completion extended beyond module plan`}
                                    />
                                )}
                                </>
                             )}
                            {leftSpacerW > 0 && <div className="flex-shrink-0" style={{width: leftSpacerW}} />}
                            {timeline.slice(colStart, colEnd).map(col => {
                                const total = getModuleTotal(module, col);
                                return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center ${style.bgColor} relative`} style={{ width: `${colWidth}px` }}>
                                    {total > 0 && displayMode === 'allocation' && (<span className={`text-[10px] font-bold ${style.totalTextColor} relative z-10`}>{formatValue(total)}</span>)}
                                </div> );
                            })}
                            {rightSpacerW > 0 && <div className="flex-shrink-0" style={{width: rightSpacerW}} />}
                          </div>

                        </div>

                        {!isModuleCollapsed && module.tasks.map((task, taskIndex) => {
                          const taskEditId = `task::${project.id}::${module.id}::${task.id}`;
                          const isTaskCollapsed = collapsedTasks[task.id] || (collapseAllByDefault && !hasInitializedCollapse.current);
                          const isEditingTask = editingId === taskEditId;
                          let earliestStartDate: string | null = null;
                          let latestEndDate: Date | null = null;
                          let taskPlannedLatestEnd: Date | null = null;
                          let totalDuration = 0;

                          if (task.assignments.length > 0) {
                              let earliestDateObj: Date | null = null;
                              task.assignments.forEach(assignment => {
                                  if (!assignment.startDate || !assignment.duration) return;
                                  const startDate = new Date(assignment.startDate.replace(/-/g, '/'));
                                  if (!earliestDateObj || startDate < earliestDateObj) {
                                      earliestDateObj = startDate;
                                  }
                                  const endDateStr = getEffectiveAssignmentEndDate(assignment);
                                  if (!endDateStr) return;
                                  const endDate = new Date(endDateStr.replace(/-/g, '/'));
                                  if (!latestEndDate || endDate > latestEndDate) {
                                      latestEndDate = endDate;
                                  }
                                  const plannedEndStr = getPlannedAssignmentEndDate(assignment);
                                  if (plannedEndStr) {
                                      const plannedEnd = new Date(plannedEndStr.replace(/-/g, '/'));
                                      if (!taskPlannedLatestEnd || plannedEnd > taskPlannedLatestEnd) {
                                          taskPlannedLatestEnd = plannedEnd;
                                      }
                                  }
                              });
                              if (earliestDateObj && latestEndDate) {
                                  earliestStartDate = formatDateForInput(earliestDateObj);
                                  totalDuration = calculateWorkingDaysBetween(earliestStartDate, formatDateForInput(latestEndDate), projectHolidayMap);
                              }
                          }
                          
                          const taskPlannedEndForProgress = taskPlannedLatestEnd || latestEndDate;
                          const taskProgress = (earliestStartDate && taskPlannedEndForProgress)
                            ? calculateTimeBasedProgress(earliestStartDate, formatDateForInput(taskPlannedEndForProgress))
                            : 0;
                          const taskIsComplete = areAssignmentsComplete(task.assignments);
                          const taskActualProgress = taskIsComplete ? 100 : getAggregateActualProgress(task.assignments, taskProgress);

                          // Task-level schedule status
                          let taskScheduleStatus: 'not-started' | 'in-progress' | 'completed' | 'overdue' = 'not-started';
                          let taskDaysOverdue = 0;
                          if (earliestStartDate && latestEndDate) {
                              const now = new Date();
                              now.setHours(0, 0, 0, 0);
                              const startD = new Date(earliestStartDate.replace(/-/g, '/'));
                              if (now < startD) taskScheduleStatus = 'not-started';
                              else if (taskIsComplete) {
                                taskScheduleStatus = 'completed';
                              } else if (now > latestEndDate) {
                                taskScheduleStatus = 'overdue';
                                  taskDaysOverdue = Math.ceil((now.getTime() - latestEndDate.getTime()) / 86400000);
                              } else taskScheduleStatus = 'in-progress';
                          }
                          const taskOverdueColSpan = 0;
                          const taskStatusBorderClass = taskScheduleStatus === 'overdue' ? 'ring-2 ring-red-400/80' : taskScheduleStatus === 'completed' ? 'ring-2 ring-emerald-400/80' : '';
                          
                          const { taskStartIndex, taskEndIndex, taskPlannedEndIndex } = (() => {
                                if (!earliestStartDate || !latestEndDate) return { taskStartIndex: -1, taskEndIndex: -1, taskPlannedEndIndex: -1 };
                                const startIdx = getColumnIndex(earliestStartDate);
                                const endIdx = getColumnIndex(formatDateForInput(latestEndDate));
                                const plannedEndIdx = taskPlannedLatestEnd ? getColumnIndex(formatDateForInput(taskPlannedLatestEnd)) : endIdx;
                                return { taskStartIndex: startIdx, taskEndIndex: endIdx, taskPlannedEndIndex: plannedEndIdx };
                          })();
                          const taskDelayColSpan = taskEndIndex > taskPlannedEndIndex && taskPlannedEndIndex > -1 ? taskEndIndex - taskPlannedEndIndex : 0;

                          return (
                            <React.Fragment key={task.id}>
                              <div draggable={!isReadOnly} onDragStart={(e) => handleTaskDragStart(e, project.id, module.id, taskIndex)} onDragOver={handleTaskDragOver} onDrop={(e) => handleTaskDrop(e, project.id, module.id, taskIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'task', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id }); }} className={`flex border-b border-slate-100 bg-slate-50 group/task ${draggedTask?.moduleId === module.id && draggedTask?.index === taskIndex ? 'opacity-30' : ''}`}>
                                <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-[35] flex items-center justify-between pl-6 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingTask && toggleTask(task.id)}>
                                    {!isReadOnly && <div className="cursor-grab text-slate-400 hover:text-slate-600" title="Drag to reorder task"><GripVertical size={14} /></div>}
                                    {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                    {isEditingTask ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-[11px] font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="text-[11px] text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" title="Double click to rename" onDoubleClick={(e) => startEditing(taskEditId, task.name, e)}>{task.name}</span> )}
                                  </div>
                                  {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.EA)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add another resource to this task"><UserPlus size={14} /></button></div>}
                                </div>
                                
                                {/* Task Details Columns - z-34 */}
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky z-[34]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                                  {isTaskCollapsed && earliestStartDate && <span title="Earliest Start Date" className="bg-slate-200/50 rounded p-1">{earliestStartDate}</span>}
                                </div>
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky z-[34]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
                                  {isTaskCollapsed && totalDuration > 0 && <span title="Total Duration" className="bg-slate-200/50 rounded p-1">{totalDuration}d</span>}
                                </div>
                                <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 ${isDetailsFrozen ? 'sticky z-[34]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>

                                <div className="flex relative">
                                    {isTaskCollapsed && displayMode === 'gantt' && taskStartIndex > -1 && taskEndIndex > -1 && (
                                        <>
                                        <div
                                            ref={(node) => {
                                              // Register this task bar for all its assignments so dependency lines can find it
                                              task.assignments.forEach((a) => {
                                                if (node) {
                                                  assignmentBarRefs.current.set(a.id, node);
                                                } else {
                                                  assignmentBarRefs.current.delete(a.id);
                                                }
                                              });
                                            }}
                                            className={`absolute top-1/2 -translate-y-1/2 h-4 z-10 bg-slate-400 rounded-md flex items-center overflow-hidden group/taskbar ${taskStatusBorderClass}`}
                                            style={{
                                                left: `${taskStartIndex * colWidth + 2}px`,
                                                width: `${((taskDelayColSpan > 0 ? taskPlannedEndIndex : taskEndIndex) - taskStartIndex + 1) * colWidth - 4}px`,
                                            }}
                                            title={`Duration: ${totalDuration} working days${taskScheduleStatus === 'overdue' ? ` | Overdue by ${taskDaysOverdue}d` : ''}`}
                                        >
                                            <div className="absolute inset-y-0 left-0 bg-white/25 border-r border-white/50" style={{ width: `${taskProgress}%` }}></div>
                                            <div className="h-full bg-slate-600" style={{ width: `${taskActualProgress}%` }}></div>
                                            {taskScheduleStatus === 'in-progress' && taskProgress > 0 && taskProgress < 100 && (
                                                <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-[2]" style={{ left: `${taskProgress}%` }} />
                                            )}
                                            <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white font-bold drop-shadow-md select-none pointer-events-none">
                                              A{taskActualProgress}% / P{taskProgress}%
                                            </span>
                                        </div>
                                        {taskDelayColSpan > 0 && (
                                            <div
                                                className="absolute top-1/2 -translate-y-1/2 h-4 z-[9] rounded-r pointer-events-none"
                                                style={{
                                                    left: `${(taskPlannedEndIndex + 1) * colWidth}px`,
                                                    width: `${taskDelayColSpan * colWidth - 2}px`,
                                                    background: 'repeating-linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.2) 3px, rgba(245,158,11,0.35) 3px, rgba(245,158,11,0.35) 6px)',
                                                    borderTop: '1.5px solid rgb(245,158,11)',
                                                    borderBottom: '1.5px solid rgb(245,158,11)',
                                                    borderRight: '1.5px solid rgb(245,158,11)',
                                                }}
                                                title={`Actual completion extended beyond task plan`}
                                            />
                                        )}
                                        </>
                                    )}
                                    {leftSpacerW > 0 && <div className="flex-shrink-0" style={{width: leftSpacerW}} />}
                                    {timeline.slice(colStart, colEnd).map(col => {
                                      const total = getTaskTotal(task, col);
                                      return ( <div key={`th-${task.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center bg-slate-50 relative`} style={{ width: `${colWidth}px` }}>
                                          {total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-semibold text-slate-600 relative z-10">{formatValue(total)}</span>)}
                                      </div> );
                                    })}
                                    {rightSpacerW > 0 && <div className="flex-shrink-0" style={{width: rightSpacerW}} />}
                                </div>
                              </div>

                              {!isTaskCollapsed && task.assignments.map((assignment, assignmentIndex) => {
                                const hasSchedule = assignment.startDate && assignment.duration && assignment.duration > 0;
                                let assignmentStartDate: Date | null = null;
                                let assignmentEndDate: Date | null = null;
                                let endDateStr = '';
                                const resourceName = assignment.resourceName || 'Unassigned'; 
                                const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); 
                                const assignmentHolidaysMap = resourceHolidayData?.holidayMap || new Map<string, number>();
                                
                                if (hasSchedule) {
                                  assignmentStartDate = new Date(assignment.startDate!.replace(/-/g, '/'));
                                  endDateStr = calculateEndDate(assignment.startDate!, assignment.duration!, assignmentHolidaysMap);
                                  assignmentEndDate = new Date(endDateStr.replace(/-/g, '/'));
                                } else {
                                  // Fallback for display if no schedule
                                  assignmentStartDate = new Date();
                                }
                                
                                const { startIndex, endIndex } = (() => {
                                    if (!hasSchedule) return { startIndex: -1, endIndex: -1 };
                                    const startIdx = getColumnIndex(formatDateForInput(assignmentStartDate!));
                                    const endIdx = getColumnIndex(endDateStr);
                                    return { startIndex: startIdx, endIndex: endIdx };
                                })();

                                // Dependency delay visual shift:
                                // If the parent assignment finished later than planned, push this bar to start after the parent's actual end.
                                let displayStartIndex = startIndex;
                                let displayEndIndex = endIndex;
                                let dependencyPushedStart: string | null = null;
                                if (hasSchedule && assignment.parentAssignmentId) {
                                    const parentAssignment = allAssignmentsMap.get(assignment.parentAssignmentId);
                                    if (parentAssignment) {
                                        const parentEffectiveEnd = getEffectiveAssignmentEndDate(parentAssignment);
                                        const parentPlannedEnd = getPlannedAssignmentEndDate(parentAssignment);
                                        if (parentEffectiveEnd && parentPlannedEnd && parentEffectiveEnd > parentPlannedEnd) {
                                            const pushedStart = findNextWorkingDay(parentEffectiveEnd, assignmentHolidaysMap);
                                            if (pushedStart > (assignment.startDate || '')) {
                                                dependencyPushedStart = pushedStart;
                                                displayStartIndex = getColumnIndex(pushedStart);
                                                displayEndIndex = getColumnIndex(calculateEndDate(pushedStart, assignment.duration!, assignmentHolidaysMap));
                                            }
                                        }
                                    }
                                }
                                const displayEndDateStr = dependencyPushedStart
                                    ? calculateEndDate(dependencyPushedStart, assignment.duration!, assignmentHolidaysMap)
                                    : endDateStr;


                                const isEditingDuration = editingId === `duration::${assignment.id}`; 
                                const roleStyle = getRoleStyle(assignment.role);
                                const currentRowIndex = gridRowIndex++;
                                const dependencyOptions = getAvailableDependencies(assignment.id);
                                const currentDependencyLabel = getDependencyLabel(assignment.parentAssignmentId);

                const plannedProgress = hasSchedule ? calculateTimeBasedProgress(assignment.startDate!, endDateStr) : 0;
                const actualCompletionDate = getValidatedActualDate(assignment);
                const actualTimelineEndDate = actualCompletionDate && actualCompletionDate > displayEndDateStr ? actualCompletionDate : displayEndDateStr;
                const actualProgress = calculateActualProgressFromDate(assignment, actualCompletionDate);
                const hasActualProgress = Boolean(actualCompletionDate) || typeof assignment.progress === 'number';
                const actualDateLabel = actualCompletionDate ? `A ${actualCompletionDate}` : 'A -';
                const progressVariance = actualProgress - plannedProgress;
                const progressVarianceLabel = progressVariance === 0 ? 'On plan' : progressVariance > 0 ? `+${progressVariance}%` : `${progressVariance}%`;
                const actualDelayDays = actualCompletionDate ? getLateCompletionWorkingDays(assignment, endDateStr, actualCompletionDate) : 0;
                const actualTimelineEndIndex = actualTimelineEndDate ? getColumnIndex(actualTimelineEndDate) : displayEndIndex;
                const actualDelayColSpan = actualCompletionDate && actualTimelineEndIndex > displayEndIndex ? Math.max(0, actualTimelineEndIndex - displayEndIndex) : 0;
                const overdueColSpan = 0; // Overdue bar removed: delay only shown when actual date is set
                const baselineEntry = baselineSnapshot[assignment.id];
                const isBaselineChanged = Boolean(baselineEntry) && ((baselineEntry.startDate || '') !== (assignment.startDate || '') || (baselineEntry.duration || 0) !== (assignment.duration || 0));
                const isBaselineNew = !baselineEntry;
                                const isPendingDependencySource = pendingDependencySourceId === assignment.id;

                                // --- Schedule Status Calculation ---
                                let scheduleStatus: 'not-started' | 'in-progress' | 'completed' | 'overdue' = 'not-started';
                                let daysOverdue = 0;
                                let daysRemaining = 0;
                                if (hasSchedule && assignmentStartDate && assignmentEndDate) {
                                    const now = new Date();
                                    now.setHours(0, 0, 0, 0);
                                    if (now < assignmentStartDate) {
                                        scheduleStatus = 'not-started';
                                        daysRemaining = Math.ceil((assignmentStartDate.getTime() - now.getTime()) / 86400000);
                  } else if (actualCompletionDate) {
                    scheduleStatus = 'completed';
                  } else if (now > assignmentEndDate) {
                    scheduleStatus = 'overdue';
                                        daysOverdue = Math.ceil((now.getTime() - assignmentEndDate.getTime()) / 86400000);
                                    } else {
                                        scheduleStatus = 'in-progress';
                                        daysRemaining = Math.ceil((assignmentEndDate.getTime() - now.getTime()) / 86400000);
                                    }
                                }

                                // Today marker position within bar (as percentage)
                const todayBarPercent = plannedProgress;
                                // Overdue extension columns - not used (delay only shown when actual date is set)
                                const scheduleStatusLabel = scheduleStatus === 'completed' && actualCompletionDate
                                  ? actualDelayDays > 0
                                    ? `Completed ${actualCompletionDate} (+${actualDelayDays}d late)`
                                    : `Completed ${actualCompletionDate}`
                                  : scheduleStatus === 'overdue'
                                  ? `Overdue by ${daysOverdue}d`
                                  : scheduleStatus === 'completed'
                                    ? 'Completed'
                                    : scheduleStatus === 'in-progress'
                                      ? `${daysRemaining}d remaining`
                                      : `Starts in ${daysRemaining}d`;

                                const statusBorderClass = scheduleStatus === 'overdue' ? 'ring-2 ring-red-400/80' 
                                    : scheduleStatus === 'completed' ? 'ring-2 ring-emerald-400/80' 
                                    : scheduleStatus === 'in-progress' ? '' 
                                    : '';

                                return (
                                <div key={assignment.id} className={`flex border-b border-slate-100 group/assign ${draggedAssignment?.taskId === task.id && draggedAssignment?.index === assignmentIndex ? 'opacity-30' : ''} ${datePickerState.assignmentId === assignment.id ? 'relative z-[40]' : ''}`} draggable={!isReadOnly} onDragStart={(e) => handleAssignmentDragStart(e, task.id, assignmentIndex)} onDragOver={handleAssignmentDragOver} onDrop={(e) => handleAssignmentDrop(e, project.id, module.id, task.id, assignmentIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'assignment', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id, assignmentId: assignment.id }); }}>
                                  <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-[30] flex items-center justify-between border-l-[3px] ${roleStyle.border} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                    <div className="flex-1 min-w-0 flex items-center gap-2 pl-12">
                                      <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="w-full text-[11px] text-slate-600 bg-transparent border-none p-0 focus:ring-0 focus:outline-none cursor-pointer hover:text-indigo-600 disabled:cursor-default disabled:hover:text-slate-600 truncate">
                                          <option value="Unassigned">Unassigned</option>
                                          {assignment.resourceName && assignment.resourceName !== 'Unassigned' && !resources.some(r => r.name === assignment.resourceName) && (
                                            <option value={assignment.resourceName}>{assignment.resourceName} (removed)</option>
                                          )}
                                          {Object.entries(groupedResources).map(([category, resList]) => ( <optgroup label={category} key={category}>{resList.map(r => <option key={r.id} value={r.name}>{r.name} {r.type === 'External' ? '(Ext.)' : ''}</option>)}</optgroup> ))}
                                      </select>
                                    </div>
                                  </div>
                                  
                                  {/* Assignment Details Columns - Increased Z-Index to prevent overlap with Gantt bars */}
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center px-2 py-1.5 relative group-hover/assign:bg-slate-50 ${isDetailsFrozen ? 'sticky z-[35] shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}>
                                    {assignment.startDate ? (
                                      <div className="relative group/date flex items-center gap-1">
                                        <button
                                          onClick={() => !isReadOnly && setDatePickerState({ assignmentId: assignment.id, mode: 'start' })}
                                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded hover:bg-slate-100 ${isReadOnly ? 'cursor-default' : ''}`}
                                          title="Edit start date"
                                        >
                                          {assignment.startDate}
                                        </button>
                                        <div className="flex items-center gap-0.5">
                                          <button
                                            type="button"
                                            onClick={() => !isReadOnly && hasSchedule && setDatePickerState({ assignmentId: assignment.id, mode: 'actual' })}
                                            disabled={isReadOnly || !hasSchedule}
                                            className={`rounded border px-1 py-0.5 text-[9px] font-semibold transition-colors ${actualCompletionDate ? 'border-slate-300 bg-slate-100 text-slate-700 hover:border-indigo-300 hover:text-indigo-700' : 'border-dashed border-slate-300 bg-white text-slate-400 hover:border-indigo-300 hover:text-indigo-600'} disabled:cursor-default disabled:hover:border-slate-300 disabled:hover:text-inherit`}
                                            title={hasSchedule ? (actualCompletionDate ? `Actual completion date: ${actualCompletionDate}` : 'Pick actual completion date') : 'Set start date and duration first'}
                                          >
                                            {actualDateLabel}
                                          </button>
                                          {actualCompletionDate && !isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => clearActualCompletionDate(assignment)}
                                              className="text-[9px] text-slate-400 hover:text-red-500 leading-none px-0.5 rounded hover:bg-red-50 opacity-0 group-hover/date:opacity-100 transition-opacity"
                                              title="Clear actual completion date"
                                            >×</button>
                                          )}
                                        </div>
                                        {datePickerState.assignmentId === assignment.id && datePickerState.mode && (
                                                <div ref={datePickerContainerRef} className="absolute top-full left-0 mt-1 z-[80]">
                                            <DatePicker
                                              value={new Date(((datePickerState.mode === 'actual' ? actualCompletionDate : assignment.startDate) || assignment.startDate).replace(/-/g, '/'))}
                                                        onChange={(date) => {
                                                const pickedDate = formatDateForInput(date);
                                                if (datePickerState.mode === 'start') {
                                                  handleAssignmentStartDateChange(assignment, pickedDate);
                                                } else {
                                                  setActualCompletionDate(assignment, pickedDate);
                                                }
                                                setDatePickerState({ assignmentId: null, mode: null });
                                              }}
                                              onClose={() => setDatePickerState({ assignmentId: null, mode: null })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] text-slate-300">-</span>
                                    )}
                                  </div>
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-center ${isDetailsFrozen ? 'sticky z-[35]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}>
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
                                            onClick={() => !isReadOnly && startEditing(`duration::${assignment.id}`, assignment.duration?.toString() || '0')}
                                        >
                                            {assignment.duration || 0}d
                                        </span>
                                    )}
                                  </div>

                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center px-1 overflow-hidden relative group/dep ${isDetailsFrozen ? 'sticky z-[35]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}>
                                     <div className="flex items-center gap-1 w-full min-w-0" title={currentDependencyLabel || 'No dependency'}>
                                        <Link2 size={10} className={`${assignment.parentAssignmentId ? 'text-indigo-500' : 'text-slate-300'} flex-shrink-0`} />
                                        {isReadOnly ? (
                                          <span className={`truncate text-[10px] ${assignment.parentAssignmentId ? 'text-slate-600' : 'text-slate-300'}`}>
                                            {currentDependencyLabel || '-'}
                                          </span>
                                        ) : (
                                          <select
                                            value={assignment.parentAssignmentId || ''}
                                            onChange={(e) => onUpdateAssignmentDependency(assignment.id, e.target.value || null)}
                                            className="w-full min-w-0 bg-transparent text-[10px] text-slate-600 border-none p-0 pr-4 focus:ring-0 focus:outline-none cursor-pointer truncate"
                                          >
                                            <option value="">No dependency</option>
                                            {Array.from(new Set(dependencyOptions.map((option) => option.groupLabel))).map((groupLabel) => (
                                              <optgroup key={groupLabel} label={groupLabel}>
                                                {dependencyOptions
                                                  .filter((option) => option.groupLabel === groupLabel)
                                                  .map((option) => (
                                                    <option key={option.id} value={option.id}>
                                                      {option.name}
                                                    </option>
                                                  ))}
                                              </optgroup>
                                            ))}
                                          </select>
                                        )}
                                        {!isReadOnly && assignment.parentAssignmentId && (
                                          <button onClick={() => onUpdateAssignmentDependency(assignment.id, null)} className="opacity-0 group-hover/dep:opacity-100 p-0.5 hover:text-red-500 rounded flex-shrink-0" title="Clear dependency">
                                            <Trash2 size={8}/>
                                          </button>
                                        )}
                                     </div>
                                  </div>

                                  <div className="flex relative">
                                    {displayMode === 'gantt' && startIndex > -1 && endIndex > -1 && hasSchedule && (
                                        <>
                                            {/* Dependency push ghost — faint outline at original planned position */}
                                            {dependencyPushedStart && (
                                                <div
                                                    className="absolute top-1.5 h-4 z-[18] rounded pointer-events-none opacity-30"
                                                    style={{
                                                        left: `${startIndex * colWidth + 2}px`,
                                                        width: `${Math.max(4, (endIndex - startIndex + 1) * colWidth - 4)}px`,
                                                        border: '1.5px dashed rgb(245,158,11)',
                                                    }}
                                                />
                                            )}
                                            {/* Draggable Gantt Bar */}
                                            <div
                                                key={`gantt-bar-${assignment.id}-${assignment.duration}-${assignment.startDate}`}
                                                ref={(node) => setAssignmentBarRef(assignment.id, node)}
                                              className={`absolute top-1.5 h-4 z-20 ${roleStyle.bar} rounded flex items-center overflow-hidden transition-all duration-300 group/bar ${statusBorderClass} ${isPendingDependencySource ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-white' : ''} ${isDependencyLinkMode && !isReadOnly ? 'cursor-pointer' : !isReadOnly ? 'cursor-grab active:cursor-grabbing' : ''} ${dependencyPushedStart ? 'border-l-[3px] border-l-amber-400' : ''}`}
                                                style={{
                                                    left: `${displayStartIndex * colWidth + 2}px`,
                                                    width: `${Math.max(4, (displayEndIndex - displayStartIndex + 1) * colWidth - 4)}px`,
                                                }}
                                                title={`${assignment.role} - ${assignment.resourceName}\nDuration: ${assignment.duration} days\n${formatDateForInput(assignmentStartDate!)} → ${endDateStr}${dependencyPushedStart ? `\n⚠ Pushed by dependency delay → starts ${dependencyPushedStart}` : ''}\nActual completion date: ${actualCompletionDate || 'Not set'}\nActual progress: ${actualProgress}%\nPlanned: ${plannedProgress}%\nVariance: ${progressVarianceLabel}\nStatus: ${scheduleStatusLabel}`}
                                              onClick={(e) => {
                                                if (!isDependencyLinkMode) return;
                                                e.stopPropagation();
                                                handleDependencyBarClick(assignment);
                                              }}
                                                onMouseDown={(e) => {
                                                if (isDependencyLinkMode) {
                                                  e.preventDefault();
                                                  e.stopPropagation();
                                                  return;
                                                }
                                                if (isReadOnly || e.button !== 0) return;
                                                    handleGanttDragStart(e, 'move', assignment.id, dependencyPushedStart || assignment.startDate!, assignment.duration!, e.currentTarget, displayStartIndex, displayEndIndex);
                                                }}
                                            >
                                                {/* Planned progress track */}
                                                <div 
                                                  className="absolute inset-y-0 left-0 bg-white/20 border-r border-white/50 pointer-events-none" 
                                                  style={{ width: `${plannedProgress}%` }}
                                                ></div>

                                                {/* Actual Progress Fill */}
                                                <div 
                                                  className={`h-full ${roleStyle.fill} transition-all duration-300 pointer-events-none`} 
                                                  style={{ width: `${actualProgress}%` }}
                                                ></div>
                                                
                                                {/* Planned progress marker */}
                                                {scheduleStatus === 'in-progress' && todayBarPercent > 0 && todayBarPercent < 100 && (
                                                    <div 
                                                        className="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-[2]"
                                                        style={{ left: `${todayBarPercent}%` }}
                                                    />
                                                )}
                                                
                                                {/* Percentage Text */}
                                                <span className="absolute inset-0 flex items-center justify-center text-[9px] text-white/90 font-bold drop-shadow-md select-none pointer-events-none">
                                                  A{actualProgress}% / P{plannedProgress}%
                                                </span>

                                                {/* Right resize handle */}
                                                {!isReadOnly && (
                                                    <div
                                                    className={`absolute right-0 top-0 bottom-0 w-2 hover:bg-black/20 rounded-r z-10 ${isDependencyLinkMode ? 'cursor-pointer' : 'cursor-col-resize'}`}
                                                        onMouseDown={(e) => {
                                                      if (isDependencyLinkMode) {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        return;
                                                      }
                                                            e.stopPropagation();
                                                            handleGanttDragStart(e, 'resize-right', assignment.id, dependencyPushedStart || assignment.startDate!, assignment.duration!, e.currentTarget.parentElement as HTMLDivElement, displayStartIndex, displayEndIndex);
                                                        }}
                                                    />
                                                )}
                                            </div>

                                            {actualCompletionDate && actualDelayColSpan > 0 && (
                                              <div
                                                className="absolute top-1.5 h-4 z-[19] rounded-r pointer-events-none"
                                                style={{
                                                  left: `${(displayEndIndex + 1) * colWidth}px`,
                                                  width: `${actualDelayColSpan * colWidth}px`,
                                                  background: 'repeating-linear-gradient(135deg, rgba(251,191,36,0.2), rgba(251,191,36,0.2) 3px, rgba(245,158,11,0.35) 3px, rgba(245,158,11,0.35) 6px)',
                                                  borderTop: '1.5px solid rgb(245,158,11)',
                                                  borderBottom: '1.5px solid rgb(245,158,11)',
                                                  borderRight: '1.5px solid rgb(245,158,11)',
                                                }}
                                                title={`Actual completion extended to ${actualCompletionDate}`}
                                              />
                                            )}

                                            {/* Overdue extension bar removed: delay only shown when actual date is set */}

                                            {/* Label + status badge next to bar */}
                                            <div 
                                                className="absolute top-1.5 h-4 z-20 flex items-center pl-1 pointer-events-none gap-1"
                                                style={{
                                                  left: `${((displayEndIndex + 1) + Math.max(overdueColSpan, actualDelayColSpan)) * colWidth}px`,
                                                }}
                                            >
                                                <span className="text-[9px] text-slate-400 whitespace-nowrap">{assignment.resourceName}</span>
                                              {dependencyPushedStart && (
                                                <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-300 rounded px-1 whitespace-nowrap" title="Pushed by parent dependency delay">↷ dep</span>
                                              )}
                                              {showBaselineDiff && (isBaselineChanged || isBaselineNew) && (
                                                <span className={`text-[8px] font-bold rounded px-1 whitespace-nowrap border ${isBaselineNew ? 'text-sky-700 bg-sky-50 border-sky-200' : 'text-amber-700 bg-amber-50 border-amber-200'}`} title={isBaselineNew ? 'New after baseline' : 'Changed vs baseline'}>
                                                  {isBaselineNew ? 'NEW' : 'Δ'}
                                                </span>
                                              )}
                                              {hasActualProgress && <span className={`text-[8px] font-bold rounded px-1 whitespace-nowrap border ${progressVariance > 0 ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : progressVariance < 0 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-slate-600 bg-slate-50 border-slate-200'}`}>{progressVarianceLabel}</span>}
                                                {actualCompletionDate && actualDelayDays > 0 && (
                                                  <span className="text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 whitespace-nowrap">+{actualDelayDays}d actual</span>
                                                )}
                                                {scheduleStatus === 'completed' && (
                                                    <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1 whitespace-nowrap">✓</span>
                                                )}
                                                {scheduleStatus === 'in-progress' && daysRemaining <= 3 && (
                                                    <span className="text-[8px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 whitespace-nowrap">{daysRemaining}d left</span>
                                                )}
                                            </div>
                                        </>
                                    )}

                                    {leftSpacerW > 0 && <div className="flex-shrink-0" style={{width: leftSpacerW}} />}
                                    {timeline.slice(colStart, colEnd).map(col => {
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
                                              holidayName = hol;
                                          }
                                      }

                                      return (
                                        <GridNumberInput
                                          key={`${assignment.id}-${col.id}-${displayMode}`}
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
                                          isGanttMode={displayMode === 'gantt'}
                                        />
                                      );
                                    })}
                                    {rightSpacerW > 0 && <div className="flex-shrink-0" style={{width: rightSpacerW}} />}
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
          <div className="fixed bg-white border border-slate-200 shadow-xl rounded-lg py-1 z-[200] text-sm min-w-[160px] animate-in fade-in zoom-in-95 duration-100" style={{ top: contextMenu.y, left: contextMenu.x }}>
            {contextMenu.type === 'project' && (
              <>
                <button onClick={() => { onAddModule(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} /> Add Module</button>
                <button onClick={() => {
                  const assignments = projects
                    .find(p => p.id === contextMenu.projectId)
                    ?.modules.flatMap(m => m.tasks.flatMap(t => t.assignments)) || [];
                  clearActualDatesForAssignments(assignments);
                  setContextMenu(null);
                }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><X size={14} /> Clear Project Actual Dates</button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button onClick={() => { onDeleteProject(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Project</button>
              </>
            )}
            {contextMenu.type === 'module' && contextMenu.moduleId && (
              <>
                <button onClick={() => { handleAddTaskClick(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><Plus size={14} /> Add Task</button>
                <button onClick={() => {
                  const assignments = projects
                    .find(p => p.id === contextMenu.projectId)
                    ?.modules.find(m => m.id === contextMenu.moduleId)
                    ?.tasks.flatMap(t => t.assignments) || [];
                  clearActualDatesForAssignments(assignments);
                  setContextMenu(null);
                }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><X size={14} /> Clear Module Actual Dates</button>
                <div className="h-px bg-slate-100 my-1"></div>
                <button onClick={() => { onDeleteModule(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Delete Module</button>
              </>
            )}
            {contextMenu.type === 'task' && contextMenu.moduleId && contextMenu.taskId && (
              <>
                 <button onClick={() => { onAddAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, Role.EA); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><UserPlus size={14} /> Add Assignment</button>
                 <button onClick={() => {
                   const assignments = projects
                    .find(p => p.id === contextMenu.projectId)
                    ?.modules.find(m => m.id === contextMenu.moduleId)
                    ?.tasks.find(t => t.id === contextMenu.taskId)
                    ?.assignments || [];
                   clearActualDatesForAssignments(assignments);
                   setContextMenu(null);
                 }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><X size={14} /> Clear Task Actual Dates</button>
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
                 <button onClick={() => { onShiftTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, 'left-working'); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><ChevronLeft size={14} /> Shift -5 Working Days</button>
                 <button onClick={() => { onShiftTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, 'right-working'); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"><ChevronRight size={14} /> Shift +5 Working Days</button>
                 <div className="h-px bg-slate-100 my-1"></div>
                 <button onClick={() => { onDeleteAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, contextMenu.assignmentId!); setContextMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 flex items-center gap-2"><Trash2 size={14} /> Remove Assignment</button>
               </>
            )}
          </div>
        )}
      </div>
    </>
  );
});
