
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday } from '../types';
import { getTimeline, ALL_WEEK_IDS, WeekPoint, getDateFromWeek, getWeekIdFromDate, formatDateForInput } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, Info, GripVertical, Plus, UserPlus, ChevronLeft, Clock, PlayCircle, Folder, Settings2, Trash2, Download, Upload, History } from 'lucide-react';
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
  onUpdateFunctionPoints
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
    e?.stopPropagation(); // Prevent toggling collapse
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
      // Format: fp-projectId-moduleId
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

  const handleExportExcel = () => {
    // 1. Create Plan Data
    const planData: any[] = [];
    const weekHeaders = getTimeline('week', timelineStart, timelineEnd).map(w => w.id);

    projects.forEach(p => {
      p.modules.forEach(m => {
        m.tasks.forEach(t => {
          t.assignments.forEach(a => {
            const row: any = {
              'Project': p.name,
              'Module': m.name,
              'Task': t.name,
              'Role': a.role,
              'Resource': a.resourceName || 'Unassigned',
            };
            a.allocations.forEach(alloc => {
              if (weekHeaders.includes(alloc.weekId)) {
                row[alloc.weekId] = alloc.count;
              }
            });
            planData.push(row);
          });
        });
      });
    });

    // 2. Create Holidays Data
    const holidaysData = holidays.map(({ id, ...rest }) => rest);

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();
    const planWs = XLSX.utils.json_to_sheet(planData, { header: ['Project', 'Module', 'Task', 'Role', 'Resource', ...weekHeaders] });
    const holidaysWs = XLSX.utils.json_to_sheet(holidaysData);

    XLSX.utils.book_append_sheet(wb, planWs, 'Resource Plan');
    XLSX.utils.book_append_sheet(wb, holidaysWs, 'Holidays');

    // 4. Trigger Download
    XLSX.writeFile(wb, `oms-resource-plan-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Parse Holidays
        const holidaysSheet = workbook.Sheets['Holidays'];
        if (!holidaysSheet) throw new Error('Holidays sheet not found');
        const importedHolidays: Holiday[] = XLSX.utils.sheet_to_json<any>(holidaysSheet).map((h, i) => ({
          ...h,
          id: `imported-holiday-${i}-${Date.now()}`
        }));

        // Parse Plan
        const planSheet = workbook.Sheets['Resource Plan'];
        if (!planSheet) throw new Error('Resource Plan sheet not found');
        const planJson = XLSX.utils.sheet_to_json<any>(planSheet);

        const importedProjects: Project[] = [];
        let currentProject: Project | null = null;
        let currentModule: ProjectModule | null = null;
        let currentTask: ProjectTask | null = null;

        planJson.forEach((row, index) => {
            // Find or create project
            if (row.Project && row.Project !== currentProject?.name) {
                currentProject = { id: `p-${index}`, name: row.Project, modules: [] };
                importedProjects.push(currentProject);
                currentModule = null;
                currentTask = null;
            }
            if (!currentProject) return;

            // Find or create module
            if (row.Module && row.Module !== currentModule?.name) {
                currentModule = { id: `m-${index}`, name: row.Module, tasks: [], functionPoints: 0, legacyFunctionPoints: 0 };
                currentProject.modules.push(currentModule);
                currentTask = null;
            }
            if (!currentModule) return;

            // Find or create task
            if (row.Task && row.Task !== currentTask?.name) {
                currentTask = { id: `t-${index}`, name: row.Task, assignments: [] };
                currentModule.tasks.push(currentTask);
            }
            if (!currentTask) return;

            // Create assignment
            const allocations: { weekId: string, count: number }[] = [];
            Object.keys(row).forEach(key => {
                // Key looks like '2025-44'
                if (/^\d{4}-\d{2}$/.test(key)) {
                    allocations.push({ weekId: key, count: Number(row[key]) });
                }
            });

            const assignment: TaskAssignment = {
                id: `a-${index}`,
                role: row.Role as Role,
                resourceName: row.Resource,
                allocations,
            };
            currentTask.assignments.push(assignment);
        });

        if (window.confirm('This will overwrite your current plan. Are you sure?')) {
            onImportPlan(importedProjects, importedHolidays);
        }

      } catch (error: any) {
        alert(`Failed to import plan: ${error.message}`);
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset input to allow re-importing same file
  };

  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);

  const today = new Date();
  const currentWeekId = getWeekIdFromDate(today);

  // Helper to check if a column represents the current date/week
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

  // Compute headers grouping
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
      
      // If we have explicit daily data, use it
      if (alloc.days && alloc.days[dateStr] !== undefined) {
          return alloc.days[dateStr];
      }
      
      // Fallback to average if weekly count exists but no daily breakdown
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

  // Aggregation Helpers
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
      // Pass the specific date string to update daily allocation
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

  // Date Picker Handler
  const handleStartDateChange = (projectId: string, moduleId: string, task: ProjectTask, newDateStr: string) => {
     if (!newDateStr) return;
     const date = new Date(newDateStr);
     const newStartWeekId = getWeekIdFromDate(date);
     
     // Preserve duration
     onUpdateTaskSchedule(projectId, moduleId, task.id, newStartWeekId, task.duration || 1);
  };

  const handleEndDateChange = (projectId: string, moduleId: string, task: ProjectTask, newDateStr: string) => {
     if (!newDateStr || !task.startWeekId) return;
     const endDate = new Date(newDateStr);
     const endWeekId = getWeekIdFromDate(endDate);

     const [y1, w1] = task.startWeekId.split('-').map(Number);
     const [y2, w2] = endWeekId.split('-').map(Number);
     
     // Approx logic assuming 52 weeks/year for simple diff
     // A more robust library like date-fns would be better, but we stick to zero-dep
     const weekDiff = (y2 - y1) * 52 + (w2 - w1) + 1;
     const newDuration = Math.max(1, weekDiff);

     onUpdateTaskSchedule(projectId, moduleId, task.id, task.startWeekId, newDuration);
  };

  // Dynamic Column Width based on slider and view mode
  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;

  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };
  const detailsColStyle = { width: detailsWidth, minWidth: detailsWidth, maxWidth: detailsWidth };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">Timeline</span>
          </div>
          
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded overflow-hidden">
             <button onClick={() => onExtendTimeline('start')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600 border-r border-slate-200" title="Add Month to Start">
               &lt; +Month
             </button>
             <button onClick={() => onExtendTimeline('end')} className="px-2 py-1 hover:bg-slate-100 text-xs text-slate-600" title="Add Month to End">
               +Month &gt;
             </button>
          </div>

          <div className="h-4 w-px bg-slate-300"></div>

          {/* Width Slider */}
          <div className="flex items-center gap-2" title="Adjust Column Width">
             <Settings2 size={14} className="text-slate-400" />
             <input 
               type="range" 
               min="20" 
               max="100" 
               value={colWidthBase} 
               onChange={(e) => setColWidthBase(parseInt(e.target.value))}
               className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"
             />
          </div>
        </div>

        <div className="flex gap-4 items-center">
           <div className="flex items-center gap-2">
              <button 
                  onClick={onShowHistory}
                  className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors"
                  title="View and restore saved versions"
              >
                  <History size={12} /> History
              </button>
              <button 
                  onClick={handleExportExcel}
                  className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors"
                  title="Export the current plan as an Excel file"
              >
                  <Download size={12} /> Export Excel
              </button>
              <button 
                  onClick={() => importInputRef.current?.click()}
                  className="text-xs flex items-center gap-1 bg-white text-slate-600 px-2 py-1 rounded hover:bg-slate-100 border border-slate-200 transition-colors"
                  title="Import a plan from an Excel file"
              >
                  <Upload size={12} /> Import Excel
              </button>
              <input type="file" ref={importInputRef} onChange={handleImportExcel} accept=".xlsx, .xls" className="hidden" />
          </div>
          <div className="w-px h-4 bg-slate-300"></div>
          <button 
             onClick={onAddProject}
             className="text-xs flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700 transition-colors"
          >
             <Plus size={12} /> Add Project
          </button>
          <div className="flex bg-slate-200 p-1 rounded-lg">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all capitalize ${
                  viewMode === mode 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto custom-scrollbar flex-1 relative">
        <div className="min-w-max">
          {/* Header Row 1: Groups (Months/Years/Weeks) */}
          <div className="flex bg-slate-100 border-b border-slate-200 sticky top-0 z-40">
            <div 
              className="flex-shrink-0 p-3 font-semibold text-slate-700 border-r border-slate-200 sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] relative group"
              style={stickyStyle}
            >
              Project Structure
              <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors"
                onMouseDown={startSidebarResize}
              ></div>
            </div>
            <div 
              className="flex-shrink-0 p-3 text-center text-xs font-semibold text-slate-600 border-r border-slate-200 relative"
              style={detailsColStyle}
            >
              Details
              <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-400 transition-colors"
                onMouseDown={startDetailsResize}
              ></div>
            </div>
            {Object.values(groupedHeaders).map((group, idx) => (
              <div 
                key={idx} 
                className="text-center p-2 text-xs font-bold text-slate-600 border-r border-slate-200 bg-slate-100 uppercase tracking-wide truncate"
                style={{ width: `${group.colspan * colWidth}px` }} 
              >
                {group.label}
              </div>
            ))}
          </div>

          {/* Header Row 2: Columns (Weeks/Days) */}
          <div className="flex bg-slate-50 border-b border-slate-200 sticky top-[41px] z-40 shadow-sm">
             <div className="flex-shrink-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}></div>
             <div className="flex-shrink-0 border-r border-slate-200" style={detailsColStyle}></div>
             {timeline.map(col => {
               const holidayInfo = getHolidayInfo(col.date);
               const isHol = !!holidayInfo;
               const isCurrent = isCurrentColumn(col);
               
               return (
                 <div 
                   key={col.id} 
                   className={`flex-shrink-0 text-center p-1 text-[10px] border-r border-slate-200 font-medium flex flex-col items-center justify-center relative group/col
                     ${isHol ? 'bg-red-50 text-red-600' : ''}
                     ${isCurrent ? 'bg-amber-50 text-amber-700 border-b-2 border-b-amber-400' : 'text-slate-500'}
                   `}
                   style={{ width: `${colWidth}px`, height: '32px' }}
                   title={isHol ? `${holidayInfo?.name} (${holidayInfo?.country})` : isCurrent ? 'Current Date' : ''}
                 >
                   <span>{col.label}</span>
                   {col.date && viewMode === 'day' && (
                     <span className={`text-[9px] ${isHol ? 'text-red-500 font-bold' : isCurrent ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>
                        {col.date.getDate()} {col.date.toLocaleString('default', { month: 'short' })}
                     </span>
                   )}
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
                {/* Project Header Row */}
                <div className="flex bg-slate-700 border-b border-slate-600 sticky z-30 group">
                  <div 
                    className="flex-shrink-0 p-3 pr-2 border-r border-slate-600 sticky left-0 bg-slate-700 z-40 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]"
                    style={stickyStyle}
                  >
                     <div 
                       className="flex items-center gap-2 overflow-hidden flex-1"
                       onClick={() => !isEditingProject && toggleProject(project.id)}
                     >
                       {isProjectCollapsed ? <ChevronRight className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
                       <Folder className="w-4 h-4 text-slate-200" />
                       
                       {isEditingProject ? (
                          <input 
                            ref={editInputRef}
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={saveEdit}
                            onKeyDown={handleKeyDown}
                            className="bg-slate-600 text-white text-sm font-bold border border-slate-500 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                       ) : (
                          <span 
                            className="font-bold text-sm truncate select-none flex-1" 
                            onDoubleClick={(e) => startEditing(`project-${project.id}`, project.name, undefined, e)}
                            title="Double click to rename"
                          >
                            {project.name}
                          </span>
                       )}
                     </div>
                     <button
                        onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id); }}
                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-red-300 hover:bg-red-500 hover:text-white p-1 rounded transition-colors"
                        title="Delete Project"
                     >
                       <Trash2 size={12} />
                     </button>
                  </div>
                  <div className="flex-shrink-0 p-3 text-center text-xs font-bold text-slate-300 border-r border-slate-600 flex items-center justify-center gap-2" style={detailsColStyle}>
                     <button 
                       onClick={(e) => { e.stopPropagation(); onAddModule(project.id); }}
                       className="flex items-center gap-1 text-[10px] bg-slate-600 hover:bg-slate-500 px-2 py-0.5 rounded transition-colors"
                     >
                        <Plus size={10} /> Module
                     </button>
                  </div>
                   {/* Project Summaries */}
                   {timeline.map(col => {
                     const total = getProjectTotal(project, col);
                     const isCurrent = isCurrentColumn(col);
                     return (
                        <div key={col.id} className={`flex-shrink-0 border-r border-slate-600 flex items-center justify-center bg-slate-700 ${isCurrent ? 'bg-slate-600 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>
                           {total > 0 && (
                             <span className="text-[10px] font-bold text-slate-200">{formatValue(total)}</span>
                           )}
                        </div>
                     );
                  })}
                </div>

                {!isProjectCollapsed && project.modules.map((module, index) => {
                  const isModuleCollapsed = collapsedModules[module.id];
                  const moduleEditId = `module-${project.id}-${module.id}`;
                  const isEditingModule = editingId === moduleEditId;
                  
                  const fpEditId = `fp-${project.id}-${module.id}`;
                  const isEditingFp = editingId === fpEditId;

                  return (
                    <div 
                      key={module.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, project.id, index)}
                      className={`${draggedModuleIndex === index ? 'opacity-50' : 'opacity-100'}`}
                    >
                      {/* Module Header Row */}
                      <div className="flex bg-indigo-50/80 border-b border-slate-100 hover:bg-indigo-100/50 transition-colors group">
                        <div 
                          className="flex-shrink-0 p-3 pl-6 border-r border-slate-200 sticky left-0 bg-indigo-50/95 backdrop-blur-sm z-30 flex items-center justify-between shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
                          style={stickyStyle}
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 overflow-hidden cursor-pointer"
                            onClick={() => !isEditingModule && toggleModule(module.id)}
                          >
                            <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500" title="Drag to reorder">
                              <GripVertical className="w-4 h-4" />
                            </div>
                            {isModuleCollapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-indigo-500" />}
                            <Layers className="w-4 h-4 text-indigo-600" />
                            
                            {isEditingModule ? (
                              <input 
                                ref={editInputRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={saveEdit}
                                onKeyDown={handleKeyDown}
                                className="bg-white text-slate-800 text-sm font-semibold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                onClick={(e) => e.stopPropagation()} 
                              />
                            ) : (
                              <span 
                                className="font-semibold text-sm text-slate-800 truncate select-none flex-1 hover:text-indigo-600" 
                                onDoubleClick={(e) => startEditing(moduleEditId, module.name, undefined, e)}
                                title="Double click to rename"
                              >
                                {module.name}
                              </span>
                            )}
                          </div>
                           <button
                              onClick={(e) => { e.stopPropagation(); onDeleteModule(project.id, module.id); }}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 transition-opacity"
                              title="Delete Module"
                            >
                              <Trash2 size={14} />
                            </button>
                        </div>
                        <div 
                          className="flex-shrink-0 p-3 text-center text-xs font-bold text-slate-500 border-r border-slate-200 flex items-center justify-center bg-indigo-50/30 cursor-pointer hover:bg-indigo-100/50"
                          style={detailsColStyle}
                          onDoubleClick={(e) => startEditing(fpEditId, module.legacyFunctionPoints.toString(), module.functionPoints.toString(), e)}
                          title="Double click to edit FP"
                        >
                          {isEditingFp ? (
                             <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                <input 
                                  ref={editInputRef}
                                  type="number"
                                  className="w-10 p-0.5 text-[10px] border rounded"
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  placeholder="Legacy"
                                  title="Legacy FP"
                                  onKeyDown={handleKeyDown}
                                />
                                <input 
                                  type="number"
                                  className="w-10 p-0.5 text-[10px] border rounded"
                                  value={editValue2}
                                  onChange={e => setEditValue2(e.target.value)}
                                  placeholder="MVP"
                                  title="MVP FP"
                                  onKeyDown={handleKeyDown}
                                  onBlur={saveEdit}
                                />
                             </div>
                          ) : (
                            <span>{module.functionPoints} FP</span>
                          )}
                        </div>
                        
                        {/* Module Summaries */}
                        {timeline.map(col => {
                           const total = getModuleTotal(module, col);
                           const isCurrent = isCurrentColumn(col);
                           return (
                              <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center bg-indigo-50/20 ${isCurrent ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}>
                                 {total > 0 && (
                                   <span className="text-[10px] font-bold text-indigo-900">{formatValue(total)}</span>
                                 )}
                              </div>
                           );
                        })}
                      </div>

                      {/* Tasks */}
                      {!isModuleCollapsed && module.tasks.map((task) => {
                        const taskEditId = `task-${project.id}-${module.id}-${task.id}`;
                        const isTaskCollapsed = collapsedTasks[task.id];
                        const isEditingTask = editingId === taskEditId;
                        
                        // Calculate Date values for inputs
                        const startDate = task.startWeekId ? getDateFromWeek(
                          parseInt(task.startWeekId.split('-')[0]), 
                          parseInt(task.startWeekId.split('-')[1])
                        ) : new Date();
                        
                        const endDate = new Date(startDate);
                        endDate.setDate(startDate.getDate() + ((task.duration || 1) * 7) - 3); // Approx Friday of last week

                        return (
                          <React.Fragment key={`${module.id}-${task.id}`}>
                            {/* Task Header Row */}
                            <div className="flex border-b border-slate-100 bg-slate-50/40 group/task">
                              <div 
                                className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50/95 z-20 flex items-center justify-between pl-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
                                style={stickyStyle}
                              >
                                 <div 
                                   className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1"
                                   onClick={() => !isEditingTask && toggleTask(task.id)}
                                 >
                                   {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                   <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                   
                                   {isEditingTask ? (
                                      <input 
                                        ref={editInputRef}
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={saveEdit}
                                        onKeyDown={handleKeyDown}
                                        className="bg-white text-slate-700 text-xs font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                      />
                                   ) : (
                                      <span 
                                        className="text-xs text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" 
                                        title="Double click to rename"
                                        onDoubleClick={(e) => startEditing(taskEditId, task.name, undefined, e)}
                                      >
                                        {task.name}
                                      </span>
                                   )}
                                 </div>
                                 
                                 {/* Controls */}
                                 <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity">
                                   <button 
                                      onClick={() => onShiftTask(project.id, module.id, task.id, 'left')}
                                      className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"
                                      title="Shift entire task back 1 week"
                                   >
                                     <ChevronLeft size={12} />
                                   </button>
                                   <button 
                                      onClick={() => onShiftTask(project.id, module.id, task.id, 'right')}
                                      className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"
                                      title="Shift entire task forward 1 week"
                                   >
                                     <ChevronRight size={12} />
                                   </button>
                                   <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                   <button 
                                      onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)}
                                      className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"
                                      title="Add another role to this task"
                                   >
                                     <UserPlus size={14} />
                                   </button>
                                   <div className="w-px h-3 bg-slate-300 mx-1"></div>
                                    <button 
                                      onClick={() => onDeleteTask(project.id, module.id, task.id)}
                                      className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-200"
                                      title="Delete task"
                                   >
                                     <Trash2 size={12} />
                                   </button>
                                 </div>
                              </div>

                              {/* Schedule Controls */}
                              <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50/30 flex items-center gap-1 px-1" style={detailsColStyle}>
                                  <div className="flex flex-col w-full gap-0.5">
                                      <div className="flex items-center gap-1" title="Start Date">
                                          <span className="text-[9px] text-slate-400 w-6">Start</span>
                                          <input 
                                            type="date"
                                            className="text-[9px] p-0 border-none bg-transparent text-slate-600 focus:ring-0 w-full cursor-pointer"
                                            value={formatDateForInput(startDate)}
                                            onChange={(e) => handleStartDateChange(project.id, module.id, task, e.target.value)}
                                          />
                                      </div>
                                      <div className="flex items-center gap-1 border-t border-slate-200 pt-0.5" title="End Date">
                                          <span className="text-[9px] text-slate-400 w-6">End</span>
                                          <input 
                                            type="date"
                                            className="text-[9px] p-0 border-none bg-transparent text-slate-600 focus:ring-0 w-full cursor-pointer"
                                            value={formatDateForInput(endDate)}
                                            min={formatDateForInput(startDate)}
                                            onChange={(e) => handleEndDateChange(project.id, module.id, task, e.target.value)}
                                          />
                                      </div>
                                  </div>
                              </div>
                              
                              {/* Task Summaries */}
                              {timeline.map(col => {
                                const total = getTaskTotal(task, col);
                                const isCurrent = isCurrentColumn(col);
                                return (
                                  <div key={`th-${task.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 flex items-center justify-center bg-slate-50/30 ${isCurrent ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}>
                                     {total > 0 && (
                                       <span className="text-[10px] font-semibold text-slate-600">{formatValue(total)}</span>
                                     )}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Assignment Rows */}
                            {!isTaskCollapsed && task.assignments.map(assignment => {
                              const resourceEditId = `resource-${project.id}-${module.id}-${task.id}-${assignment.id}`;
                              const isEditingResource = editingId === resourceEditId;
                              return (
                              <div key={assignment.id} className="flex border-b border-slate-100 group/assign">
                                <div 
                                  className={`flex-shrink-0 py-1 px-3 border-r border-slate-200 sticky left-0 bg-white group-hover/assign:bg-slate-50 z-10 flex items-center justify-between border-l-[3px] ${getRoleColorClass(assignment.role)} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`}
                                  style={stickyStyle}
                                >
                                  <div className="flex-1 overflow-hidden flex items-center">
                                    {isEditingResource ? (
                                      <input
                                        ref={editInputRef}
                                        value={editValue}
                                        onChange={(e) => setEditValue(e.target.value)}
                                        onBlur={saveEdit}
                                        onKeyDown={handleKeyDown}
                                        className="bg-white text-slate-700 text-xs font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500 ml-12"
                                      />
                                    ) : (
                                      <span 
                                        className="text-xs text-slate-600 pl-12 truncate cursor-pointer hover:text-indigo-600 flex-1"
                                        onDoubleClick={(e) => startEditing(resourceEditId, assignment.resourceName || '', undefined, e)}
                                        title="Double click to edit resource name"
                                      >
                                        ↳ {assignment.resourceName || 'Unassigned'}
                                      </span>
                                    )}
                                     <button 
                                      onClick={(e) => { e.stopPropagation(); onDeleteAssignment(project.id, module.id, task.id, assignment.id); }}
                                      className="opacity-0 group-hover/assign:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 transition-opacity ml-2"
                                      title="Delete resource"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                                
                                <div className="flex-shrink-0 border-r border-slate-200 bg-white flex items-center justify-between px-2 py-1 relative group-hover/assign:bg-slate-50" style={detailsColStyle}>
                                     <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-200/0"></div> 
                                    <select 
                                      value={assignment.role}
                                      onChange={(e) => onUpdateAssignmentRole(project.id, module.id, task.id, assignment.id, e.target.value as Role)}
                                      className="w-20 text-[10px] p-1 border-none bg-transparent focus:ring-0 text-slate-600 cursor-pointer font-medium"
                                    >
                                      {Object.values(Role).map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>

                                    <div className="flex items-center gap-0.5 opacity-0 group-hover/assign:opacity-100 transition-opacity">
                                      <button 
                                          onClick={() => onShiftAssignment(project.id, module.id, task.id, assignment.id, 'left')}
                                          className="text-slate-300 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"
                                      >
                                        <ChevronLeft size={10} />
                                      </button>
                                      <button 
                                          onClick={() => onShiftAssignment(project.id, module.id, task.id, assignment.id, 'right')}
                                          className="text-slate-300 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200"
                                      >
                                        <ChevronRight size={10} />
                                      </button>
                                    </div>
                                </div>
                                
                                {timeline.map(col => {
                                  const raw = getRawCellValue(assignment, col);
                                  const display = formatValue(raw);
                                  const hasValue = raw > 0;
                                  const holidayInfo = getHolidayInfo(col.date);
                                  const isHol = !!holidayInfo;
                                  const isCurrent = isCurrentColumn(col);

                                  return (
                                    <div 
                                      key={`${assignment.id}-${col.id}`} 
                                      className={`flex-shrink-0 border-r border-slate-100 relative ${isHol ? 'bg-[repeating-linear-gradient(45deg,#fee2e2,#fee2e2_5px,#fef2f2_5px,#fef2f2_10px)]' : isCurrent ? 'bg-amber-50/50' : ''}`} 
                                      style={{ width: `${colWidth}px` }}
                                      title={isHol ? holidayInfo?.name : ''}
                                    >
                                      <input 
                                        type="text"
                                        disabled={isHol}
                                        className={`w-full h-full text-center text-xs focus:outline-none focus:bg-indigo-50 focus:ring-2 focus:ring-indigo-500 z-0 transition-colors
                                            ${hasValue ? 'bg-indigo-50 font-medium text-indigo-700' : 'bg-transparent text-slate-400 hover:bg-slate-50'}
                                            ${isHol ? 'bg-transparent cursor-not-allowed' : ''}
                                        `}
                                        value={display}
                                        placeholder={'-'}
                                        onChange={(e) => handleCellUpdate(project.id, module.id, task.id, assignment.id, col, e.target.value)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )})}
                          </React.Fragment>
                        );
                      })}
                      
                      {/* Add Task Button */}
                      {!isModuleCollapsed && (
                        <div className="flex border-b border-slate-100 bg-slate-50/20">
                          <div 
                            className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50/80 z-20 pl-12 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]"
                            style={stickyStyle}
                          >
                            <button 
                              onClick={() => handleAddTaskClick(project.id, module.id)}
                              className="text-[11px] text-slate-500 hover:text-indigo-600 font-medium flex items-center gap-1 py-1 px-2 rounded hover:bg-slate-100 transition-colors"
                            >
                              <Plus size={12} />
                              Add New Task
                            </button>
                          </div>
                           <div className="flex-shrink-0 border-r border-slate-200 bg-slate-50/20" style={detailsColStyle}></div>
                           {timeline.map(col => {
                             const isCurrent = isCurrentColumn(col);
                             return (
                               <div key={`add-${module.id}-${col.id}`} className={`flex-shrink-0 border-r border-slate-100 ${isCurrent ? 'bg-amber-50/30' : ''}`} style={{ width: `${colWidth}px` }}></div>
                             );
                           })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}
          
          {/* Total Row */}
           <div className="flex bg-slate-800 text-white border-t border-slate-700 sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.2)] mt-0.5">
             <div 
               className="flex-shrink-0 p-3 border-r border-slate-700 sticky left-0 bg-slate-800 z-50 font-bold text-sm shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]"
               style={stickyStyle}
             >
               GRAND TOTAL
             </div>
             <div className="flex-shrink-0 border-r border-slate-700" style={detailsColStyle}></div>
             {timeline.map(col => {
               // Calculate total for this column across all projects
               const total = projects.reduce((acc, p) => acc + getProjectTotal(p, col), 0);
               const isCurrent = isCurrentColumn(col);
               
               return (
                 <div key={`total-${col.id}`} className={`flex-shrink-0 border-r border-slate-700 flex items-center justify-center text-xs font-mono font-bold ${isCurrent ? 'bg-slate-700 ring-1 ring-inset ring-amber-400/50' : ''}`} style={{ width: `${colWidth}px` }}>
                   {total > 0 ? formatValue(total) : ''}
                 </div>
               );
             })}
           </div>
        </div>
      </div>
    </div>
  );
};
