// components/DebugConnectionStatus.tsx
import React, { useEffect, useState } from 'react';
import { isOfflineMode } from '../lib/supabaseClient';
import { Wifi, WifiOff } from 'lucide-react';

export const DebugConnectionStatus: React.FC = () => {
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // 按下 Ctrl+Shift+D 開/關debug panel
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setShowDebug(!showDebug);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDebug]);

  if (!showDebug) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 text-white rounded-lg shadow-2xl p-4 max-w-sm text-sm font-mono z-50">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-700">
        <span className="font-bold">🔧 Debug Panel</span>
        <button 
          onClick={() => setShowDebug(false)}
          className="text-slate-400 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Connection Status */}
      <div className="mb-3 p-2 rounded bg-slate-800">
        <div className="flex items-center gap-2 mb-1">
          {isOfflineMode ? (
            <>
              <WifiOff className="text-red-500" size={16} />
              <span className="text-red-400">OFFLINE MODE</span>
            </>
          ) : (
            <>
              <Wifi className="text-green-500" size={16} />
              <span className="text-green-400">LIVE DATABASE</span>
            </>
          )}
        </div>
        <div className="text-slate-400 text-xs">
          {isOfflineMode 
            ? '✅ 已disconnect live database' 
            : '⚠️ 連接緊live Supabase'}
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1 text-slate-300 text-xs">
        <div>Current Time: {new Date().toLocaleTimeString()}</div>
        <div>Browser: {navigator.userAgent.split(' ').pop()}</div>
        <div>LocalStorage: {localStorage.length} items</div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700 text-slate-400 text-xs">
        按 <kbd className="bg-slate-700 px-1 rounded">Ctrl+Shift+D</kbd> 關閉
      </div>
    </div>
  );
};
