import React from 'react';
import { Info, Code, Database, Bug } from 'lucide-react';

interface SettingsProps {
  isDebugLogEnabled: boolean;
  onToggleDebugLog: (enabled: boolean) => void;
}

export const Settings: React.FC<SettingsProps> = ({ isDebugLogEnabled, onToggleDebugLog }) => {
  const version = "1.1.1";

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
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

       <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Bug className="w-5 h-5 text-amber-600" />
          <h2 className="text-lg font-bold text-slate-800">Debugging</h2>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>
            <label htmlFor="debug-toggle" className="font-medium text-slate-700">Enable Debug Log</label>
            <p className="text-xs text-slate-500">Shows a real-time log of database operations for troubleshooting.</p>
          </div>
          <button
            id="debug-toggle"
            role="switch"
            aria-checked={isDebugLogEnabled}
            onClick={() => onToggleDebugLog(!isDebugLogEnabled)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
              isDebugLogEnabled ? 'bg-indigo-600' : 'bg-slate-200'
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isDebugLogEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-slate-800">Supabase Configuration</h2>
        </div>
        <div className="space-y-4 text-sm text-slate-600">
          <p>
            To deploy this application on Vercel and connect it to your Supabase backend, you need to set the following environment variables in your Vercel project settings:
          </p>
          <div className="space-y-2">
            <div className="p-3 bg-slate-50 rounded-lg border">
              <code className="font-mono text-xs font-semibold text-slate-700">VITE_SUPABASE_URL</code>
              <p className="text-xs text-slate-500 mt-1">
                Your Supabase project URL. Found in your Supabase project's <span className="font-semibold">Settings &gt; API</span>.
              </p>
            </div>
             <div className="p-3 bg-slate-50 rounded-lg border">
              <code className="font-mono text-xs font-semibold text-slate-700">VITE_SUPABASE_ANON_KEY</code>
              <p className="text-xs text-slate-500 mt-1">
                Your Supabase project's anonymous key. Found in your Supabase project's <span className="font-semibold">Settings &gt; API</span>.
              </p>
            </div>
          </div>
          <p>
            After setting these variables, redeploy your Vercel project for the changes to take effect.
          </p>
        </div>
      </div>
    </div>
  );
};