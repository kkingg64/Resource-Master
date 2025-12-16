
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday, Resource, IndividualHoliday, ResourceAllocation } from '../types';
import { getTimeline, GOV_HOLIDAYS_DB, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput, calculateEndDate, calculateWorkingDaysBetween } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, GripVertical, Plus, UserPlus, Folder, Settings2, Trash2, Download, Upload, History, RefreshCw, CheckCircle, AlertTriangle, RotateCw, ChevronsDownUp, Copy, Pin, PinOff, Link, Link2, EyeOff, Eye, LayoutList, CalendarRange, Percent } from 'lucide-react';
import * as XLSX from 'xlsx';

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
  const [startColWidth, setStartColWidth] = useState(95);
  const [durationColWidth, setDurationColWidth] = useState(50);
  const [dependencyColWidth, setDependencyColWidth] = useState(50);

  const [colWidthBase, setColWidthBase] = useState(40);
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
  
  const importInputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const toggleButtonRef = useRef<HTMLButtonElement>(null);

  // --- Performance: Ghost Resize Refs ---
  const resizeGhostRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const resizeData = useRef({ col: '', startX: 0, startWidth: 0 });

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

      if (col === 'sidebar') setSidebarWidth(Math.max(200, Math.min(600, newWidth)));
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
  const handleModuleDrop = (e: React.DragEvent, projectId: string, index: number) => { if (isReadOnly) return; e.preventDefault(); setDraggedModuleIndex(null); const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(startIndex) && startIndex !== index) { onReorderModules(projectId, startIndex, index); } };

  const handleTaskDragStart = (e: React.DragEvent, moduleId: string, taskIndex: number) => { if (isReadOnly) return; e.dataTransfer.setData("application/json", JSON.stringify({ type: 'task', moduleId, index: taskIndex })); e.dataTransfer.effectAllowed = "move"; setDraggedTask({ moduleId, index: taskIndex }); };
  const handleTaskDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleTaskDrop = (e: React.DragEvent, projectId: string, targetModuleId: string, targetTaskIndex: number) => { if (isReadOnly) return; e.preventDefault(); setDraggedTask(null); try { const data = JSON.parse(e.dataTransfer.getData("application/json")); if (data.type === 'task' && data.moduleId === targetModuleId && data.index !== targetTaskIndex) { onReorderTasks(projectId, data.moduleId, data.index, targetTaskIndex); } } catch (err) { console.error("Error dropping task", err); } };
  
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

  return (
    <>
      <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden relative">
        {/* Ghost Resize Line */}
        <div 
            ref={resizeGhostRef} 
            className="fixed top-0 bottom-0 w-0.5 bg-indigo-500 z-[100] hidden pointer-events-none border-l border-dashed border-indigo-200"
            style={{ display: 'none' }}
        ></div>

        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
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
            <div className="flex items-center gap-2 bg-slate-200 rounded-lg p-1">
                <button onClick={() => setDisplayMode('allocation')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${displayMode === 'allocation' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Grid View (Allocations)"><LayoutList size={14} /> Grid</button>
                <button onClick={() => setDisplayMode('gantt')} className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded transition-all ${displayMode === 'gantt' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`} title="Gantt View (Timeline Bars)"><CalendarRange size={14} /> Gantt</button>
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

        <div className="overflow-x-auto custom-scrollbar flex-1 relative">
          <div className="min-w-max">
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
                          if (holiday) { isHKHoliday = true; holidayName = holiday.name; }
                      }
                      let className = `flex-shrink-0 text-center text-[10px] border-r border-slate-200 font-medium flex flex-col items-center justify-center relative group/col h-full`;
                      if (isHKHoliday) { className += ' bg-red-50 text-red-700'; } else if (isCurrent) { className += ' bg-amber-100 text-amber-800 border-b-4 border-b-amber-500'; } else { className += ' text-slate-500'; }
                      if (isCurrent && !isHKHoliday) { className += ''; } // Already applied above
                      return (<div key={col.id} className={className} style={{ width: `${colWidth}px` }} title={isHKHoliday ? holidayName : (isCurrent ? 'Current Date' : '')}><span>{col.label}</span>{viewMode === 'day' && col.date && <span className={`text-[9px] ${isHKHoliday ? 'text-red-600 font-bold' : isCurrent ? 'text-amber-800 font-bold' : 'text-slate-400'}`}>{col.date.getDate()}</span>}</div>);
                  })}
                </div>
              </>

            {projects.map((project) => {
              const isProjectCollapsed = collapsedProjects[project.id];
              const isEditingProject = editingId === `project::${project.id}`;

              return (
                <React.Fragment key={project.id}>
                  <div className="flex bg-slate-700 border-b border-slate-600 sticky z-30 group">
                    <div className="flex-shrink-0 px-3 py-1.5 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 z-40 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'project', x: e.pageX, y: e.pageY, projectId: project.id }); }}>
                      <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => !isEditingProject && toggleProject(project.id)}>
                        {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                        <Folder className="w-3.5 h-3.5 text-slate-200" />
                        {isEditingProject ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-slate-600 text-white text-xs font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="font-bold text-xs truncate select-none flex-1" onDoubleClick={(e) => startEditing(`project::${project.id}`, project.name, e)} title="Double click to rename">{project.name}</span> )}
                      </div>
                      {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }} className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-red-300 hover:bg-red-500 hover:text-white p-1 rounded transition-colors" title="Delete Project"><Trash2 size={12} /></button>}
                    </div>
                    {/* Project Row Spacers */}
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    <div className={`flex-shrink-0 border-r border-slate-600 bg-slate-700 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 39 : undefined }}></div>
                    
                    {timeline.map(col => { const total = getProjectTotal(project, col); const isCurrent = isCurrentColumn(col); return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-600 flex items-center justify-center bg-slate-700 ${isCurrent ? 'bg-slate-600 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-bold text-slate-200">{formatValue(total)}</span>)}</div> ); })}
                  </div>

                  {!isProjectCollapsed && project.modules.map((module, index) => {
                    const isModuleCollapsed = collapsedModules[module.id];
                    const moduleEditId = `module::${project.id}::${module.id}`;
                    const isEditingModule = editingId === moduleEditId;
                    let moduleEarliestStartDate: string | null = null;
                    let moduleLatestEndDate: Date | null = null;
                    let moduleTotalDuration = 0;
                    { const allAssignments = module.tasks.flatMap(t => t.assignments); if (allAssignments.length > 0) { let earliestDate: Date | null = null; let latestEndDate: Date | null = null; const moduleHolidays = new Set<string>(); allAssignments.forEach(a => { const resourceName = a.resourceName || 'Unassigned'; const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); if (resourceHolidayData) { resourceHolidayData.dateSet.forEach(d => moduleHolidays.add(d)); } }); allAssignments.forEach(assignment => { if (!assignment.startDate || !assignment.duration) return; const startDate = new Date(assignment.startDate.replace(/-/g, '/')); if (!earliestDate || startDate < earliestDate) { earliestDate = startDate; } const resourceName = assignment.resourceName || 'Unassigned'; const assignmentHolidays = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.dateSet || new Set<string>(); const endDateStr = calculateEndDate(assignment.startDate!, assignment.duration, assignmentHolidays); const endDate = new Date(endDateStr.replace(/-/g, '/')); if (!latestEndDate || endDate > latestEndDate) { latestEndDate = endDate; } }); if (earliestDate && latestEndDate) { moduleEarliestStartDate = formatDateForInput(earliestDate); moduleLatestEndDate = latestEndDate; moduleTotalDuration = calculateWorkingDaysBetween(formatDateForInput(earliestDate), formatDateForInput(latestEndDate), moduleHolidays); } } }

                    return (
                      <div key={module.id} draggable={!isReadOnly} onDragStart={(e) => handleModuleDragStart(e, index)} onDragOver={handleModuleDragOver} onDrop={(e) => handleModuleDrop(e, project.id, index)} className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'module', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id }); }}>
                        <div className="flex bg-indigo-50 border-b border-slate-100 hover:bg-indigo-100/50 transition-colors group">
                          <div className="flex-shrink-0 py-1.5 px-3 pl-6 border-r border-slate-200 sticky left-0 bg-indigo-50 z-30 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                            <div className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer" onClick={() => !isEditingModule && toggleModule(module.id)}>
                              {!isReadOnly && <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder"><GripVertical className="w-4 h-4" /></div>}
                              {isModuleCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />}
                              <Layers className="w-4 h-4 text-indigo-600" />
                              {isEditingModule ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-800 text-xs font-semibold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" onClick={(e) => e.stopPropagation()} /> ) : ( <span className="font-semibold text-xs text-slate-800 truncate select-none flex-1 hover:text-indigo-600" onDoubleClick={(e) => startEditing(moduleEditId, module.name, e)} title="Double click to rename">{module.name}</span> )}
                            </div>
                            {!isReadOnly && <button onClick={(e) => { e.stopPropagation(); onDeleteModule(project.id, module.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 transition-opacity" title="Delete Module"><Trash2 size={14} /></button>}
                          </div>
                          
                          {/* Module Details Columns */}
                          <div className={`flex-shrink-0 text-[10px] font-bold text-indigo-800/80 border-r border-slate-200 flex items-center justify-center bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                            {isModuleCollapsed && moduleEarliestStartDate && <span title="Earliest Start Date" className="bg-indigo-200/50 rounded p-1">{moduleEarliestStartDate.substring(5)}</span>}
                          </div>
                          <div className={`flex-shrink-0 text-[10px] font-bold text-indigo-800/80 border-r border-slate-200 flex items-center justify-center bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                            {isModuleCollapsed && moduleTotalDuration > 0 && <span title="Total Duration" className="bg-indigo-200/50 rounded p-1">{moduleTotalDuration}d</span>}
                          </div>
                          <div className={`flex-shrink-0 border-r border-slate-200 bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}></div>

                          {timeline.map(col => {
                            const total = getModuleTotal(module, col);
                            const isCurrent = isCurrentColumn(col);
                            let isInModuleRange = false; let isModuleStart = false; let isModuleEnd = false;
                            if (moduleEarliestStartDate && moduleLatestEndDate) { const modStart = new Date(moduleEarliestStartDate.replace(/-/g, '/')); const modEnd = moduleLatestEndDate; if (viewMode === 'day' && col.date) { isInModuleRange = col.date >= modStart && col.date <= modEnd; isModuleStart = col.date.getTime() === modStart.getTime(); isModuleEnd = col.date.getTime() === modEnd.getTime(); if (formatDateForInput(col.date) === formatDateForInput(modStart)) isModuleStart = true; if (formatDateForInput(col.date) === formatDateForInput(modEnd)) isModuleEnd = true; } else if (viewMode === 'week') { const [y, w] = col.id.split('-').map(Number); const colDate = getDateFromWeek(y, w); const colEnd = new Date(colDate); colEnd.setDate(colEnd.getDate() + 6); isInModuleRange = (modStart <= colEnd) && (modEnd >= colDate); if (isInModuleRange) { const startWeekId = getWeekIdFromDate(modStart); const endWeekId = getWeekIdFromDate(modEnd); isModuleStart = col.id === startWeekId; isModuleEnd = col.id === endWeekId; } } else if (viewMode === 'month') { if (col.weekIds && col.weekIds.length > 0) { const startWeek = col.weekIds[0]; const endWeek = col.weekIds[col.weekIds.length - 1]; const [y1, w1] = startWeek.split('-').map(Number); const mStart = getDateFromWeek(y1, w1); const [y2, w2] = endWeek.split('-').map(Number); const mEnd = new Date(getDateFromWeek(y2, w2)); mEnd.setDate(mEnd.getDate() + 6); isInModuleRange = (modStart <= mEnd) && (modEnd >= mStart); isModuleStart = modStart >= mStart && modStart <= mEnd; isModuleEnd = modEnd >= mStart && modEnd <= mEnd; } } }
                            return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center bg-indigo-50 relative ${isCurrent ? 'bg-indigo-50/80' : ''}`} style={{ width: `${colWidth}px` }}>{isInModuleRange && ( <div className={`absolute pointer-events-none ${displayMode === 'gantt' ? 'top-1/2 -translate-y-1/2 h-2 bg-indigo-400 opacity-60 rounded' : 'inset-y-1 inset-x-0 bg-indigo-200'} ${isModuleStart ? 'rounded-l-md ml-1' : ''} ${isModuleEnd ? 'rounded-r-md mr-1' : ''}`}></div> )}{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-bold text-indigo-900 relative z-10">{formatValue(total)}</span>)}</div> );
                          })}
                        </div>

                        {!isModuleCollapsed && module.tasks.map((task, taskIndex) => {
                          const taskEditId = `task::${project.id}::${module.id}::${task.id}`;
                          const isTaskCollapsed = collapsedTasks[task.id];
                          const isEditingTask = editingId === taskEditId;
                          let earliestStartDate: string | null = null; let latestEndDate: Date | null = null; let totalDuration = 0;
                          if (task.assignments.length > 0) { let earliestDate: Date | null = null; const taskHolidays = new Set<string>(); task.assignments.forEach(a => { const resourceName = a.resourceName || 'Unassigned'; const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); if (resourceHolidayData) { resourceHolidayData.dateSet.forEach(d => taskHolidays.add(d)); } }); task.assignments.forEach(assignment => { if (!assignment.startDate || !assignment.duration) return; const startDate = new Date(assignment.startDate.replace(/-/g, '/')); if (!earliestDate || startDate < earliestDate) { earliestDate = startDate; } const resourceName = assignment.resourceName || 'Unassigned'; const assignmentHolidays = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.dateSet || new Set<string>(); const endDateStr = calculateEndDate(assignment.startDate!, assignment.duration, assignmentHolidays); const endDate = new Date(endDateStr.replace(/-/g, '/')); if (!latestEndDate || endDate > latestEndDate) { latestEndDate = endDate; } }); if (earliestDate && latestEndDate) { earliestStartDate = formatDateForInput(earliestDate); totalDuration = calculateWorkingDaysBetween(formatDateForInput(earliestDate), formatDateForInput(latestEndDate), taskHolidays); } }

                          return (
                            <React.Fragment key={task.id}>
                              <div draggable={!isReadOnly} onDragStart={(e) => handleTaskDragStart(e, module.id, taskIndex)} onDragOver={handleTaskDragOver} onDrop={(e) => handleTaskDrop(e, project.id, module.id, taskIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'task', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id }); }} className={`flex border-b border-slate-100 bg-slate-50 group/task ${draggedTask?.moduleId === module.id && draggedTask?.index === taskIndex ? 'opacity-30' : ''}`}>
                                <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between pl-6 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                                  <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingTask && toggleTask(task.id)}>
                                    {!isReadOnly && <div className="cursor-grab text-slate-400 hover:text-slate-600" title="Drag to reorder task"><GripVertical size={14} /></div>}
                                    {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                    {isEditingTask ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-[11px] font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="text-[11px] text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" title="Double click to rename" onDoubleClick={(e) => startEditing(taskEditId, task.name, e)}>{task.name}</span> )}
                                  </div>
                                  {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.EA)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add another resource to this task"><UserPlus size={14} /></button></div>}
                                </div>
                                
                                {/* Task Details Columns */}
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                  {isTaskCollapsed && earliestStartDate && <span title="Earliest Start Date" className="bg-slate-200/50 rounded p-1">{earliestStartDate.substring(5)}</span>}
                                </div>
                                <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                  {isTaskCollapsed && totalDuration > 0 && <span title="Total Duration" className="bg-slate-200/50 rounded p-1">{totalDuration}d</span>}
                                </div>
                                <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}></div>

                                {timeline.map(col => {
                                  const total = getTaskTotal(task, col); const isCurrent = isCurrentColumn(col); let isInTaskRange = false; let isTaskStart = false; let isTaskEnd = false;
                                  if (earliestStartDate && latestEndDate) { const tStart = new Date(earliestStartDate.replace(/-/g, '/')); const tEnd = latestEndDate; if (viewMode === 'day' && col.date) { isInTaskRange = col.date >= tStart && col.date <= tEnd; isTaskStart = col.date.getTime() === tStart.getTime(); isTaskEnd = col.date.getTime() === tEnd.getTime(); if (formatDateForInput(col.date) === formatDateForInput(tStart)) isTaskStart = true; if (formatDateForInput(col.date) === formatDateForInput(tEnd)) isTaskEnd = true; } else if (viewMode === 'week') { const [y, w] = col.id.split('-').map(Number); const colDate = getDateFromWeek(y, w); const colEnd = new Date(colDate); colEnd.setDate(colEnd.getDate() + 6); isInTaskRange = (tStart <= colEnd) && (tEnd >= colDate); if (isInTaskRange) { const startWeekId = getWeekIdFromDate(tStart); const endWeekId = getWeekIdFromDate(tEnd); isTaskStart = col.id === startWeekId; isTaskEnd = col.id === endWeekId; } } else if (viewMode === 'month') { if (col.weekIds && col.weekIds.length > 0) { const startWeek = col.weekIds[0]; const endWeek = col.weekIds[col.weekIds.length - 1]; const [y1, w1] = startWeek.split('-').map(Number); const mStart = getDateFromWeek(y1, w1); const [y2, w2] = endWeek.split('-').map(Number); const mEnd = new Date(getDateFromWeek(y2, w2)); mEnd.setDate(mEnd.getDate() + 6); isInTaskRange = (tStart <= mEnd) && (tEnd >= mStart); isTaskStart = tStart >= mStart && tStart <= mEnd; isTaskEnd = tEnd >= mStart && tEnd <= mEnd; } } }
                                  return ( <div key={`th-${task.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center bg-slate-50 relative ${isCurrent ? 'bg-slate-50' : ''}`} style={{ width: `${colWidth}px` }}>{isInTaskRange && ( <div className={`absolute pointer-events-none ${displayMode === 'gantt' ? 'top-1/2 -translate-y-1/2 h-2 bg-slate-400 opacity-60 rounded' : 'inset-y-1 inset-x-0 bg-slate-200'} ${isTaskStart ? 'rounded-l-md ml-1' : ''} ${isTaskEnd ? 'rounded-r-md mr-1' : ''}`}></div> )}{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-semibold text-slate-600 relative z-10">{formatValue(total)}</span>)}</div> );
                                })}
                              </div>

                              {!isTaskCollapsed && task.assignments.map((assignment, assignmentIndex) => {
                                let assignmentStartDate: Date;
                                if (assignment.startDate) { assignmentStartDate = new Date(assignment.startDate.replace(/-/g, '/')); } else if (assignment.startWeekId) { assignmentStartDate = getDateFromWeek(parseInt(assignment.startWeekId.split('-')[0]), parseInt(assignment.startWeekId.split('-')[1])); } else { assignmentStartDate = new Date(); }
                                const resourceName = assignment.resourceName || 'Unassigned'; const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); const assignmentHolidays = resourceHolidayData?.dateSet || new Set<string>(); const endDateStr = calculateEndDate(formatDateForInput(assignmentStartDate), assignment.duration || 1, assignmentHolidays); const assignmentEndDate = new Date(endDateStr.replace(/-/g, '/'));
                                const possibleParents = allAssignmentsForDependencies.filter(parent => parent.id !== assignment.id && !isCircularDependency(assignment.id, parent.id)); const groupedParents = possibleParents.reduce((acc, parent) => { if (!acc[parent.groupLabel]) acc[parent.groupLabel] = []; acc[parent.groupLabel].push(parent); return acc; }, {} as Record<string, typeof possibleParents>);
                                const isEditingDuration = editingId === `duration::${assignment.id}`; const roleStyle = getRoleStyle(assignment.role);
                                const currentRowIndex = gridRowIndex++; // Increment for each assignment row

                                return (
                                <div key={assignment.id} className={`flex border-b border-slate-100 group/assign ${draggedAssignment?.taskId === task.id && draggedAssignment?.index === assignmentIndex ? 'opacity-30' : ''}`} draggable={!isReadOnly} onDragStart={(e) => handleAssignmentDragStart(e, task.id, assignmentIndex)} onDragOver={handleAssignmentDragOver} onDrop={(e) => handleAssignmentDrop(e, project.id, module.id, task.id, assignmentIndex)} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); !isReadOnly && setContextMenu({ type: 'assignment', x: e.pageX, y: e.pageY, projectId: project.id, moduleId: module.id, taskId: task.id, assignmentId: assignment.id }); }}>
                                  <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-10 flex items-center justify-between border-l-[3px] ${roleStyle.border} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}>
                                    <div className="flex-1 overflow-hidden flex items-center gap-2 pl-12">
                                      <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="w-full text-[11px] text-slate-600 bg-transparent border-none p-0 focus:ring-0 cursor-pointer hover:text-indigo-600 disabled:cursor-default disabled:hover:text-slate-600">
                                          <option value="Unassigned">Unassigned</option>
                                          {Object.entries(groupedResources).map(([category, resList]) => ( <optgroup label={category} key={category}>{resList.map(r => <option key={r.id} value={r.name}>{r.name} {r.type === 'External' ? '(Ext.)' : ''}</option>)}</optgroup> ))}
                                      </select>
                                    </div>
                                  </div>
                                  
                                  {/* Assignment Details Columns */}
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center px-2 py-1.5 relative group-hover/assign:bg-slate-50 ${isDetailsFrozen ? 'sticky shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                      {!isReadOnly && <div className="cursor-grab text-slate-300 hover:text-slate-500 mr-1" title="Drag to reorder assignment"><GripVertical size={14} /></div>}
                                      <input type="date" title="Start Date" disabled={isReadOnly || !!assignment.parentAssignmentId} className={`no-calendar-icon text-[11px] py-0.5 px-1 rounded-md bg-transparent border-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-full hover:bg-slate-100 ${isReadOnly || !!assignment.parentAssignmentId ? 'cursor-not-allowed text-slate-400' : 'cursor-pointer text-slate-600'}`} value={formatDateForInput(assignmentStartDate)} onChange={(e) => handleAssignmentStartDateChange(assignment, e.target.value)} />
                                  </div>
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center px-2 py-1.5 relative group-hover/assign:bg-slate-50 ${isDetailsFrozen ? 'sticky shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                      <input type="number" min="1" title="Duration (days)" disabled={isReadOnly} value={isEditingDuration ? editValue : (assignment.duration || 1)} onFocus={() => { setEditingId(`duration::${assignment.id}`); setEditValue((assignment.duration || 1).toString()); }} onChange={(e) => setEditValue(e.target.value)} onBlur={() => saveDuration(assignment)} onKeyDown={(e) => { if (e.key === 'Enter') { saveDuration(assignment); (e.target as HTMLInputElement).blur(); } else if (e.key === 'Escape') { setEditingId(null); (e.target as HTMLInputElement).blur(); } }} ref={isEditingDuration ? editInputRef : undefined} className="text-[11px] py-0.5 px-1 rounded-md bg-transparent border-none text-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 w-full text-center hover:bg-slate-100 disabled:hover:bg-transparent" />
                                  </div>
                                  <div className={`flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-center px-1 py-1.5 relative group-hover/assign:bg-slate-50 ${isDetailsFrozen ? 'sticky shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                      <div className="relative w-full h-full flex items-center justify-center">
                                           <select disabled={isReadOnly} value={assignment.parentAssignmentId || ''} onChange={(e) => onUpdateAssignmentDependency(assignment.id, e.target.value || null)} title="Task Dependency" className="absolute inset-0 w-full h-full text-transparent bg-transparent border-none appearance-none cursor-pointer focus:ring-1 focus:ring-indigo-500 rounded-md disabled:cursor-default">
                                                <option value="" className="text-black">- No Dependency -</option>
                                                {Object.entries(groupedParents).map(([label, group]) => ( <optgroup label={label} key={label}>{group.map(parent => ( <option key={parent.id} value={parent.id} className="text-black">{parent.name}</option> ))}</optgroup> ))}
                                            </select>
                                            {assignment.parentAssignmentId ? <Link size={14} className="text-indigo-600 pointer-events-none" /> : <Link2 size={14} className="text-slate-400 pointer-events-none" />}
                                      </div>
                                  </div>
                                  
                                  {timeline.map((col, colIndex) => {
                                    const dateStr = col.date ? formatDateForInput(col.date) : '';
                                    const isHol = viewMode === 'day' && !!(resourceHolidayData && resourceHolidayData.dateSet.has(dateStr));
                                    const holidayInfo = isHol ? resourceHolidayData!.holidays.find(h => h.date === dateStr) : undefined;
                                    const isCurrent = isCurrentColumn(col);

                                    if (displayMode === 'allocation') {
                                        const raw = getRawCellValue(assignment, col);
                                        return (
                                            <GridNumberInput
                                                key={`${assignment.id}-${col.id}`}
                                                value={raw}
                                                onChange={(val) => handleCellUpdate(project.id, module.id, task.id, assignment.id, col, val)}
                                                onNavigate={handleNavigate}
                                                rowIndex={currentRowIndex}
                                                colIndex={colIndex}
                                                width={colWidth}
                                                isHoliday={isHol}
                                                holidayName={holidayInfo}
                                                isCurrent={isCurrent}
                                                disabled={isReadOnly}
                                            />
                                        );
                                    } else {
                                        let isInRange = false; let isStart = false; let isEnd = false;
                                        if (viewMode === 'day' && col.date) { isInRange = col.date >= assignmentStartDate && col.date <= assignmentEndDate; isStart = col.date.getTime() === assignmentStartDate.getTime(); isEnd = col.date.getTime() === assignmentEndDate.getTime(); if (formatDateForInput(col.date) === formatDateForInput(assignmentStartDate)) isStart = true; if (formatDateForInput(col.date) === formatDateForInput(assignmentEndDate)) isEnd = true; } else if (viewMode === 'week') { const [y, w] = col.id.split('-').map(Number); const colDate = getDateFromWeek(y, w); const colEnd = new Date(colDate); colEnd.setDate(colEnd.getDate() + 6); isInRange = (assignmentStartDate <= colEnd) && (assignmentEndDate >= colDate); if (isInRange) { const startWeekId = getWeekIdFromDate(assignmentStartDate); const endWeekId = getWeekIdFromDate(assignmentEndDate); isStart = col.id === startWeekId; isEnd = col.id === endWeekId; } } else if (viewMode === 'month') { if (col.weekIds && col.weekIds.length > 0) { const startWeek = col.weekIds[0]; const endWeek = col.weekIds[col.weekIds.length - 1]; const [y1, w1] = startWeek.split('-').map(Number); const mStart = getDateFromWeek(y1, w1); const [y2, w2] = endWeek.split('-').map(Number); const mEnd = new Date(getDateFromWeek(y2, w2)); mEnd.setDate(mEnd.getDate() + 6); isInRange = (assignmentStartDate <= mEnd) && (assignmentEndDate >= mStart); isStart = assignmentStartDate >= mStart && assignmentStartDate <= mEnd; isEnd = assignmentEndDate >= mStart && assignmentEndDate <= mEnd; } }
                                        const progress = assignment.progress || 0;
                                        return (
                                            <div key={`${assignment.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 relative ${isCurrent ? 'bg-amber-100 ring-1 ring-inset ring-amber-300' : ''}`} style={{ width: `${colWidth}px` }}>
                                                {isInRange && ( <div className={`absolute top-1 bottom-1 left-0 right-0 ${roleStyle.bar} ${isStart ? 'rounded-l-md ml-1' : ''} ${isEnd ? 'rounded-r-md mr-1' : ''} flex items-center overflow-hidden`} title={`${assignment.role} - ${assignment.resourceName || 'Unassigned'} (${progress}%)`}> <div className={`h-full opacity-30 ${roleStyle.fill}`} style={{ width: `${progress}%` }}></div> {isStart && ( <span className="absolute left-2 text-[9px] font-bold text-slate-700 whitespace-nowrap truncate z-10 pointer-events-none">{assignment.resourceName || 'Unassigned'}</span> )} {isEnd && progress > 0 && ( <span className="absolute right-2 text-[8px] font-bold text-slate-600 z-10 pointer-events-none bg-white/50 px-0.5 rounded">{progress}%</span> )} </div> )}
                                            </div>
                                        );
                                    }
                                  })}
                                </div>
                              )})}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
            
            <div className="flex bg-slate-800 text-white border-t border-slate-700 sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] mt-0.5">
              <div className="flex-shrink-0 px-3 py-1.5 border-r border-slate-700 sticky left-0 bg-slate-800 z-50 font-bold text-xs shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)] flex items-center" style={stickyStyle}>GRAND TOTAL</div>
              
              <div className={`flex-shrink-0 border-r border-slate-700 bg-slate-800 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
              <div className={`flex-shrink-0 border-r border-slate-700 bg-slate-800 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>
              <div className={`flex-shrink-0 border-r border-slate-700 bg-slate-800 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 49 : undefined }}></div>

              {timeline.map(col => { const total = projects.reduce((acc, p) => acc + getProjectTotal(p, col), 0); const isCurrent = isCurrentColumn(col); return ( <div key={`total-${col.id}`} className={`flex-shrink-0 border-r border-slate-700 flex items-center justify-center text-[10px] font-mono font-bold ${isCurrent ? 'bg-slate-700 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>{total > 0 && displayMode === 'allocation' ? formatValue(total) : ''}</div> ); })}
            </div>
          </div>
        </div>
      </div>
      {contextMenu && (
        <div style={{ top: contextMenu.y, left: contextMenu.x }} className="absolute z-50 bg-white shadow-xl rounded-md border border-slate-200 p-1 animate-in fade-in">
          {contextMenu.type === 'project' && ( <> <button onClick={() => { onAddModule(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded flex items-center gap-2"><Plus size={12} /> Add New Module</button> <div className="h-px bg-slate-100 my-1"></div> <button onClick={() => { onDeleteProject(contextMenu.projectId); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-700 rounded flex items-center gap-2 text-red-600"><Trash2 size={12} /> Delete Project</button> </> )}
          {contextMenu.type === 'module' && contextMenu.moduleId && ( <> <button onClick={() => { handleAddTaskClick(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded flex items-center gap-2"><Plus size={12} /> Add New Task</button> <div className="h-px bg-slate-100 my-1"></div> <button onClick={() => { onDeleteModule(contextMenu.projectId, contextMenu.moduleId!); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-700 rounded flex items-center gap-2 text-red-600"><Trash2 size={12} /> Delete Module</button> </> )}
          {contextMenu.type === 'task' && contextMenu.moduleId && contextMenu.taskId && ( <> <button onClick={() => { onAddAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, Role.EA); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded flex items-center gap-2"><UserPlus size={12} /> Add Resource</button> <div className="h-px bg-slate-100 my-1"></div> <button onClick={() => { onDeleteTask(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-700 rounded flex items-center gap-2 text-red-600"><Trash2 size={12} /> Delete Task</button> </> )}
          {contextMenu.type === 'assignment' && contextMenu.assignmentId && contextMenu.moduleId && contextMenu.taskId && ( <> <button onClick={() => { onCopyAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, contextMenu.assignmentId!); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-indigo-50 hover:text-indigo-700 rounded flex items-center gap-2"><Copy size={12} /> Duplicate Assignment</button> {onUpdateAssignmentProgress && ( <div className="px-3 py-1.5 text-xs flex items-center gap-2 text-slate-700"> <Percent size={12} /> <span>Progress</span> <input type="range" min="0" max="100" step="10" className="w-20 accent-indigo-600" onClick={(e) => e.stopPropagation()} defaultValue={projects.find(p => p.id === contextMenu.projectId)?.modules.find(m => m.id === contextMenu.moduleId)?.tasks.find(t => t.id === contextMenu.taskId)?.assignments.find(a => a.id === contextMenu.assignmentId)?.progress || 0} onChange={(e) => onUpdateAssignmentProgress(contextMenu.assignmentId!, parseInt(e.target.value))} /> </div> )} <div className="h-px bg-slate-100 my-1"></div> <button onClick={() => { onDeleteAssignment(contextMenu.projectId, contextMenu.moduleId!, contextMenu.taskId!, contextMenu.assignmentId!); setContextMenu(null); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-red-50 hover:text-red-700 rounded flex items-center gap-2 text-red-600"><Trash2 size={12} /> Delete Assignment</button> </> )}
        </div>
      )}
    </>
  );
};
