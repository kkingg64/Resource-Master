import React from 'react';
import { Info, Code } from 'lucide-react';

export const Settings: React.FC = () => {
  const version = "1.1.1"; // As requested

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <Info className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-800">Application Information</h2>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Code className="w-4 h-4 text-slate-400" />
          <span className="font-medium text-slate-600">Version:</span>
          <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">{version}</span>
        </div>
        <p className="text-sm text-slate-500 pt-2">
          This is the OMS Resource Master, a tool for planning and managing project resources effectively.
        </p>
      </div>
    </div>
  );
};