import React, { useState, useEffect, useMemo } from 'react';
import { Project, ProjectModule } from '../types';
import { Calculator, ArrowRight, Save, GripVertical, CheckCircle, AlertCircle, Folder, Users, Clock, CalendarDays, BarChart3, HelpCircle } from 'lucide-react';

interface EstimatorProps {
  projects: Project[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
}

export const Estimator: React.FC<EstimatorProps> = ({ projects, onUpdateFunctionPoints, onReorderModules }) => {
  const [velocity, setVelocity] = useState<number>(5); // FP per person-day
  const [teamSize, setTeamSize] = useState<number>(2); // Number of resources
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    // If the selected project is deleted or no longer exists, reset to the first available project.
    let currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject && projects.length > 0) {
        setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const modules = selectedProject ? selectedProject.modules : [];

  // Calculations
  const totals = useMemo(() => {
    const totalLegacyFP = modules.reduce((sum, m) => sum + (m.legacyFunctionPoints || 0), 0);
    const totalMvpFP = modules.reduce((sum, m) => sum + (m.functionPoints || 0), 0);
    
    // Effort in Man-Days
    const effortLegacyDays = Math.ceil(totalLegacyFP / velocity);
    const effortMvpDays = Math.ceil(totalMvpFP / velocity);
    
    // Duration in Calendar Days (assuming parallel work if team size > 1)
    const durationLegacyDays = Math.ceil(effortLegacyDays / teamSize);
    const durationMvpDays = Math.ceil(effortMvpDays / teamSize);

    return {
        legacyFP: totalLegacyFP,
        mvpFP: totalMvpFP,
        effortLegacy: effortLegacyDays,
        effortMvp: effortMvpDays,
        durationLegacy: durationLegacyDays,
        durationMvp: durationMvpDays
    };
  }, [modules, velocity, teamSize]);

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
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 flex-shrink-0">
        <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-indigo-600" />
                Effort Estimator
            </h2>
            <p className="text-xs text-slate-500 mt-1">Calculate effort based on complexity (FP) and team capacity.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-2 rounded-xl border border-slate-200">
            {/* Project Selector */}
            <div className="relative min-w-[200px]">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Folder className="h-4 w-4 text-slate-400" />
                </div>
                <select 
                    className="block w-full pl-9 pr-3 py-1.5 text-sm border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white border shadow-sm"
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                    {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                </select>
            </div>

            <div className="h-8 w-px bg-slate-300 mx-2 hidden md:block"></div>

            {/* Global Settings */}
            <div className="flex items-center gap-3">
                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        Velocity <span title="Function Points per Person-Day" className="cursor-help"><HelpCircle size={10} /></span>
                    </label>
                    <div className="flex items-center gap-1">
                        <BarChart3 size={14} className="text-slate-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={velocity}
                            onChange={(e) => setVelocity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 p-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-400">FP/day</span>
                    </div>
                </div>

                <div className="flex flex-col">
                    <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Avg Team Size</label>
                    <div className="flex items-center gap-1">
                        <Users size={14} className="text-slate-400" />
                        <input 
                            type="number" 
                            min="1"
                            value={teamSize}
                            onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 p-1 text-sm border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-400">ppl</span>
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* Main Content: Spreadsheet View */}
      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                        <th className="w-10 py-3 text-center">#</th>
                        <th className="py-3 px-4">Module Name</th>
                        <th className="py-3 px-4 w-32 text-right bg-slate-200/50 border-l border-slate-200">Legacy FP</th>
                        <th className="py-3 px-4 w-32 text-right bg-indigo-50 border-l border-slate-200 text-indigo-700">MVP FP</th>
                        <th className="py-3 px-4 w-32 text-right border-l border-slate-200">Effort (Days)</th>
                        <th className="py-3 px-4 w-32 text-right border-l border-slate-200">Duration</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {modules.length === 0 && (
                        <tr>
                            <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                No modules found in this project. Go to Planner to add modules.
                            </td>
                        </tr>
                    )}
                    {modules.map((m, index) => {
                        const effortDays = Math.ceil((m.functionPoints || 0) / velocity);
                        const duration = Math.ceil(effortDays / teamSize);

                        return (
                            <tr 
                                key={m.id}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, index)}
                                className={`hover:bg-slate-50 transition-colors group ${draggedIndex === index ? 'opacity-40 bg-slate-100' : ''}`}
                            >
                                <td className="text-center text-slate-400 cursor-grab active:cursor-grabbing">
                                    <div className="flex justify-center group-hover:text-slate-600">
                                        <GripVertical size={16} />
                                    </div>
                                </td>
                                <td className="px-4 py-2 font-medium text-slate-700">{m.name}</td>
                                
                                {/* Legacy FP Input */}
                                <td className="px-2 py-1 border-l border-slate-100 bg-slate-50/30">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full text-right p-1.5 bg-transparent border border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white rounded transition-all focus:ring-0 font-mono text-slate-600"
                                        value={m.legacyFunctionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, parseInt(e.target.value) || 0, m.functionPoints)}
                                        placeholder="0"
                                    />
                                </td>

                                {/* MVP FP Input */}
                                <td className="px-2 py-1 border-l border-slate-100 bg-indigo-50/10">
                                    <input 
                                        type="number" 
                                        min="0"
                                        className="w-full text-right p-1.5 bg-transparent border border-transparent hover:border-indigo-300 focus:border-indigo-500 focus:bg-white rounded transition-all focus:ring-0 font-mono font-bold text-indigo-700"
                                        value={m.functionPoints || 0}
                                        onChange={(e) => onUpdateFunctionPoints(selectedProjectId, m.id, m.legacyFunctionPoints, parseInt(e.target.value) || 0)}
                                        placeholder="0"
                                    />
                                </td>

                                {/* Calculated Effort */}
                                <td className="px-4 py-2 text-right border-l border-slate-100 font-mono text-slate-600">
                                    {effortDays > 0 ? effortDays : '-'}
                                </td>

                                {/* Calculated Duration */}
                                <td className="px-4 py-2 text-right border-l border-slate-100 font-mono text-slate-500 text-xs">
                                    {duration > 0 ? (
                                        <span title={`${duration} calendar days`}>~{formatWeeks(duration)}</span>
                                    ) : '-'}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
      </div>

      {/* Footer / Summary Cards */}
      <div className="bg-white border-t border-slate-200 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
        
        {/* Total Scope */}
        <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                <BarChart3 size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Total MVP Scope</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-800">{totals.mvpFP}</span>
                    <span className="text-sm text-slate-500">FP</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">Legacy Analysis: {totals.legacyFP} FP</p>
            </div>
        </div>

        {/* Total Effort */}
        <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600">
                <Clock size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Required Effort</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-800">{totals.effortMvp}</span>
                    <span className="text-sm text-slate-500">Man-Days</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">@ {velocity} FP/day velocity</p>
            </div>
        </div>

        {/* Estimated Duration */}
        <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
                <CalendarDays size={24} />
            </div>
            <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">Est. Duration</p>
                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-slate-800">{formatWeeks(totals.durationMvp)}</span>
                    <span className="text-sm text-slate-500">Calendar Time</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">With team of {teamSize}</p>
            </div>
        </div>

      </div>
    </div>
  );
};