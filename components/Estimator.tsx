import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel, Holiday, Role } from '../types';
import { Calculator, GripVertical, BarChart3, Users, HelpCircle, ArrowRight, Gauge, CalendarDays, Code, Layout, Server, ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { calculateEndDate, formatDateForInput } from '../constants';

interface EstimatorProps {
  projects: Project[];
  holidays: Holiday[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => void;
  onUpdateModuleStartDate: (projectId: string, moduleId: string, startDate: string | null) => void;
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
        <div className="relative w-full h-full flex items-center justify-center group cursor-pointer bg-white border border-transparent hover:border-slate-300 rounded px-1 transition-colors">
            {/* Display Layer */}
            <div className="flex items-center gap-1 pointer-events-none z-0">
                <span className={`text-[10px] font-bold ${
                    value === 'Low' ? 'text-green-600' :
                    value === 'Medium' ? 'text-blue-600' :
                    value === 'High' ? 'text-orange-600' :
                    'text-red-600'
                }`}>
                    {value.charAt(0)}
                </span>
                <ChevronDown size={10} className="text-slate-300 group-hover:text-slate-500" />
            </div>
            {/* Interaction Layer - Invisible Select */}
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

export const Estimator: React.FC<EstimatorProps> = ({ projects, holidays, onUpdateFunctionPoints, onUpdateModuleComplexity, onUpdateModuleStartDate, onReorderModules }) => {
  // Phase 2: Front-End (Still global)
  const [feVelocity, setFeVelocity] = useState<number>(5);
  const [feTeamSize, setFeTeamSize] = useState<number>(2);

  // Phase 3: Back-End (Still global)
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

  // Calculations
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
        // Prep - Per module config
        totalLegacyFP += (m.legacyFunctionPoints || 0);
        const prepVelocity = m.prepVelocity || 10;
        const prepTeamSize = m.prepTeamSize || 2;
        const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
        totalPrepEffort += prepEffort;
        totalPrepDuration += Math.ceil(prepEffort / prepTeamSize);

        // FE
        const feFP = m.frontendFunctionPoints || 0;
        const feComp = m.frontendComplexity || 'Medium';
        totalFeFP += feFP;
        const feEffort = Math.ceil((feFP / feVelocity) * COMPLEXITY_MULTIPLIERS[feComp]);
        totalFeEffort += feEffort;
        totalFeDuration += Math.ceil(feEffort / feTeamSize);

        // BE
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
        totalDuration: totalPrepDuration + Math.max(totalFeDuration, totalBeDuration) // Parallel dev
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
    const weeks = (days / 5).toFixed(1);
    return `${weeks}w`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      
      {/* Header / Settings Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col xl:flex-row xl:items-center justify-between gap-6 flex-shrink-0">
        <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                Effort Estimator
            </h2>
            <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-500">Project:</span>
                <select 
                    className="text-sm border-slate-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 border py-1 pl-2 pr-8"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>
        </div>

        {/* Global Settings Grouped by Phase */}
        <div className="flex flex-col md:flex-row gap-4 overflow-x-auto pb-2 xl:pb-0">
            
            {/* FE Settings */}
            <div className="flex items-center gap-3 bg-blue-50/50 p-2 rounded-lg border border-blue-100 min-w-max">
                <div className="px-2 border-r border-blue-200 flex items-center gap-1">
                    <Layout size={14} className="text-blue-600" />
                    <span className="text-xs font-bold text-blue-700 uppercase tracking-wider">Front-End</span>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Vel.</label>
                    <input type="number" min="1" value={feVelocity} onChange={(e) => setFeVelocity(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 p-1 text-xs border border-blue-200 rounded"/>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Team</label>
                    <input type="number" min="1" value={feTeamSize} onChange={(e) => setFeTeamSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 p-1 text-xs border border-blue-200 rounded"/>
                </div>
            </div>

            <ArrowRight className="text-slate-300 hidden md:block self-center flex-shrink-0" size={16} />

            {/* BE Settings */}
            <div className="flex items-center gap-3 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100 min-w-max">
                <div className="px-2 border-r border-indigo-200 flex items-center gap-1">
                    <Server size={14} className="text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Back-End</span>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Vel.</label>
                    <input type="number" min="1" value={beVelocity} onChange={(e) => setBeVelocity(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 p-1 text-xs border border-indigo-200 rounded"/>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Team</label>
                    <input type="number" min="1" value={beTeamSize} onChange={(e) => setBeTeamSize(Math.max(1, parseInt(e.target.value) || 1))} className="w-10 p-1 text-xs border border-indigo-200 rounded"/>
                </div>
            </div>

        </div>
      </div>

      {/* Main Content: Spreadsheet View */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-w-max">
            <table className="w-full text-sm text-left border-collapse table-fixed">
                <colgroup>
                    <col className="w-8" /> {/* Drag Handle */}
                    <col className="w-48" /> {/* Module Name */}
                    
                    {/* Prep */}
                    <col className="w-16" /> {/* Legacy FP */}
                    <col className="w-10" /> {/* Vel */}
                    <col className="w-10" /> {/* Team */}
                    <col className="w-12" /> {/* Effort */}
                    <col className="w-12" /> {/* Dur */}

                    {/* FE */}
                    <col className="w-16" /> {/* FE FP */}
                    <col className="w-14" /> {/* Diff */}
                    <col className="w-12" /> {/* Effort */}
                    <col className="w-12" /> {/* Dur */}

                    {/* BE */}
                    <col className="w-16" /> {/* BE FP */}
                    <col className="w-14" /> {/* Diff */}
                    <col className="w-12" /> {/* Effort */}
                    <col className="w-12" /> {/* Dur */}

                    {/* Delivery */}
                    <col className="w-28" /> {/* Start Date */}
                    <col className="w-24" /> {/* Est Date */}
                </colgroup>
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                        <th className="py-3 border-b border-slate-200"></th>
                        <th className="py-3 px-2 border-b border-slate-200 border-r text-left truncate">Module</th>
                        
                        {/* Preparation */}
                        <th colSpan={5} className="py-2 px-1 text-center bg-amber-50 border-b border-amber-100 border-r border-slate-200 text-amber-800">
                            Preparation
                        </th>
                        
                        {/* Front-End */}
                        <th colSpan={4} className="py-2 px-1 text-center bg-blue-50 border-b border-blue-100 border-r border-slate-200 text-blue-800">
                            Front-End
                        </th>

                        {/* Back-End */}
                        <th colSpan={4} className="py-2 px-1 text-center bg-indigo-50 border-b border-indigo-100 border-r border-slate-200 text-indigo-800">
                            Back-End
                        </th>

                        <th colSpan={2} className="py-3 px-2 text-center border-b border-slate-200 bg-slate-100">Delivery</th>
                    </tr>
                    <tr className="text-[10px] text-slate-500">
                        <th className="border-b border-slate-200 bg-slate-50"></th>
                        <th className="border-b border-slate-200 border-r bg-slate-50"></th>
                        
                        {/* Prep Subs */}
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-amber-50/30">L. FP</th>
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-amber-50/30" title="Velocity">Vel</th>
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-amber-50/30" title="Team Size">Tm</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 bg-amber-50/30">M.D.</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 border-r bg-amber-50/30">Wks</th>

                        {/* FE Subs */}
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-blue-50/30">FE FP</th>
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-blue-50/30">Diff</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 bg-blue-50/30">M.D.</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 border-r bg-blue-50/30">Wks</th>

                         {/* BE Subs */}
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-indigo-50/30">BE FP</th>
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-indigo-50/30">Diff</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 bg-indigo-50/30">M.D.</th>
                        <th className="py-1 px-1 text-right border-b border-slate-200 border-r bg-indigo-50/30">Wks</th>
                        
                        <th className="py-1 px-1 text-center border-b border-slate-200 bg-slate-100">Start Date</th>
                        <th className="py-1 px-2 text-right border-b border-slate-200 bg-slate-100 font-bold">ETA</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {modules.length === 0 && (
                        <tr>
                            <td colSpan={17} className="p-8 text-center text-slate-400 italic">
                                No modules found. Go to Planner to add modules.
                            </td>
                        </tr>
                    )}
                    {modules.map((m, index) => {
                        // Phase 1
                        const prepVelocity = m.prepVelocity || 10;
                        const prepTeamSize = m.prepTeamSize || 2;
                        const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
                        const prepDuration = Math.ceil(prepEffort / prepTeamSize);

                        // Phase 2 FE
                        const feFP = m.frontendFunctionPoints || 0;
                        const feComp = m.frontendComplexity || 'Medium';
                        const feEffort = Math.ceil((feFP / feVelocity) * COMPLEXITY_MULTIPLIERS[feComp]);
                        const feDuration = Math.ceil(feEffort / feTeamSize);

                        // Phase 3 BE
                        const beFP = m.backendFunctionPoints || 0;
                        const beComp = m.backendComplexity || 'Medium';
                        const beEffort = Math.ceil((beFP / beVelocity) * COMPLEXITY_MULTIPLIERS[beComp]);
                        const beDuration = Math.ceil(beEffort / beTeamSize);

                        // Total Duration (Prep + Parallel Dev)
                        const totalDuration = prepDuration + Math.max(feDuration, beDuration);
                        const devDuration = Math.max(feDuration, beDuration);
                        
                        let deliveryDate: string | null = null;
                        
                        if (m.startDate) {
                             // Override logic: if Start Date is set in Estimator, calculate based on that
                             deliveryDate = calculateEndDate(m.startDate, totalDuration, holidaySet);
                        } else {
                            // Fallback logic 1. Try to find a scheduled "EP Dev Team" task to anchor the build phase
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
                                // Fallback logic 2. Find earliest start of any task (likely Prep/Discovery)
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
                                    <div className="flex justify-center group-hover:text-slate-500">
                                        <GripVertical size={14} />
                                    </div>
                                </td>
                                <td className="px-2 py-2 border-b border-slate-100 border-r border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-slate-700 truncate block w-full text-xs" title={m.name}>{m.name}</span>
                                    </div>
                                </td>
                                
                                {/* Preparation */}
                                <td className="px-1 py-1 border-b border-slate-100 hover:bg-slate-50 relative group/cell">
                                    <input 
                                        type="number" min="0" className="w-full h-full text-center p-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded font-mono text-slate-600 text-[11px] transition-colors"
                                        value={m.legacyFunctionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, parseInt(e.target.value) || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, prepVelocity, prepTeamSize)}
                                    />
                                </td>
                                <td className="px-1 py-1 border-b border-slate-100 hover:bg-slate-50 relative">
                                     <input 
                                        type="number" min="1" className="w-full h-full text-center p-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded font-mono text-slate-500 text-[11px] transition-colors"
                                        value={prepVelocity}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, parseInt(e.target.value) || 1, prepTeamSize)}
                                        title="Prep Velocity"
                                    />
                                </td>
                                <td className="px-1 py-1 border-b border-slate-100 hover:bg-slate-50 relative">
                                     <input 
                                        type="number" min="1" className="w-full h-full text-center p-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded font-mono text-slate-500 text-[11px] transition-colors"
                                        value={prepTeamSize}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, m.backendFunctionPoints || 0, prepVelocity, parseInt(e.target.value) || 1)}
                                        title="Prep Team Size"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 font-mono text-[11px] text-slate-400">{prepEffort || '-'}</td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 border-r border-slate-200 font-mono text-[11px] font-medium text-amber-700">{formatWeeks(prepDuration)}</td>

                                {/* Front-End */}
                                <td className="px-1 py-1 border-b border-slate-100 hover:bg-slate-50 relative group/cell">
                                    <input 
                                        type="number" min="0" className="w-full h-full text-center p-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded font-mono text-slate-600 text-[11px] transition-colors"
                                        value={m.frontendFunctionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, parseInt(e.target.value) || 0, m.backendFunctionPoints || 0, prepVelocity, prepTeamSize)}
                                    />
                                </td>
                                <td className="px-1 py-1 border-b border-slate-100">
                                    <ComplexitySelect value={feComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'frontend', val)} />
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 font-mono text-[11px] text-slate-400">{feEffort || '-'}</td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 border-r border-slate-200 font-mono text-[11px] font-medium text-blue-700">{formatWeeks(feDuration)}</td>

                                {/* Back-End */}
                                <td className="px-1 py-1 border-b border-slate-100 hover:bg-slate-50 relative group/cell">
                                    <input 
                                        type="number" min="0" className="w-full h-full text-center p-1 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded font-mono text-slate-600 text-[11px] transition-colors"
                                        value={m.backendFunctionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints || 0, m.frontendFunctionPoints || 0, parseInt(e.target.value) || 0, prepVelocity, prepTeamSize)}
                                    />
                                </td>
                                <td className="px-1 py-1 border-b border-slate-100">
                                    <ComplexitySelect value={beComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'backend', val)} />
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 font-mono text-[11px] text-slate-400">{beEffort || '-'}</td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 border-r border-slate-200 font-mono text-[11px] font-medium text-indigo-700">{formatWeeks(beDuration)}</td>
                                
                                {/* Start Date Input */}
                                <td className="px-1 py-1 border-b border-slate-100 bg-slate-50/20 relative">
                                    <div className={`relative w-full h-full flex items-center justify-center rounded border transition-colors ${m.startDate ? 'bg-indigo-50 border-indigo-200' : 'border-transparent hover:bg-slate-100 hover:border-slate-200'}`}>
                                        <input 
                                            type="date" 
                                            className="w-full h-full opacity-0 absolute inset-0 cursor-pointer z-10"
                                            value={m.startDate || ''}
                                            onChange={(e) => onUpdateModuleStartDate(selectedProjectId, m.id, e.target.value)}
                                            title="Click to pick a start date"
                                        />
                                        {m.startDate ? (
                                            <span className="text-[10px] font-mono text-indigo-700 font-medium truncate px-1">
                                                {new Date(m.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </span>
                                        ) : (
                                            <CalendarIcon size={12} className="text-slate-300" />
                                        )}
                                    </div>
                                </td>

                                {/* Delivery */}
                                <td className="px-2 py-2 text-right border-b border-slate-100 bg-slate-50/50 font-mono text-[10px] font-bold text-slate-800">
                                    {deliveryDate ? (
                                        <div className="flex flex-col items-end">
                                            <span className="text-indigo-700 text-xs">{new Date(deliveryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                            <span className="text-[8px] text-slate-400 font-normal">
                                                {m.startDate ? `(Fixed: ${formatWeeks(totalDuration)})` : (
                                                    (m.tasks.some(t => t.assignments.some(a => a.role === Role.DEV))) ? `(Dev: ${formatWeeks(devDuration)})` : `(Total: ${formatWeeks(totalDuration)})`
                                                )}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-slate-400">{totalDuration > 0 ? formatWeeks(totalDuration) : '-'}</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-xs border-t-2 border-slate-200">
                    <tr>
                        <td colSpan={2} className="px-2 py-2 text-right text-slate-500 uppercase text-[10px]">Totals</td>
                        
                        {/* Prep Totals */}
                        <td className="px-1 py-2 text-center text-slate-700 text-[11px]">{totals.legacyFP}</td>
                        <td colSpan={2} className="px-1 py-2 text-center text-slate-400 text-[11px]">-</td>
                        <td className="px-2 py-2 text-right text-slate-700 text-[11px]">{totals.prepEffort}</td>
                        <td className="px-2 py-2 text-right text-amber-700 border-r border-slate-300 text-[11px]">{formatWeeks(totals.prepDuration)}</td>

                        {/* FE Totals */}
                        <td className="px-1 py-2 text-center text-slate-700 text-[11px]">{totals.feFP}</td>
                        <td className="px-1 py-2 text-center text-slate-400 text-[11px]">-</td>
                        <td className="px-2 py-2 text-right text-slate-700 text-[11px]">{totals.feEffort}</td>
                        <td className="px-2 py-2 text-right text-blue-700 border-r border-slate-300 text-[11px]">{formatWeeks(totals.feDuration)}</td>

                         {/* BE Totals */}
                        <td className="px-1 py-2 text-center text-slate-700 text-[11px]">{totals.beFP}</td>
                        <td className="px-1 py-2 text-center text-slate-400 text-[11px]">-</td>
                        <td className="px-2 py-2 text-right text-slate-700 text-[11px]">{totals.beEffort}</td>
                        <td className="px-2 py-2 text-right text-indigo-700 border-r border-slate-300 text-[11px]">{formatWeeks(totals.beDuration)}</td>

                        <td colSpan={2} className="px-4 py-2 text-right text-slate-900 text-sm"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div className="mt-4 text-[10px] text-slate-400 text-right space-y-1">
            <p>* Front-End and Back-End development are assumed to run in parallel.</p>
            <p>* Delivery date prioritizes Manual Start Date if set.</p>
            <p>* If no manual date, it looks for scheduled 'EP Dev Team' tasks. If found, adds Development Duration to that start date.</p>
            <p>* Otherwise, it adds (Prep + Development) duration to the earliest module activity found in the planner.</p>
        </div>
      </div>
    </div>
  );
};