import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel, Holiday, Role } from '../types';
import { Calculator, GripVertical, ArrowRight, Layout, Server, ChevronDown, Calendar as CalendarIcon, Link2, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { calculateEndDate, formatDateForInput } from '../constants';

interface EstimatorProps {
  projects: Project[];
  holidays: Holiday[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, frontendFp: number, backendFp: number, prepVelocity: number, prepTeamSize: number, feVelocity: number, feTeamSize: number, beVelocity: number, beTeamSize: number) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, type: 'frontend' | 'backend', complexity: ComplexityLevel) => void;
  onUpdateModuleStartDate: (projectId: string, moduleId: string, startDate: string | null) => void;
  onUpdateModuleDeliveryTask: (projectId: string, moduleId: string, deliveryTaskId: string | null) => void;
  onUpdateModuleStartTask: (projectId: string, moduleId: string, startTaskId: string | null) => void;
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

export const Estimator: React.FC<EstimatorProps> = ({ projects, holidays, onUpdateFunctionPoints, onUpdateModuleComplexity, onUpdateModuleStartDate, onUpdateModuleDeliveryTask, onUpdateModuleStartTask, onReorderModules }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Strict HK Working Day Calculation: Only filter holidays where country is 'HK'
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
        const feVel = m.frontendVelocity || 5;
        const feTeam = m.frontendTeamSize || 2;
        const feComp = m.frontendComplexity || 'Medium';
        const feEffort = Math.ceil((feFP / feVel) * COMPLEXITY_MULTIPLIERS[feComp]);
        const feDuration = Math.ceil(feEffort / feTeam);
        totalFeFP += feFP;
        totalFeEffort += feEffort;
        totalFeDuration += feDuration;

        const beFP = m.backendFunctionPoints || 0;
        const beVel = m.backendVelocity || 5;
        const beTeam = m.backendTeamSize || 2;
        const beComp = m.backendComplexity || 'Medium';
        const beEffort = Math.ceil((beFP / beVel) * COMPLEXITY_MULTIPLIERS[beComp]);
        const beDuration = Math.ceil(beEffort / beTeam);
        totalBeFP += beFP;
        totalBeEffort += beEffort;
        totalBeDuration += beDuration;
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
    };
  }, [modules]);

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

  // Helper to find the start date of a specific task
  const getTaskStartDate = (module: ProjectModule, taskId: string): string | null => {
      const task = module.tasks.find(t => t.id === taskId);
      if (!task) return null;
      // Find earliest start date in this task's assignments
      let minStart: string | null = null;
      task.assignments.forEach(a => {
          if (a.startDate) {
              if (!minStart || a.startDate < minStart) {
                  minStart = a.startDate;
              }
          }
      });
      return minStart;
  };

  // Helper to find the latest end date of ANY task in the module
  const getModuleLatestEndDate = (module: ProjectModule): Date | null => {
      let maxEndDate: Date | null = null;
      module.tasks.forEach(task => {
          task.assignments.forEach(a => {
              if (a.startDate && a.duration) {
                  const endDateStr = calculateEndDate(a.startDate, a.duration, holidaySet);
                  const endDate = new Date(endDateStr.replace(/-/g, '/'));
                  if (!maxEndDate || endDate > maxEndDate) {
                      maxEndDate = endDate;
                  }
              }
          });
      });
      return maxEndDate;
  }

  // Helper to find earliest start date from planner tasks
  const getModuleEarliestStartDate = (module: ProjectModule): string | null => {
      let minDate: string | null = null;
      module.tasks.forEach(task => {
          task.assignments.forEach(a => {
              if (a.startDate) {
                  if (!minDate || a.startDate < minDate) {
                      minDate = a.startDate;
                  }
              }
          });
      });
      return minDate;
  }


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
                <span className="text-[10px] text-slate-400 ml-2">(Est. based on HK Holidays)</span>
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

                {/* FE: 6 cols */}
                <col className="w-14" />  {/* FE FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}

                {/* BE: 6 cols */}
                <col className="w-14" />  {/* BE FP */}
                <col className="w-10" />  {/* Vel */}
                <col className="w-10" />  {/* Team */}
                <col className="w-12" />  {/* Diff */}
                <col className="w-12" />  {/* MD */}
                <col className="w-12" />  {/* Wks */}

                {/* Delivery: 2 cols */}
                <col className="w-28" />  {/* Start */}
                <col className="w-28" />  {/* ETA / Delivery Task */}
            </colgroup>
            <thead className="bg-slate-50 text-slate-600 text-[10px] uppercase tracking-wider sticky top-0 z-20 shadow-sm font-semibold">
                <tr>
                    <th className="py-2 border-b border-slate-200 bg-slate-50"></th>
                    <th className="py-2 px-2 border-b border-slate-200 border-r text-left truncate bg-slate-50">Module</th>
                    <th colSpan={5} className="py-1 px-1 text-center bg-amber-50/80 border-b border-amber-100 border-r border-slate-200 text-amber-800">Preparation</th>
                    <th colSpan={6} className="py-1 px-1 text-center bg-blue-50/80 border-b border-blue-100 border-r border-slate-200 text-blue-800">Front-End</th>
                    <th colSpan={6} className="py-1 px-1 text-center bg-indigo-50/80 border-b border-indigo-100 border-r border-slate-200 text-indigo-800">Back-End</th>
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
                    <th className="py-1 text-center border-b border-slate-200 bg-slate-50">Plan vs Est</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11px]">
                {modules.length === 0 && (
                    <tr>
                        <td colSpan={21} className="p-12 text-center text-slate-400 bg-slate-50/30">
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
                    const feVel = m.frontendVelocity || 5;
                    const feTeam = m.frontendTeamSize || 2;
                    const feComp = m.frontendComplexity || 'Medium';
                    const feEffort = Math.ceil((feFP / feVel) * COMPLEXITY_MULTIPLIERS[feComp]);
                    const feDuration = Math.ceil(feEffort / feTeam);

                    const beFP = m.backendFunctionPoints || 0;
                    const beVel = m.backendVelocity || 5;
                    const beTeam = m.backendTeamSize || 2;
                    const beComp = m.backendComplexity || 'Medium';
                    const beEffort = Math.ceil((beFP / beVel) * COMPLEXITY_MULTIPLIERS[beComp]);
                    const beDuration = Math.ceil(beEffort / beTeam);

                    // 1. Calculate Estimated Duration from FPs (in working days)
                    const totalDuration = prepDuration + Math.max(feDuration, beDuration);
                    
                    // 2. Determine Base Start Date
                    // Priority: Manual Override (startDate) > Task Start (startTaskId) > Auto Planner Earliest
                    let baseStartDate = m.startDate || null;
                    let isTaskBased = false;
                    let startTaskName = '';

                    if (!baseStartDate && m.startTaskId) {
                        const taskStart = getTaskStartDate(m, m.startTaskId);
                        if (taskStart) {
                            baseStartDate = taskStart;
                            isTaskBased = true;
                            startTaskName = m.tasks.find(t => t.id === m.startTaskId)?.name || '';
                        }
                    }
                    
                    if (!baseStartDate) {
                        baseStartDate = getModuleEarliestStartDate(m);
                    }

                    // 3. Calculate "Estimated" Delivery Date (Using HK working days logic via holidaySet)
                    let estimatedDateStr: string | null = null;
                    if (baseStartDate && totalDuration > 0) {
                        estimatedDateStr = calculateEndDate(baseStartDate, totalDuration, holidaySet);
                    }

                    // 4. Calculate "Planned" Delivery Date (Planner Latest End Date)
                    const plannerDateObj = getModuleLatestEndDate(m);
                    const plannerDateStr = plannerDateObj ? formatDateForInput(plannerDateObj) : null;

                    // 5. Compare
                    // Logic: 
                    // If Est > Plan => Plan is earlier than Est => Aggressive / Risk (Red).
                    // If Est <= Plan => Plan is later or equal to Est => Safe / Buffer (Green).
                    let varianceStatus: 'safe' | 'risk' | 'unknown' = 'unknown';
                    if (estimatedDateStr && plannerDateStr) {
                        varianceStatus = estimatedDateStr > plannerDateStr ? 'risk' : 'safe';
                    }

                    const updateParams = (
                        legacyFP: number, 
                        feFP: number, 
                        beFP: number, 
                        pVel: number, 
                        pTeam: number,
                        fVel: number,
                        fTeam: number,
                        bVel: number,
                        bTeam: number
                    ) => {
                        onUpdateFunctionPoints(
                            selectedProjectId, 
                            m.id, 
                            legacyFP, 
                            feFP, 
                            beFP, 
                            pVel, 
                            pTeam,
                            fVel,
                            fTeam,
                            bVel,
                            bTeam
                        );
                    };

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
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.legacyFunctionPoints || 0} onChange={(e) => updateParams(parseInt(e.target.value) || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                    <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={prepVelocity} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, parseInt(e.target.value) || 1, prepTeamSize, feVel, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                    <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={prepTeamSize} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, parseInt(e.target.value) || 1, feVel, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{prepEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-amber-700 font-medium">{formatWeeks(prepDuration)}</td>

                            {/* FE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.frontendFunctionPoints || 0} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, parseInt(e.target.value) || 0, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={feVel} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, parseInt(e.target.value) || 1, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={feTeam} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, parseInt(e.target.value) || 1, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={feComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'frontend', val)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{feEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-blue-700 font-medium">{formatWeeks(feDuration)}</td>

                            {/* BE */}
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="0" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-600" value={m.backendFunctionPoints || 0} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, parseInt(e.target.value) || 0, prepVelocity, prepTeamSize, feVel, feTeam, beVel, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={beVel} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, parseInt(e.target.value) || 1, beTeam)} />
                            </td>
                            <td className="p-0 border-b border-slate-100 relative hover:bg-slate-50">
                                <input type="number" min="1" className="w-full h-full text-center bg-transparent border-none focus:ring-1 focus:ring-inset focus:ring-indigo-500 text-slate-500" value={beTeam} onChange={(e) => updateParams(m.legacyFunctionPoints || 0, feFP, beFP, prepVelocity, prepTeamSize, feVel, feTeam, beVel, parseInt(e.target.value) || 1)} />
                            </td>
                            <td className="p-0 border-b border-slate-100">
                                <ComplexitySelect value={beComp} onChange={(val) => onUpdateModuleComplexity(selectedProjectId, m.id, 'backend', val)} />
                            </td>
                            <td className="px-1 text-center border-b border-slate-100 text-slate-400 font-mono">{beEffort || '-'}</td>
                            <td className="px-1 text-center border-b border-slate-100 border-r border-slate-200 text-indigo-700 font-medium">{formatWeeks(beDuration)}</td>

                            {/* Start */}
                            <td className="p-0 border-b border-slate-100 bg-slate-50/30 relative group/start">
                                {/* Task/Auto/Manual Selector Overlay */}
                                <div className="absolute inset-0 opacity-0 group-hover/start:opacity-100 transition-opacity bg-white/95 flex items-center justify-center shadow-sm z-20">
                                    <div className="relative w-full h-full">
                                        <select 
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            value={m.startTaskId || (m.startDate ? 'manual' : '')}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'manual' || val === '') {
                                                    // Clear task selection
                                                    onUpdateModuleStartTask(selectedProjectId, m.id, null);
                                                    if(val === '') {
                                                        // Also clear manual date to go to Auto
                                                        onUpdateModuleStartDate(selectedProjectId, m.id, null);
                                                    }
                                                } else {
                                                    // Set task selection (this will override manual date logic in UI)
                                                    onUpdateModuleStartTask(selectedProjectId, m.id, val);
                                                }
                                            }}
                                        >
                                            <option value="">- Auto (Earliest) -</option>
                                            <option value="manual">- Manual Date -</option>
                                            <optgroup label="Select Task">
                                                {m.tasks.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </optgroup>
                                        </select>
                                        <div className="w-full h-full flex flex-col items-center justify-center text-[9px] text-indigo-600 pointer-events-none p-1">
                                            <Link2 size={10} /> 
                                            <span className="truncate w-full text-center">Change Source</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Actual Display Content */}
                                <div className="w-full h-full flex flex-col items-center justify-center text-[10px] relative z-10 px-1">
                                    {isTaskBased ? (
                                        <>
                                            <span className="text-indigo-700 font-bold truncate w-full text-center" title={`Starts with: ${startTaskName}`}>{startTaskName}</span>
                                            <span className="text-[9px] text-slate-400">{baseStartDate ? new Date(baseStartDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'}) : '-'}</span>
                                        </>
                                    ) : (
                                        <>
                                            <input 
                                                type="date" 
                                                className={`w-full bg-transparent text-center focus:outline-none ${m.startDate ? 'text-indigo-700 font-bold' : 'text-slate-500'}`}
                                                value={m.startDate || (baseStartDate || '')} 
                                                onChange={(e) => onUpdateModuleStartDate(selectedProjectId, m.id, e.target.value)}
                                            />
                                            {!m.startDate && baseStartDate && <span className="text-[8px] text-slate-300 absolute bottom-0.5 right-1">Auto</span>}
                                        </>
                                    )}
                                </div>
                            </td>

                            {/* Delivery (Pure Comparison) */}
                            <td className="px-1 border-b border-slate-100 bg-white text-right align-middle">
                                <div className="flex flex-col gap-0.5 py-1 px-1 h-full justify-center">
                                     {/* Estimated Date */}
                                     <div className="flex items-center justify-between gap-2 text-[9px] text-slate-400 border-b border-slate-50 pb-0.5">
                                        <span>Est:</span>
                                        <span className="font-mono">
                                            {estimatedDateStr ? new Date(estimatedDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                                        </span>
                                     </div>

                                     {/* Planner Date */}
                                     <div className={`flex items-center justify-between gap-2 text-[10px] font-bold ${
                                         varianceStatus === 'safe' ? 'text-green-600' : 
                                         varianceStatus === 'risk' ? 'text-red-600' : 'text-slate-600'
                                     }`}>
                                        <div className="flex items-center gap-1">
                                            <span>Plan:</span>
                                            {varianceStatus === 'risk' && <AlertCircle size={8} />}
                                            {varianceStatus === 'safe' && <CheckCircle2 size={8} />}
                                        </div>
                                        <span className="font-mono" title="Latest task end date">
                                            {plannerDateStr ? new Date(plannerDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '-'}
                                        </span>
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
                    <td colSpan={3} className="text-center text-slate-300">-</td>
                    <td className="text-center text-slate-700">{totals.feEffort}</td>
                    <td className="text-center text-blue-700 border-r border-slate-300">{formatWeeks(totals.feDuration)}</td>
                    <td className="text-center text-slate-700">{totals.beFP}</td>
                    <td colSpan={3} className="text-center text-slate-300">-</td>
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
          <div className="flex gap-4">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> Safe Plan (Plan &ge; Est)</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Aggressive Plan (Plan &lt; Est)</span>
          </div>
      </div>
    </div>
  );
};