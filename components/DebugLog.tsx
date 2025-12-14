import React, { useState } from 'react';
import { LogEntry } from '../types';
import { Bug, X, Trash2, ChevronDown, ChevronRight, Server, AlertTriangle, CheckCircle } from 'lucide-react';

interface DebugLogProps {
  entries: LogEntry[];
  setEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

const statusStyles = {
  pending: { icon: Server, color: 'text-slate-500' },
  success: { icon: CheckCircle, color: 'text-green-500' },
  error: { icon: AlertTriangle, color: 'text-red-500' },
};

const LogItem: React.FC<{ entry: LogEntry }> = ({ entry }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { icon: Icon, color } = statusStyles[entry.status];

  return (
    <div className="border-b border-slate-200 text-xs">
      <div 
        className="flex items-center gap-2 p-2 cursor-pointer hover:bg-slate-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="font-mono text-slate-400">{entry.timestamp}</span>
        <Icon size={14} className={`${color} flex-shrink-0`} />
        <span className={`font-medium flex-1 truncate ${color}`}>{entry.message}</span>
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </div>
      {isExpanded && (
        <pre className="bg-slate-100 p-2 text-[10px] text-slate-600 overflow-auto max-h-40">
          {JSON.stringify(entry.payload, null, 2)}
        </pre>
      )}
    </div>
  );
};


export const DebugLog: React.FC<DebugLogProps> = ({ entries, setEntries }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-slate-800 text-white rounded-full p-3 shadow-lg hover:bg-slate-700 z-50 animate-in fade-in"
        title="Open Debug Log"
      >
        <Bug size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-full max-w-lg h-96 bg-white rounded-xl shadow-2xl border border-slate-300 flex flex-col z-50 animate-in fade-in slide-in-from-bottom-5">
      <header className="flex items-center justify-between p-3 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <div className="flex items-center gap-2 font-bold text-slate-700">
          <Bug size={16} className="text-indigo-600"/>
          <span>Debug Log</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEntries([])} className="p-1 rounded-full text-slate-400 hover:bg-slate-200" title="Clear Logs">
            <Trash2 size={16}/>
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-200" title="Close">
            <X size={18}/>
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto">
        {entries.length === 0 ? (
           <div className="p-4 text-center text-sm text-slate-400">No logs yet. Interact with the app to see database calls.</div>
        ) : (
          [...entries].map(entry => <LogItem key={entry.id} entry={entry} />)
        )}
      </main>
    </div>
  );
};