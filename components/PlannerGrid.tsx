import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ResourceAllocation, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { getTimeline, GOV_HOLIDAYS_DB, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween, calculateTimeBasedProgress } from '../constants';
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
  holidayDuration: number;
  isCurrent: boolean;
  holidayName?: string | any;
  disabled?: boolean;
}

const GridNumberInput: React.FC<GridNumberInputProps> = ({ value, onChange, onNavigate, rowIndex, colIndex, width, holidayDuration, isCurrent, holidayName, disabled }) => {
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
          style={{ width: `${width}