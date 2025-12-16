import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel, Holiday, Role, ProjectTask, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { Calculator, GripVertical, ArrowRight, Layout, Server, ChevronDown, Calendar as CalendarIcon, Link2, Clock, AlertCircle, CheckCircle2, Layers, Gem, ShieldCheck } from 'lucide-react';
import { calculateEndDate, formatDateForInput, calculateWorkingDaysBetween } from '../constants';

interface EstimatorProps {
  projects: Project[];
  holidays: Holiday[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number, feVelocity: number, feTeamSize: number, beVelocity: number, beTeamSize: number) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => void;
  onUpdateModuleStartDate: (projectId: string, moduleId: string, startDate: string | null) => void;
  onUpdateModuleDeliveryTask: (projectId: string, moduleId: string, deliveryTaskId: string | null) => void;
  onUpdateModuleStartTask: (projectId: string, moduleId: string, startTaskId: string | null) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  isReadOnly?: boolean;
}

const COMPLEXITY_MULTIPLIERS: Record<ComplexityLevel, number> = {
  'Low': 1.0,
  'Medium': 1.2,
  'High': 1.5,
  'Complex': 2.0
};

const MODULE_TYPE_STYLES: Record<ModuleType, { icon: React.ElementType, rowBg: string, header: string }> = {
  [ModuleType.Development]: { icon: Layers, rowBg: 'bg-white', header: 'Preparation' },
  [ModuleType.Preparation]: { icon: Gem, rowBg: 'bg-amber-50', header: 'Preparation' },
  [ModuleType.PostDevelopment]: { icon: ShieldCheck, rowBg: 'bg-teal-50', header: 'Post-Dev Effort' },
};

const ComplexitySelect: React.FC<{ value: ComplexityLevel, onChange: (val: ComplexityLevel) => void, isReadOnly?: boolean }> = ({ value, onChange, isReadOnly }) => {
    return (
        <div className={`relative w-full h-full flex items-center justify-center group ${isReadOnly ? '' : 'cursor-pointer hover:bg-white hover:border-slate-300'} bg-transparent border border-transparent rounded px-1 transition-colors`}>
            <div className="flex items-center gap-0.5 pointer-events-none z-0">
                <span className={`text-[10px] font-bold ${
                    value === 'Low' ? 'text-green-600' :
                    value === 'Medium' ? 'text-blue-600' :
                    value === 'High' ? 'text-orange-600' :
                    'text-red-600'
                }`}>
                    {value.charAt(0)}
                </span>
                {!isReadOnly && <ChevronDown size={8} className="text-slate-300 group-hover:text-slate-500" />}
            </div>
            {!isReadOnly && <select
                value={value}
                onChange={(e) => onChange(e.target.value as ComplexityLevel)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                title={`Current: ${value} (${COMPLEXITY_MULTIPLIERS[value]}x)`}
            >
                <option value="Low">Low (1x)</option>
                <option value="Medium">Medium (1.2x)</option>
                <option value="High">High (1.5x)</option>
                <option value="Complex">Complex (2x)</option>
            </select>}
        </div>
    );
};

// --- Improved Input Component ---
interface EstimatorNumberInputProps {
    value: number;
    onChange: (val: number) => void;
    min?: number;
    className?: string;
    onNavigate: (dir: string, r: number, c: number) => void;
    rowIndex: number;
    colIndex: number;
    disabled?: boolean;
}

const EstimatorNumberInput: React.FC<EstimatorNumberInputProps> = ({ value, onChange, min = 0, className, onNavigate, rowIndex, colIndex, disabled }) => {
    const [localValue, setLocalValue] = useState(String(value));
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(String(value));
        }
    }, [value, isEditing]);

    const commit = () => {
        if (disabled) return;
        setIsEditing(false);
        let num = parseFloat(localValue);
        if (isNaN(num)) num = value;
        if (num < min) num = min;
        if (num !== value) {
            onChange(num);
        }
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
        if (e.key === 'Escape') {
            setIsEditing(false);
            setLocalValue(String(value));
            e.currentTarget.blur();
        }
    };

    return (
        <input 
            type="text" 
            data-r={rowIndex}
            data-c={colIndex}
            data-grid="estimator"
            className={`${className} disabled:bg-slate-100/50 disabled:text-slate-400 disabled:cursor-not-allowed`}
            value={isEditing ? localValue : (value || '')}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onFocus={(e) => { if (!disabled) { setIsEditing(true); e.target.select(); } }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
        />
    );
};


export const Estimator: React.FC<EstimatorProps> = ({ projects, holidays, onUpdateFunctionPoints, onUpdateModuleComplexity, onUpdateModuleStartDate, onUpdateModuleDeliveryTask, onUpdateModuleStartTask, onReorderModules, isReadOnly = false }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const holidaySet = useMemo(() => new Set(
    holidays
        .filter(h => h.country === 'HK')
        .map(h => h.date)
  ), [holidays]);
  
  useEffect(() => {
    let currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject && projects.length > 0) {
        setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const modules = selectedProject ? selectedProject.modules : [];

  const allTasksMap = useMemo(() => {
    const map = new Map<string, { task: ProjectTask, module: ProjectModule }>();
    if (selectedProject) {
        selectedProject.modules.forEach(module => {
            module.tasks.forEach(task => {
                map.set(task.id, { task, module });
            });
        });
    }
    return map;
  }, [selectedProject]);

  const totals = useMemo(() => {
    let totalRefFP = 0;
    let totalFeFP = 0;
    let totalBeFP = 0;
    let totalPrepEffort = 0;
    let totalFeEffort = 0;
    let totalBeEffort = 0;
    let totalPrepDuration = 0;
    let totalFeDuration = 0;
    let totalBeDuration = 0;
    let projectMaxEstDate: Date | null = null;
    let projectMaxPlanDate: Date | null = null;
    let totalVarianceDays = 0;

    modules.forEach(m => {
        const moduleType = m.type || ModuleType.Development;
        const isDev = moduleType === ModuleType.Development;

        const feFP = isDev ? (m.frontendFunctionPoints || 0) : 0;
        const beFP = isDev ? (m.backendFunctionPoints || 0) : 0;
        
        const prepBase = m.legacyFunctionPoints || 0;
        totalRefFP += prepBase;

        const prepVelocity = m.prepVelocity || 10;
        const prepTeamSize = m.prepTeamSize || 2;
        const prepEffort = prepBase > 0 ? Math.ceil(prepBase / prepVelocity) : 0;
        totalPrepEffort += prepEffort;
        const prepDuration = prepEffort > 0 ? Math.ceil(prepEffort / prepTeamSize) : 0;
        totalPrepDuration += prepDuration;

        const feVel = m.frontendVelocity || 5;
        const feTeam = m.frontendTeamSize || 2;
        const feComp = m.frontendComplexity || 'Medium';
        const feEffort = feFP > 0 ? Math.ceil((feFP / feVel) * COMPLEXITY_MULTIPLIERS[feComp]) : 0;
        const feDuration = feEffort > 0 ? Math.ceil(feEffort / feTeam) : 0;
        totalFeFP += feFP;
        totalFeEffort += feEffort;
        totalFeDuration += feDuration;

        const beVel = m.backendVelocity || 5;
        const beTeam = m.backendTeamSize || 2;
        const beComp = m.backendComplexity || 'Medium';
        const beEffort = beFP > 0 ? Math.ceil((beFP / beVel) * COMPLEXITY_MULTIPLIERS[beComp]) : 0;
        const beDuration = beEffort > 0 ? Math.ceil(beEffort / beTeam) : 0;
        totalBeFP += beFP;
        totalBeEffort += beEffort;
        totalBeDuration += beDuration;

        const moduleTotalDuration = isDev ? Math.max(feDuration, beDuration) : prepDuration;
        const hasEffort = (isDev && (feFP > 0 || beFP > 0)) || (!isDev && prepBase > 0);

        let baseStartDate = m.startDate || null;
        if (!baseStartDate && m.startTaskId) {
            const taskInfo = allTasksMap.get(m.startTaskId);
            if (taskInfo) {
                let minStart: string | null = null;
                taskInfo.task.assignments.forEach(a => {
                    if (a.startDate && (!minStart || a.startDate < minStart)) {
                        minStart = a.startDate;
                    }
                });
                baseStartDate = minStart;
            }
        }
        if (!baseStartDate) {
             let minDate: string | null = null;
             m.tasks.forEach(task => {
                 task.assignments.forEach(a => {
                     if (a.startDate && (!minDate || a.startDate < minDate)) {
                         minDate = a.startDate;
                     }
                 });
             });
             baseStartDate = minDate;
        }

        let estDate: Date | null = null;
        if (hasEffort && baseStartDate) {
            if (moduleTotalDuration > 0) {
                const estDateStr = calculateEndDate(baseStartDate, moduleTotalDuration, holidaySet);
                estDate = new Date(estDateStr.replace(/-/g, '/'));
            } else {
                estDate = new Date(baseStartDate.replace(/-/g, '/'));
            }
            if (estDate && (!projectMaxEstDate || estDate > projectMaxEstDate)) {
                projectMaxEstDate = estDate;
            }
        }

        let modMaxEndDate: Date | null = null;
        m.tasks.forEach(task => {
            task.assignments.forEach(a => {
                if (a.startDate && a.duration) {
                    const endDateStr = calculateEndDate(a.startDate, a.duration, holidaySet);
                    const endDate = new Date(endDateStr.replace(/-/g, '/'));
                    if (!modMaxEndDate || endDate > modMaxEndDate) {
                        modMaxEndDate = endDate;
                    }
                }
            });
        });
        
        if (modMaxEndDate) {
            if (!projectMaxPlanDate || modMaxEndDate > projectMaxPlanDate) {
                projectMaxPlanDate = modMaxEndDate;
            }
        }

        if (estDate && modMaxEndDate) {
            const estStr = formatDateForInput(estDate);
            const planStr = formatDateForInput(modMaxEndDate);
            let days = 0;
            if (estStr === planStr) {
                days = 0;
            } else if (estStr < planStr) {
                days = - (calculateWorkingDaysBetween(estStr, planStr, holidaySet) - 1);
            } else {
                days = calculateWorkingDaysBetween(planStr, estStr, holidaySet) - 1;
            }
            totalVarianceDays += days;
        }
    });

    return { refFP: totalRefFP, feFP: totalFeFP, beFP: totalBeFP, prepEffort: totalPrepEffort, feEffort: totalFeEffort, beEffort: totalBeEffort, prepDuration: totalPrepDuration, feDuration: totalFeDuration, beDuration: totalBeDuration, projectMaxEstDate, projectMaxPlanDate, totalVarianceDays };
  }, [modules, holidaySet, allTasksMap]);

  const handleDragStart = (e: React.DragEvent, index: number) => { if (isReadOnly) return; e.dataTransfer.setData("text/plain", index.toString()); setDraggedIndex(index); };
  const handleDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, index: number) => { if (isReadOnly) return; e.preventDefault(); const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(startIndex) && startIndex !== index) { onReorderModules(selectedProjectId, startIndex, index); } setDraggedIndex(null); };

  const formatWeeks = (days: number) => { if (!days || isNaN(days)) return '0.0w'; const weeks = (days / 5).toFixed(1); return `${weeks}w`; };
  const getModuleLatestEndDate = (module: ProjectModule): Date | null => { let maxEndDate: Date | null = null; module.tasks.forEach(task => { task.assignments.forEach(a => { if (a.startDate && a.duration) { const endDateStr = calculateEndDate(a.startDate, a.duration, holidaySet); const endDate = new Date(endDateStr.replace(/-/g, '/')); if (!maxEndDate || endDate > maxEndDate) { maxEndDate = endDate; } } }); }); return maxEndDate; }
  const getModuleEarliestStartDate = (module: ProjectModule): string | null => { let minDate: string | null = null; module.tasks.forEach(task => { task.assignments.forEach(a => { if (a.startDate) { if (!minDate || a.startDate < minDate) { minDate = a.startDate; } } }); }); return minDate; }

  // --- Estimator Navigation ---
  const handleNavigate = (direction: string, currentRow: number, currentCol: number) => {
    let targetRow = currentRow;
    let targetCol = currentCol;

    if (direction === 'ArrowUp') targetRow--;
    if (direction === 'ArrowDown') targetRow++;
    if (direction === 'ArrowLeft') targetCol--;
    if (direction === 'ArrowRight') targetCol++;

    const selector = `input[data-grid="estimator"][data-r="${targetRow}"][data-c="${targetCol}"]`;
    const el = document.querySelector(selector) as HTMLInputElement;
    if (el) {
        el.focus();
        el.select();
    }
  };


  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2"><Calculator className="w-4 h-4 text-indigo-600" />Effort Estimator</h2>
            <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Project:</span>
                <select className="text-xs border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 border py-1 pl-2 pr-6 h-7" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
                    {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
                <span className="text-[10px] text-slate-400 ml-2">(Est. based on HK Holidays)</span>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-white relative">
        <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
                <col className="w-8" />   {/* Drag */}
                <col className="w-48" />  {/* Module Name */}
                <col className="w-14" />  {/* Ref FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}
                <col className="w-14" />  {/* FE FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}
                <col className="w-14" />  {/* BE FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}
                <col className="w-24" />  {/* Start */}
                <col className="w-28" />  {/* ETA / Delivery Task */}
                <col className="w-20" />  {/* Variance */}
            </colgroup>
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider sticky top-0 z-20 shadow-sm font-semibold">
                <tr>
                    <th className="py-2 border-b border-slate-200 bg-slate-50"></th>
                    <th className="py-2 px-2 border-b border-slate-200 border-r text-left truncate bg-slate-50">Module</th>
                    <th colSpan={5} className="py-1 px-1 text-center bg-amber-50/80 border-b border-amber-100 border-r border-slate-200 text-amber-800">Preparation</th>
                    <th colSpan={6} className="py-1 px-1 text-center bg-blue-50/80 border-b border-blue-100 border-r border-slate-200 text-blue-800">Front-End</th>
                    <th colSpan={6} className="py-1 px-1 text-center bg-indigo-50/80 border-b border-indigo-100 border-r border-slate-200 text-indigo-800">Back-End</th>
                    <th colSpan={3} className="py-2 px-2 text-center border-b border-slate-200 bg-slate-50">Delivery</th>
                </tr>
                <tr className="text-[9px] text-slate-500">
                    <th className="border-b border-slate-200 bg-slate-50"></th>
                    <th className="border-b border-slate-200 border-r bg-slate-50"></th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Ref FP</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Vel</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Team</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-amber-50/30">Wks</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">FP</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">Vel</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">Team</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">Cpx</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-blue-50/30">Wks</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">FP</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">Vel</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">Team</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">Cpx</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-indigo-50/30">Wks</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">Start</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">Dates</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">Var</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
                {modules.length === 0 && (
                    <tr><td colSpan={22} className="p-12 text-center text-slate-400 bg-slate-50/30"><div className="flex flex-col items-center justify-center gap-2"><Layout className="w-8 h-8 text-slate-300"/><p>No modules found.</p></div></td></tr>
                )}
                {modules.map((m, index) => {
                    const moduleType = m.type || ModuleType.Development;
                    const isDev = moduleType === ModuleType.Development;
                    const typeStyle = MODULE_TYPE_STYLES[moduleType];
                    const Icon = typeStyle.icon;
                    
                    const feFP = isDev ? (m.frontendFunctionPoints || 0) : 0;
                    const beFP = isDev ? (m.backendFunctionPoints || 0) : 0;
                    const prepBase = m.legacyFunctionPoints || 0;

                    const prepVelocity = m.prepVelocity || 10;
                    const prepTeamSize = m.prepTeamSize || 2;
                    const prepEffort = prepBase > 0 ? Math.ceil(prepBase / prepVelocity) : 0;
                    const prepDuration = prepEffort > 0 ? Math.ceil(prepEffort / prepTeamSize) : 0;
                    
                    const feVel = m.frontendVelocity || 5;
                    const feTeam = m.frontendTeamSize || 2;
                    const feComp = m.frontendComplexity || 'Medium';
                    const feEffort = feFP > 0 ? Math.ceil((feFP / feVel) * COMPLEXITY_MULTIPLIERS[feComp]) : 0;
                    const feDuration = feEffort > 0 ? Math.ceil(feEffort / feTeam) : 0;

                    const beVel = m.backendVelocity || 5;
                    const beTeam = m.backendTeamSize || 2;
                    const beComp = m.backendComplexity || 'Medium';
                    const beEffort = beFP > 0 ? Math.ceil((beFP / beVel) * COMPLEXITY_MULTIPLIERS[beComp]) : 0;
                    const beDuration = beEffort > 0 ? Math.ceil(beEffort / beTeam) : 0;

                    const totalDuration = isDev ? Math.max(feDuration, beDuration) : prepDuration;
                    const hasEffort = (isDev && (feFP > 0 || beFP > 0)) || (!isDev && prepBase > 0);
                    
                    let baseStartDate = m.startDate || null;
                    let isTaskBased = false;
                    let startTaskName = '';
                    if (!baseStartDate && m.startTaskId) { 
                        const taskInfo = allTasksMap.get(m.startTaskId);
                        if (taskInfo) {
                            let minStart: string | null = null;
                            taskInfo.task.assignments.forEach(a => {
                                if (a.startDate && (!minStart || a.startDate < minStart)) {
                                    minStart = a.startDate;
                                }
                            });
                            if (minStart) {
                                baseStartDate = minStart;
                                isTaskBased = true;
                                startTaskName = taskInfo.task.name;
                            }
                        }
                    }
                    if (!baseStartDate) { baseStartDate = getModuleEarliestStartDate(m); }

                    let estimatedDateStr: string | null = null;
                    if (hasEffort && baseStartDate) { if (totalDuration > 0) { estimatedDateStr = calculateEndDate(baseStartDate, totalDuration, holidaySet); } else if (baseStartDate) { estimatedDateStr = formatDateForInput(new Date(baseStartDate.replace(/-/g, '/'))); } }
                    const plannerDateObj = getModuleLatestEndDate(m);
                    const plannerDateStr = plannerDateObj ? formatDateForInput(plannerDateObj) : null;
                    let varianceStatus: 'safe' | 'risk' | 'unknown' = 'unknown';
                    let varianceText = '-';
                    let varianceClass = 'text-slate-300';
                    if (estimatedDateStr && plannerDateStr) { if (estimatedDateStr <= plannerDateStr) { varianceStatus = 'safe'; let diff = calculateWorkingDaysBetween(estimatedDateStr, plannerDateStr, holidaySet) - 1; if(estimatedDateStr === plannerDateStr) diff = 0; const savedDays = -diff; varianceText = `${savedDays}d`; varianceClass = 'text-green-600 font-bold'; } else { varianceStatus = 'risk'; const diff = calculateWorkingDaysBetween(plannerDateStr, estimatedDateStr, holidaySet) - 1; varianceText = `+${diff}d`; varianceClass = 'text-red-600 font-bold'; } }
                    const updateParams = (legacyFP: number, feFP: number, beFP: number, pVel: number, pTeam: number, fVel: number, fTeam: number, bVel: number, bTeam: number) => { onUpdateFunctionPoints(selectedProjectId, m.id, legacyFP, feFP, beFP, pVel, pTeam, fVel, fTeam, bVel, bTeam); };
                    let cellBgClass = 'bg-transparent';
                    if (varianceStatus === 'risk') cellBgClass = 'bg-red-50/50';
                    if (varianceStatus === 'safe') cellBgClass = 'bg-green-50/50';

                    const baseInputClass = "w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500";

                    return (
                        <tr key={m.id} draggable={!isReadOnly} onDragStart={(e) => handleDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)} className={`hover:bg-slate-50 transition-colors group ${draggedIndex === index ? 'opacity-40' : ''} ${typeStyle.rowBg}`}>
                            <td className="text-center text-slate-300 cursor-grab active:cursor-grabbing border-b border-slate-100"><div className="flex justify-center group-hover:text-slate-500">{!isReadOnly && <GripVertical size={12} />}</div></td>
                            <td className="px-2 py-1.5 border-b border-slate-100 border-r border-slate-200">
                                <div className="flex items-center gap-1.5">
                                    <Icon size={14} className="text-slate-400" title={MODULE_TYPE_DISPLAY_NAMES[moduleType]} />
                                    <span className="font-medium text-slate-700 truncate block w-full" title={m.name}>{m.name}</span>
                                </div>
                            </td>
                            
                            {/* Prep */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={0} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-600`} min={0} value={m.legacyFunctionPoints || 0} onChange={(val) => updateParams(val, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} disabled={isReadOnly} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={1} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={prepVelocity} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, val, prepTeamSize, feVel, feTeam, beVel, beTeam)} disabled={isReadOnly} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={2} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={prepTeamSize} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, val, feVel, feTeam, beVel, beTeam)} disabled={isReadOnly} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{prepEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-amber-700 font-medium">{formatWeeks(prepDuration)}</td>

                            {/* FE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={3} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-600`} min={0} value={feFP} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, val, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={4} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={feVel} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, val, feTeam, beVel, beTeam)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={5} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={feTeam} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, val, beVel, beTeam)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={feComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'frontend', val)} isReadOnly={isReadOnly || !isDev} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{feEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-blue-700 font-medium">{formatWeeks(feDuration)}</td>

                            {/* BE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={6} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-600`} min={0} value={beFP} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, val, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={7} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={beVel} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, val, beTeam)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-white/50">
                                <EstimatorNumberInput rowIndex={index} colIndex={8} onNavigate={handleNavigate} className={`${baseInputClass} text-slate-500`} min={1} value={beTeam} onChange={(val) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, val)} disabled={isReadOnly || !isDev} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={beComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'backend', val)} isReadOnly={isReadOnly || !isDev} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{beEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-indigo-700 font-medium">{formatWeeks(beDuration)}</td>

                            {/* Start */}
                            <td className="p-0 border-b border-slate-100 bg-slate-50/30 relative group/start">
                                {!isReadOnly && <div className="absolute inset-0 opacity-0 group-hover/start:opacity-100 transition-opacity bg-white/95 flex items-center justify-center shadow-sm z-20">
                                    <div className="relative w-full h-full">
                                        <select className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={m.startTaskId || (m.startDate ? 'manual' : '')} onChange={(e) => { const val = e.target.value; if (val === 'manual' || val === '') { onUpdateModuleStartTask(selectedProjectId, m.id, null); if(val === '') { onUpdateModuleStartDate(selectedProjectId, m.id, null); } } else { onUpdateModuleStartTask(selectedProjectId, m.id, val); } }}>
                                            <option value="">- Auto (Earliest) -</option>
                                            <option value="manual">- Manual Date -</option>
                                            {selectedProject?.modules.map(mod => (
                                              <optgroup label={mod.name} key={mod.id}>
                                                  {mod.tasks.map(t => (
                                                      <option key={t.id} value={t.id}>{t.name}</option>
                                                  ))}
                                              </optgroup>
                                            ))}
                                        </select>
                                        <div className="w-full h-full flex flex-col items-center justify-center text-[9px] text-indigo-600 pointer-events-none p-1"><Link2 size={10} /> <span className="truncate w-full text-center">Change Source</span></div>
                                    </div>
                                </div>}
                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] relative z-10 px-1">
                                    {isTaskBased ? ( <> <span className="text-indigo-700 font-bold truncate w-full text-center" title={`Starts with: ${startTaskName}`}>{startTaskName}</span> <span className="text-[9px] text-slate-400">{baseStartDate ? new Date(baseStartDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : '-'}</span> </> ) : ( <> <input type="date" disabled={isReadOnly} className={`w-full bg-transparent text-center focus:outline-none ${m.startDate ? 'text-indigo-700 font-bold' : 'text-slate-500'} ${isReadOnly ? 'cursor-default' : ''}`} value={m.startDate || (baseStartDate || '')} onChange={(e) => onUpdateModuleStartDate(selectedProjectId, m.id, e.target.value)} /> {!m.startDate && baseStartDate && <span className="text-[8px] text-slate-300 absolute bottom-0.5 right-1">Auto</span>} </> )}
                                </div>
                            </td>

                            {/* Delivery */}
                            <td className={`px-1 border-b border-slate-100 text-right align-middle ${cellBgClass}`}>
                                <div className="flex flex-col gap-0.5 py-1 px-1 h-full justify-center">
                                     <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 border-b border-slate-200/50 pb-0.5"><span>Est:</span><span className="font-mono">{estimatedDateStr ? new Date(estimatedDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div>
                                     <div className={`flex items-center justify-between gap-2 text-[10px] font-bold ${varianceStatus === 'safe' ? 'text-green-700' : varianceStatus === 'risk' ? 'text-red-700' : 'text-slate-600'}`}><div className="flex items-center gap-1"><span>Plan:</span>{varianceStatus === 'risk' && <AlertCircle size={8} />}{varianceStatus === 'safe' && <CheckCircle2 size={8} />}</div><span className="font-mono" title="Latest task end date">{plannerDateStr ? new Date(plannerDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div>
                                </div>
                            </td>

                             {/* Variance */}
                            <td className={`px-1 border-b border-slate-100 text-center align-middle border-r border-slate-200 ${cellBgClass}`}><span className={`text-[10px] font-mono ${varianceClass}`}>{varianceText}</span></td>
                        </tr>
                    );
                })}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-[10px] border-t border-slate-200 sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                 <tr>
                    <td colSpan={2} className="px-2 py-2 text-right text-slate-500 uppercase">Totals</td>
                    <td className="text-center text-slate-700">{totals.refFP}</td>
                    <td colSpan={2} className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.prepEffort}</td>
                    <td className="text-center text-amber-700 border-r border-slate-300">{formatWeeks(totals.prepDuration)}</td>
                    <td className="text-center text-slate-700">{totals.feFP}</td>
                    <td colSpan={3} className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.feEffort}</td>
                    <td className="text-center text-blue-700 border-r border-slate-300">{formatWeeks(totals.feDuration)}</td>
                    <td className="text-center text-slate-700">{totals.beFP}</td>
                    <td colSpan={3} className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.beEffort}</td>
                    <td className="text-center text-indigo-700 border-r border-slate-300">{formatWeeks(totals.beDuration)}</td>
                    <td className="text-center text-slate-400 border-b border-slate-200 bg-slate-50">-</td>
                    <td className="px-1 py-1 border-b border-slate-200 bg-slate-50 text-right"><div className="flex flex-col gap-0.5 justify-center h-full"><div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 border-b border-slate-200/50 pb-0.5"><span>Max Est:</span><span className="font-mono">{totals.projectMaxEstDate ? totals.projectMaxEstDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div><div className="flex items-center justify-between gap-2 text-[10px] font-bold text-slate-700"><span>Max Plan:</span><span className="font-mono">{totals.projectMaxPlanDate ? totals.projectMaxPlanDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div></div></td>
                    <td className="px-1 border-b border-slate-200 bg-slate-50 text-center">
                       {(() => { const days = totals.totalVarianceDays; let varianceClass = 'text-slate-300'; let varianceText = '-'; if (days !== 0) { const sign = days > 0 ? '+' : ''; varianceText = `${sign}${days}d`; if (days > 0) varianceClass = 'text-red-600 font-bold'; else varianceClass = 'text-green-600 font-bold'; } else { varianceText = '0d'; varianceClass = 'text-green-600 font-bold'; } return <span className={`text-[10px] font-mono ${varianceClass}`}>{varianceText}</span>; })()}
                    </td>
                </tr>
            </tfoot>
        </table>
      </div>
      <div className="bg-slate-50 border-t border-slate-200 p-2 text-[10px] text-slate-400 text-center flex justify-between items-center px-4"><span>* FE/BE in parallel</span><div className="flex gap-4"><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Saved Days (Negative)</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Delays (Positive)</span></div></div>
    </div>
  );
};
