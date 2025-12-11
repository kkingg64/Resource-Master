import React from 'react';
import { Info, Code, Database, Bug } from 'lucide-react';

interface SettingsProps {
  isDebugLogEnabled: boolean;
  setIsDebugLogEnabled: (enabled: boolean) => void;
}


export const Settings: React.FC<SettingsProps> = ({ isDebugLogEnabled, setIsDebugLogEnabled }) => {
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
        <div className="flex items-center justify-between">
            <label htmlFor="debug-toggle" className="text-sm text-slate-600 font-medium">
              Enable Debug Log Panel
              <p className="text-xs text-slate-400 font-normal">Shows a real-time log of database operations.</p>
            </label>
            <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                <input
                    type="checkbox"
                    name="debug-toggle"
                    id="debug-toggle"
                    checked={isDebugLogEnabled}
                    onChange={(e) => setIsDebugLogEnabled(e.target.checked)}
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                />
                <label htmlFor="debug-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
            </div>
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
