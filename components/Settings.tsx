
import React, { useState } from 'react';
import { Info, Code, Database, Bug, Sparkles, ShieldAlert, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { fetchSmartsheetSheets } from '../lib/smartsheetImporter';

interface SettingsProps {
  isDebugLogEnabled: boolean;
  setIsDebugLogEnabled: (enabled: boolean) => void;
  isAIEnabled: boolean;
  setIsAIEnabled: (enabled: boolean) => void;
  smartsheetToken?: string;
  onSmartsheetTokenChange?: (token: string) => void;
  onOpenDatabaseFix: () => void;
}


export const Settings: React.FC<SettingsProps> = ({ isDebugLogEnabled, setIsDebugLogEnabled, isAIEnabled, setIsAIEnabled, smartsheetToken = '', onSmartsheetTokenChange, onOpenDatabaseFix }) => {
  const version = "2.0.0 (Production)";
  const [isTestingToken, setIsTestingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [tokenMessage, setTokenMessage] = useState('');

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
          <h2 className="text-lg font-bold text-slate-800">Tools & Debugging</h2>
        </div>
        <div className="space-y-6">
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

            <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <label htmlFor="ai-toggle" className="text-sm text-slate-600 font-medium flex items-center gap-2">
                <Sparkles size={16} className="text-indigo-500" />
                Enable AI Assistant
                <p className="text-xs text-slate-400 font-normal">Shows the floating AI chat assistant for help with planning.</p>
                </label>
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                    <input
                        type="checkbox"
                        name="ai-toggle"
                        id="ai-toggle"
                        checked={isAIEnabled}
                        onChange={(e) => setIsAIEnabled(e.target.checked)}
                        className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out"
                    />
                    <label htmlFor="ai-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-slate-300 cursor-pointer"></label>
                </div>
            </div>

            {onSmartsheetTokenChange && (
              <div className="border-t border-slate-100 pt-4">
                <label className="text-sm text-slate-600 font-medium flex items-center gap-2 mb-2">
                  <Upload size={16} className="text-indigo-500" />
                  Smartsheet API Token
                  <p className="text-xs text-slate-400 font-normal">For importing requirements from Smartsheet</p>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder="Paste your Smartsheet API token here"
                    value={smartsheetToken}
                    onChange={(e) => {
                      onSmartsheetTokenChange(e.target.value);
                      setTokenStatus('idle');
                      setTokenMessage(e.target.value.trim() ? 'Token saved locally.' : '');
                    }}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => {
                      if (smartsheetToken) {
                        localStorage.setItem('oms_smartsheet_token', smartsheetToken);
                        setTokenStatus('idle');
                        setTokenMessage('Token saved locally.');
                      }
                    }}
                    className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={async () => {
                      if (!smartsheetToken.trim()) {
                        setTokenStatus('error');
                        setTokenMessage('Please paste a Smartsheet token first.');
                        return;
                      }
                      setIsTestingToken(true);
                      setTokenStatus('idle');
                      setTokenMessage('Testing token...');
                      try {
                        const sheets = await fetchSmartsheetSheets(smartsheetToken);
                        setTokenStatus('ok');
                        setTokenMessage(`Connected. Found ${sheets.length} sheet(s).`);
                      } catch (error) {
                        const message = error instanceof Error ? error.message : 'Token test failed.';
                        setTokenStatus('error');
                        setTokenMessage(message);
                      } finally {
                        setIsTestingToken(false);
                      }
                    }}
                    disabled={isTestingToken}
                    className="px-3 py-2 bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isTestingToken ? 'Testing...' : 'Test Token'}
                  </button>
                </div>
                {tokenMessage && (
                  <div className={`mt-2 text-xs flex items-center gap-1.5 ${tokenStatus === 'ok' ? 'text-green-600' : tokenStatus === 'error' ? 'text-red-600' : 'text-slate-500'}`}>
                    {tokenStatus === 'ok' ? <CheckCircle2 size={14} /> : tokenStatus === 'error' ? <AlertCircle size={14} /> : <Upload size={14} />}
                    <span>{tokenMessage}</span>
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-2">
                  Get your token from <a href="https://smartsheet.com/settings/token" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">Smartsheet Settings</a>
                </p>
              </div>
            )}
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
          
          <div className="border-t border-slate-100 pt-4 mt-4">
             <h3 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><ShieldAlert size={16} className="text-amber-500"/> Troubleshooting</h3>
             <p className="mb-3">If you are experiencing issues with data not loading or "Infinite Recursion" errors, you may need to reset your database policies.</p>
             <button 
                onClick={onOpenDatabaseFix}
                className="px-4 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors flex items-center gap-2"
             >
                <Database size={14} /> Open Database Repair Tool
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
    