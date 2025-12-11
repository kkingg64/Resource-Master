
import React, { useState, useEffect } from 'react';
import { Project, ProjectModule } from '../types';
import { Calculator, ArrowRight, Save, GripVertical, CheckCircle, AlertCircle, Folder } from 'lucide-react';

interface EstimatorProps {
  projects: Project[];
  onUpdateFunctionPoints: (projectId: string, moduleId: string, legacyFp: number, mvpFp: number) => void;
  onReorderModules: (projectId: string, startIndex: number, endIndex: number) => void;
}

export const Estimator: React.FC<EstimatorProps> = ({ projects, onUpdateFunctionPoints, onReorderModules }) => {
  const [velocity, setVelocity] = useState<number>(5); // FP per person-day
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || '');
  const [selectedModuleId, setSelectedModuleId] = useState<string>('');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    // If the selected project is deleted or no longer exists, reset to the first available project.
    let currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject) {
        currentProject = projects[0];
        setSelectedProjectId(currentProject?.id || '');
    }

    // If there's a selected project, ensure a valid module is selected.
    if (currentProject) {
        const modules = currentProject.modules;
        // FIX: Added a check for modules existence and used optional chaining to prevent potential runtime errors when accessing modules[0].
        const moduleExists = modules && modules.some(m => m.id === selectedModuleId);
        if (!moduleExists) {
            setSelectedModuleId(modules?.[0]?.id || '');
        }
    } else {
        // No projects exist, so no module can be selected.
        setSelectedModuleId('');
    }
  }, [projects, selectedProjectId, selectedModuleId]);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const modules = selectedProject ? selectedProject.modules : [];
  
  const selectedModule = modules.find(m => m.id === selectedModuleId);
  const estimatedLegacyDays = selectedModule ? Math.ceil((selectedModule.legacyFunctionPoints || 0) / velocity) : 0;
  const estimatedMvpDays = selectedModule ? Math.ceil((selectedModule?.functionPoints || 0) / velocity) : 0;

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

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6 text-slate-800">
        <Calculator className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold">Effort Estimator</h2>
      </div>

      <div className="space-y-6 flex-1 flex flex-col">
        {/* Project Selector */}
        <div>
           <label className="block text-sm font-medium text-slate-600 mb-2">Select Project</label>
           <div className="relative">
             <select 
               className="w-full p-2 pl-9 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm appearance-none bg-white"
               value={selectedProjectId}
               onChange={(e) => setSelectedProjectId(e.target.value)}
             >
               {projects.map(p => (
                 <option key={p.id} value={p.id}>{p.name}</option>
               ))}
             </select>
             <Folder className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
           </div>
        </div>

        <div className="flex-1 overflow-auto">
          <label className="block text-sm font-medium text-slate-600 mb-2">Select Module</label>
          <div className="space-y-2 pr-2">
            {modules.length === 0 && <div className="text-sm text-slate-400 italic p-2">No modules in this project.</div>}
            {modules.map((m, index) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => setSelectedModuleId(m.id)}
                className={`p-3 border rounded-lg flex items-center justify-between cursor-pointer transition-all ${
                  selectedModuleId === m.id 
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-slate-50'
                } ${draggedIndex === index ? 'opacity-50 border-dashed border-slate-400' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="cursor-grab text-slate-400 hover:text-slate-600">
                    <GripVertical size={16} />
                  </div>
                  <div>
                    <span className={`block text-sm font-medium ${selectedModuleId === m.id ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {m.name}
                    </span>
                    <span className="text-xs text-slate-400">MVP: {m.functionPoints} FP</span>
                  </div>
                </div>
                {selectedModuleId === m.id && <CheckCircle size={16} className="text-indigo-600" />}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-100 pt-6">
          <div className="grid grid-cols-2 gap-4 mb-4">
             <div>
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">Legacy System Size (FP)</label>
               <input 
                  type="number" 
                  value={selectedModule?.legacyFunctionPoints || 0}
                  onChange={(e) => selectedModule && onUpdateFunctionPoints(selectedProjectId, selectedModule.id, parseInt(e.target.value) || 0, selectedModule.functionPoints)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
               />
               <p className="text-[10px] text-slate-400 mt-1">For Fact Finding Tasks</p>
            </div>
            <div>
               <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase">MVP Scope Size (FP)</label>
               <input 
                  type="number" 
                  value={selectedModule?.functionPoints || 0}
                  onChange={(e) => selectedModule && onUpdateFunctionPoints(selectedProjectId, selectedModule.id, selectedModule.legacyFunctionPoints || 0, parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
               />
               <p className="text-[10px] text-slate-400 mt-1">For Build/QA Tasks</p>
            </div>
          </div>
          
          <div className="mb-6">
             <label className="block text-sm font-medium text-slate-600 mb-2">Team Velocity (FP/Day)</label>
             <input 
                type="number" 
                value={velocity}
                onChange={(e) => setVelocity(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
             />
          </div>

          <div className="space-y-3">
             <div className="bg-slate-50 p-3 rounded-lg flex items-center justify-between border border-slate-200">
              <div>
                <span className="text-xs text-slate-500 font-semibold uppercase">Discovery Effort</span>
                <div className="text-xl font-bold text-slate-700">{estimatedLegacyDays} <span className="text-sm font-normal text-slate-500">days</span></div>
              </div>
              <div className="text-xs text-slate-400 text-right">Based on Legacy Size<br/>(Full Review)</div>
            </div>

            <div className="bg-indigo-50 p-3 rounded-lg flex items-center justify-between border border-indigo-100">
              <div>
                <span className="text-xs text-indigo-600 font-semibold uppercase">Build Effort</span>
                <div className="text-xl font-bold text-indigo-900">{estimatedMvpDays} <span className="text-sm font-normal text-indigo-700">days</span></div>
              </div>
              <div className="text-xs text-indigo-400 text-right">Based on MVP Size<br/>(Target Build)</div>
            </div>
          </div>

          <div className="flex items-start gap-2 mt-4 text-xs text-slate-500 bg-yellow-50 p-2 rounded border border-yellow-100">
            <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            <p>Select a project and module above to estimate efforts.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
