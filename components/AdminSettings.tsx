
import React, { useState } from 'react';
import { Holiday } from '../types';
import { GOV_HOLIDAYS_DB } from '../constants';
import { Globe, Download, Trash2, CalendarDays, CheckCircle, XCircle } from 'lucide-react';

interface AdminSettingsProps {
  holidays: Holiday[];
  onUpdateHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ holidays, onUpdateHolidays }) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('HK');
  const [isSyncing, setIsSyncing] = useState(false);

  const countries = [
    { code: 'HK', name: 'Hong Kong' },
    { code: 'CN', name: 'China' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'US', name: 'United States' },
  ];

  const selectedCountryName = countries.find(c => c.code === selectedCountryCode)?.name || selectedCountryCode;
  
  // Holidays available in mock DB for selected country
  const sourceHolidays = GOV_HOLIDAYS_DB[selectedCountryCode] || [];

  // Filter active holidays to see which ones belong to the selected country
  const activeCountryHolidays = holidays.filter(h => h.country === selectedCountryCode);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      onUpdateHolidays((prevHolidays) => {
        const existingIds = new Set(prevHolidays.map(h => h.id));
        const newHolidays = sourceHolidays.filter(h => !existingIds.has(h.id));
        return [...prevHolidays, ...newHolidays];
      });
      setIsSyncing(false);
    }, 500);
  };

  const handleDeleteAllFromCountry = () => {
    if (window.confirm(`Are you sure you want to remove all holidays for ${selectedCountryName}?`)) {
      onUpdateHolidays((prevHolidays) => prevHolidays.filter(h => h.country !== selectedCountryCode));
    }
  };

  const handleDeleteSingle = (id: string) => {
    onUpdateHolidays((prevHolidays) => prevHolidays.filter(h => h.id !== id));
  };

  const isHolidayActive = (id: string) => holidays.some(h => h.id === id);

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      {/* Left Sidebar: Country Selection */}
      <div className="w-64 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            Regions
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {countries.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCountryCode(c.code)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between
                ${selectedCountryCode === c.code 
                  ? 'bg-indigo-50 text-indigo-700' 
                  : 'text-slate-600 hover:bg-slate-50'
                }`}
            >
              <span>{c.name}</span>
              {selectedCountryCode === c.code && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* Top Panel: Source Data & Actions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
             <div>
               <h2 className="text-lg font-bold text-slate-800">{selectedCountryName} Holidays</h2>
               <p className="text-sm text-slate-500">Manage public holidays for this region.</p>
             </div>
             <div className="flex gap-3">
               <button 
                 onClick={handleDeleteAllFromCountry}
                 disabled={activeCountryHolidays.length === 0}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Trash2 size={16} />
                 Clear {selectedCountryCode}
               </button>
               <button 
                 onClick={handleSync}
                 disabled={isSyncing || sourceHolidays.every(h => isHolidayActive(h.id))}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               >
                 {isSyncing ? <span className="animate-spin">⌛</span> : <Download size={16} />}
                 {sourceHolidays.every(h => isHolidayActive(h.id)) ? 'All Synced' : 'Sync Holidays'}
               </button>
             </div>
          </div>

          {/* Preview List */}
          <div className="border rounded-lg border-slate-200 overflow-hidden">
             <div className="bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
               Available Government Data ({sourceHolidays.length})
             </div>
             <div className="max-h-40 overflow-y-auto bg-slate-50/30">
                {sourceHolidays.length === 0 ? (
                  <div className="p-4 text-center text-sm text-slate-400">No data available for this region.</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                    {sourceHolidays.map(h => {
                      const isActive = isHolidayActive(h.id);
                      return (
                        <div key={h.id} className={`flex items-center gap-2 p-2 rounded border text-xs ${isActive ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                           {isActive ? <CheckCircle size={14} className="text-green-600" /> : <div className="w-3.5 h-3.5 rounded-full border border-slate-300"></div>}
                           <span className="font-mono text-slate-500">{h.date}</span>
                           <span className="font-medium text-slate-700 truncate">{h.name}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* Bottom Panel: All Active Holidays */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-slate-500" />
              All Active Holidays Configuration
            </h3>
            <span className="text-xs font-medium bg-white px-2 py-1 rounded border border-slate-200 text-slate-600">
              Total: {holidays.length}
            </span>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
             <table className="w-full text-sm text-left">
               <thead className="bg-white text-slate-600 sticky top-0 z-10 shadow-sm">
                 <tr>
                   <th className="p-3 font-semibold border-b w-32">Date</th>
                   <th className="p-3 font-semibold border-b">Holiday Name</th>
                   <th className="p-3 font-semibold border-b w-24">Region</th>
                   <th className="p-3 font-semibold border-b w-16 text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {holidays.length === 0 && (
                   <tr>
                     <td colSpan={4} className="p-8 text-center text-slate-400">
                       No active holidays. Sync from a region above.
                     </td>
                   </tr>
                 )}
                 {/* Sort by date */}
                 {[...holidays].sort((a, b) => a.date.localeCompare(b.date)).map((h) => (
                   <tr key={h.id} className={`hover:bg-slate-50 ${h.country === selectedCountryCode ? 'bg-indigo-50/30' : ''}`}>
                     <td className="p-3 font-mono text-slate-600">{h.date}</td>
                     <td className="p-3 font-medium text-slate-800">{h.name}</td>
                     <td className="p-3">
                       <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${h.country === selectedCountryCode ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'}`}>
                         {h.country}
                       </span>
                     </td>
                     <td className="p-3 text-right">
                       <button 
                         onClick={() => handleDeleteSingle(h.id)}
                         className="text-slate-400 hover:text-red-600 transition-colors"
                         title="Remove holiday"
                       >
                         <Trash2 size={14} />
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        </div>

      </div>
    </div>
  );
};
