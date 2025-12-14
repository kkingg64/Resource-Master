import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel, Holiday, Role } from '../types';
import { Calculator, GripVertical, ArrowRight, Layout, Server, ChevronDown, Calendar as CalendarIcon, Link2 } from 'lucide-react';
import { calculateEndDate, formatDateForInput } from '../constants';

interface EstimatorProps {
  projects: Project[];
  holidays: Holiday[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => void;
  onUpdateModuleStartDate: (projectId: string, moduleId: string, startDate: string | null) => void;
  onUpdateModuleDeliveryTask: (projectId: string, moduleId: string, deliveryTaskId: string | null) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
}

const COMPLEXITY_MULTIPLIERS: Record<ComplexityLevel, number> = {
  'Low': 1.0,
  'Medium': 1.2,
  'High': 1.5,
  'Complex': 2.0
};

const ComplexitySelect: React.FC<{ value: ComplexityLevel, onChange: (val: ComplexityLevel) => void }> = ({ value, onChange }) => {
    return (
        <div className="relative w-full h-full flex items-center justify-center group cursor-pointer bg-white/50 hover:bg-white border border-transparent hover:border-slate-300 rounded px-1 transition-colors">
            <div className="flex items-center gap-0.5 pointer-events-none z-0">
                <span className={`text-[10px] font-bold ${
                    value === 'Low' ? 'text-green-600' :
                    value === 'Medium' ? 'text-blue-600' :
                    value === 'High' ? 'text-orange-600' :
                    'text-red-600'
                }`}>
                    {value.charAt(0)}
                </span>
                <ChevronDown size={8} className="text-slate-300 group-hover:text-slate-500" />
            </div>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value as ComplexityLevel)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 appearance-none"
                title={`Current: ${value} (${COMPLEXITY_MULTIPLIERS[value]}x)`}
            >
                <option value="Low">Low (1x)</option>
                <option value="Medium">Medium (1.2x)</option>
                <option value="High">High (1.5x)</option>
                <option value="Complex">Complex (2x)</option>
            </select>
        </div>
    );
};

export const Estimator: React.FC<EstimatorProps> = ({ projects, holidays, onUpdateFunctionPoints, onUpdateModuleComplexity, onUpdateModuleStartDate, onUpdateModuleDeliveryTask, onReorderModules }) => {
  const [feVelocity, setFeVelocity] = useState<number>(5);
  const [feTeamSize, setFeTeamSize] = useState<number>(2);
  const [beVelocity, setBeVelocity] = useState<number>(5);
  const [beTeamSize, setBeTeamSize] = useState<number>(2);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);
  
  useEffect(() => {
    let currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject && projects.length > 0) {
        setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const modules = selectedProject ? selectedProject.modules : [];

  const totals = useMemo(() => {
    let totalLegacyFP = 0;
    let totalFeFP = 0;
    let totalBeFP = 0;
    
    let totalPrepEffort = 0;
    let totalFeEffort = 0;
    let totalBeEffort = 0;

    let totalPrepDuration = 0;
    let totalFeDuration = 0;
    let totalBeDuration = 0;

    modules.forEach(m => {
        totalLegacyFP += (m.legacyFunctionPoints || 0);
        const prepVelocity = m.prepVelocity || 10;
        const prepTeamSize = m.prepTeamSize || 2;
        const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
        totalPrepEffort += prepEffort;
        totalPrepDuration += Math.ceil(prepEffort / prepTeamSize);

        const feFP = m.frontendFunctionPoints || 0;
        const feComp = m.frontendComplexity || 'Medium';
        totalFeFP += feFP;
        const feEffort = Math.ceil((feFP / feVelocity) * COMPLEXITY_MULTIPLIERS[feComp]);
        totalFeEffort += feEffort;
        totalFeDuration += Math.ceil(feEffort / feTeamSize);

        const beFP = m.backendFunctionPoints || 0;
        const beComp = m.backendComplexity || 'Medium';
        totalBeFP += beFP;
        const beEffort = Math.ceil((beFP / beVelocity) * COMPLEXITY_MULTIPLIERS[beComp]);
        totalBeEffort += beEffort;
        totalBeDuration += Math.ceil(beEffort / beTeamSize);
    });

    return {
        legacyFP: totalLegacyFP,
        feFP: totalFeFP,
        beFP: totalBeFP,
        prepEffort: totalPrepEffort,
        feEffort: totalFeEffort,
        beEffort: totalBeEffort,
        prepDuration: totalPrepDuration,
        feDuration: totalFeDuration,
        beDuration: totalBeDuration,
        totalDuration: totalPrepDuration + Math.max(totalFeDuration, totalBeDuration)
    };
  }, [modules, feVelocity, feTeamSize, beVelocity, beTeamSize]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData("text/plain", index.toString());
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const startIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
    if (!isNaN(startIndex) && startIndex !== index) {
      onReorderModules(selectedProjectId, startIndex, index);
    }
    setDraggedIndex(null);
  };

  const formatWeeks = (days: number) => {
    if (!days || isNaN(days)) return '0.0w';
    const weeks = (days / 5).toFixed(1);
    return `${weeks}w`;
  };

  // Helper to find the max end date of a specific task
  const getTaskEndDate = (module: ProjectModule, taskId: string): string | null => {
      const task = module.tasks.find(t => t.id === taskId);
      if (!task) return null;
      
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
      return maxEndDate ? formatDateForInput(maxEndDate) : null;
  };


  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-4 h-4 text-indigo-600" />
                Effort Estimator
            </h2>
            <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Project:</span>
                <select 
                    className="text-xs border-slate-300 rounded focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 border py-1 pl-2 pr-6 h-7"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
        </div>

        <div className="flex gap-4">
            {/* FE Settings */}
            <div className="flex items-center gap-2 bg-blue-50/50 px-3 py-1.5 rounded border border-blue-100">
                <div className="flex items-center gap-1.5 border-r border-blue-200 pr-2 mr-1">
                    <Layout size={12} className="text-blue-600" />
                    <span className="text-[10px] font-bold text-blue-700 uppercase">FE</span>
                </div>
                <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Vel:</label>
                    <input type="number" min="1" value={feVelocity} onChange={(e) => setFeVelocity(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 p-0.5 text-center text-xs border border-blue-200 rounded h-6"/>
                </div>
                <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Team:</label>
                    <input type="number" min="1" value={feTeamSize} onChange={(e) => setFeTeamSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 p-0.5 text-center text-xs border border-blue-200 rounded h-6"/>
                </div>
            </div>

            {/* BE Settings */}
            <div className="flex items-center gap-2 bg-indigo-50/50 px-3 py-1.5 rounded border border-indigo-100">
                <div className="flex items-center gap-1.5 border-r border-indigo-200 pr-2 mr-1">
                    <Server size={12} className="text-indigo-600" />
                    <span className="text-[10px] font-bold text-indigo-700 uppercase">BE</span>
                </div>
                <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Vel:</label>
                    <input type="number" min="1" value={beVelocity} onChange={(e) => setBeVelocity(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 p-0.5 text-center text-xs border border-indigo-200 rounded h-6"/>
                </div>
                <div className="flex items-center gap-1">
                    <label className="text-[10px] text-slate-500">Team:</label>
                    <input type="number" min="1" value={beTeamSize} onChange={(e) => setBeTeamSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-8 p-0.5 text-center text-xs border border-indigo-200 rounded h-6"/>
                </div>
            </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto bg-white relative">
        <table className="w-full text-left border-collapse table-fixed">
            <colgroup>
                <col className="w-8" />   {/* Drag */}
                <col className="w-48" />  {/* Module Name */}
                
                {/* Prep: 5 cols */}
                <col className="w-14" />  {/* L.FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}

                {/* FE: 4 cols */}
                <col className="w-14" />  {/* FE FP */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}

                {/* BE: 4 cols */}
                <col className="w-14" />  {/* BE FP */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}

                {/* Delivery: 2 cols */}
                <col className="w-24" />  {/* Start */}
                <col className="w-24" />  {/* ETA / Delivery Task */}
            </colgroup>
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider sticky top-0 z-20 shadow-sm font-semibold">
                <tr>
                    <th className="py-2 border-b border-slate-200 bg-slate-50"></th>
                    <th className="py-2 px-2 border-b border-slate-200 border-r text-left truncate bg-slate-50">Module</th>
                    <th colSpan={5} className="py-1 px-1 text-center bg-amber-50/80 border-b border-amber-100 border-r border-slate-200 text-amber-800">Preparation</th>
                    <th colSpan={4} className="py-1 px-1 text-center bg-blue-50/80 border-b border-blue-100 border-r border-slate-200 text-blue-800">Front-End</th>
                    <th colSpan={4} className="py-1 px-1 text-center bg-indigo-50/80 border-b border-indigo-100 border-r border-slate-200 text-indigo-800">Back-End</th>
                    <th colSpan={2} className="py-2 px-2 text-center border-b border-slate-200 bg-slate-50">Delivery</th>
                </tr>
                <tr className="text-[9px] text-slate-500">
                    <th className="border-b border-slate-200 bg-slate-50"></th>
                    <th className="border-b border-slate-200 border-r bg-slate-50"></th>
                    
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Legacy</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Vel</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">Team</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-amber-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-amber-50/30">Wks</th>

                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">FP</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">Cpx</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-blue-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-blue-50/30">Wks</th>

                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">FP</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">Cpx</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-indigo-50/30">M.D.</th>
                    <th className="py-1 text-center border-b border-slate-200 border-r bg-indigo-50/30">Wks</th>
                    
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">Start</th>
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">ETA / Task</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
                {modules.length === 0 && (
                    <tr>
                        <td colSpan={17} className="p-12 text-center text-slate-400 bg-slate-50/30">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Layout className="w-8 h-8 text-slate-300"/>
                                <p>No modules found.</p>
                            </div>
                        </td>
                    </tr>
                )}
                {modules.map((m, index) => {
                    const prepVelocity = m.prepVelocity || 10;
                    const prepTeamSize = m.prepTeamSize || 2;
                    const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
                    const prepDuration = Math.ceil(prepEffort / prepTeamSize);

                    const feFP = m.frontendFunctionPoints || 0;
                    const feComp = m.frontendComplexity || 'Medium';
                    const feEffort = Math.ceil((feFP / feVelocity) * COMPLEXITY_MULTIPLIERS[feComp]);
                    const feDuration = Math.ceil(feEffort / feTeamSize);

                    const beFP = m.backendFunctionPoints || 0;
                    const beComp = m.backendComplexity || 'Medium';
                    const beEffort = Math.ceil((beFP / beVelocity) * COMPLEXITY_MULTIPLIERS[beComp]);
                    const beDuration = Math.ceil(beEffort / beTeamSize);

                    const totalDuration = prepDuration + Math.max(feDuration, beDuration);
                    const devDuration = Math.max(feDuration, beDuration);
                    
                    let deliveryDate: string | null = null;
                    
                    // Logic: If manual delivery task is selected, use that.
                    // Else if start date override, calculate.
                    // Else calculate best guess.
                    
                    const manualDeliveryDate = m.deliveryTaskId ? getTaskEndDate(m, m.deliveryTaskId) : null;
                    
                    if (manualDeliveryDate) {
                        deliveryDate = manualDeliveryDate;
                    } else if (m.startDate) {
                        deliveryDate = calculateEndDate(m.startDate, totalDuration, holidaySet);
                    } else {
                        // ... default calculation logic ...
                         const devStartDate = m.tasks.reduce((min: string | null, task) => {
                                const hasDev = task.assignments.some(a => a.role === Role.DEV);
                                if (!hasDev) return min;
                                const taskMin = task.assignments
                                    .filter(a => a.role === Role.DEV)
                                    .reduce((tMin: string | null, assign) => {
                                        if (!assign.startDate) return tMin;
                                        if (!tMin || assign.startDate < tMin) return assign.startDate;
                                        return tMin;
                                    }, null);
                                if (!taskMin) return min;
                                if (!min || taskMin < min) return taskMin;
                                return min;
                            }, null);

                            if (devStartDate && devDuration > 0) {
                                deliveryDate = calculateEndDate(devStartDate, devDuration, holidaySet);
                            } else {
                                const moduleStartDate = m.tasks.reduce((min: string | null, task) => {
                                    const taskMin = task.assignments.reduce((tMin: string | null, assign) => {
                                        if (!assign.startDate) return tMin;
                                        if (!tMin || assign.startDate < tMin) return assign.startDate;
                                        return tMin;
                                    }, null);
                                    if (!taskMin) return min;
                                    if (!min || taskMin < min) return taskMin;
                                    return min;
                                }, null);

                                if (moduleStartDate && totalDuration > 0) {
                                    deliveryDate = calculateEndDate(moduleStartDate, totalDuration, holidaySet);
                                }
                            }
                    }

                    return (
                        <tr 
                            key={m.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, index)}
                            className={`hover:bg-slate-50 transition-colors group ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                        >
                            <td className="text-center text-slate-300 cursor-grab active:cursor-grabbing border-b border-slate-100">
                                <div className="flex justify-center group-hover:text-slate-500"><GripVertical size={12} /></div>
                            </td>
                            <td className="px-2 py-1.5 border-b border-slate-100 border-r border-slate-200">
                                <span className="font-medium text-slate-700 truncate block w-full" title={m.name}>{m.name}</span>
                            </td>
                            
                            {/* Prep */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.legacyFunctionPoints || 0} onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, parseInt(e.target.value) || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, prepVelocity, prepTeamSize)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                    <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={prepVelocity} onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, parseInt(e.target.value) || 1, prepTeamSize)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                    <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={prepTeamSize} onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, prepVelocity, parseInt(e.target.value) || 1)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{prepEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-amber-700 font-medium">{formatWeeks(prepDuration)}</td>

                            {/* FE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.frontendFunctionPoints || 0} onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, parseInt(e.target.value) || 0, m.backendFunctionPoints || 0, prepVelocity, prepTeamSize)} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={feComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'frontend', val)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{feEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-blue-700 font-medium">{formatWeeks(feDuration)}</td>

                            {/* BE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.backendFunctionPoints || 0} onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, parseInt(e.target.value) || 0, prepVelocity, prepTeamSize)} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={beComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'backend', val)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{beEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-indigo-700 font-medium">{formatWeeks(beDuration)}</td>

                            {/* Delivery */}
                            <td className="p-0 border-b border-slate-100 bg-slate-50/30">
                                <div className="relative w-full h-full">
                                    <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" value={m.startDate || ''} onChange={(e) => onUpdateModuleStartDate(selectedProjectId, m.id, e.target.value)} />
                                    <div className={`w-full h-full flex items-center justify-center text-[10px] ${m.startDate ? 'text-indigo-700 font-medium' : 'text-slate-300'}`}>
                                        {m.startDate ? new Date(m.startDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : <CalendarIcon size={12}/>}
                                    </div>
                                </div>
                            </td>
                            <td className="px-1 border-b border-slate-100 bg-slate-50/50 text-right relative group/delivery">
                                <div className="flex flex-col items-end leading-none py-1 h-full justify-center">
                                     {deliveryDate ? (
                                        <span className={`text-[10px] font-bold ${m.deliveryTaskId ? 'text-green-700' : 'text-indigo-700'}`}>
                                            {new Date(deliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </span>
                                    ) : <span className="text-slate-300">-</span>}
                                    
                                    {/* Task Picker Overlay */}
                                    <div className="absolute inset-0 opacity-0 group-hover/delivery:opacity-100 transition-opacity bg-white/90 flex items-center justify-center">
                                         <div className="relative w-full h-full">
                                            <select 
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                                value={m.deliveryTaskId || ''}
                                                onChange={(e) => onUpdateModuleDeliveryTask(selectedProjectId, m.id, e.target.value || null)}
                                            >
                                                <option value="">- Auto Calculate -</option>
                                                {m.tasks.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                            <div className="w-full h-full flex items-center justify-center gap-1 text-[9px] text-slate-500 pointer-events-none">
                                                <Link2 size={10} /> {m.deliveryTaskId ? 'Mapped' : 'Auto'}
                                            </div>
                                         </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold text-[10px] border-t border-slate-200 sticky bottom-0 z-20 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                 <tr>
                    <td colSpan={2} className="px-2 py-2 text-right text-slate-500 uppercase">Totals</td>
                    <td className="text-center text-slate-700">{totals.legacyFP}</td>
                    <td colSpan={2} className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.prepEffort}</td>
                    <td className="text-center text-amber-700 border-r border-slate-300">{formatWeeks(totals.prepDuration)}</td>
                    <td className="text-center text-slate-700">{totals.feFP}</td>
                    <td className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.feEffort}</td>
                    <td className="text-center text-blue-700 border-r border-slate-300">{formatWeeks(totals.feDuration)}</td>
                    <td className="text-center text-slate-700">{totals.beFP}</td>
                    <td className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.beEffort}</td>
                    <td className="text-center text-indigo-700 border-r border-slate-300">{formatWeeks(totals.beDuration)}</td>
                    <td colSpan={2}></td>
                </tr>
            </tfoot>
        </table>
      </div>
      
      {/* Footer Info */}
      <div className="bg-slate-50 border-t border-slate-200 p-2 text-[10px] text-slate-400 text-center flex justify-between items-center px-4">
          <span>* FE/BE in parallel</span>
          <span>* Auto-calculates based on planner if date not set</span>
      </div>
    </div>
  );
};