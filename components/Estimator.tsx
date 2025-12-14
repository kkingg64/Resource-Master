import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule, ComplexityLevel } from '../types';
import { Calculator, GripVertical, BarChart3, Users, HelpCircle, ArrowRight, Gauge } from 'lucide-react';

interface EstimatorProps {
  projects: Project[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => void;
  onUpdateModuleComplexity: (projectId: string, moduleId: string, complexity: ComplexityLevel) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
}

const COMPLEXITY_MULTIPLIERS: Record<ComplexityLevel, number> = {
  'Low': 1.0,
  'Medium': 1.2,
  'High': 1.5,
  'Complex': 2.0
};

export const Estimator: React.FC<EstimatorProps> = ({ projects, onUpdateFunctionPoints, onUpdateModuleComplexity, onReorderModules }) => {
  // Phase 1: Preparation (Fact Finding / Legacy Analysis)
  const [prepVelocity, setPrepVelocity] = useState<number>(10); // FP per person-day
  const [prepTeamSize, setPrepTeamSize] = useState<number>(2);

  // Phase 2: Development (MVP Build)
  const [devVelocity, setDevVelocity] = useState<number>(5); // FP per person-day
  const [devTeamSize, setDevTeamSize] = useState<number>(4);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
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
    let totalMvpFP = 0;
    
    let totalPrepEffort = 0;
    let totalDevEffort = 0;

    let totalPrepDuration = 0;
    let totalDevDuration = 0;

    modules.forEach(m => {
        const complexity = m.complexity || 'Medium';
        const multiplier = COMPLEXITY_MULTIPLIERS[complexity];

        totalLegacyFP += (m.legacyFunctionPoints || 0);
        totalMvpFP += (m.functionPoints || 0);

        // Prep Effort (No multiplier typically for analysis, or can be added if needed)
        const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
        
        // Dev Effort (Apply Multiplier here)
        const rawDevEffort = (m.functionPoints || 0) / devVelocity;
        const devEffort = Math.ceil(rawDevEffort * multiplier);

        totalPrepEffort += prepEffort;
        totalDevEffort += devEffort;

        totalPrepDuration += Math.ceil(prepEffort / prepTeamSize);
        totalDevDuration += Math.ceil(devEffort / devTeamSize);
    });

    return {
        legacyFP: totalLegacyFP,
        mvpFP: totalMvpFP,
        prepEffort: totalPrepEffort,
        devEffort: totalDevEffort,
        prepDuration: totalPrepDuration,
        devDuration: totalDevDuration,
        totalDuration: totalPrepDuration + totalDevDuration
    };
  }, [modules, prepVelocity, prepTeamSize, devVelocity, devTeamSize]);

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
    return `${weeks} wks`;
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
        <div className="flex flex-col md:flex-row gap-4">
            
            {/* Prep Settings */}
            <div className="flex items-center gap-3 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                <div className="px-2 border-r border-amber-200 flex items-center">
                    <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Preparation</span>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Velocity <span title="Legacy FP per Person-Day" className="cursor-help"><HelpCircle size={10} /></span>
                    </label>
                    <div className="flex items-center gap-1">
                        <BarChart3 size={14} className="text-amber-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={prepVelocity}
                            onChange={(e) => setPrepVelocity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 p-1 text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Team Size</label>
                    <div className="flex items-center gap-1">
                        <Users size={14} className="text-amber-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={prepTeamSize}
                            onChange={(e) => setPrepTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 p-1 text-xs border border-amber-200 rounded focus:ring-1 focus:ring-amber-500"
                        />
                    </div>
                </div>
            </div>

            <ArrowRight className="text-slate-300 hidden md:block self-center" size={20} />

            {/* Dev Settings */}
            <div className="flex items-center gap-3 bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
                <div className="px-2 border-r border-indigo-200 flex items-center">
                    <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">Development</span>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                        Velocity <span title="MVP FP per Person-Day" className="cursor-help"><HelpCircle size={10} /></span>
                    </label>
                    <div className="flex items-center gap-1">
                        <BarChart3 size={14} className="text-indigo-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={devVelocity}
                            onChange={(e) => setDevVelocity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 p-1 text-xs border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>
                <div className="flex flex-col">
                    <label className="text-[10px] text-slate-500 uppercase">Team Size</label>
                    <div className="flex items-center gap-1">
                        <Users size={14} className="text-indigo-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={devTeamSize}
                            onChange={(e) => setDevTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-14 p-1 text-xs border border-indigo-200 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                    </div>
                </div>
            </div>

        </div>
      </div>

      {/* Main Content: Spreadsheet View */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                        <th className="w-10 py-3 border-b border-slate-200"></th>
                        <th className="py-3 px-4 border-b border-slate-200 border-r text-left min-w-[200px]">Module</th>
                        
                        {/* Preparation Header */}
                        <th colSpan={3} className="py-2 px-4 text-center bg-amber-50 border-b border-amber-100 border-r border-slate-200 text-amber-800">
                            Preparation
                        </th>
                        
                        {/* Development Header */}
                        <th colSpan={4} className="py-2 px-4 text-center bg-indigo-50 border-b border-indigo-100 border-r border-slate-200 text-indigo-800">
                            Development
                        </th>

                        <th className="py-3 px-4 text-center border-b border-slate-200 bg-slate-100">Total</th>
                    </tr>
                    <tr className="text-[10px] text-slate-500">
                        <th className="border-b border-slate-200 bg-slate-50"></th>
                        <th className="border-b border-slate-200 border-r bg-slate-50"></th>
                        
                        {/* Preparation Subheaders */}
                        <th className="py-2 px-2 text-right border-b border-slate-200 bg-amber-50/30 w-32">Legacy FP</th>
                        <th className="py-2 px-2 text-right border-b border-slate-200 bg-amber-50/30 w-28" title="Man-Days">Effort</th>
                        <th className="py-2 px-2 text-right border-b border-slate-200 border-r bg-amber-50/30 w-28" title="Calendar Time">Duration</th>

                        {/* Development Subheaders */}
                        <th className="py-2 px-2 text-right border-b border-slate-200 bg-indigo-50/30 w-32">MVP FP</th>
                        <th className="py-2 px-2 text-center border-b border-slate-200 bg-indigo-50/30 w-40">Difficulty</th>
                        <th className="py-2 px-2 text-right border-b border-slate-200 bg-indigo-50/30 w-28" title="Man-Days (Calculated with Difficulty)">Effort</th>
                        <th className="py-2 px-2 text-right border-b border-slate-200 border-r bg-indigo-50/30 w-28" title="Calendar Time">Duration</th>

                        <th className="py-2 px-4 text-right border-b border-slate-200 bg-slate-100 w-40 font-bold">Est. Delivery</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {modules.length === 0 && (
                        <tr>
                            <td colSpan={10} className="p-8 text-center text-slate-400 italic">
                                No modules found. Go to Planner to add modules.
                            </td>
                        </tr>
                    )}
                    {modules.map((m, index) => {
                        // Phase 1 Calculations
                        const prepEffort = Math.ceil((m.legacyFunctionPoints || 0) / prepVelocity);
                        const prepDuration = Math.ceil(prepEffort / prepTeamSize);

                        // Phase 2 Calculations
                        const complexity = m.complexity || 'Medium';
                        const multiplier = COMPLEXITY_MULTIPLIERS[complexity];
                        const devEffort = Math.ceil(((m.functionPoints || 0) / devVelocity) * multiplier);
                        const devDuration = Math.ceil(devEffort / devTeamSize);

                        const totalDuration = prepDuration + devDuration;

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
                                <td className="px-4 py-2 border-b border-slate-100 border-r border-slate-200">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-slate-700">{m.name}</span>
                                    </div>
                                </td>
                                
                                {/* Preparation: Inputs & Outputs */}
                                <td className="px-2 py-1 border-b border-slate-100 bg-amber-50/10">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full text-right p-1 bg-transparent border border-transparent hover:border-amber-200 focus:border-amber-500 focus:bg-white rounded transition-all focus:ring-0 font-mono text-slate-600 text-xs"
                                        value={m.legacyFunctionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, parseInt(e.target.value) || 0, m.functionPoints)}
                                        placeholder="0"
                                    />
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 font-mono text-xs text-slate-500 bg-amber-50/10">
                                    {prepEffort > 0 ? prepEffort : '-'}
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 border-r border-slate-200 font-mono text-xs font-medium text-amber-700 bg-amber-50/10">
                                    {prepDuration > 0 ? `${prepDuration}d` : '-'}
                                </td>

                                {/* Development: Inputs & Outputs */}
                                <td className="px-2 py-1 border-b border-slate-100 bg-indigo-50/10">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full text-right p-1 bg-transparent border border-transparent hover:border-indigo-200 focus:border-indigo-500 focus:bg-white rounded transition-all focus:ring-0 font-mono text-slate-600 text-xs"
                                        value={m.functionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints, parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </td>
                                <td className="px-2 py-1 border-b border-slate-100 bg-indigo-50/10">
                                    <div className="relative">
                                        <select
                                            value={complexity}
                                            onChange={(e) => onUpdateModuleComplexity(selectedProjectId, m.id, e.target.value as ComplexityLevel)}
                                            className="w-full text-xs p-1 bg-transparent border-none focus:ring-0 cursor-pointer text-center font-medium text-slate-600 appearance-none hover:text-indigo-600"
                                        >
                                            <option value="Low">Low (1x)</option>
                                            <option value="Medium">Medium (1.2x)</option>
                                            <option value="High">High (1.5x)</option>
                                            <option value="Complex">Complex (2x)</option>
                                        </select>
                                        <Gauge size={10} className="absolute right-0 top-1.5 text-slate-300 pointer-events-none" />
                                    </div>
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 font-mono text-xs text-slate-500 bg-indigo-50/10">
                                    {devEffort > 0 ? devEffort : '-'}
                                </td>
                                <td className="px-2 py-1 text-right border-b border-slate-100 border-r border-slate-200 font-mono text-xs font-medium text-indigo-700 bg-indigo-50/10">
                                    {devDuration > 0 ? `${devDuration}d` : '-'}
                                </td>

                                {/* Total */}
                                <td className="px-4 py-2 text-right border-b border-slate-100 bg-slate-50 font-mono text-xs font-bold text-slate-800">
                                    {totalDuration > 0 ? formatWeeks(totalDuration) : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot className="bg-slate-50 font-semibold text-xs border-t-2 border-slate-200">
                    <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-slate-500 uppercase">Project Totals</td>
                        
                        {/* Prep Totals */}
                        <td className="px-2 py-3 text-right text-slate-700">{totals.legacyFP}</td>
                        <td className="px-2 py-3 text-right text-slate-700">{totals.prepEffort}</td>
                        <td className="px-2 py-3 text-right text-amber-700 border-r border-slate-300">{formatWeeks(totals.prepDuration)}</td>

                        {/* Dev Totals */}
                        <td className="px-2 py-3 text-right text-slate-700">{totals.mvpFP}</td>
                        <td className="px-2 py-3 text-center text-slate-400">-</td>
                        <td className="px-2 py-3 text-right text-slate-700">{totals.devEffort}</td>
                        <td className="px-2 py-3 text-right text-indigo-700 border-r border-slate-300">{formatWeeks(totals.devDuration)}</td>

                        {/* Grand Total */}
                        <td className="px-4 py-3 text-right text-slate-900 text-sm">
                            {formatWeeks(totals.totalDuration)}
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
        <div className="mt-4 text-[10px] text-slate-400 text-right">
            * Duration estimates assume Preparation and Development run sequentially per module, but parallel across the team. <br/>
            * Development Effort includes difficulty multiplier.
        </div>
      </div>
    </div>
  );
};