// components/OfflineLoginScreen.tsx
import React, { useState } from 'react';
import { mockAuthManager } from '../lib/mockAuth';
import { loadSampleDataFromJSON } from '../lib/offlineDataLoader';
import { LogIn, Download } from 'lucide-react';

interface OfflineLoginScreenProps {
  onLogin: (session: any) => void;
}

export const OfflineLoginScreen: React.FC<OfflineLoginScreenProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('dev@localhost');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate login delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const session = mockAuthManager.createMockSession(email);
    onLogin(session);

    setIsLoading(false);
  };

  const handleLoadSampleData = async () => {
    setLoadingData(true);
    try {
      const result = await loadSampleDataFromJSON();
      if (result.success) {
        setDataLoaded(true);
        console.log('✅ Sample data loaded successfully!');
      } else {
        alert('❌ Failed to load sample data');
      }
    } catch (error) {
      console.error('Error loading sample data:', error);
      alert('❌ Error loading sample data');
    } finally {
      setLoadingData(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white p-8 rounded-xl shadow-2xl border border-slate-200 max-w-md w-full">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">⚙️</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Resource Master</h1>
          </div>
          <p className="text-sm text-slate-500">Offline Development Mode</p>
        </div>

        {/* Warning Banner */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
          <p className="text-xs text-yellow-800">
            <span className="font-semibold">⚠️ Offline Mode:</span> Using local data only. Changes won't sync to live database.
          </p>
        </div>

        {/* Load Sample Data Section */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900 mb-3">
            💾 <span className="font-semibold">Load Test Data:</span> Click to load 22 sample records for testing
          </p>
          <button
            onClick={handleLoadSampleData}
            disabled={loadingData || dataLoaded}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download size={18} />
            {loadingData ? 'Loading...' : dataLoaded ? '✅ Data Loaded' : 'Load Sample Data'}
          </button>
          {dataLoaded && (
            <p className="text-xs text-blue-700 mt-2">
              ✅ 22 records loaded! Ready to test.
            </p>
          )}
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email (for mock session)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dev@localhost"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn size={18} />
            {isLoading ? 'Logging in...' : 'Start Development'}
          </button>
        </form>

        {/* Info */}
        <div className="mt-6 pt-6 border-t border-slate-200">
          <p className="text-xs text-slate-500 text-center">
            💡 Tip: All data is stored locally in <code className="bg-slate-100 px-1 rounded">localStorage</code>
          </p>
        </div>
      </div>
    </div>
  );
};
