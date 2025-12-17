import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel, Holiday, Role, ProjectTask, ModuleType, MODULE_TYPE_DISPLAY_NAMES } from '../types';
import { Calculator, GripVertical, ChevronRight, ChevronDown, Calendar as CalendarIcon, Link2, AlertCircle, CheckCircle2, Layers, Gem, ShieldCheck, Dot, Rocket, Server, Trash2 } from 'lucide-react';
import { calculateEndDate, formatDateForInput, calculateWorkingDaysBetween } from '../constants';

interface EstimatorProps {
  projects: Project[];
  holidays: Holiday[];
  onUpdateModuleEstimates: (projectId: string, moduleId: string, legacyFp: number, prepVelocity: number, prepTeamSize: number, feVelocity: number, feTeamSize: number, beVelocity: number, beTeamSize: number) => void;
  onUpdateTaskEstimates: (projectId: string, moduleId: string, taskId: string, updates: Partial<Omit<ProjectTask, 'id' | 'name' | 'assignments'>>) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, type: 'frontend' | 'backend' | 'prep', complexity: ComplexityLevel) => void;
  onUpdateModuleStartDate: (projectId: string, moduleId: string, startDate: string | null) => void;
  onUpdateModuleDeliveryTask: (projectId: string, moduleId: string, deliveryTaskId: string | null) => void;
  onUpdateModuleStartTask: (projectId: string, moduleId: string, startTaskId: string | null) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
  onDeleteModule: (projectId: string, moduleId: string) => void;
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
  [ModuleType.MVP]: { icon: Rocket, rowBg: 'bg-sky-50', header: 'MVP Effort' },
  [ModuleType.Production]: { icon: Server, rowBg: 'bg-slate-50', header: 'Production Effort' },
};

const ComplexitySelect: React.FC<{ value: ComplexityLevel, onChange: (val: ComplexityLevel) => void, isReadOnly?: boolean, placeholder?: string }> = ({ value, onChange, isReadOnly, placeholder }) => {
    return (
        <div className={`relative w-full h-full flex items-center justify-center group ${isReadOnly ? '' : 'cursor-pointer hover:bg-white hover:border-slate-300'} bg-transparent border border-transparent rounded px-1 transition-colors`}>
            <div className="flex items-center gap-0.5 pointer-events-none z-0" title={placeholder ? `Inherited: ${placeholder}` : undefined}>
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
    value?: number | null;
    onChange: (val: number) => void;
    placeholder?: number;
    min?: number;
    className?: string;
    onNavigate: (dir: string, r: number, c: number) => void;
    rowIndex: number;
    colIndex: number;
    disabled?: boolean;
}

const EstimatorNumberInput: React.FC<EstimatorNumberInputProps> = ({ value, onChange, placeholder, min = 0, className, onNavigate, rowIndex, colIndex, disabled }) => {
    const [localValue, setLocalValue] = useState(value == null ? '' : String(value));
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            setLocalValue(value == null ? '' : String(value));
        }
    }, [value, isEditing]);

    const commit = () => {
        if (disabled) return;
        setIsEditing(false);
        const trimmed = localValue.trim();
        if (trimmed === '') {
            if (value != null) {
                onChange(0); // Explicitly clear if user deletes input, treat as override
            }
            return;
        }
        
        let num = parseFloat(trimmed);
        if (isNaN(num)) num = value ?? 0;
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
        if (e.key === 'Enter') { e.currentTarget.blur(); }
        if (e.key === 'Escape') { setIsEditing(false); setLocalValue(value == null ? '' : String(value)); e.currentTarget.blur(); }
    };
    
    const displayValue = isEditing ? localValue : (value == null ? '' : String(value));
    const effectivePlaceholder = isEditing ? '' : (placeholder != null ? String(placeholder) : '');


    return (
        <input 
            type="text" 
            data-r={rowIndex}
            data-c={colIndex}
            data-grid="estimator"
            className={`${className} placeholder:text-slate-300 placeholder:italic disabled:bg-slate-100/50 disabled:text-slate-400 disabled:cursor-not-allowed`}
            value={displayValue}
            placeholder={effectivePlaceholder}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={commit}
            onFocus={(e) => { if (!disabled) { setIsEditing(true); e.target.select(); } }}
            onKeyDown={handleKeyDown}
            disabled={disabled}
        />
    );
};


export const Estimator: React.FC<EstimatorProps> = ({ projects, holidays, onUpdateModuleEstimates, onDeleteModule, onUpdateTaskEstimates, onUpdateModuleComplexity, onUpdateModuleStartDate, onUpdateModuleDeliveryTask, onUpdateModuleStartTask, onReorderModules, isReadOnly = false }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; moduleId: string; } | null>(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

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

  const getTaskEarliestStartDate = (task: ProjectTask): string | null => {
    let minDate: string | null = null;
    task.assignments.forEach(a => {
        if (a.startDate) {
            if (!minDate || a.startDate < minDate) {
                minDate = a.startDate;
            }
        }
    });
    return minDate;
  };

  const getTaskLatestEndDate = (task: ProjectTask): Date | null => {
      let maxEndDate: Date | null = null;
      task.assignments.forEach(a => {
          if (a.startDate && a.duration) {
              const endDateStr = calculateEndDate(a.startDate, a.duration, holidaySet);
              const endDate = new Date(endDateStr.replace(/-/g, '/'));
              if (!maxEndDate || endDate > maxEndDate) {
                  maxEndDate = endDate;
              }
          }
      });
      return maxEndDate;
  };

  const getModuleLatestEndDate = (module: ProjectModule): Date | null => { let maxEndDate: Date | null = null; module.tasks.forEach(task => { const taskEndDate = getTaskLatestEndDate(task); if (taskEndDate && (!maxEndDate || taskEndDate > maxEndDate)) { maxEndDate = taskEndDate; } }); return maxEndDate; }
  const getModuleEarliestStartDate = (module: ProjectModule): string | null => { let minDate: string | null = null; module.tasks.forEach(task => { const taskStartDate = getTaskEarliestStartDate(task); if (taskStartDate && (!minDate || taskStartDate < minDate)) { minDate = taskStartDate; } }); return minDate; }
  
  const totalDevelopmentFP = useMemo(() => {
    return modules
        .filter(m => (m.type || ModuleType.Development) === ModuleType.Development)
        .reduce((total, devModule) => {
            const feFP = devModule.tasks.reduce((s, t) => s + (t.frontendFunctionPoints || 0), 0);
            const beFP = devModule.tasks.reduce((s, t) => s + (t.backendFunctionPoints || 0), 0);
            return total + feFP + beFP;
        }, 0);
  }, [modules]);

  const moduleCalculations = useMemo(() => {
    const calcMap = new Map<string, any>();
    modules.forEach(m => {
        const moduleType = m.type || ModuleType.Development;
        const isDev = moduleType === ModuleType.Development;

        let moduleFeFp = 0;
        let moduleBeFp = 0;

        if (isDev) {
            moduleFeFp = m.tasks.reduce((s, t) => s + (t.frontendFunctionPoints || 0), 0);
            moduleBeFp = m.tasks.reduce((s, t) => s + (t.backendFunctionPoints || 0), 0);
        }

        let modulePrepFp = 0;
        let modulePrepEffort = 0;

        if (!isDev) {
            modulePrepFp = m.tasks.reduce((s, t) => s + (t.frontendFunctionPoints || 0), 0);
            m.tasks.forEach(t => { 
                const taskVel = t.frontendVelocity ?? m.prepVelocity ?? 10; 
                const taskComp = t.frontendComplexity ?? m.complexity ?? 'Medium'; 
                modulePrepEffort += (t.frontendFunctionPoints ?? 0) > 0 ? Math.ceil(((t.frontendFunctionPoints ?? 0) / taskVel) * COMPLEXITY_MULTIPLIERS[taskComp]) : 0; 
            });
        }
        
        // Effort & Duration Calculations
        const prepTeamSize = m.prepTeamSize || 2;
        const prepDuration = (modulePrepEffort > 0 && prepTeamSize > 0) ? Math.ceil(modulePrepEffort / prepTeamSize) : 0;

        let moduleFeEffort = 0, moduleBeEffort = 0;
        if (isDev) { 
            m.tasks.forEach(t => { 
                const taskFeVel = t.frontendVelocity ?? m.frontendVelocity ?? 5; 
                const taskFeComp = t.frontendComplexity ?? m.frontendComplexity ?? 'Medium'; 
                moduleFeEffort += (t.frontendFunctionPoints ?? 0) > 0 ? Math.ceil(((t.frontendFunctionPoints ?? 0) / taskFeVel) * COMPLEXITY_MULTIPLIERS[taskFeComp]) : 0; 
                
                const taskBeVel = t.backendVelocity ?? m.backendVelocity ?? 5; 
                const taskBeComp = t.backendComplexity ?? m.backendComplexity ?? 'Medium'; 
                moduleBeEffort += (t.backendFunctionPoints ?? 0) > 0 ? Math.ceil(((t.backendFunctionPoints ?? 0) / taskBeVel) * COMPLEXITY_MULTIPLIERS[taskBeComp]) : 0; 
            }); 
        }
        const feTeam = m.frontendTeamSize || 2; 
        const feDuration = (moduleFeEffort > 0 && feTeam > 0) ? Math.ceil(moduleFeEffort / feTeam) : 0;
        const beTeam = m.backendTeamSize || 2; 
        const beDuration = (moduleBeEffort > 0 && beTeam > 0) ? Math.ceil(moduleBeEffort / beTeam) : 0;
        
        // Delivery Date Calculations
        const totalDuration = Math.max(prepDuration, feDuration, beDuration);
        const hasEffort = modulePrepFp > 0 || moduleFeFp > 0 || moduleBeFp > 0;
        
        let baseStartDate = m.startDate || null; 
        let isTaskBased = false; 
        let startTaskName = '';
        if (!baseStartDate && m.startTaskId) { 
            const taskInfo = allTasksMap.get(m.startTaskId); 
            if (taskInfo) { 
                const minStart = getTaskEarliestStartDate(taskInfo.task); 
                if (minStart) { baseStartDate = minStart; isTaskBased = true; startTaskName = taskInfo.task.name; } 
            } 
        }
        if (!baseStartDate) { 
            baseStartDate = getModuleEarliestStartDate(m); 
        }

        let estimatedDateStr: string | null = null;
        if (hasEffort && baseStartDate) { 
            if (totalDuration > 0) { 
                estimatedDateStr = calculateEndDate(baseStartDate, totalDuration, holidaySet); 
            } else if (baseStartDate) { 
                estimatedDateStr = formatDateForInput(new Date(baseStartDate.replace(/-/g, '/'))); 
            } 
        }
        const plannerDateObj = getModuleLatestEndDate(m);
        const plannerDateStr = plannerDateObj ? formatDateForInput(plannerDateObj) : null;
        
        let varianceStatus: 'safe' | 'risk' | 'unknown' = 'unknown'; 
        let varianceText = '-'; 
        let varianceClass = 'text-slate-300';
        if (estimatedDateStr && plannerDateStr) { 
            if (estimatedDateStr <= plannerDateStr) { 
                varianceStatus = 'safe'; 
                let diff = calculateWorkingDaysBetween(estimatedDateStr, plannerDateStr, holidaySet) - 1; 
                if(estimatedDateStr === plannerDateStr) diff = 0; 
                const savedDays = -diff; 
                varianceText = `${savedDays}d`; 
                varianceClass = 'text-green-600 font-bold'; 
            } else { 
                varianceStatus = 'risk'; 
                const diff = calculateWorkingDaysBetween(plannerDateStr, estimatedDateStr, holidaySet) - 1; 
                varianceText = `+${diff}d`; 
                varianceClass = 'text-red-600 font-bold'; 
            } 
        }
        let cellBgClass = 'bg-transparent'; 
        if (varianceStatus === 'risk') cellBgClass = 'bg-red-50/50'; 
        if (varianceStatus === 'safe') cellBgClass = 'bg-green-50/50';

        calcMap.set(m.id, {
            moduleFeFp, moduleBeFp, modulePrepFp,
            modulePrepEffort, moduleFeEffort, moduleBeEffort,
            prepDuration, feDuration, beDuration,
            baseStartDate, isTaskBased, startTaskName,
            estimatedDateStr, plannerDateStr,
            varianceStatus, varianceText, varianceClass, cellBgClass,
        });
    });
    return calcMap;
  }, [modules, holidaySet, allTasksMap, totalDevelopmentFP]);

  const groupedTotalsMap = useMemo(() => {
    const subtotals: Record<string, any> = {};

    modules.forEach(m => {
        const moduleType = m.type || ModuleType.Development;
        const calcs = moduleCalculations.get(m.id);
        if (!calcs) return;

        if (!subtotals[moduleType]) {
            subtotals[moduleType] = { prepEffort: 0, feEffort: 0, beEffort: 0, prepDuration: 0, feDuration: 0, beDuration: 0, feFP: 0, beFP: 0, refFP: 0 };
        }

        subtotals[moduleType].prepEffort += calcs.modulePrepEffort;
        subtotals[moduleType].feEffort += calcs.moduleFeEffort;
        subtotals[moduleType].beEffort += calcs.moduleBeEffort;
        subtotals[moduleType].prepDuration += calcs.prepDuration;
        subtotals[moduleType].feDuration += calcs.feDuration;
        subtotals[moduleType].beDuration += calcs.beDuration;
        subtotals[moduleType].feFP += calcs.moduleFeFp;
        subtotals[moduleType].beFP += calcs.moduleBeFp;
        subtotals[moduleType].refFP += calcs.modulePrepFp;
    });

    return subtotals;
  }, [modules, moduleCalculations]);


  const toggleModuleExpansion = (moduleId: string) => {
    setExpandedModules(prev => ({ ...prev, [moduleId]: !prev[moduleId] }));
  };

  const handleDragStart = (e: React.DragEvent, index: number) => { if (isReadOnly) return; e.dataTransfer.setData("text/plain", index.toString()); setDraggedIndex(index); };
  const handleDragOver = (e: React.DragEvent) => { if (isReadOnly) return; e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, index: number) => { if (isReadOnly) return; e.preventDefault(); const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); if (!isNaN(startIndex) && startIndex !== index) { onReorderModules(selectedProjectId, startIndex, index); } setDraggedIndex(null); };

  const formatWeeks = (days: number) => { if (!days || isNaN(days)) return '0.0w'; const weeks = (days / 5).toFixed(1); return `${weeks}w`; };

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
                <col className="w-12" />  {/* Cpx */}
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
                    <th className="py-2 px-2 border-b border-slate-200 border-r text-left truncate bg-slate-50">Module / Task</th>
                    <th colSpan={6} className="py-1 px-1 text-center bg-amber-50/80 border-b border-amber-100 border-r border-slate-200 text-amber-800">Preparation</th>
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
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Cpx</th>
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
            <tbody className="text-[11px]">
                {modules.length === 0 && (
                    <tr><td colSpan={23} className="p-12 text-center text-slate-400 bg-slate-50/30"><div className="flex flex-col items-center justify-center gap-2"><Layers className="w-8 h-8 text-slate-300"/><p>No modules found.</p></div></td></tr>
                )}
                {modules.map((m, index) => {
                    const moduleType = m.type || ModuleType.Development;
                    const isDev = moduleType === ModuleType.Development;
                    const typeStyle = MODULE_TYPE_STYLES[moduleType];
                    const Icon = typeStyle.icon;
                    const isExpanded = !!expandedModules[m.id];
                    const calcs = moduleCalculations.get(m.id);
                    
                    if (!calcs) return null;

                    const { 
                        moduleFeFp, moduleBeFp, modulePrepFp,
                        prepDuration, feDuration, beDuration,
                        baseStartDate, isTaskBased, startTaskName,
                        estimatedDateStr, plannerDateStr,
                        varianceStatus, varianceText, varianceClass, cellBgClass,
                    } = calcs;
                    
                    const baseInputClass = "w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500";
                    
                    const isLastOfType = (index === modules.length - 1) || (moduleType !== (modules[index + 1].type || ModuleType.Development));
                    
                    const SubtotalRow = () => {
                        const subtotal = groupedTotalsMap[moduleType];
                        if (!subtotal) return null;

                        const modulesOfType = modules.filter(mod => (mod.type || ModuleType.Development) === moduleType);

                        let subtotalMaxEstDate: Date | null = null;
                        let subtotalMaxPlanDate: Date | null = null;
                        modulesOfType.forEach(mod => {
                            const modCalcs = moduleCalculations.get(mod.id);
                            if (modCalcs?.estimatedDateStr) { const estDate = new Date(modCalcs.estimatedDateStr.replace(/-/g, '/')); if (!subtotalMaxEstDate || estDate > subtotalMaxEstDate) subtotalMaxEstDate = estDate; }
                            if (modCalcs?.plannerDateStr) { const planDate = new Date(modCalcs.plannerDateStr.replace(/-/g, '/')); if (!subtotalMaxPlanDate || planDate > subtotalMaxPlanDate) subtotalMaxPlanDate = planDate; }
                        });

                        let subtotalVarianceText = '-';
                        let subtotalVarianceClass = 'text-slate-400';
                        if (subtotalMaxEstDate && subtotalMaxPlanDate) {
                            const estStr = formatDateForInput(subtotalMaxEstDate); const planStr = formatDateForInput(subtotalMaxPlanDate);
                            if (estStr <= planStr) { let diff = calculateWorkingDaysBetween(estStr, planStr, holidaySet) - 1; if(estStr === planStr) diff = 0; subtotalVarianceText = `${-diff}d`; subtotalVarianceClass = 'text-green-600 font-bold'; } else { const diff = calculateWorkingDaysBetween(planStr, estStr, holidaySet) - 1; subtotalVarianceText = `+${diff}d`; subtotalVarianceClass = 'text-red-600 font-bold'; }
                        }

                        return (
                            <tr key={`${moduleType}-subtotal`} className="bg-slate-100 font-semibold text-[10px] border-t border-b-2 border-slate-200">
                                <td colSpan={2} className="px-2 py-1.5 text-right text-slate-500 uppercase">{MODULE_TYPE_DISPLAY_NAMES[moduleType as ModuleType]}<br/>Sub-total</td>
                                <td className="text-center text-slate-700">{subtotal.refFP || '-'}</td>
                                <td colSpan={4} className="text-center text-slate-300">-</td>
                                <td className="text-center text-amber-700 border-r border-slate-200">{formatWeeks(subtotal.prepDuration)}</td>
                                <td className="text-center text-slate-700">{subtotal.feFP || '-'}</td>
                                <td colSpan={4} className="text-center text-slate-300">-</td>
                                <td className="text-center text-blue-700 border-r border-slate-200">{formatWeeks(subtotal.feDuration)}</td>
                                <td className="text-center text-slate-700">{subtotal.beFP || '-'}</td>
                                <td colSpan={4} className="text-center text-slate-300">-</td>
                                <td className="text-center text-indigo-700 border-r border-slate-200">{formatWeeks(subtotal.beDuration)}</td>
                                <td colSpan={1} className="text-center text-slate-400 border-r border-slate-200"></td>
                                <td className="px-1 py-1 text-right">
                                    <div className="flex flex-col gap-0.5 justify-center h-full text-[9px]"><div className="flex items-center justify-between gap-2 text-slate-500"><span>Max Est:</span><span className="font-mono">{subtotalMaxEstDate ? subtotalMaxEstDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div><div className="flex items-center justify-between gap-2 text-slate-600 font-bold"><span>Max Plan:</span><span className="font-mono">{subtotalMaxPlanDate ? subtotalMaxPlanDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div></div>
                                </td>
                                <td className="px-1 text-center border-r border-slate-200"><span className={`text-xs font-mono ${subtotalVarianceClass}`}>{subtotalVarianceText}</span></td>
                            </tr>
                        );
                    };

                    return (
                        <React.Fragment key={m.id}>
                            <tr draggable={!isReadOnly} onDragStart={(e) => handleDragStart(e, index)} onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, index)} className={`hover:bg-slate-50 transition-colors group ${draggedIndex === index ? 'opacity-40' : ''} ${typeStyle.rowBg}`} onContextMenu={(e) => { if (isReadOnly) return; e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.pageX, y: e.pageY, moduleId: m.id }); }}>
                                <td className="text-center text-slate-300 cursor-grab active:cursor-grabbing border-b border-slate-100"><div className="flex justify-center group-hover:text-slate-500">{!isReadOnly && <GripVertical size={12} />}</div></td>
                                <td className="px-2 py-1.5 border-b border-slate-100 border-r border-slate-200"><div className="flex items-center gap-1.5">{m.tasks.length > 0 && <button onClick={() => toggleModuleExpansion(m.id)} className="p-0.5 rounded hover:bg-black/5">{isExpanded ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}</button>}<Icon size={14} className="text-slate-400" title={MODULE_TYPE_DISPLAY_NAMES[moduleType]} /><span className="font-medium text-slate-700 truncate block w-full" title={m.name}>{m.name}</span></div></td>
                                
                                <td className="p-0 border-b border-slate-100"><EstimatorNumberInput rowIndex={index * 1000} colIndex={0} onNavigate={handleNavigate} className={`${baseInputClass} font-bold disabled:bg-slate-50`} value={modulePrepFp} onChange={() => {}} disabled={true} /></td>
                                <td colSpan={4} className="text-center text-slate-300 border-b border-slate-100">-</td>
                                <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-amber-700 font-medium">{formatWeeks(prepDuration)}</td>

                                <td className="p-0 border-b border-slate-100"><EstimatorNumberInput rowIndex={index * 1000} colIndex={3} onNavigate={handleNavigate} className={`${baseInputClass} font-bold text-slate-800 disabled:bg-slate-50`} value={moduleFeFp} onChange={() => {}} disabled={true} /></td>
                                <td colSpan={4} className="text-center text-slate-300 border-b border-slate-100">-</td>
                                <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-blue-700 font-medium">{formatWeeks(feDuration)}</td>

                                <td className="p-0 border-b border-slate-100"><EstimatorNumberInput rowIndex={index * 1000} colIndex={6} onNavigate={handleNavigate} className={`${baseInputClass} font-bold text-slate-800 disabled:bg-slate-50`} value={moduleBeFp} onChange={() => {}} disabled={true} /></td>
                                <td colSpan={4} className="text-center text-slate-300 border-b border-slate-100">-</td>
                                <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-indigo-700 font-medium">{formatWeeks(beDuration)}</td>

                                <td className="p-0 border-b border-slate-100 bg-slate-50/30 relative group/start">{!isReadOnly && <div className="absolute inset-0 opacity-0 group-hover/start:opacity-100 transition-opacity bg-white/95 flex items-center justify-center shadow-sm z-20"><div className="relative w-full h-full"><select className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" value={m.startTaskId || (m.startDate ? 'manual' : '')} onChange={(e) => { const val = e.target.value; if (val === 'manual' || val === '') { onUpdateModuleStartTask(selectedProjectId, m.id, null); if(val === '') { onUpdateModuleStartDate(selectedProjectId, m.id, null); } } else { onUpdateModuleStartTask(selectedProjectId, m.id, val); } }}><option value="">- Auto (Earliest) -</option><option value="manual">- Manual Date -</option>{selectedProject?.modules.map(mod => (<optgroup label={mod.name} key={mod.id}>{mod.tasks.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}</optgroup>))}</select><div className="w-full h-full flex flex-col items-center justify-center text-[9px] text-indigo-600 pointer-events-none p-1"><Link2 size={10} /> <span className="truncate w-full text-center">Change Source</span></div></div></div>}<div className="w-full h-full flex flex-col items-center justify-center text-[10px] relative z-10 px-1">{isTaskBased ? ( <> <span className="text-indigo-700 font-bold truncate w-full text-center" title={`Starts with: ${startTaskName}`}>{startTaskName}</span> <span className="text-[9px] text-slate-400">{baseStartDate ? new Date(baseStartDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : '-'}</span> </> ) : ( <> <input type="date" disabled={isReadOnly} className={`w-full bg-transparent text-center focus:outline-none ${m.startDate ? 'text-indigo-700 font-bold' : 'text-slate-500'} ${isReadOnly ? 'cursor-default' : ''}`} value={m.startDate || (baseStartDate || '')} onChange={(e) => onUpdateModuleStartDate(selectedProjectId, m.id, e.target.value)} /> {!m.startDate && baseStartDate && <span className="text-[8px] text-slate-300 absolute bottom-0.5 right-1">Auto</span>} </> )}</div></td>
                                <td className={`px-1 border-b border-slate-100 text-right align-middle ${cellBgClass}`}><div className="flex flex-col gap-0.5 py-1 px-1 h-full justify-center"><div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 border-b border-slate-200/50 pb-0.5"><span>Est:</span><span className="font-mono">{estimatedDateStr ? new Date(estimatedDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div><div className={`flex items-center justify-between gap-2 text-[10px] font-bold ${varianceStatus === 'safe' ? 'text-green-700' : varianceStatus === 'risk' ? 'text-red-700' : 'text-slate-600'}`}><div className="flex items-center gap-1"><span>Plan:</span>{varianceStatus === 'risk' && <AlertCircle size={8} />}{varianceStatus === 'safe' && <CheckCircle2 size={8} />}</div><span className="font-mono" title="Latest task end date">{plannerDateStr ? new Date(plannerDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}</span></div></div></td>
                                <td className={`px-1 border-b border-slate-100 text-center align-middle border-r border-slate-200 ${cellBgClass}`}><span className={`text-[10px] font-mono ${varianceClass}`}>{varianceText}</span></td>
                            </tr>
                            {isExpanded && m.tasks.map((task, taskIndex) => {
                                 const taskFeVel = task.frontendVelocity ?? m.frontendVelocity ?? 5; const taskFeTeam = task.frontendTeamSize ?? (task.assignments.length > 0 ? task.assignments.length : m.frontendTeamSize) ?? 2; const taskFeComp = task.frontendComplexity ?? m.frontendComplexity ?? 'Medium'; const taskFeEffort = (task.frontendFunctionPoints ?? 0) > 0 ? Math.ceil(((task.frontendFunctionPoints ?? 0) / taskFeVel) * COMPLEXITY_MULTIPLIERS[taskFeComp]) : 0; 
                                 const taskFeDuration = (taskFeEffort > 0 && taskFeTeam > 0) ? Math.ceil(taskFeEffort / taskFeTeam) : 0;
                                 const taskBeVel = task.backendVelocity ?? m.backendVelocity ?? 5; const taskBeTeam = task.backendTeamSize ?? (task.assignments.length > 0 ? task.assignments.length : m.backendTeamSize) ?? 2; const taskBeComp = task.backendComplexity ?? m.backendComplexity ?? 'Medium'; const taskBeEffort = (task.backendFunctionPoints ?? 0) > 0 ? Math.ceil(((task.backendFunctionPoints ?? 0) / taskBeVel) * COMPLEXITY_MULTIPLIERS[taskBeComp]) : 0; 
                                 const taskBeDuration = (taskBeEffort > 0 && taskBeTeam > 0) ? Math.ceil(taskBeEffort / taskBeTeam) : 0;
                                 
                                 const taskPrepVel = task.frontendVelocity ?? m.prepVelocity ?? 10; const taskPrepTeam = task.frontendTeamSize ?? (task.assignments.length > 0 ? task.assignments.length : m.prepTeamSize) ?? 2; const taskPrepComp = task.frontendComplexity ?? m.complexity ?? 'Medium'; const taskPrepEffort = (task.frontendFunctionPoints ?? 0) > 0 ? Math.ceil(((task.frontendFunctionPoints ?? 0) / taskPrepVel) * COMPLEXITY_MULTIPLIERS[taskPrepComp]) : 0; 
                                 const taskPrepDuration = (taskPrepEffort > 0 && taskPrepTeam > 0) ? Math.ceil(taskPrepEffort / taskPrepTeam) : 0;

                                 const taskTotalDuration = isDev ? Math.max(taskFeDuration, taskBeDuration) : taskPrepDuration;
                                 const plannerTaskStartDate = getTaskEarliestStartDate(task);
                                 const effectiveTaskStartDate = task.startDate || plannerTaskStartDate;
                                 const taskPlannedEndDate = getTaskLatestEndDate(task);
                                 let taskEstimatedEndDateStr: string | null = null;
                                 if (effectiveTaskStartDate && taskTotalDuration > 0) { taskEstimatedEndDateStr = calculateEndDate(effectiveTaskStartDate, taskTotalDuration, holidaySet); } else if (effectiveTaskStartDate) { taskEstimatedEndDateStr = effectiveTaskStartDate; }
                                 const taskPlannerDateStr = taskPlannedEndDate ? formatDateForInput(taskPlannedEndDate) : null;
                                 let taskVarianceStatus: 'safe' | 'risk' | 'unknown' = 'unknown'; let taskVarianceText = '-'; let taskVarianceClass = 'text-slate-400';
                                 if (taskEstimatedEndDateStr && taskPlannerDateStr) { if (taskEstimatedEndDateStr <= taskPlannerDateStr) { taskVarianceStatus = 'safe'; let diff = calculateWorkingDaysBetween(taskEstimatedEndDateStr, taskPlannerDateStr, holidaySet) - 1; if(taskEstimatedEndDateStr === taskPlannerDateStr) diff = 0; taskVarianceText = `${-diff}d`; taskVarianceClass = 'text-green-600 font-bold'; } else { taskVarianceStatus = 'risk'; const diff = calculateWorkingDaysBetween(taskPlannerDateStr, taskEstimatedEndDateStr, holidaySet) - 1; taskVarianceText = `+${diff}d`; taskVarianceClass = 'text-red-600 font-bold'; } }
                                 const taskCellBg = taskVarianceStatus === 'risk' ? 'bg-red-50/30' : taskVarianceStatus === 'safe' ? 'bg-green-50/30' : '';
                                return (
                                <tr key={task.id} className="bg-slate-50/50 hover:bg-slate-100/50">
                                    <td className="border-b border-slate-100"></td>
                                    <td className="pl-8 pr-2 py-1 text-xs text-slate-600 border-b border-slate-100 border-r border-slate-200">
                                        <div className="flex items-center gap-2 relative