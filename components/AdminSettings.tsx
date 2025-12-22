import React, { useState, useMemo } from 'react';
import { Holiday } from '../types';
import { GOV_HOLIDAYS_DB } from '../constants';
import { Globe, Download, Trash2, CalendarDays, CheckCircle, Plus, Building, Clock } from 'lucide-react';

interface AdminSettingsProps {
  holidays: Holiday[];
  onAddHolidays: (holidays: Omit<Holiday, 'id'>[]) => Promise<void>;
  onDeleteHoliday: (id: string) => Promise<void>;
  onDeleteHolidaysByCountry: (country: string) => Promise<void>;
  onUpdateHolidayDuration: (id: string, duration: number) => Promise<void>;
  isReadOnly?: boolean;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ holidays, onAddHolidays, onDeleteHoliday, onDeleteHolidaysByCountry, onUpdateHolidayDuration, isReadOnly = false }) => {
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('HK');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  
  const [newHolidayStartDate, setNewHolidayStartDate] = useState('');
  const [newHolidayEndDate, setNewHolidayEndDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDuration, setNewHolidayDuration] = useState<number>(1); // 1 = Full, 0.5 = Half

  const countries = [
    { code: 'CE', name: 'Germany (CE)' },
    { code: 'CN', name: 'China' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'MY', name: 'Malaysia' },
    { code: 'SG', name: 'Singapore' },
    { code: 'LK', name: 'Sri Lanka' },
    { code: 'UK', name: 'United Kingdom' },
    { code: 'US', name: 'United States' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  const selectedCountryName = countries.find(c => c.code === selectedCountryCode)?.name || selectedCountryCode;
  
  const sourceHolidays = GOV_HOLIDAYS_DB[selectedCountryCode] || [];
  const activeCountryHolidays = holidays.filter(h => h.country === selectedCountryCode);

  const handleSync = async () => {
    if (isReadOnly) return;
    setIsSyncing(true);
    // When syncing public holidays, default to Full Day (1.0)
    const holidaysToSync = sourceHolidays.filter(sh => !holidays.some(h => h.date === sh.date && h.country === sh.country))
      .map(h => ({ ...h, duration: 1 }));
      
    if (holidaysToSync.length > 0) {
      await onAddHolidays(holidaysToSync);
    }
    setIsSyncing(false);
  };

  const handleAddCustomHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !newHolidayStartDate || !newHolidayName.trim()) return;
    setIsAdding(true);

    const items: Omit<Holiday, 'id'>[] = [];
    const current = new Date(newHolidayStartDate);
    const end = newHolidayEndDate ? new Date(newHolidayEndDate) : new Date(newHolidayStartDate);
    
    current.setUTCHours(12,0,0,0);
    end.setUTCHours(12,0,0,0);

    while (current <= end) {
        items.push({
            date: current.toISOString().split('T')[0],
            name: newHolidayName.trim(),
            country: selectedCountryCode,
            duration: newHolidayDuration
        });
        current.setUTCDate(current.getUTCDate() + 1);
    }

    if (items.length > 0) {
        await onAddHolidays(items);
    }

    setNewHolidayStartDate('');
    setNewHolidayEndDate('');
    setNewHolidayName('');
    setNewHolidayDuration(1);
    setIsAdding(false);
  };

  const handleDeleteAllFromCountry = async () => {
    if (isReadOnly) return;
    if (window.confirm(`Are you sure you want to delete all active holidays for ${selectedCountryName}?`)) {
        await onDeleteHolidaysByCountry(selectedCountryCode);
    }
  };
  
  const isGovHoliday = (holiday: Holiday) => {
    const govHolidaysForCountry = GOV_HOLIDAYS_DB[holiday.country] || [];
    return govHolidaysForCountry.some(h => h.date === holiday.date && h.country === holiday.country);
  };

  const isHolidayActive = (sourceHoliday: Omit<Holiday, 'id'>) => {
    return holidays.some(h => h.date === sourceHoliday.date && h.country === sourceHoliday.country);
  }

  // Group holidays by country
  const groupedHolidays = useMemo(() => {
    const groups: Record<string, Holiday[]> = {};
    holidays.forEach(h => {
        if (!groups[h.country]) groups[h.country] = [];
        groups[h.country].push(h);
    });
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => a.date.localeCompare(b.date));
    });
    return groups;
  }, [holidays]);

  return (
    <div className="flex flex-col gap-6">
      <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden flex-shrink-0">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
          <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-600" />
            Select Region to Manage
          </h2>
        </div>
        <div className="flex flex-wrap gap-1 p-2">
          {countries.map(c => (
            <button
              key={c.code}
              onClick={() => setSelectedCountryCode(c.code)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${selectedCountryCode === c.code 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-100'
                }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex-shrink-0">
          <div className="flex justify-between items-start mb-4">
             <div>
               <h2 className="text-lg font-bold text-slate-800">{selectedCountryName} Holidays</h2>
               <p className="text-sm text-slate-500">Sync from public data or add custom company holidays.</p>
             </div>
             <div className="flex gap-3">
               <button 
                 onClick={handleDeleteAllFromCountry}
                 disabled={activeCountryHolidays.length === 0 || isReadOnly}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 <Trash2 size={16} />
                 Clear {selectedCountryCode}
               </button>
               <button 
                 onClick={handleSync}
                 disabled={isSyncing || sourceHolidays.every(isHolidayActive) || isReadOnly}
                 className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
               >
                 {isSyncing ? <span className="animate-spin">⌛</span> : <Download size={16} />}
                 {sourceHolidays.every(isHolidayActive) ? 'All Synced' : 'Sync Holidays'}
               </button>
             </div>
          </div>
          
          <div className="space-y-4">
             {/* Add Custom Holiday Form */}
             {!isReadOnly && (
               <div className="border-t border-slate-200 pt-4">
                 <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
                   <Building size={14} /> Add Company Holiday to {selectedCountryName}
                 </h3>
                 <form onSubmit={handleAddCustomHoliday} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-end">
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Start Date</label>
                     <input type="date" required value={newHolidayStartDate} onChange={e => setNewHolidayStartDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                   </div>
                   <div className="flex flex-col gap-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">End Date (Opt)</label>
                     <input type="date" value={newHolidayEndDate} onChange={e => setNewHolidayEndDate(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                   </div>
                   <div className="flex flex-col gap-1 md:col-span-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Holiday Name</label>
                     <input type="text" required placeholder="e.g. Company Founders Day" value={newHolidayName} onChange={e => setNewHolidayName(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg text-xs" />
                   </div>
                   <div className="flex gap-2">
                       <div className="flex-1">
                           <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                           <select value={newHolidayDuration} onChange={e => setNewHolidayDuration(parseFloat(e.target.value))} className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white">
                               <option value={1}>Full Day</option>
                               <option value={0.5}>Half Day</option>
                           </select>
                       </div>
                       <button type="submit" disabled={isAdding} className="flex-1 bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs font-bold flex items-center justify-center">
                         {isAdding ? '...' : <Plus size={16} />}
                       </button>
                   </div>
                 </form>
               </div>
             )}

             <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">
                {activeCountryHolidays.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                        No holidays configured for {selectedCountryName}.
                    </div>
                ) : (
                    groupedHolidays[selectedCountryCode]?.map(holiday => (
                        <div key={holiday.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-indigo-200 transition-colors group">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center justify-center w-10 h-10 bg-white border border-slate-200 rounded-lg shadow-sm">
                                    <span className="text-[9px] text-slate-400 font-bold uppercase">{new Date(holiday.date).toLocaleString('default', { month: 'short' })}</span>
                                    <span className="text-sm font-bold text-slate-700">{new Date(holiday.date).getDate()}</span>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-700">{holiday.name}</h4>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <span className="font-mono">{holiday.date}</span>
                                        {holiday.duration === 0.5 && <span className="flex items-center text-[10px] text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100"><Clock size={10} className="mr-1"/> 0.5 Day</span>}
                                        {isGovHoliday(holiday) ? (
                                            <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full text-[10px] font-medium"><Globe size={10} /> Public</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-slate-600 bg-slate-200 px-1.5 py-0.5 rounded-full text-[10px] font-medium"><Building size={10} /> Custom</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            {!isReadOnly && <button 
                                onClick={() => onDeleteHoliday(holiday.id)}
                                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove Holiday"
                            >
                                <Trash2 size={16} />
                            </button>}
                        </div>
                    ))
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};