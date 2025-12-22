

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
  /* Added isReadOnly property to AdminSettingsProps to fix assignment error in App.tsx */
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
    /* Guard against sync in read-only mode */
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
    /* Guard against adding custom holidays in read-only mode */
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
    /* Guard against delete action in read-only mode */
    if (isReadOnly) return;
    if (window.confirm(`Are you sure you want to delete all active holidays for ${selectedCountryName}?`)) {
        await onDeleteHolidaysByCountry(selectedCountryCode);
    }
  };
  
  const isGovHoliday = (holiday: Holiday) => {
    const govHolidaysForCountry = GOV_HOLIDAYS_DB[holiday.country] || [];
    // Check only date and country for a match, as names can sometimes differ slightly.
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
    // Sort holidays within groups by date
    Object.keys(groups).forEach(key => {
        groups[key].sort((a, b) => a.date.localeCompare(b.date));
    });
    return groups;
  }, [holidays]);

  const sortedCountryCodes = Object.keys(groupedHolidays).sort();

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
                   <div className="