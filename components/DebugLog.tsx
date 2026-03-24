import React, { useMemo, useState } from 'react';
import { LogEntry } from '../types';
import { Bug, X, Trash2, ChevronDown, ChevronRight, Server, AlertTriangle, CheckCircle, Copy, Check } from 'lucide-react';

interface DebugLogProps {
  entries: LogEntry[];
  setEntries: React.Dispatch<React.SetStateAction<LogEntry[]>>;
}

const statusStyles = {
  pending: { icon: Server, color: 'text-slate-500' },
  success: { icon: CheckCircle, color: 'text-green-500' },
  error: { icon: AlertTriangle, color: 'text-red-500' },
};

const copyTextSafe = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back below.
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'absolute';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return copied;
  } catch {
    return false;
  }
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
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | LogEntry['status']>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const serializedEntries = useMemo(() => JSON.stringify(entries, null, 2), [entries]);
  const filteredEntries = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!normalizedSearch) return true;
      const payloadText = entry.payload ? JSON.stringify(entry.payload).toLowerCase() : '';
      return entry.message.toLowerCase().includes(normalizedSearch) || payloadText.includes(normalizedSearch);
    });
  }, [entries, searchTerm, statusFilter]);

  const handleCopyLogs = async () => {
    const copied = await copyTextSafe(serializedEntries);
    if (!copied) return;

    setCopyFeedback(true);
    window.setTimeout(() => setCopyFeedback(false), 1500);
  };

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
          <Bug size={16} className="text-indigo-600" />
          <span>Debug Log</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCopyLogs} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200" title="Copy logs">
            {copyFeedback ? <Check size={14} /> : <Copy size={14} />}
            <span>{copyFeedback ? 'Copied' : 'Copy'}</span>
          </button>
          <button onClick={() => setEntries([])} className="p-1 rounded-full text-slate-400 hover:bg-slate-200" title="Clear Logs">
            <Trash2 size={16} />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-200" title="Close">
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="border-b border-slate-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        Look for APP_BOOT, PAGE_SHOW, AUTH_STATE_CHANGE, and FETCH_DATA_START after the reload.
      </div>
      <div className="border-b border-slate-200 bg-white px-3 py-2 flex items-center gap-2">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Filter message or payload..."
          className="flex-1 border border-slate-200 rounded px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | LogEntry['status'])}
          className="border border-slate-200 rounded px-2 py-1 text-[11px] bg-white"
        >
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="success">Success</option>
          <option value="error">Error</option>
        </select>
      </div>
      <main className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400">No logs yet. Interact with the app to see lifecycle and database events.</div>
        ) : (
          [...filteredEntries].map(entry => <LogItem key={entry.id} entry={entry} />)
        )}
      </main>
    </div>
  );
};
