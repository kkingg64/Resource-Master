
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, ProjectModule, ProjectTask, TaskAssignment, Role, ViewMode, TimelineColumn, Holiday } from '../types';
import { getTimeline, ALL_WEEK_IDS, WeekPoint } from '../constants';
import { Layers, Calendar, ChevronRight, ChevronDown, GripVertical, Plus, UserPlus, ChevronLeft, Clock, PlayCircle, Folder, Settings2, Trash2, Share2, Eye } from 'lucide-react';

interface PlannerGridProps {
  userId: string;
  projects: Project[];
  holidays: Holiday[];
  timelineStart: WeekPoint;
  timelineEnd: WeekPoint;
  onExtendTimeline: (direction: 'start' | 'end') => void;
  onUpdateAllocation: (projectId: string, moduleId: string, taskId: string, assignmentId: string, weekId: string, value: number) => void;
  onUpdateAssignmentRole: (projectId: string, moduleId: string, taskId: string, assignmentId: string, role: Role) => void;
  onAddTask: (projectId: string, moduleId: string, taskName: string, role: Role) => void;
  onAddAssignment: (projectId: string, moduleId: string, taskId: string, role: Role) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onShiftTask: (projectId: string, moduleId: string, taskId: string, direction: 'left' | 'right') => void;
  onShiftAssignment: (projectId: string, moduleId: string, taskId: string, assignmentId: string, direction: 'left' | 'right') => void;
  onUpdateTaskSchedule: (projectId: string, moduleId: string, taskId: string, startWeekId: string, duration: number) => void;
  onAddProject: () => void;
  onAddModule: (projectId: string) => void;
  onUpdateProjectName: (projectId: string, name: string) => void;
  onUpdateTaskName: (projectId: string, moduleId: string, taskId: string, name: string) => void;
  onDeleteProject: (projectId: string) => void;
  onShareProject: (project: Project) => void;
}

export const PlannerGrid: React.FC<PlannerGridProps> = ({ 
  userId, projects, holidays, timelineStart, timelineEnd, onExtendTimeline, onUpdateAllocation, onUpdateAssignmentRole, onAddTask, onAddAssignment, onReorderModules, onShiftTask, onShiftAssignment, onUpdateTaskSchedule, onAddProject, onAddModule, onUpdateProjectName, onUpdateTaskName, onDeleteProject, onShareProject
}) => {
  const [collapsedProjects, setCollapsedProjects] = useState<Record<string, boolean>>({});
  const [collapsedModules, setCollapsedModules] = useState<Record<string, boolean>>({});
  const [collapsedTasks, setCollapsedTasks] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null);
  const [colWidthBase, setColWidthBase] = useState<number>(40);
  const [sidebarWidth, setSidebarWidth] = useState<number>(256);
  const sidebarResizing = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editingId && editInputRef.current) editInputRef.current.focus(); }, [editingId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!sidebarResizing.current) return;
      const newWidth = Math.max(150, Math.min(600, e.clientX - 32));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => { sidebarResizing.current = false; document.body.style.cursor = 'default'; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  const startSidebarResize = (e: React.MouseEvent) => { e.preventDefault(); sidebarResizing.current = true; document.body.style.cursor = 'col-resize'; };
  const toggleProject = (id: string) => setCollapsedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleModule = (id: string) => setCollapsedModules(prev => ({ ...prev, [id]: !prev[id] }));
  const toggleTask = (id: string) => setCollapsedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const startEditing = (id: string, initialValue: string, e: React.MouseEvent) => { e.stopPropagation(); setEditingId(id); setEditValue(initialValue); };
  const saveEdit = (projectId: string, moduleId?: string, taskId?: string) => {
    if (taskId && moduleId) onUpdateTaskName(projectId, moduleId, taskId, editValue);
    else onUpdateProjectName(projectId, editValue);
    setEditingId(null);
  };
  const handleKeyDown = (e: React.KeyboardEvent, projectId: string, moduleId?: string, taskId?: string) => {
    if (e.key === 'Enter') saveEdit(projectId, moduleId, taskId);
    else if (e.key === 'Escape') setEditingId(null);
  };

  const timeline = useMemo(() => getTimeline(viewMode, timelineStart, timelineEnd), [viewMode, timelineStart, timelineEnd]);
  const groupedHeaders = useMemo(() => timeline.reduce((acc, col) => {
    const key = col.groupLabel;
    if (!acc[key]) acc[key] = { label: key, colspan: 0 };
    acc[key].colspan++;
    return acc;
  }, {} as Record<string, { label: string, colspan: number }>), [timeline]);

  const getRoleColorClass = (role: Role) => ({ [Role.DEV]: 'border-l-blue-500', [Role.UIUX]: 'border-l-orange-500', [Role.QA]: 'border-l-green-500', [Role.BA]: 'border-l-purple-500' }[role] || 'border-l-slate-300');
  const getHolidayInfo = (date?: Date) => { if (!date) return null; const dateStr = date.toISOString().split('T')[0]; return holidays.find(h => h.date === dateStr); };
  const isHoliday = (date?: Date) => !!getHolidayInfo(date);
  const getRawCellValue = (assignment: TaskAssignment, col: TimelineColumn): number => {
    if (viewMode === 'week') return assignment.allocations.find(a => a.weekId === col.id)?.count || 0;
    if (viewMode === 'month') return col.weekIds ? assignment.allocations.filter(a => col.weekIds!.includes(a.weekId)).reduce((s, a) => s + a.count, 0) : 0;
    if (viewMode === 'day') { if (isHoliday(col.date) || !col.parentWeekId) return 0; const alloc = assignment.allocations.find(a => a.weekId === col.parentWeekId); return alloc ? alloc.count / 5 : 0; }
    return 0;
  };
  const formatValue = (val: number): string => (val === 0 ? '' : Number.isInteger(val) ? val.toString() : val.toFixed(1));
  const getTaskTotal = (task: ProjectTask, col: TimelineColumn) => task.assignments.reduce((sum, assign) => sum + getRawCellValue(assign, col), 0);
  const getModuleTotal = (module: ProjectModule, col: TimelineColumn) => module.tasks.reduce((sum, task) => sum + getTaskTotal(task, col), 0);
  const getProjectTotal = (project: Project, col: TimelineColumn) => project.modules.reduce((sum, module) => sum + getModuleTotal(module, col), 0);
  const handleCellUpdate = (projectId: string, moduleId: string, taskId: string, assignmentId: string, col: TimelineColumn, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value);
    if (isNaN(numValue)) return;
    if (viewMode === 'week') onUpdateAllocation(projectId, moduleId, taskId, assignmentId, col.id, numValue);
    else if (viewMode === 'month' && col.weekIds?.length) col.weekIds.forEach(weekId => onUpdateAllocation(projectId, moduleId, taskId, assignmentId, weekId, numValue / col.weekIds!.length));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => { e.dataTransfer.setData("text/plain", index.toString()); setDraggedModuleIndex(index); };
  const handleDrop = (e: React.DragEvent, projectId: string, index: number) => { e.preventDefault(); const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(startIndex) && startIndex !== index) onReorderModules(projectId, startIndex, index); setDraggedModuleIndex(null); };
  const handleAddTaskClick = (projectId: string, moduleId: string, isReadOnly: boolean) => { if (isReadOnly) return; const name = window.prompt("Enter task name:"); if (name) onAddTask(projectId, moduleId, name, Role.DEV); };
  
  const colWidth = viewMode === 'month' ? colWidthBase * 2 : colWidthBase;
  const stickyStyle = { width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth };

  return (
    <div className="flex flex-col h-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-500" /><span className="text-sm font-semibold text-slate-700">Timeline</span></div>
          <div className="flex items-center gap-1 bg-white border border-slate-300 rounded"><button onClick={() => onExtendTimeline('start')} className="px-2 py-1 hover:bg-slate-100 text-xs border-r">&lt; +Mo</button><button onClick={() => onExtendTimeline('end')} className="px-2 py-1 hover:bg-slate-100 text-xs">+Mo &gt;</button></div>
          <div className="h-4 w-px bg-slate-300"></div>
          <div className="flex items-center gap-2"><Settings2 size={14} className="text-slate-400" /><input type="range" min="20" max="100" value={colWidthBase} onChange={(e) => setColWidthBase(parseInt(e.target.value))} className="w-20 accent-indigo-600" /></div>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={onAddProject} className="text-xs flex items-center gap-1 bg-slate-800 text-white px-2 py-1 rounded hover:bg-slate-700"><Plus size={12} /> Add Project</button>
          <div className="flex bg-slate-200 p-1 rounded-lg">{(['day', 'week', 'month'] as ViewMode[]).map(mode => <button key={mode} onClick={() => setViewMode(mode)} className={`px-3 py-1 text-xs font-medium rounded-md capitalize ${viewMode === mode ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>{mode}</button>)}</div>
        </div>
      </div>
      <div className="overflow-auto custom-scrollbar flex-1 relative">
        <div className="min-w-max">
          <div className="flex bg-slate-100 border-b border-slate-200 sticky top-0 z-40">
            <div className="flex-shrink-0 p-3 font-semibold text-slate-700 border-r sticky left-0 bg-slate-100 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)] relative" style={stickyStyle}>Project Structure<div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize" onMouseDown={startSidebarResize}></div></div>
            <div className="w-32 flex-shrink-0 p-3 text-center text-xs font-semibold border-r">Details</div>
            {Object.values(groupedHeaders).map((g, i) => <div key={i} className="text-center p-2 text-xs font-bold uppercase" style={{ width: `${g.colspan * colWidth}px` }}>{g.label}</div>)}
          </div>
          <div className="flex bg-slate-50 border-b border-slate-200 sticky top-[41px] z-40 shadow-sm">
             <div className="flex-shrink-0 border-r sticky left-0 bg-slate-50 z-50 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}></div><div className="w-32 flex-shrink-0 border-r"></div>
             {timeline.map(col => { const h = getHolidayInfo(col.date); return <div key={col.id} className={`flex-shrink-0 text-center p-1 text-[10px] border-r flex flex-col items-center justify-center ${h ? 'bg-red-50 text-red-600' : ''}`} style={{ width: `${colWidth}px`, height: '32px' }} title={h?.name}><span>{col.label}</span>{col.date && viewMode === 'day' && <span className={`text-[9px] ${h ? 'font-bold' : ''}`}>{col.date.getDate()} {col.date.toLocaleString('default', { month: 'short' })}</span>}</div>; })}
          </div>

          {projects.map(project => {
            const isOwner = project.owner_id === userId;
            const isReadOnly = !isOwner;
            const isProjectCollapsed = collapsedProjects[project.id];
            return (
            <React.Fragment key={project.id}>
              <div className="flex bg-slate-700 border-b border-slate-600 sticky z-30 group">
                <div className="flex-shrink-0 p-3 pr-2 border-r sticky left-0 bg-slate-700 z-40 cursor-pointer flex items-center justify-between text-white shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle}>
                   <div className="flex items-center gap-2 overflow-hidden flex-1" onClick={() => toggleProject(project.id)}>{isProjectCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}<Folder size={16} />{editingId === project.id ? <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveEdit(project.id)} onKeyDown={e => handleKeyDown(e, project.id)} className="bg-slate-600 text-sm font-bold w-full" /> : <span className="font-bold text-sm truncate" onDoubleClick={e => !isReadOnly && startEditing(project.id, project.name, e)}>{project.name}</span>}</div>
                   <div className="flex items-center gap-1">{!isOwner && <span className="text-xs text-slate-400 flex items-center gap-1"><Eye size={12}/>View</span>}{isOwner && <><button onClick={() => onShareProject(project)} className="opacity-0 group-hover:opacity-100 text-slate-300 p-1 hover:bg-slate-600 rounded"><Share2 size={12} /></button><button onClick={e => { e.stopPropagation(); onDeleteProject(project.id); }} className="opacity-0 group-hover:opacity-100 text-red-300 p-1 hover:bg-red-500 rounded"><Trash2 size={12} /></button></>}</div>
                </div>
                <div className="w-32 flex-shrink-0 p-3 text-center text-xs border-r flex items-center justify-center">{!isReadOnly && <button onClick={e => { e.stopPropagation(); onAddModule(project.id); }} className="flex items-center gap-1 text-[10px] bg-slate-600 text-white hover:bg-slate-500 px-2 py-0.5 rounded"><Plus size={10} /> Module</button>}</div>
                {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r border-slate-600 flex items-center justify-center" style={{ width: `${colWidth}px` }}><span className="text-[10px] font-bold text-slate-200">{formatValue(getProjectTotal(project, col))}</span></div>)}
              </div>
              {!isProjectCollapsed && project.modules.map((module, index) => {
                const isModuleCollapsed = collapsedModules[module.id];
                return (
                <div key={module.id} draggable={!isReadOnly} onDragStart={e => !isReadOnly && handleDragStart(e, index)} onDragOver={e => e.preventDefault()} onDrop={e => !isReadOnly && handleDrop(e, project.id, index)} className={draggedModuleIndex === index ? 'opacity-50' : ''}>
                  <div className="flex bg-indigo-50/80 border-b group">
                    <div className="flex-shrink-0 p-3 pl-6 border-r sticky left-0 bg-indigo-50/95 z-30 cursor-pointer flex items-center gap-2 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle} onClick={() => toggleModule(module.id)}>{!isReadOnly && <div className="cursor-grab"><GripVertical size={16} /></div>}{isModuleCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}<Layers size={16} /><span className="font-semibold text-sm truncate">{module.name}</span></div>
                    <div className="w-32 flex-shrink-0 p-3 text-center text-xs font-bold border-r">{module.functionPoints} FP</div>
                    {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r flex items-center justify-center" style={{ width: `${colWidth}px` }}><span className="text-[10px] font-bold text-indigo-900">{formatValue(getModuleTotal(module, col))}</span></div>)}
                  </div>
                  {!isModuleCollapsed && module.tasks.map(task => {
                    const isTaskCollapsed = collapsedTasks[task.id];
                    return (
                    <React.Fragment key={task.id}>
                      <div className="flex border-b bg-slate-50/40 group/task">
                        <div className="flex-shrink-0 py-1.5 px-3 border-r sticky left-0 bg-slate-50/95 z-20 flex items-center justify-between pl-10 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}>
                           <div className="flex items-center gap-2 overflow-hidden cursor-pointer flex-1" onClick={() => toggleTask(task.id)}>{isTaskCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}<div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>{editingId === task.id ? <input ref={editInputRef} value={editValue} onChange={e => setEditValue(e.target.value)} onBlur={() => saveEdit(project.id, module.id, task.id)} onKeyDown={e => handleKeyDown(e, project.id, module.id, task.id)} className="bg-white text-xs w-full" /> : <span className="text-xs font-bold truncate" onDoubleClick={e => !isReadOnly && startEditing(task.id, task.name, e)}>{task.name}</span>}</div>
                           {!isReadOnly && <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100"><button onClick={() => onShiftTask(project.id, module.id, task.id, 'left')} className="p-0.5 rounded"><ChevronLeft size={12} /></button><button onClick={() => onShiftTask(project.id, module.id, task.id, 'right')} className="p-0.5 rounded"><ChevronRight size={12} /></button><div className="w-px h-3 mx-1"></div><button onClick={() => onAddAssignment(project.id, module.id, task.id, Role.DEV)}><UserPlus size={14} /></button></div>}
                        </div>
                        <div className="w-32 flex-shrink-0 border-r flex items-center gap-1 px-1">
                          <div className="flex flex-col w-full">
                            <div className="flex items-center gap-1"><PlayCircle size={10} /><select disabled={isReadOnly} className="text-[9px] w-full" value={task.startWeekId || ''} onChange={e => onUpdateTaskSchedule(project.id, module.id, task.id, e.target.value, task.duration || 1)}><option value="">Start</option>{ALL_WEEK_IDS.map(w => <option key={w} value={w}>{w.split('-')[1]}</option>)}</select></div>
                            <div className="flex items-center gap-1 pt-0.5 mt-0.5"><Clock size={10} /><input disabled={isReadOnly} type="number" className="text-[9px] w-8" placeholder="Wks" min={1} value={task.duration || ''} onChange={e => onUpdateTaskSchedule(project.id, module.id, task.id, task.startWeekId || ALL_WEEK_IDS[0], parseInt(e.target.value) || 0)} /><span className="text-[9px]">wks</span></div>
                          </div>
                        </div>
                        {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r flex items-center justify-center" style={{ width: `${colWidth}px` }}><span className="text-[10px] font-semibold">{formatValue(getTaskTotal(task, col))}</span></div>)}
                      </div>
                      {!isTaskCollapsed && task.assignments.map(assign => (
                      <div key={assign.id} className="flex border-b group/assign">
                        <div className={`flex-shrink-0 py-1 px-3 border-r sticky left-0 bg-white z-10 flex flex-col justify-center border-l-4 ${getRoleColorClass(assign.role)} shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]`} style={stickyStyle}><span className="text-[10px] pl-12">↳ Input</span></div>
                        <div className="w-32 flex-shrink-0 border-r bg-white flex items-center justify-between px-2 py-1 relative">
                          <select disabled={isReadOnly} value={assign.role} onChange={e => onUpdateAssignmentRole(project.id, module.id, task.id, assign.id, e.target.value as Role)} className="w-20 text-[10px]"><>
                            {Object.values(Role).map(r => <option key={r} value={r}>{r}</option>)}
                          </></select>
                          {!isReadOnly && <div className="flex items-center gap-0.5 opacity-0 group-hover/assign:opacity-100"><button onClick={() => onShiftAssignment(project.id, module.id, task.id, assign.id, 'left')} className="p-0.5 rounded"><ChevronLeft size={10} /></button><button onClick={() => onShiftAssignment(project.id, module.id, task.id, assign.id, 'right')} className="p-0.5 rounded"><ChevronRight size={10} /></button></div>}
                        </div>
                        {timeline.map(col => { const h = getHolidayInfo(col.date); return <div key={col.id} className={`flex-shrink-0 border-r relative ${h ? 'bg-[repeating-linear-gradient(45deg,#fee2e2,#fee2e2_5px,#fef2f2_5px,#fef2f2_10px)]' : ''}`} style={{ width: `${colWidth}px` }} title={h?.name}><input type="text" disabled={isReadOnly || viewMode === 'day' || !!h} className={`w-full h-full text-center text-xs ${getRawCellValue(assign, col) > 0 ? 'bg-indigo-50 font-medium' : ''} ${isReadOnly || !!h ? 'cursor-not-allowed' : ''}`} value={formatValue(getRawCellValue(assign, col))} placeholder={isReadOnly ? '' : '-'} onChange={e => handleCellUpdate(project.id, module.id, task.id, assign.id, col, e.target.value)} /></div>; })}
                      </div>
                      ))}
                    </React.Fragment>
                    );
                  })}
                  {!isModuleCollapsed && !isReadOnly && (
                    <div className="flex border-b bg-slate-50/20">
                      <div className="flex-shrink-0 py-1.5 px-3 border-r sticky left-0 bg-slate-50/80 z-20 pl-12 shadow-[4px_0_10px_-4px_rgba(0,0,0,0.1)]" style={stickyStyle}><button onClick={() => handleAddTaskClick(project.id, module.id, isReadOnly)} className="text-[11px] text-slate-500 hover:text-indigo-600 flex items-center gap-1"><Plus size={12} />Add New Task</button></div>
                      <div className="w-32 flex-shrink-0 border-r"></div>
                      {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r" style={{ width: `${colWidth}px` }}></div>)}
                    </div>
                  )}
                </div>
                );
              })}
            </React.Fragment>
            );
          })}
           <div className="flex bg-slate-800 text-white border-t sticky bottom-0 z-50 shadow-[0_-4px_10px_rgba(0,0,0,0.2)]">
             <div className="flex-shrink-0 p-3 border-r sticky left-0 bg-slate-800 z-50 font-bold text-sm shadow-[4px_0_10px_-4px_rgba(0,0,0,0.3)]" style={stickyStyle}>GRAND TOTAL</div>
             <div className="w-32 flex-shrink-0 border-r"></div>
             {timeline.map(col => <div key={col.id} className="flex-shrink-0 border-r flex items-center justify-center text-xs font-mono font-bold" style={{ width: `${colWidth}px` }}>{formatValue(projects.reduce((acc, p) => acc + getProjectTotal(p, col), 0))}</div>)}
           </div>
        </div>
      </div>
    </div>
  );
};
