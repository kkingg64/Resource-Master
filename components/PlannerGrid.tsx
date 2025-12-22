import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ResourceAllocation, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { getTimeline, GOV_HOLIDAYS_DB, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween, calculateTimeBasedProgress } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, GripVertical, Plus, UserPlus, Folder, Settings2, Trash2, RefreshCw, CheckCircle, AlertTriangle, RotateCw, ChevronsDownUp, Copy, Pin, PinOff, Link, Link2, EyeOff, Eye, LayoutList, CalendarRange, Percent, ChevronLeft, Gem, ShieldCheck, Rocket, Server, Search, X, Filter, CheckSquare, Square, Download, Upload, History } from 'lucide-react';
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
  holidayDuration: number;
  isCurrent: boolean;
  holidayName?: string | any;
  disabled?: boolean;
  isGanttMode?: boolean;
}

const GridNumberInput: React.FC<GridNumberInputProps> = ({ value, onChange, onNavigate, rowIndex, colIndex, width, holidayDuration, isCurrent, holidayName, disabled, isGanttMode }) => {
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

  // In Gantt mode, we want a clean transparent cell so the bar shows through.
  if (isGanttMode) {
      return (
          <div className="flex-shrink-0 border-r border-slate-100 bg-transparent relative" style={{ width: `${width}px` }}></div>
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
};


// Explicit Color Map to prevent Tailwind purging
const ROLE_STYLES: Record<string, { border: string, bg: string, bar: string, fill: string }> = {
  [Role.DEV]: { border: 'border-l-blue-500', bg: 'bg-blue-50', bar: 'bg-blue-400', fill: 'bg-blue-600' },
  [Role.BRAND_SOLUTIONS]: { border: 'border-l-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-400', fill: 'bg-orange-600' },
  [Role.PLM_D365]: { border: 'border-l-green-500', bg: 'bg-green-50', bar: 'bg-green-400', fill: 'bg-green-600' },
  [Role.BA]: { border: 'border-l-purple-500', bg: 'bg-purple-50', bar: 'bg-purple-400', fill: 'bg-purple-600' },
  [Role.APP_SUPPORT]: { border: 'border-l-red-500', bg: 'bg-red-50', bar: 'bg-red-400', fill: 'bg-red-600' },
  [Role.DM]: { border: 'border-l-yellow-500', bg: 'bg-yellow-50', bar: 'bg-yellow-400', fill: 'bg-yellow-600' },
  [Role.COE]: { border: 'border-l-cyan-500', bg: 'bg-cyan-50', bar: 'bg-cyan-400', fill: 'bg-cyan-600' },
  [Role.EA]: { border: 'border-l-pink-500', bg: 'bg-pink-50', bar: 'bg-pink-400', fill: 'bg-pink-600' },
  [Role.PREP_DEV]: { border: 'border-l-teal-500', bg: 'bg-teal-50', bar: 'bg-teal-400', fill: 'bg-teal-600' },
  [Role.CNF]: { border: 'border-l-slate-500', bg: 'bg-slate-50', bar: 'bg-slate-400', fill: 'bg-slate-600' },
  'default': { border: 'border-l-slate-400', bg: 'bg-slate-50', bar: 'bg-slate-400', fill: 'bg-slate-500' }
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
  
  // Resource Filter State
  const [selectedResourceFilters, setSelectedResourceFilters] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [resourceFilterSearch, setResourceFilterSearch] = useState('');
  const filterRef = useRef<HTMLDivElement>(null);

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
  const resizeData = useRef({ col: '', startX: 0, startWidth: 0 });

  // Use a consistent project-level holiday calendar (HK) for duration calculations.
  const projectHolidayMap = useMemo(() => {
    const map = new Map<string, number>();
    holidays.filter(h => h.country === 'HK').forEach(h => {
        map.set(h.date, h.duration || 1);
    });
    return map;
  }, [holidays]);

  // Click outside handler for filter menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  // Get all unique resource names including "Unassigned"
  const allResourceNames = useMemo(() => {
      const names = resources.map(r => r.name).sort((a, b) => a.localeCompare(b));
      return ['Unassigned', ...names];
  }, [resources]);

  const toggleResourceFilter = (name: string) => {
      setSelectedResourceFilters(prev => 
          prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
      );
  };

  // Filtering Logic
  const filteredProjects = useMemo(() => {
    if (selectedResourceFilters.length === 0) return projects;
    
    return projects.map(p => {
        // Filter Modules
        const matchingModules = p.modules.map(m => {
            // Filter Tasks
            const matchingTasks = m.tasks.map(t => {
                // Filter Assignments
                const matchingAssignments = t.assignments.filter(a => 
                    selectedResourceFilters.includes(a.resourceName || 'Unassigned')
                );
                
                if (matchingAssignments.length > 0) {
                    return { 
                        ...t, 
                        assignments: matchingAssignments 
                    };
                }
                return null;
            }).filter(Boolean) as ProjectTask[];

            if (matchingTasks.length > 0) {
                return { ...m, tasks: matchingTasks };
            }
            return null;
        }).filter(Boolean) as ProjectModule[];

        if (matchingModules.length > 0) {
            return { ...p, modules: matchingModules };
        }
        return null;
    }).filter(Boolean) as Project[];
  }, [projects, selectedResourceFilters]);

  // Auto-expand on filter
  useEffect(() => {
      if (selectedResourceFilters.length > 0) {
          // Reset collapse states to show results
          setCollapsedProjects({});
          setCollapsedModules({});
          setCollapsedTasks({});
      }
  }, [selectedResourceFilters]);

  // Auto-fit sidebar width based on longest text
  useEffect(() => {
    if (userHasResizedSidebar) return;
    if (!filteredProjects || filteredProjects.length === 0) return;

    const calculateOptimalWidth = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return 350; // Fallback

        // Font settings matching UI (Inter, text-xs/12px)
        context.font = 'bold 12px Inter, ui-sans-serif, system-ui, sans-serif'; 

        let maxPixelWidth = 200; // Minimum start width

        filteredProjects.forEach(p => {
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
  }, [filteredProjects, userHasResizedSidebar]);

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
            /* Added missing user_id property to correctly satisfy the Project interface during import */
            if (row.Project && row.Project !== currentProject?.name) { currentProject = { id: `p-${index}`, name: row.Project, modules: [], user_id: 'imported' }; importedProjects.push(currentProject); currentModule = null; currentTask = null; }
            if (!currentProject) return;
            if (row.Module && row.Module !== currentModule?.name) { currentModule = { id: `m-${index}`, name: row.Module, tasks: [], functionPoints: 0, legacyFunctionPoints: 0 }; currentProject.modules.push(currentModule); currentTask = null; }
            if (!currentModule) return;
            if (row.Task && row.Task !== currentTask?.name) { currentTask = { id: `t-${index}`, name: row.Task, assignments: [] }; currentModule.tasks.push(currentTask); }
            if (!currentProject) return; // redundant but for TS safety
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
         onUpdateAllocation(projectId, moduleId, taskId, assignmentId, weekId, valuePerWeek);
       });
    } else if (viewMode === 'day') {
      if (!col.parentWeekId || !col.date) return;
      const dateStr = formatDateForInput(col.date);
      onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.parentWeekId, numValue, dateStr);
    }
  };

  // --- Grid Navigation Logic ---
  const handleNavigate = (direction: string, currentRow: number, currentCol: number) => {
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
  };

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

  const handleAssignmentStartDateChange = (assignment: TaskAssignment, newDateStr: string) => {
     if (isReadOnly || !newDateStr) return;
     onUpdateAssignmentSchedule(assignment.id, newDateStr, assignment.duration || 1);
  };

  const saveDuration = (assignment: TaskAssignment) => {
    if (editingId !== `duration::${assignment.id}` || isReadOnly) return;
    let startDate = assignment.startDate;
    if (!startDate && assignment.startWeekId) { const d = getDateFromWeek(parseInt(assignment.startWeekId.split('-')[0]), parseInt(assignment.startWeekId.split('-')[1])); startDate = formatDateForInput(d); }
    if (!startDate) { setEditingId(null); return; }
    const newDuration = parseInt(editValue, 10);
    if (!isNaN(newDuration) && newDuration > 0 && newDuration !== assignment.duration) { onUpdateAssignmentSchedule(assignment.id, startDate, newDuration); }
    setEditingId(null);
  };

  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;
  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };
  
  const startColLeft = sidebarWidth;
  const durationColLeft = sidebarWidth + startColWidth;
  const dependencyColLeft = sidebarWidth + startColWidth + durationColWidth;

  const showYearRow = viewMode === 'day' || viewMode === 'week' || viewMode === 'month';
  const showMonthRow = viewMode === 'day' || viewMode === 'week';

  // --- Grid Row Tracking ---
  let gridRowIndex = 0;

  // --- Calculate Current Column for Overlay ---
  const currentColumnIndex = timeline.findIndex(c => isCurrentColumn(c));
  const stickyLeftOffset = sidebarWidth + startColWidth + durationColWidth + dependencyColWidth;

  const isFiltered = selectedResourceFilters.length > 0;

  const assignmentRenderInfo = useMemo(() => {
    const map = new Map<string, { rowIndex: number, y: number, startDate: string | undefined, endDate: string }>();
    let rowIndex = 0;
    const HEADER_HEIGHT = (showYearRow ? 32 : 0) + (showMonthRow ? 32 : 0) + 32;
    const ROW_HEIGHT = 34;

    filteredProjects.forEach(project => {
        rowIndex++; // Project header
        if (!collapsedProjects[project.id]) {
            project.modules.forEach(module => {
                rowIndex++; // Module header
                if (!collapsedModules[module.id]) {
                    module.tasks.forEach(task => {
                        rowIndex++; // Task header
                        if (!collapsedTasks[task.id]) {
                            task.assignments.forEach(assignment => {
                                if (assignment.startDate && assignment.duration) {
                                    const resourceName = assignment.resourceName || 'Unassigned';
                                    const assignmentHolidaysMap = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.holidayMap || new Map<string, number>();
                                    const endDateStr = calculateEndDate(assignment.startDate, assignment.duration, assignmentHolidaysMap);
                                    
                                    map.set(assignment.id, {
                                        rowIndex,
                                        y: HEADER_HEIGHT + (rowIndex * ROW_HEIGHT) + (ROW_HEIGHT / 2),
                                        startDate: assignment.startDate,
                                        endDate: endDateStr,
                                    });
                                }
                                rowIndex++; // Assignment row
                            });
                        }
                    });
                }
            });
        }
    });
    return { map, totalHeight: HEADER_HEIGHT + rowIndex * ROW_HEIGHT };
  }, [filteredProjects, collapsedProjects, collapsedModules, collapsedTasks, holidays, resources, showMonthRow, showYearRow]);

  return (
    <>
      <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        {/* Ghost Resize Line */}
        <div 
            ref={resizeGhostRef} 
            className="fixed top-0 bottom-0 w-0.5 bg-indigo-500 z-[100] hidden pointer-events-none border-l border-dashed border-indigo-200"
            style={{ display: 'none' }}
        ></div>

        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50 relative z-[60]">
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-500" /><span className="text-sm font-semibold text-slate-700">Timeline</span></div>
             <div className="relative">
                <button ref={toggleButtonRef} onClick={(e) => { e.stopPropagation(); setShowToggleMenu(!showToggleMenu); }} className="text-xs flex items-center gap-1.5 bg-white text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors">
                  <Eye size={14} /> View Options <ChevronDown size={12} />
                </button>
                {showToggleMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { handleToggleModules(); setShowToggleMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><ChevronsDownUp size={14} /> Toggle All Modules</button>
                    <button onClick={() => { handleToggleResources(); setShowToggleMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 flex items-center gap-2"><EyeOff size={14} /> Toggle Resources Only</button>
                  </div>
                )}
            </div>
            
            <div className="relative" ref={filterRef}>
                <button 
                    onClick={() => setIsFilterOpen(!isFilterOpen)} 
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${selectedResourceFilters.length > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                    <Filter size={14} /> 
                    Filter 
                    {selectedResourceFilters.length > 0 && <span className="bg-indigo-200 text-indigo-800 text-[9px] px-1.5 rounded-full">{selectedResourceFilters.length}</span>}
                </button>
                {isFilterOpen && (
                    <div className="absolute top-full left-0 mt-1 w-56 max-h-64 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] flex flex-col animate-in fade-in zoom-in-95">
                        <div className="p-2 border-b border-slate-100 bg-slate-50 rounded-t-lg flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase">Select Resources</span>
                            {selectedResourceFilters.length > 0 && <button onClick={() => setSelectedResourceFilters([])} className="text-[10px] text-red-500 hover:text-red-700">Clear</button>}
                        </div>
                        {/* Search Input */}
                        <div className="p-2 border-b border-slate-100">
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input 
                                    type="text" 
                                    value={resourceFilterSearch}
                                    onChange={(e) => setResourceFilterSearch(e.target.value)}
                                    placeholder="Search resources..." 
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-indigo-300"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto custom-scrollbar p-1">
                            {/* Unassigned First */}
                            {('unassigned'.includes(resourceFilterSearch.toLowerCase())) && (
                                <button 
                                    onClick={() => toggleResourceFilter("Unassigned")}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-md flex items-center gap-2 ${selectedResourceFilters.includes("Unassigned") ? 'text-indigo-700 bg-indigo-50 font-medium' : 'text-slate-600'}`}
                                >
                                    {selectedResourceFilters.includes("Unassigned") ? <CheckSquare size={14} className="text-indigo-600"/> : <Square size={14} className="text-slate-300"/>}
                                    Unassigned
                                </button>
                            )}
                            
                            {/* Grouped by Role */}
                            {Object.entries(groupedResources)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .map(([role, list]) => {
                                    const filteredList = list.filter(r => r.name.toLowerCase().includes(resourceFilterSearch.toLowerCase()));
                                    if (filteredList.length === 0) return null;
                                    
                                    return (
                                        <div key={role}>
                                            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase mt-1">{role}</div>
                                            {filteredList.map(r => (
                                                <button 
                                                    key={r.name}
                                                    onClick={() => toggleResourceFilter(r.name)}
                                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-md flex items-center gap-2 ${selectedResourceFilters.includes(r.name) ? 'text-indigo-700 bg-indigo-50 font-medium' : 'text-slate-600'}`}
                                                >
                                                    {selectedResourceFilters.includes(r.name) ? <CheckSquare size={14} className="text-indigo-600"/> : <Square size={14} className="text-slate-300"/>}
                                                    {r.name}
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 bg-slate-200 rounded-lg p-1 ml-2">
                <button onClick={() => setDisplayMode('gantt')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${displayMode === 'gantt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Gantt View (Timeline Bars)"><CalendarRange size={14} /> Gantt</button>
                <button onClick={() => setDisplayMode('allocation')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${displayMode === 'allocation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Grid View (Allocations)"><LayoutList size={14} /> Grid</button>
            </div>
            <div className="h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-1 bg-white border border-slate-300 rounded overflow-hidden">
              <button onClick={() => onExtendTimeline('start')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600 border-r border-slate-200" title="Add Month to Start">&lt; +Month</button>
              <button onClick={() => onExtendTimeline('end')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600" title="Add Month to End">+Month &gt;</button>
            </div>
            <div className="h-4 w-px bg-slate-300"></div>
            <div className="flex items-center gap-2" title="Adjust Column Width">
              <Settings2 size={14} className="text-slate-400" />
              <input type="range" min="20" max="100" value={colWidthBase} onChange={(e) => setColWidthBase(parseInt(e.target.value))} className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
            </div>
          </div>
          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
                <button onClick={onRefresh} disabled={isRefreshing} className="text-xs flex items-center gap-1.5 bg-white text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" title="Refresh data from server"><RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} /> Refresh</button>
                <SaveStatusIndicator status={saveStatus} />
                <div className="w-px h-4 bg-slate-300"></div>
                {!isReadOnly && <button onClick={onShowHistory} className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors" title="View and restore saved versions"><History size={12} /></button>}
                <button onClick={handleExportExcel} className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors" title="Export the current plan as an Excel file"><Download size={12} /></button>
                {!isReadOnly && <button onClick={() => importInputRef.current?.click()} className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors" title="Import a plan from an Excel file"><Upload size={12} /></button>}
                <input type="file" ref={importInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
            </div>
            <div className="w-px h-4 bg-slate-300"></div>
            {!isReadOnly && <button onClick={onAddProject} className="text-xs flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"><Plus size={12} /> Add Project</button>}
            <div className="flex bg-slate-200 p-1 rounded-lg">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{mode}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-auto custom-scrollbar flex-1 relative">
           {displayMode === 'gantt' && (
            <DependencyLines 
              allAssignmentsMap={allAssignmentsMap}
              assignmentRenderInfo={assignmentRenderInfo.map}
              timeline={timeline}
              colWidth={colWidth}
              totalHeight={assignmentRenderInfo.totalHeight}
              sidebarWidth={sidebarWidth + startColWidth + durationColWidth + dependencyColWidth}
            />
          )}
          <div className="min-w-max relative">
              <>
                {/* Header Rows */}
                <div className="flex bg-slate-200 border-b border-slate-200 sticky top-0 z-40 h-8 items-center">
                  <div className="flex-shrink-0 px-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] relative group h-full flex items-center text-xs" style={stickyStyle}>
                    Project Structure
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('sidebar', sidebarWidth, e)}></div>
                  </div>
                  
                  {/* Start Column Header */}
                  <div className={`flex-shrink-0 flex items-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}>
                    <div className="flex items-center justify-between w-full">
                        <button onClick={() => setIsDetailsFrozen(!isDetailsFrozen)} title={isDetailsFrozen ? 'Unfreeze columns' : 'Freeze columns'} className="text-slate-400 hover:text-indigo-600 mr-1">{isDetailsFrozen ? <PinOff size={14} /> : <Pin size={14} />}</button>
                        <span className="flex-1 text-center">Start</span>
                    </div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('start', startColWidth, e)}></div>
                  </div>

                  {/* Duration Column Header */}
                  <div className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}>
                    <span>Days</span>
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('duration', durationColWidth, e)}></div>
                  </div>

                  {/* Dependency Column Header */}
                  <div title="Dependency" className={`flex-shrink-0 flex items-center justify-center px-2 text-[11px] font-semibold text-slate-600 border-r border-slate-200 relative h-full bg-slate-100 ${isDetailsFrozen ? 'sticky shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}>
                    <Link2 size={14} className="text-slate-600" />
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors" onMouseDown={(e) => handleResizeStart('dependency', dependencyColWidth, e)}></div>
                  </div>

                  {Object.values(yearHeaders).map((group, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-700 border-r border-slate-300 uppercase tracking-wider h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                </div>
                {showMonthRow && (
                  <div className="flex bg-slate-100 border-b border-slate-200 sticky top-8 z-40 h-8 items-center">
                    <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full" style={stickyStyle}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                    {Object.values(monthHeaders).map((group, idx) => (<div key={idx} className="text-center text-[11px] font-bold text-slate-600 border-r border-slate-200 uppercase h-full flex items-center justify-center" style={{ width: `${group.colspan * colWidth}px` }}>{group.label}</div>))}
                  </div>
                )}
                <div className={`flex bg-slate-50 border-b border-slate-200 sticky z-40 shadow-sm h-8 items-center ${showMonthRow ? 'top-16' : 'top-8'}`}>
                  <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] h-full" style={stickyStyle}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                  <div className={`flex-shrink-0 border-r border-slate-200 h-full bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
                  {timeline.map(col => {
                      const isCurrent = isCurrentColumn(col);
                      let isHKHoliday = false;
                      let holidayName = '';
                      if (viewMode === 'day' && col.date) {
                          const dateStr = formatDateForInput(col.date);
                          const holiday = holidays.find(h => h.country === 'HK' && h.date === dateStr);
                          if (holiday && (holiday.duration === undefined || holiday.duration === 1)) { isHKHoliday = true; holidayName = holiday.name; }
                      }
                      let className = `flex-shrink-0 text-center text-[10px] border-r border-slate-200 font-medium flex flex-col items-center justify-center relative group/col h-full`;
                      if (isHKHoliday) { className += ' bg-red-50 text-red-700'; } else if (isCurrent) { className += ' bg-amber-100 text-amber-800 border-b-4 border-b-amber-500'; } else { className += ' text-slate-500'; }
                      if (isCurrent && !isHKHoliday) { className += ''; } // Already applied above
                      return (<div key={col.id} className={className} style={{ width: `${colWidth}px` }} title={isHKHoliday ? holidayName : (isCurrent ? 'Current Date' : '')}><span>{col.label}</span>{viewMode === 'day' && col.date && <span className={`text-[9px] ${isHKHoliday ? 'text-red-600 font-bold' : isCurrent ? 'text-amber-800 font-bold' : 'text-slate-400'}`}>{col.date.getDate()}</span>}</div>);
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
                  <div className="flex bg-slate-700 border-b border-slate-600 sticky z-30 group h-[34px]">
                    <div className="flex-shrink-0 px-3 py-1.5 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 z-40 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'project', x: e.pageX, y: e.pageY, projectId: project.id }); }}>
                      <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => !isEditingProject && toggleProject(project.id)}>
                        {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                        <Folder className="w-3.5 h-3.5 text-slate-200" />
                        {isEditingProject ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-slate-600 text-white text-xs font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="font-bold text-xs truncate select-none flex-1" onDoubleClick={(e) => startEditing(`project::${project.id}`, project.name, e)} title="Double click to rename">{project.name}</span> )}
                      </div>
                    </div>
                    {/* Project Row Spacers */}
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    
                    <div className="flex relative">
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
                    let moduleProgress = 0;
                    
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
                            
                            // Calculate module progress
                            moduleProgress = calculateTimeBasedProgress(moduleEarliestStartDate, formatDateForInput(moduleLatestEndDate));
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
                      <div key={module.id} draggable={!isReadOnly && !isFiltered} onDragStart={(e) => handleModuleDragStart(e, index)} onDragOver={handleModuleDragOver} onDrop={(e) => handleModuleDrop(e, project.id, module.id, index)} className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'module', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id }); }}>
                        <div className={`flex ${style.bgColor} border-b border-slate-100 ${style.hoverBgColor} transition-colors group h-[34px]`}>
                          <div className={`flex-shrink-0 py-1.5 px-3 pl-6 border-r border-slate-200 sticky left-0 ${style.bgColor} z-30 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                            <div className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer" onClick={() => !isEditingModule && toggleModule(module.id)}>
                              {!isReadOnly && !isFiltered && <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder"><GripVertical className="w-4 h-4" /></div>}
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
                          
                          {/* Module Details Columns */}
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                            {isModuleCollapsed && moduleEarliestStartDate && <span title="Earliest Start Date" className={`${style.ganttGridColor} rounded p-1`}>{moduleEarliestStartDate}</span>}
                          </div>
                          <div className={`flex-shrink-0 text-[10px] font-bold ${style.totalTextColor}/80 border-r border-slate-200 flex items-center justify-center ${style.bgColor} ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                            {isModuleCollapsed && moduleTotalDuration > 0 && <span title="Total Duration" className={`${style.ganttGridColor} rounded p-1`}>{moduleTotalDuration}d</span>}
                          </div>
                          <div className={`flex-shrink-0 border-r border-slate-200 ${style.bgColor} ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}></div>

                          <div className="flex relative">
                             {isModuleCollapsed && displayMode === 'gantt' && moduleStartIndex > -1 && moduleEndIndex > -1 && (
                                <div
                                    className={`absolute top-1/2 -translate-y-1/2 h-4 z-10 ${style.ganttBarColor} rounded-md flex items-center justify-center overflow-hidden`}
                                    style={{
                                        left: `${moduleStartIndex * colWidth + 2}px`,
                                        width: `${(moduleEndIndex - moduleStartIndex + 1) * colWidth - 4}px`,
                                    }}
                                    title={`Duration: ${moduleTotalDuration} working days`}
                                >
                                    {moduleProgress > 0 && (
                                        <div className="absolute top-0 bottom-0 left-0 bg-black/20" style={{ width: `${moduleProgress}%` }}></div>
                                    )}
                                    <span className="relative z-10 text-[9px] font-bold text-white/90 drop-shadow-sm px-1">
                                        {moduleProgress > 0 ? `${moduleProgress}%` : ''}
                                    </span>
                                </div>
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
                          let taskProgress = 0;

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
                                  taskProgress = calculateTimeBasedProgress(earliestStartDate, formatDateForInput(latestEndDate));
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
                              <div draggable={!isReadOnly && !isFiltered} onDragStart={(e) => handleTaskDragStart(e, project.id, module.id, taskIndex)} onDragOver={handleTaskDragOver} onDrop={(e) => handleTaskDrop(e, project.id, module.id, taskIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'task', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id }); }} className={`flex border-b border-slate-100 bg-slate-50 group/task h-[34px] ${draggedTask?.moduleId === module.id && draggedTask?.index === taskIndex ? 'opacity-30' : ''}`}>
                                <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between pl-6 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingTask && toggleTask(task.id)}>
                                    {!isReadOnly && !isFiltered && <div className="cursor-grab text-slate-400 hover:text-slate-600" title="Drag to reorder task"><GripVertical size={14} /></div>}
                                    {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                    {isEditingTask ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-[11px] font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="text-[11px] text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" title="Double click to rename" onDoubleClick={(e) => startEditing(taskEditId, task.name, e)}>{task.name}</span> )}
                                  </div>
                                  {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.EA)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add another resource to this task"><UserPlus size={14} /></button></div>}
                                </div>
                                
                                {/* Task Details Columns */}
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                  {isTaskCollapsed && earliestStartDate && <span title="Earliest Start Date" className="bg-slate-200/50 rounded p-1">{earliestStartDate}</span>}
                                </div>
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                  {isTaskCollapsed && totalDuration > 0 && <span title="Total Duration" className="bg-slate-200/50 rounded p-1">{totalDuration}d</span>}
                                </div>
                                <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}></div>

                                <div className="flex relative">
                                    {isTaskCollapsed && displayMode === 'gantt' && taskStartIndex > -1 && taskEndIndex > -1 && (
                                        <div
                                            className="absolute top-1/2 -translate-y-1/2 h-4 z-10 bg-slate-400 rounded-md flex items-center justify