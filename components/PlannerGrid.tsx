import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { getTimeline, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween, getTaskBaseName } from '../constants';
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
    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const date = new Date(year, month - 1, prevMonthDays - i);
        days.push({ date, isCurrentMonth: false });
    }
    for (let i = 1; i <= daysInMonth; i++) {
        const date = new Date(year, month, i);
        days.push({ date, isCurrentMonth: true });
    }
    const remaining = 42 - days.length;
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
            <button key={i} onClick={() => handleDayClick(day)} className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${!day.isCurrentMonth ? 'text-slate-300' : 'text-slate-700'} ${day.isCurrentMonth && !isSelected ? 'hover:bg-slate-100' : ''} ${isToday && !isSelected ? 'border border-indigo-300' : ''} ${isSelected ? 'bg-indigo-600 text-white font-bold hover:bg-indigo-700' : ''}`}>
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

interface GridNumberInputProps {
  value: number;
  onChange: (val: string) => void;
  onNavigate: (direction: string, r: number, c: number) => void;
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
  useEffect(() => { if (!isEditing) setLocalValue(value === 0 ? '' : String(value)); }, [value, isEditing]);
  const commit = () => { onChange(localValue); setIsEditing(false); };
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); commit(); onNavigate(e.key, rowIndex, colIndex); }
      if (e.key === 'Enter') e.currentTarget.blur();
  };
  return (
      <div className={`flex-shrink-0 border-r border-slate-100 relative ${isHoliday ? 'bg-[repeating-linear-gradient(45deg,theme(colors.red.50),theme(colors.red.50)_5px,theme(colors.red.100)_5px,theme(colors.red.100)_10px)]' : isCurrent ? 'bg-amber-100 ring-1 ring-inset ring-amber-300' : ''}`} style={{ width: `${width}px` }} title={typeof holidayName === 'string' ? holidayName : holidayName?.name}>
          {isHoliday && holidayName ? (
              <div className="flex items-center justify-center h-full text-[10px] font-bold text-red-700 select-none">{'country' in (holidayName as any) ? (holidayName as any).country : 'AL'}</div>
          ) : disabled ? (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-medium">{localValue}</div>
          ) : (
              <input type="text" data-r={rowIndex} data-c={colIndex} data-grid="planner" className={`w-full h-full text-center text-[10px] focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-0 transition-colors ${(localValue && localValue !== '0') ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-400 hover:bg-slate-50/50'}`} value={localValue} placeholder="-" onChange={(e) => setLocalValue(e.target.value)} onBlur={commit} onFocus={(e) => { setIsEditing(true); e.target.select(); }} onKeyDown={handleKeyDown} disabled={disabled} />
          )}
      </div>
  );
};

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

const MODULE_TYPE_STYLES = {
  [ModuleType.Development]: { icon: Layers, iconColor: 'text-indigo-600', bgColor: 'bg-indigo-50', hoverBgColor: 'hover:bg-indigo-100/50', textColor: 'text-slate-800', hoverTextColor: 'hover:text-indigo-600', ganttBarColor: 'bg-indigo-400', ganttGridColor: 'bg-indigo-200', totalTextColor: 'text-indigo-900' },
  [ModuleType.Preparation]: { icon: Gem, iconColor: 'text-amber-600', bgColor: 'bg-amber-100', hoverBgColor: 'hover:bg-amber-200/50', textColor: 'text-amber-900', hoverTextColor: 'hover:text-amber-700', ganttBarColor: 'bg-amber-500', ganttGridColor: 'bg-amber-200', totalTextColor: 'text-amber-900' },
  [ModuleType.PostDevelopment]: { icon: ShieldCheck, iconColor: 'text-teal-600', bgColor: 'bg-teal-100', hoverBgColor: 'hover:bg-teal-200/50', textColor: 'text-teal-900', hoverTextColor: 'hover:text-teal-700', ganttBarColor: 'bg-teal-500', ganttGridColor: 'bg-teal-200', totalTextColor: 'text-teal-900' },
  [ModuleType.MVP]: { icon: Rocket, iconColor: 'text-sky-600', bgColor: 'bg-sky-100', hoverBgColor: 'hover:bg-sky-200/50', textColor: 'text-sky-900', hoverTextColor: 'hover:text-sky-700', ganttBarColor: 'bg-sky-500', ganttGridColor: 'bg-sky-200', totalTextColor: 'text-sky-900' },
  [ModuleType.Production]: { icon: Server, iconColor: 'text-slate-600', bgColor: 'bg-slate-100', hoverBgColor: 'hover:bg-slate-200/50', textColor: 'text-slate-900', hoverTextColor: 'hover:text-slate-700', ganttBarColor: 'bg-slate-500', ganttGridColor: 'bg-slate-200', totalTextColor: 'text-slate-900' },
};

export const PlannerGrid: React.FC<PlannerGridProps> = ({ projects, holidays, resources, timelineStart, timelineEnd, onExtendTimeline, onUpdateAllocation, onUpdateAssignmentResourceName, onUpdateAssignmentDependency, onAddTask, onAddAssignment, onCopyAssignment, onReorderModules, onReorderTasks, onMoveTask, onUpdateModuleType, onReorderAssignments, onShiftTask, onUpdateAssignmentSchedule, onUpdateAssignmentProgress, onAddProject, onAddModule, onUpdateProjectName, onUpdateModuleName, onUpdateTaskName, onDeleteProject, onDeleteModule, onDeleteTask, onDeleteAssignment, onImportPlan, onShowHistory, onRefresh, saveStatus, isRefreshing, isReadOnly = false }) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem('oms_collapsed_projects') || '{}'));
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem('oms_collapsed_modules') || '{}'));
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>(() => JSON.parse(localStorage.getItem('oms_collapsed_tasks') || '{}'));
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [displayMode, setDisplayMode] = useState<'allocation' | 'gantt'>('allocation');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [startColWidth, setStartColWidth] = useState(95);
  const [durationColWidth, setDurationColWidth] = useState(50);
  const [dependencyColWidth, setDependencyColWidth] = useState(50);
  const [colWidthBase, setColWidthBase] = useState(20);
  const [isDetailsFrozen, setIsDetailsFrozen] = useState(true);
  const [showToggleMenu, setShowToggleMenu] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, type: string, projectId: string, moduleId?: string, taskId?: string, assignmentId?: string } | null>(null);
  const [datePickerState, setDatePickerState] = useState<{ assignmentId: string | null }>({ assignmentId: null });

  const importInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const resizeGhostRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeData = useRef({ col: '', startX: 0, startWidth: 0 });

  useEffect(() => { localStorage.setItem('oms_collapsed_projects', JSON.stringify(collapsedProjects)); }, [collapsedProjects]);
  useEffect(() => { localStorage.setItem('oms_collapsed_modules', JSON.stringify(collapsedModules)); }, [collapsedModules]);
  useEffect(() => { localStorage.setItem('oms_collapsed_tasks', JSON.stringify(collapsedTasks)); }, [collapsedTasks]);

  const toggleProject = (id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTask = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const projectHolidaySet = useMemo(() => new Set(holidays.filter(h => h.country === 'HK').map(h => h.date)), [holidays]);
  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);
  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;

  const resourceHolidaysMap = useMemo(() => {
    const map = new Map<string, { holidays: any[], dateSet: Set<string> }>();
    const defaultHolidays = holidays.filter(h => h.country === 'HK');
    map.set('Unassigned', { holidays: defaultHolidays, dateSet: new Set(defaultHolidays.map(h => h.date)) });
    resources.forEach(res => {
        const regional = res.holiday_region ? holidays.filter(h => h.country === res.holiday_region) : [];
        const individual = res.individual_holidays || [];
        const combined = [...regional, ...individual];
        map.set(res.name, { holidays: combined, dateSet: new Set(combined.map(h => h.date)) });
    });
    return map;
  }, [resources, holidays]);

  const groupedResources = useMemo(() => {
    return resources.reduce((acc, r) => {
        const cat = r.category || 'Other';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(r);
        return acc;
    }, {} as Record<string, Resource[]>);
  }, [resources]);

  const allAssignmentsMap = useMemo(() => {
    const map = new Map<string, TaskAssignment>();
    projects.forEach(p => p.modules.forEach(m => m.tasks.forEach(t => t.assignments.forEach(a => map.set(a.id, a)))));
    return map;
  }, [projects]);

  const handleCellUpdate = (projectId: string, moduleId: string, taskId: string, assignmentId: string, col: TimelineColumn, value: string) => {
    if (isReadOnly) return;
    const num = value === '' ? 0 : parseFloat(value);
    if (isNaN(num)) return;
    if (viewMode === 'week') onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.id, num);
    else if (viewMode === 'day' && col.parentWeekId && col.date) onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.parentWeekId, num, formatDateForInput(col.date));
  };

  const getRawCellValue = (assignment: TaskAssignment, col: TimelineColumn): number => {
    const resHols = resourceHolidaysMap.get(assignment.resourceName || 'Unassigned');
    if (viewMode === 'day' && col.date && resHols?.dateSet.has(formatDateForInput(col.date))) return 0;
    if (viewMode === 'week') {
      const alloc = assignment.allocations.find(a => a.weekId === col.id);
      return alloc ? alloc.count : 0;
    }
    if (viewMode === 'day' && col.parentWeekId && col.date) {
      const alloc = assignment.allocations.find(a => a.weekId === col.parentWeekId);
      return alloc?.days?.[formatDateForInput(col.date)] || 0;
    }
    return 0;
  };

  const getTaskTotal = (task: ProjectTask, col: TimelineColumn) => task.assignments.reduce((sum, a) => sum + getRawCellValue(a, col), 0);
  const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => module.tasks.reduce((sum, t) => sum + getTaskTotal(t, col), 0);
  const getProjectTotal = (project: Project, col: TimelineColumn) => project.modules.reduce((sum, m) => sum + getModuleTotal(m, col), 0);

  const startEditing = (id: string, val: string, e?: React.MouseEvent) => {
    if (isReadOnly) return;
    e?.preventDefault();
    setEditingId(id);
    setEditValue(val);
  };

  const saveEdit = () => {
    if (!editingId) return;
    const [type, ...parts] = editingId.split('::');
    if (type === 'project') onUpdateProjectName(parts[0], editValue);
    else if (type === 'module') onUpdateModuleName(parts[0], parts[1], editValue);
    else if (type === 'task') onUpdateTaskName(parts[0], parts[1], parts[2], editValue);
    setEditingId(null);
  };

  const handleResizeStart = (col: string, width: number, e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    resizeData.current = { col, startX: e.clientX, startWidth: width };
    if (resizeGhostRef.current) { resizeGhostRef.current.style.display = 'block'; resizeGhostRef.current.style.left = `${e.clientX}px`; }
    window.addEventListener('mousemove', (ev) => { if (resizeGhostRef.current) resizeGhostRef.current.style.left = `${ev.clientX}px`; });
    window.addEventListener('mouseup', (ev) => {
        isResizing.current = false;
        if (resizeGhostRef.current) resizeGhostRef.current.style.display = 'none';
        const delta = ev.clientX - resizeData.current.startX;
        const newWidth = resizeData.current.startWidth + delta;
        if (resizeData.current.col === 'sidebar') setSidebarWidth(Math.max(150, newWidth));
        if (resizeData.current.col === 'start') setStartColWidth(Math.max(50, newWidth));
        window.removeEventListener('mousemove', () => {});
    }, { once: true });
  };

  const handleExportExcel = () => {
    const data = projects.flatMap(p => p.modules.flatMap(m => m.tasks.flatMap(t => t.assignments.map(a => ({ Project: p.name, Module: m.name, Task: t.name, Role: a.role, Resource: a.resourceName } )))));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plan");
    XLSX.writeFile(wb, "ResourcePlan.xlsx");
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws);
      console.log("Imported JSON:", json);
      // Basic logic to transform JSON to Project[] would go here. 
      // For now, assume onImportPlan handles the logic if projects are correctly mapped.
    };
    reader.readAsBinaryString(file);
  };

  const assignmentRenderInfo = useMemo(() => {
    const map = new Map<string, { rowIndex: number, y: number, startDate: string | undefined, endDate: string }>();
    let rowIndex = 0;
    const HEADER_HEIGHT = (viewMode === 'month' ? 32 : 64) + 32;
    const ROW_HEIGHT = 33;
    projects.forEach(p => {
        rowIndex++;
        if (!collapsedProjects[p.id]) {
            p.modules.forEach(m => {
                rowIndex++;
                if (!collapsedModules[m.id]) {
                    m.tasks.forEach(t => {
                        rowIndex++;
                        if (!collapsedTasks[t.id]) {
                            t.assignments.forEach(a => {
                                if (a.startDate && a.duration) {
                                    map.set(a.id, { rowIndex, y: HEADER_HEIGHT + (rowIndex * ROW_HEIGHT) + 16, startDate: a.startDate, endDate: calculateEndDate(a.startDate, a.duration, projectHolidaySet) });
                                }
                                rowIndex++;
                            });
                        }
                    });
                }
            });
        }
    });
    return { map, totalHeight: HEADER_HEIGHT + (rowIndex * ROW_HEIGHT) };
  }, [projects, collapsedProjects, collapsedModules, collapsedTasks, viewMode]);

  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
      <div ref={resizeGhostRef} className="fixed top-0 bottom-0 w-0.5 bg-indigo-500 z-[100] hidden pointer-events-none" />
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <Calendar className="w-4 h-4 text-slate-500" />
          <div className="flex items-center gap-1 bg-white border rounded p-1">
            <button onClick={() => setDisplayMode('allocation')} className={`px-3 py-1 text-xs rounded ${displayMode === 'allocation' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>Grid</button>
            <button onClick={() => setDisplayMode('gantt')} className={`px-3 py-1 text-xs rounded ${displayMode === 'gantt' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}>Gantt</button>
          </div>
          <div className="flex items-center gap-1 bg-white border rounded p-1">
            {['day', 'week', 'month'].map(m => <button key={m} onClick={() => setViewMode(m as ViewMode)} className={`px-2 py-1 text-xs capitalize ${viewMode === m ? 'font-bold text-indigo-600' : 'text-slate-500'}`}>{m}</button>)}
          </div>
        </div>
        <div className="flex items-center gap-2">
            <SaveStatusIndicator status={saveStatus} />
            <button onClick={handleExportExcel} className="p-2 hover:bg-slate-100 rounded" title="Export Excel"><Download size={16}/></button>
            {!isReadOnly && <button onClick={() => importInputRef.current?.click()} className="p-2 hover:bg-slate-100 rounded" title="Import Excel"><Upload size={16}/></button>}
            <input type="file" ref={importInputRef} onChange={handleImportExcel} className="hidden" />
            <button onClick={onRefresh} className="p-2 hover:bg-slate-100 rounded"><RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''}/></button>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {displayMode === 'gantt' && <DependencyLines allAssignmentsMap={allAssignmentsMap} assignmentRenderInfo={assignmentRenderInfo.map} timeline={timeline} colWidth={colWidth} totalHeight={assignmentRenderInfo.totalHeight} sidebarWidth={sidebarWidth + startColWidth + durationColWidth + dependencyColWidth} />}
        <div className="min-w-max">
            {/* Headers */}
            <div className="flex sticky top-0 z-50 bg-slate-100 border-b border-slate-200">
                <div className="flex-shrink-0 px-3 py-2 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 flex items-center justify-between text-xs font-bold text-slate-700" style={stickyStyle}>
                    Project Structure
                    <div className="w-1 cursor-col-resize hover:bg-indigo-400 h-full" onMouseDown={(e) => handleResizeStart('sidebar', sidebarWidth, e)} />
                </div>
                <div className="flex-shrink-0 border-r border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center bg-slate-50" style={{ width: startColWidth }}>Start</div>
                <div className="flex-shrink-0 border-r border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center bg-slate-50" style={{ width: durationColWidth }}>Days</div>
                <div className="flex-shrink-0 border-r border-slate-200 text-[10px] font-bold text-slate-600 flex items-center justify-center bg-slate-50" style={{ width: dependencyColWidth }}>Dep.</div>
                {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-200 text-[9px] font-medium text-center flex flex-col justify-center" style={{ width: colWidth }}>{col.label}</div>)}
            </div>

            {/* Data Rows */}
            {projects.map(project => (
                <React.Fragment key={project.id}>
                    <div className="flex bg-slate-800 text-white border-b border-slate-700 group h-8">
                        <div className="flex-shrink-0 px-3 py-1 border-r border-slate-700 sticky left-0 bg-slate-800 z-40 flex items-center gap-2 cursor-pointer truncate text-xs font-bold" style={stickyStyle} onClick={() => toggleProject(project.id)}>
                            {collapsedProjects[project.id] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                            {editingId === `project::${project.id}` ? <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} className="bg-slate-700 text-white px-1 w-full outline-none" /> : <span onDoubleClick={() => startEditing(`project::${project.id}`, project.name)}>{project.name}</span>}
                        </div>
                        <div style={{ width: startColWidth + durationColWidth + dependencyColWidth }} className="bg-slate-800 border-r border-slate-700" />
                        {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-700" style={{ width: colWidth }} />)}
                    </div>
                    {!collapsedProjects[project.id] && project.modules.map(module => (
                        <React.Fragment key={module.id}>
                            <div className="flex bg-slate-100 border-b border-slate-200 h-8">
                                <div className="flex-shrink-0 px-3 py-1 pl-8 border-r border-slate-200 sticky left-0 bg-slate-100 z-30 flex items-center gap-2 cursor-pointer truncate text-xs font-semibold text-slate-700" style={stickyStyle} onClick={() => toggleModule(module.id)}>
                                    {collapsedModules[module.id] ? <ChevronRight size={14}/> : <ChevronDown size={14}/>}
                                    <span>{module.name}</span>
                                </div>
                                <div style={{ width: startColWidth + durationColWidth + dependencyColWidth }} className="bg-slate-100 border-r border-slate-200" />
                                {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-200 text-[10px] font-bold text-center flex items-center justify-center text-slate-800" style={{ width: colWidth }}>{getModuleTotal(module, col) || ''}</div>)}
                            </div>
                            {!collapsedModules[module.id] && module.tasks.map(task => (
                                <React.Fragment key={task.id}>
                                    <div className="flex bg-white border-b border-slate-100 h-8">
                                        <div className="flex-shrink-0 px-3 py-1 pl-14 border-r border-slate-200 sticky left-0 bg-white z-20 flex items-center gap-2 cursor-pointer truncate text-[11px] text-slate-600" style={stickyStyle} onClick={() => toggleTask(task.id)}>
                                            {collapsedTasks[task.id] ? <ChevronRight size={12}/> : <ChevronDown size={12}/>}
                                            <span>{task.name}</span>
                                        </div>
                                        <div style={{ width: startColWidth + durationColWidth + dependencyColWidth }} className="bg-white border-r border-slate-200" />
                                        {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-100 text-[10px] text-center flex items-center justify-center text-slate-500" style={{ width: colWidth }}>{getTaskTotal(task, col) || ''}</div>)}
                                    </div>
                                    {!collapsedTasks[task.id] && task.assignments.map(assignment => (
                                        <div key={assignment.id} className="flex bg-white border-b border-slate-50 h-8 group hover:bg-slate-50 transition-colors">
                                            <div className="flex-shrink-0 px-3 py-1 pl-20 border-r border-slate-100 sticky left-0 bg-white z-10 flex items-center gap-2 group-hover:bg-slate-50" style={stickyStyle}>
                                                <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={e => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="bg-transparent border-none text-[10px] w-full outline-none focus:ring-0 cursor-pointer">
                                                    <option value="Unassigned">Unassigned</option>
                                                    {Object.entries(groupedResources).map(([cat, list]) => <optgroup label={cat} key={cat}>{list.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}</optgroup>)}
                                                </select>
                                            </div>
                                            <div style={{ width: startColWidth }} className="border-r border-slate-100 flex items-center px-1">
                                                <input type="date" disabled={isReadOnly} value={assignment.startDate || ''} onChange={e => onUpdateAssignmentSchedule(assignment.id, e.target.value, assignment.duration || 1)} className="text-[10px] w-full bg-transparent outline-none" />
                                            </div>
                                            <div style={{ width: durationColWidth }} className="border-r border-slate-100 flex items-center px-1">
                                                <input type="number" disabled={isReadOnly} value={assignment.duration || ''} onChange={e => onUpdateAssignmentSchedule(assignment.id, assignment.startDate || '', parseInt(e.target.value))} className="text-[10px] w-full bg-transparent outline-none text-center" />
                                            </div>
                                            <div style={{ width: dependencyColWidth }} className="border-r border-slate-100 flex items-center justify-center">
                                                <select disabled={isReadOnly} value={assignment.parentAssignmentId || ''} onChange={e => onUpdateAssignmentDependency(assignment.id, e.target.value || null)} className="text-[10px] w-full bg-transparent outline-none text-center appearance-none">
                                                    <option value="">-</option>
                                                    {Array.from(allAssignmentsMap.values()).filter(a => a.id !== assignment.id).map(a => <option key={a.id} value={a.id}>{a.resourceName || 'Unassigned'}</option>)}
                                                </select>
                                            </div>
                                            {timeline.map((col, colIdx) => (
                                                <GridNumberInput key={col.id} rowIndex={0} colIndex={colIdx} width={colWidth} value={getRawCellValue(assignment, col)} onChange={val => handleCellUpdate(project.id, module.id, task.id, assignment.id, col, val)} onNavigate={() => {}} isHoliday={false} isCurrent={false} disabled={isReadOnly} />
                                            ))}
                                        </div>
                                    ))}
                                </React.Fragment>
                            ))}
                        </React.Fragment>
                    ))}
                </React.Fragment>
            ))}
        </div>
      </div>
      {contextMenu && (
        <div style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-[100] bg-white shadow-xl rounded border p-1 animate-in fade-in">
          {contextMenu.type === 'project' && <button onClick={() => { onAddModule(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left p-2 text-xs hover:bg-slate-100">Add Module</button>}
          {contextMenu.type === 'task' && <button onClick={() => { onAddAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, Role.DEV); setContextMenu(null); }} className="w-full text-left p-2 text-xs hover:bg-slate-100">Add Resource</button>}
          <button onClick={() => setContextMenu(null)} className="w-full text-left p-2 text-xs hover:bg-slate-100 text-red-600">Close</button>
        </div>
      )}
    </div>
  );
};