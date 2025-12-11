import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Bug, X, Trash2, ChevronDown } from 'lucide-react';

interface DebugLogProps {
  logs: LogEntry[];
  onClear: () => void;
}

export const DebugLog: React.FC<DebugLogProps> = ({ logs, onClear }) => {
  const [isOpen, setIsOpen] = useState(false);

  const levelColorMap = {
    INFO: 'text-slate-300',
    SUCCESS: 'text-green-400',
    ERROR: 'text-red-400',
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition-all z-50"
        title="Open Debug Log"
      >
        <Bug size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-[600px] h-[400px] bg-slate-800/95 backdrop-blur-sm text-white rounded-lg shadow-2xl flex flex-col z-50 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <header className="flex items-center justify-between p-2 border-b border-slate-700 flex-shrink-0">
        <h3 className="font-mono text-sm font-bold flex items-center gap-2"><Bug size={16} /> Debug Log</h3>
        <div className="flex items-center gap-2">
          <button onClick={onClear} title="Clear Logs" className="p-1 rounded text-slate-400 hover:bg-slate-700"><Trash2 size={16} /></button>
          <button onClick={() => setIsOpen(false)} title="Close" className="p-1 rounded text-slate-400 hover:bg-slate-700"><X size={16} /></button>
        </div>
      </header>
      <main className="flex-1 p-2 overflow-y-auto font-mono text-xs custom-scrollbar">
        {logs.length === 0 && <div className="text-slate-500 text-center py-4">No log entries yet. Interact with the app to see logs.</div>}
        {logs.map(log => (
          <details key={log.id} className="border-b border-slate-700/50 py-1.5 group" open={log.level === 'ERROR'}>
            <summary className="flex items-center gap-2 cursor-pointer list-none">
                <span className={`font-bold w-12 flex-shrink-0 ${levelColorMap[log.level]}`}>{log.level}</span>
                <span className="text-slate-500 w-16 flex-shrink-0">{log.timestamp}</span>
                <span className="flex-1 text-slate-300 truncate">{log.message}</span>
                {log.data && <div className="text-slate-500 transition-transform group-open:rotate-180"><ChevronDown size={14} /></div>}
            </summary>
            {log.data && (
              <pre className="mt-2 p-2 bg-slate-900 rounded text-slate-400 text-[10px] max-h-48 overflow-auto custom-scrollbar">
                {JSON.stringify(log.data, null, 2)}
              </pre>
            )}
          </details>
        ))}
      </main>
    </div>
  );
};
