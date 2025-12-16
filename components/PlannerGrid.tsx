import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, Holiday, Resource, ViewMode, TimelineColumn, WeekPoint } from '../types';
import { 
    Calendar, ChevronDown, ChevronRight, Plus, Trash2, Copy, GripVertical, 
    UserPlus, Clock, Link2, AlertCircle, Save, RotateCcw, MoreHorizontal, 
    ArrowLeft, ArrowRight, Layout, Filter, Download, Upload, RefreshCw, Layers
} from 'lucide-react';
import { 
    getTimeline, getWeekIdFromDate, getDateFromWeek, formatDateForInput, 
    calculateEndDate, calculateWorkingDaysBetween, 
    DEFAULT_START, DEFAULT_END, ALL_WEEK_IDS
} from '../constants';

interface PlannerGridProps {
  projects: Project[];
  holidays: Holiday[];
  resources: Resource[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, count: number, dayDate?: string) => void;
  onUpdateAssignmentResourceName: (projectId: string, moduleId: string, taskId: string, assignmentId: string, resourceName: string) => void;
  onUpdateAssignmentDependency: (assignmentId: string, parentAssignmentId: string | null) => void;
  onAddTask: (projectId: string, moduleId: string, taskId: string, taskName: string, role: Role) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onCopyAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onReorderTasks: (projectId: string, moduleId: string, startIndex: number, endIndex: number) => void;
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
  onImportPlan: (projects: Project[]) => void;
  onShowHistory: () => void;
  onRefresh: () => void;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
  isRefreshing: boolean;
  isReadOnly?: boolean;
}

export const PlannerGrid: React.FC<PlannerGridProps> = ({ 
    projects, holidays, resources, timelineStart, timelineEnd, onExtendTimeline,
    onUpdateAllocation, onUpdateAssignmentResourceName, onUpdateAssignmentDependency,
    onAddTask, onAddAssignment, onCopyAssignment,
    onReorderModules, onReorderTasks, onReorderAssignments, onShiftTask,
    onUpdateAssignmentSchedule, onUpdateAssignmentProgress,
    onAddProject, onAddModule, onUpdateProjectName, onUpdateModuleName, onUpdateTaskName,
    onDeleteProject, onDeleteModule, onDeleteTask, onDeleteAssignment,
    onImportPlan, onShowHistory, onRefresh, saveStatus, isRefreshing, isReadOnly 
}) => {
    // UI State
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [displayMode, setDisplayMode] = useState<'allocation' | 'gantt'>('allocation');
    
    // Collapsing State
    const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
    const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
    const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
    
    // Editing State
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    // Drag and Drop State
    const [draggedModule, setDraggedModule] = useState<{ projectId: string, index: number } | null>(null);
    const [draggedTask, setDraggedTask] = useState<{ moduleId: string, index: number } | null>(null);

    // Context Menu State
    const [contextMenu, setContextMenu] = useState<{ type: 'project' | 'module' | 'task' | 'assignment', x: number, y: number, projectId: string, moduleId?: string, taskId?: string, assignmentId?: string } | null>(null);

    // Timeline Generation
    const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);

    // Resource Holidays Map
    const resourceHolidaysMap = useMemo(() => {
        const map = new Map<string, { dateSet: Set<string> }>();
        const defaultHolidays = new Set(holidays.filter(h => h.country === 'HK').map(h => h.date));
        map.set('Unassigned', { dateSet: defaultHolidays });

        resources.forEach(res => {
            const regional = holidays.filter(h => h.country === res.holiday_region);
            const individual = res.individual_holidays || [];
            const set = new Set([...regional, ...individual].map(h => h.date));
            map.set(res.name, { dateSet: set });
        });
        return map;
    }, [resources, holidays]);

    // Constants for Layout
    const isDetailsFrozen = true;
    const nameColWidth = 250;
    const startColWidth = 80;
    const durationColWidth = 50;
    const dependencyColWidth = 50;
    const startColLeft = nameColWidth;
    const durationColLeft = nameColWidth + startColWidth;
    const dependencyColLeft = nameColWidth + startColWidth + durationColWidth;
    const stickyStyle = isDetailsFrozen ? { position: 'sticky', left: 0, width: nameColWidth, minWidth: nameColWidth, maxWidth: nameColWidth, zIndex: 30 } as React.CSSProperties : {};
    
    const colWidth = viewMode === 'day' ? 40 : viewMode === 'week' ? 60 : 80;

    // --- Handlers ---
    const toggleProject = (id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleModule = (id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
    const toggleTask = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));

    const startEditing = (id: string, initialValue: string, e?: React.MouseEvent) => {
        if (isReadOnly) return;
        e?.stopPropagation();
        setEditingId(id);
        setEditValue(initialValue);
        setTimeout(() => editInputRef.current?.focus(), 50);
    };

    const saveEdit = () => {
        if (!editingId) return;
        const [type, pId, mId, tId] = editingId.split('::');
        if (type === 'project') onUpdateProjectName(pId, editValue);
        if (type === 'module') onUpdateModuleName(pId, mId, editValue);
        if (type === 'task') onUpdateTaskName(pId, mId, tId, editValue);
        setEditingId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') setEditingId(null);
    };

    const handleTaskDragStart = (e: React.DragEvent, moduleId: string, index: number) => {
        if (isReadOnly) return;
        e.dataTransfer.setData('text/plain', JSON.stringify({ moduleId, index }));
        setDraggedTask({ moduleId, index });
    };

    const handleTaskDragOver = (e: React.DragEvent) => {
        if (isReadOnly) return;
        e.preventDefault();
    };

    const handleTaskDrop = (e: React.DragEvent, projectId: string, moduleId: string, index: number) => {
        if (isReadOnly) return;
        e.preventDefault();
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            if (data.moduleId === moduleId && data.index !== index) {
                onReorderTasks(projectId, moduleId, data.index, index);
            }
        } catch (err) {}
        setDraggedTask(null);
    };

    // Helper for module total (used in rendering)
    const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => {
        let total = 0;
        module.tasks.forEach(t => {
            t.assignments.forEach(a => {
                a.allocations.forEach(alloc => {
                    if (viewMode === 'week') {
                        if (alloc.weekId === col.id) total += alloc.count;
                    } else if (viewMode === 'month') {
                        if (col.weekIds && col.weekIds.includes(alloc.weekId)) total += alloc.count;
                    } else if (viewMode === 'day' && col.date) {
                        if (alloc.weekId === col.parentWeekId) {
                            const dateStr = formatDateForInput(col.date);
                            if (alloc.days && alloc.days[dateStr]) {
                                total += alloc.days[dateStr];
                            }
                        }
                    }
                });
            });
        });
        return total;
    };

    const formatValue = (val: number) => val % 1 === 0 ? val : val.toFixed(1);

    // Close Context Menu
    useEffect(() => {
        const handleClick = () => setContextMenu(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    return (
        <div className="flex flex-col h-full bg-white border-r border-slate-200">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50 flex-shrink-0 z-40">
                <div className="flex items-center gap-4">
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                        <button onClick={() => setViewMode('day')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'day' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>Day</button>
                        <button onClick={() => setViewMode('week')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'week' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>Week</button>
                        <button onClick={() => setViewMode('month')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${viewMode === 'month' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>Month</button>
                    </div>
                    <div className="h-4 w-px bg-slate-300 mx-2"></div>
                    <div className="flex bg-white rounded-lg border border-slate-200 p-0.5">
                         <button onClick={() => setDisplayMode('allocation')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${displayMode === 'allocation' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>Allocation</button>
                         <button onClick={() => setDisplayMode('gantt')} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${displayMode === 'gantt' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>Gantt</button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {saveStatus === 'saving' && <span className="text-xs text-slate-400 flex items-center gap-1"><RefreshCw size={12} className="animate-spin"/> Saving...</span>}
                    {saveStatus === 'success' && <span className="text-xs text-green-600 flex items-center gap-1"><Save size={12}/> Saved</span>}
                    {saveStatus === 'error' && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12}/> Error</span>}
                    <button onClick={onRefresh} className={`p-1.5 rounded hover:bg-slate-200 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={16}/></button>
                    {!isReadOnly && <button onClick={onAddProject} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors"><Plus size={14}/> New Project</button>}
                </div>
            </div>

            {/* Grid Container */}
            <div className="flex-1 overflow-auto relative custom-scrollbar">
                <div className="inline-block min-w-full">
                    {/* Header Row */}
                    <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30 shadow-sm">
                        <div className={`flex-shrink-0 px-3 py-2 border-r border-slate-200 font-bold text-xs text-slate-700 bg-slate-50 flex items-center justify-between ${isDetailsFrozen ? 'sticky left-0 z-40' : ''}`} style={stickyStyle}>
                            <span>Task Name</span>
                            <div className="flex gap-1">
                                <button onClick={() => onExtendTimeline('start')} className="p-1 hover:bg-slate-200 rounded" title="Extend Timeline Start"><ArrowLeft size={12}/></button>
                                <button onClick={() => onExtendTimeline('end')} className="p-1 hover:bg-slate-200 rounded" title="Extend Timeline End"><ArrowRight size={12}/></button>
                            </div>
                        </div>
                        {/* Detail Headers */}
                        <div className={`flex-shrink-0 w-[80px] border-r border-slate-200 px-2 py-2 font-bold text-[10px] text-slate-600 bg-slate-50 text-center ${isDetailsFrozen ? 'sticky z-40' : ''}`} style={isDetailsFrozen ? { left: startColLeft } : {}}>Start</div>
                        <div className={`flex-shrink-0 w-[50px] border-r border-slate-200 px-2 py-2 font-bold text-[10px] text-slate-600 bg-slate-50 text-center ${isDetailsFrozen ? 'sticky z-40' : ''}`} style={isDetailsFrozen ? { left: durationColLeft } : {}}>Dur</div>
                        <div className={`flex-shrink-0 w-[50px] border-r border-slate-200 px-2 py-2 font-bold text-[10px] text-slate-600 bg-slate-50 text-center ${isDetailsFrozen ? 'sticky z-40' : ''}`} style={isDetailsFrozen ? { left: dependencyColLeft } : {}}>Dep</div>
                        
                        {/* Timeline Headers */}
                        {timeline.map(col => (
                            <div key={col.id} className="flex-shrink-0 flex flex-col items-center justify-center border-r border-slate-200 bg-slate-50 px-1 py-1" style={{ width: `${colWidth}px` }}>
                                <span className="text-[10px] font-bold text-slate-700">{col.label}</span>
                                {viewMode !== 'month' && <span className="text-[9px] text-slate-400">{col.monthLabel}</span>}
                            </div>
                        ))}
                    </div>

                    {/* Project Rows */}
                    {projects.map(project => {
                        const isProjectCollapsed = collapsedProjects[project.id];
                        const projectEditId = `project::${project.id}`;
                        const isEditingProject = editingId === projectEditId;

                        return (
                            <React.Fragment key={project.id}>
                                {/* Project Header */}
                                <div className="flex border-b border-slate-200 bg-slate-100 hover:bg-slate-200/50 transition-colors">
                                    <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 z-20 flex items-center justify-between bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={stickyStyle}>
                                        <div className="flex items-center gap-2 cursor-pointer flex-1 overflow-hidden" onClick={() => !isEditingProject && toggleProject(project.id)}>
                                            {isProjectCollapsed ? <ChevronRight size={16} className="text-slate-500"/> : <ChevronDown size={16} className="text-slate-500"/>}
                                            {isEditingProject ? (
                                                <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="text-xs font-bold bg-white border border-indigo-300 rounded px-1 w-full" />
                                            ) : (
                                                <span className="text-xs font-bold text-slate-800 truncate" onDoubleClick={(e) => startEditing(projectEditId, project.name, e)}>{project.name}</span>
                                            )}
                                        </div>
                                        {!isReadOnly && <div className="flex items-center gap-1">
                                            <button onClick={() => onAddModule(project.id)} className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-slate-200" title="Add Module"><Plus size={14}/></button>
                                            <button onClick={() => onDeleteProject(project.id)} className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-200" title="Delete Project"><Trash2 size={14}/></button>
                                        </div>}
                                    </div>
                                    {/* Spacers for details columns */}
                                    <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, left: isDetailsFrozen ? startColLeft : undefined }}></div>
                                    <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined }}></div>
                                    <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-100 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined }}></div>
                                    {/* Timeline cells for project (empty) */}
                                    {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-200 bg-slate-100" style={{ width: `${colWidth}px` }}></div>)}
                                </div>

                                {/* Modules */}
                                {!isProjectCollapsed && project.modules.map((module, modIndex) => {
                                    const isModuleCollapsed = collapsedModules[module.id];
                                    const moduleEditId = `module::${project.id}::${module.id}`;
                                    const isEditingModule = editingId === moduleEditId;
                                    
                                    // Calculate Module Rollup Dates
                                    let moduleEarliestStartDate: string | null = null;
                                    let moduleLatestEndDate: Date | null = null;
                                    
                                    module.tasks.forEach(t => {
                                        t.assignments.forEach(a => {
                                            if (a.startDate) {
                                                if (!moduleEarliestStartDate || a.startDate < moduleEarliestStartDate) moduleEarliestStartDate = a.startDate;
                                                if (a.duration) {
                                                    const resName = a.resourceName || 'Unassigned';
                                                    const holidaysSet = resourceHolidaysMap.get(resName)?.dateSet || new Set();
                                                    const end = calculateEndDate(a.startDate, a.duration, holidaysSet);
                                                    const endDate = new Date(end.replace(/-/g, '/'));
                                                    if (!moduleLatestEndDate || endDate > moduleLatestEndDate) moduleLatestEndDate = endDate;
                                                }
                                            }
                                        });
                                    });

                                    let moduleTotalDuration = 0;
                                    if (moduleEarliestStartDate && moduleLatestEndDate) {
                                        const defaultHolidays = resourceHolidaysMap.get('Unassigned')?.dateSet || new Set();
                                        moduleTotalDuration = calculateWorkingDaysBetween(moduleEarliestStartDate, formatDateForInput(moduleLatestEndDate), defaultHolidays);
                                    }

                                    return (
                                        <React.Fragment key={module.id}>
                                            <div className="flex border-b border-indigo-100 bg-indigo-50/50 group/module">
                                                <div className={`flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 z-20 flex items-center justify-between pl-6 bg-indigo-50/50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] ${isDetailsFrozen ? 'sticky' : ''}`} style={stickyStyle}>
                                                    <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingModule && toggleModule(module.id)}>
                                                        {isModuleCollapsed ? <ChevronRight size={14} className="text-indigo-400"/> : <ChevronDown size={14} className="text-indigo-400"/>}
                                                        {isEditingModule ? (
                                                            <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="text-xs font-semibold bg-white border border-indigo-300 rounded px-1 w-full" />
                                                        ) : (
                                                            <span className="text-xs font-semibold text-indigo-900 truncate" onDoubleClick={(e) => startEditing(moduleEditId, module.name, e)}>{module.name}</span>
                                                        )}
                                                    </div>
                                                    {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/module:opacity-100 transition-opacity">
                                                        <button onClick={() => onAddTask(project.id, module.id, crypto.randomUUID(), "New Task", Role.DEV)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add Task"><Plus size={14}/></button>
                                                        <button onClick={() => onDeleteModule(project.id, module.id)} className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-200" title="Delete Module"><Trash2 size={14}/></button>
                                                    </div>}
                                                </div>

                                                {/* Module Details Columns */}
                                                <div className={`flex-shrink-0 text-[10px] font-bold text-indigo-800/80 border-r border-slate-200 flex items-center justify-center bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                                                    {isModuleCollapsed && moduleEarliestStartDate && <span title="Earliest Start Date" className="bg-indigo-200/50 rounded p-1">{moduleEarliestStartDate}</span>}
                                                </div>
                                                <div className={`flex-shrink-0 text-[10px] font-bold text-indigo-800/80 border-r border-slate-200 flex items-center justify-center bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}>
                                                    {isModuleCollapsed && moduleTotalDuration > 0 && <span title="Total Duration" className="bg-indigo-200/50 rounded p-1">{moduleTotalDuration}d</span>}
                                                </div>
                                                <div className={`flex-shrink-0 border-r border-slate-200 bg-indigo-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 29 : undefined }}></div>

                                                {timeline.map(col => {
                                                    const total = getModuleTotal(module, col);
                                                    let isInModuleRange = false; let isModuleStart = false; let isModuleEnd = false;
                                                    if (moduleEarliestStartDate && moduleLatestEndDate) { const modStart = new Date(moduleEarliestStartDate.replace(/-/g, '/')); const modEnd = moduleLatestEndDate; if (viewMode === 'day' && col.date) { isInModuleRange = col.date >= modStart && col.date <= modEnd; isModuleStart = col.date.getTime() === modStart.getTime(); isModuleEnd = col.date.getTime() === modEnd.getTime(); if (formatDateForInput(col.date) === formatDateForInput(modStart)) isModuleStart = true; if (formatDateForInput(col.date) === formatDateForInput(modEnd)) isModuleEnd = true; } else if (viewMode === 'week') { const [y, w] = col.id.split('-').map(Number); const colDate = getDateFromWeek(y, w); const colEnd = new Date(colDate); colEnd.setDate(colEnd.getDate() + 6); isInModuleRange = (modStart <= colEnd) && (modEnd >= colDate); if (isInModuleRange) { const startWeekId = getWeekIdFromDate(modStart); const endWeekId = getWeekIdFromDate(modEnd); isModuleStart = col.id === startWeekId; isModuleEnd = col.id === endWeekId; } } else if (viewMode === 'month') { if (col.weekIds && col.weekIds.length > 0) { const startWeek = col.weekIds[0]; const endWeek = col.weekIds[col.weekIds.length - 1]; const [y1, w1] = startWeek.split('-').map(Number); const mStart = getDateFromWeek(y1, w1); const [y2, w2] = endWeek.split('-').map(Number); const mEnd = new Date(getDateFromWeek(y2, w2)); mEnd.setDate(mEnd.getDate() + 6); isInModuleRange = (modStart <= mEnd) && (modEnd >= mStart); isModuleStart = modStart >= mStart && modStart <= mEnd; isModuleEnd = modEnd >= mStart && modEnd <= mEnd; } } }
                                                    return ( <div key={col.id} className={`flex-shrink-0 border-r border-slate-200/50 flex items-center justify-center bg-indigo-50 relative`} style={{ width: `${colWidth}px` }}>{isInModuleRange && ( <div className={`absolute pointer-events-none z-10 ${displayMode === 'gantt' ? 'top-1/2 -translate-y-1/2 h-4 bg-indigo-400 rounded' : 'inset-y-1 inset-x-0 bg-indigo-200'} ${isModuleStart ? 'rounded-l-md ml-1' : ''} ${isModuleEnd ? 'rounded-r-md mr-1' : ''}`}></div> )}{total > 0 && displayMode === 'allocation' && (<span className="text-[10px] font-bold text-indigo-900 relative z-10">{formatValue(total)}</span>)}</div> );
                                                })}
                                            </div>

                                            {!isModuleCollapsed && module.tasks.map((task, taskIndex) => {
                                                const taskEditId = `task::${project.id}::${module.id}::${task.id}`;
                                                const isTaskCollapsed = collapsedTasks[task.id];
                                                const isEditingTask = editingId === taskEditId;
                                                
                                                let earliestStartDate: string | null = null; 
                                                let latestEndDate: Date | null = null; 
                                                let totalDuration = 0;

                                                if (task.assignments.length > 0) { 
                                                    let earliestDate: Date | null = null; 
                                                    const taskHolidays = new Set<string>(); 
                                                    task.assignments.forEach(a => { 
                                                        const resourceName = a.resourceName || 'Unassigned'; 
                                                        const resourceHolidayData = resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'); 
                                                        if (resourceHolidayData) { resourceHolidayData.dateSet.forEach(d => taskHolidays.add(d)); } 
                                                    }); 
                                                    task.assignments.forEach(assignment => { 
                                                        if (!assignment.startDate || !assignment.duration) return; 
                                                        const startDate = new Date(assignment.startDate.replace(/-/g, '/')); 
                                                        if (!earliestDate || startDate < earliestDate) { earliestDate = startDate; } 
                                                        const resourceName = assignment.resourceName || 'Unassigned'; 
                                                        const assignmentHolidays = (resourceHolidaysMap.get(resourceName) || resourceHolidaysMap.get('Unassigned'))?.dateSet || new Set<string>(); 
                                                        const endDateStr = calculateEndDate(assignment.startDate!, assignment.duration, assignmentHolidays); 
                                                        const endDate = new Date(endDateStr.replace(/-/g, '/')); 
                                                        if (!latestEndDate || endDate > latestEndDate) { latestEndDate = endDate; } 
                                                    }); 
                                                    if (earliestDate && latestEndDate) { 
                                                        earliestStartDate = formatDateForInput(earliestDate); 
                                                        totalDuration = calculateWorkingDaysBetween(formatDateForInput(earliestDate), formatDateForInput(latestEndDate), taskHolidays); 
                                                    } 
                                                }

                                                return (
                                                    <React.Fragment key={task.id}>
                                                        <div draggable={!isReadOnly} onDragStart={(e) => handleTaskDragStart(e, module.id, taskIndex)} onDragOver={handleTaskDragOver} onDrop={(e) => handleTaskDrop(e, project.id, module.id, taskIndex)} className={`flex border-b border-slate-100 bg-slate-50 group/task ${draggedTask?.moduleId === module.id && draggedTask?.index === taskIndex ? 'opacity-30' : ''}`}>
                                                            <div className="flex-shrink-0 py-1.5 px-3 border-r border-slate-200 sticky left-0 bg-slate-50 z-20 flex items-center justify-between pl-6 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                                                                <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => !isEditingTask && toggleTask(task.id)}>
                                                                    {!isReadOnly && <div className="cursor-grab text-slate-400 hover:text-slate-600" title="Drag to reorder task"><GripVertical size={14} /></div>}
                                                                    {isTaskCollapsed ? <ChevronRight size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-400 flex-shrink-0"></div>
                                                                    {isEditingTask ? ( <input ref={editInputRef} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} className="bg-white text-slate-700 text-[11px] font-bold border border-indigo-300 rounded px-1 w-full focus:outline-none focus:ring-1 focus:ring-indigo-500" /> ) : ( <span className="text-[11px] text-slate-700 font-bold truncate select-none hover:text-indigo-600 flex-1" title="Double click to rename" onDoubleClick={(e) => startEditing(taskEditId, task.name, e)}>{task.name}</span> )}
                                                                </div>
                                                                {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity"><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.EA)} className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-200" title="Add another resource to this task"><UserPlus size={14} /></button>
                                                                <button onClick={() => onDeleteTask(project.id, module.id, task.id)} className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-200" title="Delete Task"><Trash2 size={14}/></button></div>}
                                                            </div>
                                                            
                                                            {/* Task Details Columns */}
                                                            <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                                                {isTaskCollapsed && earliestStartDate && <span title="Earliest Start Date" className="bg-slate-200/50 rounded p-1">{earliestStartDate}</span>}
                                                            </div>
                                                            <div className={`flex-shrink-0 text-[10px] font-medium text-slate-500 border-r border-slate-200 flex items-center justify-center bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}>
                                                                {isTaskCollapsed && totalDuration > 0 && <span title="Total Working Days" className="bg-slate-200/50 rounded p-1">{totalDuration}d</span>}
                                                            </div>
                                                            <div className={`flex-shrink-0 border-r border-slate-200 bg-slate-50 ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 19 : undefined }}></div>

                                                            {timeline.map(col => {
                                                                // Task row rollup if collapsed
                                                                if (!isTaskCollapsed) return <div key={col.id} className="flex-shrink-0 border-r border-slate-200 bg-slate-50" style={{ width: `${colWidth}px` }}></div>;
                                                                
                                                                let total = 0;
                                                                task.assignments.forEach(a => {
                                                                    a.allocations.forEach(alloc => {
                                                                        if (viewMode === 'week' && alloc.weekId === col.id) total += alloc.count;
                                                                        else if (viewMode === 'month' && col.weekIds?.includes(alloc.weekId)) total += alloc.count;
                                                                        else if (viewMode === 'day' && col.parentWeekId === alloc.weekId && col.date) {
                                                                            if (alloc.days && alloc.days[formatDateForInput(col.date)]) total += alloc.days[formatDateForInput(col.date)];
                                                                        }
                                                                    });
                                                                });
                                                                return (
                                                                    <div key={col.id} className="flex-shrink-0 border-r border-slate-200 bg-slate-50 flex items-center justify-center" style={{ width: `${colWidth}px` }}>
                                                                         {total > 0 && <span className="text-[10px] text-slate-400">{formatValue(total)}</span>}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* Assignments */}
                                                        {!isTaskCollapsed && task.assignments.map((assignment, assignIndex) => {
                                                            const resName = assignment.resourceName || 'Unassigned';
                                                            const myHolidays = resourceHolidaysMap.get(resName)?.dateSet || new Set();

                                                            return (
                                                                <div key={assignment.id} className="flex border-b border-slate-100 bg-white group/assignment hover:bg-slate-50">
                                                                     <div className={`flex-shrink-0 py-1 px-3 border-r border-slate-200 sticky left-0 z-10 flex items-center justify-between pl-10 bg-white ${isDetailsFrozen ? 'sticky' : ''}`} style={stickyStyle}>
                                                                        <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                                            <span className={`w-1.5 h-1.5 rounded-full ${assignment.resourceName === 'Unassigned' ? 'bg-red-400' : 'bg-green-400'}`}></span>
                                                                            <select disabled={isReadOnly} value={assignment.resourceName || 'Unassigned'} onChange={(e) => onUpdateAssignmentResourceName(project.id, module.id, task.id, assignment.id, e.target.value)} className="text-[11px] bg-transparent border-none p-0 focus:ring-0 text-slate-600 truncate w-24 cursor-pointer hover:text-indigo-600">
                                                                                <option value="Unassigned">Unassigned</option>
                                                                                {resources.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                                                                            </select>
                                                                            <span className="text-[9px] text-slate-400 px-1 border border-slate-200 rounded">{assignment.role}</span>
                                                                        </div>
                                                                        {!isReadOnly && <div className="flex items-center gap-0.5 opacity-0 group-hover/assignment:opacity-100 transition-opacity">
                                                                            <button onClick={() => onShiftTask(project.id, module.id, task.id, 'left')} className="p-0.5 text-slate-400 hover:text-indigo-600" title="Shift Left"><ArrowLeft size={10}/></button>
                                                                            <button onClick={() => onShiftTask(project.id, module.id, task.id, 'right')} className="p-0.5 text-slate-400 hover:text-indigo-600" title="Shift Right"><ArrowRight size={10}/></button>
                                                                            <button onClick={() => onCopyAssignment(project.id, module.id, task.id, assignment.id)} className="p-0.5 text-slate-400 hover:text-indigo-600" title="Duplicate"><Copy size={10}/></button>
                                                                            <button onClick={() => onDeleteAssignment(project.id, module.id, task.id, assignment.id)} className="p-0.5 text-slate-400 hover:text-red-600" title="Delete"><Trash2 size={10}/></button>
                                                                        </div>}
                                                                     </div>

                                                                     {/* Start Date Input */}
                                                                    <div className={`flex-shrink-0 border-r border-slate-200 flex items-center justify-center p-1 bg-white ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: startColWidth, minWidth: startColWidth, maxWidth: startColWidth, left: isDetailsFrozen ? startColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                                                        <input type="date" disabled={isReadOnly} value={assignment.startDate || ''} onChange={(e) => onUpdateAssignmentSchedule(assignment.id, e.target.value, assignment.duration || 1)} className="w-full text-[10px] bg-transparent border-none p-0 focus:ring-0 text-center font-mono text-slate-600" />
                                                                    </div>
                                                                    {/* Duration Input */}
                                                                    <div className={`flex-shrink-0 border-r border-slate-200 flex items-center justify-center p-1 bg-white ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: durationColWidth, minWidth: durationColWidth, maxWidth: durationColWidth, left: isDetailsFrozen ? durationColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                                                        <input type="number" disabled={isReadOnly} value={assignment.duration || 0} onChange={(e) => onUpdateAssignmentSchedule(assignment.id, assignment.startDate || '', parseInt(e.target.value) || 0)} className="w-full text-[10px] bg-transparent border-none p-0 focus:ring-0 text-center font-mono text-slate-600" min={0} />
                                                                    </div>
                                                                     {/* Dependency Input */}
                                                                     <div className={`flex-shrink-0 border-r border-slate-200 flex items-center justify-center p-1 bg-white ${isDetailsFrozen ? 'sticky' : ''}`} style={{ width: dependencyColWidth, minWidth: dependencyColWidth, maxWidth: dependencyColWidth, left: isDetailsFrozen ? dependencyColLeft : undefined, zIndex: isDetailsFrozen ? 9 : undefined }}>
                                                                         <div className="relative w-full h-full flex items-center justify-center group/dep">
                                                                             <div className="text-[9px] text-slate-400 truncate max-w-full text-center">
                                                                                 {assignment.parentAssignmentId ? 'Linked' : '-'}
                                                                             </div>
                                                                             {!isReadOnly && <select value={assignment.parentAssignmentId || ''} onChange={(e) => onUpdateAssignmentDependency(assignment.id, e.target.value || null)} className="absolute inset-0 opacity-0 cursor-pointer text-[10px]">
                                                                                 <option value="">No Dep</option>
                                                                                 {/* List previous tasks assignments as options */}
                                                                                 {project.modules.flatMap(m => m.tasks.flatMap(t => t.assignments)).filter(a => a.id !== assignment.id).map(a => (
                                                                                     <option key={a.id} value={a.id}>
                                                                                         {project.modules.find(m => m.tasks.some(t => t.assignments.some(asg => asg.id === a.id)))?.name.substring(0,10)}... - {project.modules.flatMap(m => m.tasks).find(t => t.assignments.some(asg => asg.id === a.id))?.name} ({a.resourceName})
                                                                                     </option>
                                                                                 ))}
                                                                             </select>}
                                                                         </div>
                                                                    </div>
                                                                     
                                                                     {/* Grid Cells */}
                                                                    {timeline.map(col => {
                                                                        const isWeek = viewMode === 'week';
                                                                        const isMonth = viewMode === 'month';
                                                                        const isDay = viewMode === 'day';
                                                                        
                                                                        let val = 0;
                                                                        let isWorkingDay = true;
                                                                        let isHoliday = false;

                                                                        if (isWeek) {
                                                                            const alloc = assignment.allocations.find(a => a.weekId === col.id);
                                                                            if (alloc) val = alloc.count;
                                                                        } else if (isMonth) {
                                                                            col.weekIds?.forEach(wid => {
                                                                                const alloc = assignment.allocations.find(a => a.weekId === wid);
                                                                                if (alloc) val += alloc.count;
                                                                            });
                                                                        } else if (isDay && col.date && col.parentWeekId) {
                                                                            const dateStr = formatDateForInput(col.date);
                                                                            const dayOfWeek = col.date.getDay();
                                                                            isHoliday = myHolidays.has(dateStr);
                                                                            isWorkingDay = dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday;
                                                                            
                                                                            const alloc = assignment.allocations.find(a => a.weekId === col.parentWeekId);
                                                                            if (alloc && alloc.days && alloc.days[dateStr] !== undefined) {
                                                                                val = alloc.days[dateStr];
                                                                            } else if (isWorkingDay && alloc && (!alloc.days || Object.keys(alloc.days).length === 0) && alloc.count > 0) {
                                                                                // Fallback visualization if daily data missing but weekly exists (optional)
                                                                            }
                                                                        }
                                                                        
                                                                        const isEditing = false; // Add cell editing state logic if needed
                                                                        
                                                                        // Gantt Bar Logic
                                                                        let isBar = false;
                                                                        if (displayMode === 'gantt' && assignment.startDate && assignment.duration) {
                                                                            const start = new Date(assignment.startDate.replace(/-/g, '/'));
                                                                            const end = new Date(calculateEndDate(assignment.startDate, assignment.duration, myHolidays).replace(/-/g, '/'));
                                                                            
                                                                            if (isDay && col.date) {
                                                                                isBar = col.date >= start && col.date <= end && isWorkingDay;
                                                                            } else if (isWeek) {
                                                                                 const [y, w] = col.id.split('-').map(Number);
                                                                                 const wStart = getDateFromWeek(y, w);
                                                                                 const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate()+6);
                                                                                 isBar = (start <= wEnd) && (end >= wStart);
                                                                            }
                                                                        }

                                                                        return (
                                                                            <div key={col.id} className={`flex-shrink-0 border-r border-slate-200 flex items-center justify-center relative ${isHoliday ? 'bg-red-50/50' : !isWorkingDay ? 'bg-slate-50' : 'bg-white'}`} style={{ width: `${colWidth}px` }}>
                                                                                {displayMode === 'gantt' && isBar ? (
                                                                                    <div className="h-3 rounded-full bg-indigo-400 w-full mx-1 opacity-80" title={`${assignment.resourceName} - ${val} MD`}></div>
                                                                                ) : (
                                                                                    isReadOnly || (isDay && !isWorkingDay) ? (
                                                                                        <span className={`text-[10px] ${val > 0 ? 'font-bold text-indigo-600' : 'text-slate-300'}`}>{val > 0 ? formatValue(val) : ''}</span>
                                                                                    ) : (
                                                                                        <input 
                                                                                            type="text" 
                                                                                            className={`w-full h-full text-center text-[10px] bg-transparent border-none focus:ring-1 focus:ring-indigo-500 p-0 ${val > 0 ? 'font-bold text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                                                                                            value={val === 0 ? '' : formatValue(val)}
                                                                                            onChange={(e) => {
                                                                                                const num = parseFloat(e.target.value);
                                                                                                if (!isNaN(num)) {
                                                                                                    if (isDay && col.date && col.parentWeekId) {
                                                                                                        onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.parentWeekId, num, formatDateForInput(col.date));
                                                                                                    } else if (isWeek) {
                                                                                                        onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.id, num);
                                                                                                    }
                                                                                                } else if (e.target.value === '') {
                                                                                                    if (isDay && col.date && col.parentWeekId) {
                                                                                                        onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.parentWeekId, 0, formatDateForInput(col.date));
                                                                                                    } else if (isWeek) {
                                                                                                        onUpdateAllocation(project.id, module.id, task.id, assignment.id, col.id, 0);
                                                                                                    }
                                                                                                }
                                                                                            }}
                                                                                        />
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            );
                                                        })}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </React.Fragment>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
