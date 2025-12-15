
import React, { useState, useMemo } from 'react';
import { Resource, Role, IndividualHoliday } from '../types';
import { Users, Plus, Trash2, Calendar, ChevronDown, Edit2, Check, X } from 'lucide-react';
import { GOV_HOLIDAYS_DB } from '../constants';

interface ResourcesProps {
  resources: Resource[];
  onAddResource: (name: string, category: Role, region: string, type: 'Internal' | 'External') => Promise<void>;
  onDeleteResource: (id: string) => Promise<void>;
  onUpdateResourceCategory: (id: string, category: Role) => Promise<void>;
  onUpdateResourceRegion: (id: string, region: string | null) => Promise<void>;
  onUpdateResourceType: (id: string, type: 'Internal' | 'External') => Promise<void>;
  onUpdateResourceName: (id: string, name: string) => Promise<void>;
  onAddIndividualHoliday: (resourceId: string, items: { date: string, name: string }[]) => Promise<void>;
  onDeleteIndividualHoliday: (holidayId: string) => Promise<void>;
}

const IndividualHolidayManager: React.FC<{
  resource: Resource;
  onAdd: (items: { date: string, name: string }[]) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}> = ({ resource, onAdd, onDelete }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [name, setName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !name.trim()) return;
    setIsAdding(true);

    const items: { date: string, name: string }[] = [];
    const current = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    
    // Normalize to noon to avoid timezone shift issues during loop
    current.setUTCHours(12,0,0,0);
    end.setUTCHours(12,0,0,0);

    while (current <= end) {
        items.push({
            date: current.toISOString().split('T')[0],
            name: name.trim()
        });
        current.setUTCDate(current.getUTCDate() + 1);
    }

    if (items.length > 0) {
        await onAdd(items);
    }
    
    setStartDate('');
    setEndDate('');
    setName('');
    setIsAdding(false);
  };
  
  const regionalHolidays = GOV_HOLIDAYS_DB[resource.holiday_region || ''] || [];
  const allHolidays = [
    ...regionalHolidays.map(h => ({ ...h, type: 'Regional' as const })),
    ...(resource.individual_holidays || []).map(h => ({ ...h, type: 'Individual' as const })),
  ].sort((a,b) => a.date.localeCompare(b.date));


  return (
    <div className="bg-slate-100 p-4 rounded-b-lg border-t border-slate-200">
       <h4 className="text-xs font-bold text-slate-600 mb-3">Manage Individual Holidays</h4>
      <form onSubmit={handleAddHoliday} className="grid gap-2 mb-4">
        <div className="flex gap-2">
            <div className="flex flex-col gap-1 w-32">
                <label className="text-[10px] font-bold text-slate-500 uppercase">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className="p-2 border border-slate-300 rounded-lg text-sm"/>
            </div>
            <div className="flex flex-col gap-1 w-32">
                <label className="text-[10px] font-bold text-slate-500 uppercase">To (Optional)</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-2 border border-slate-300 rounded-lg text-sm"/>
            </div>
        </div>
        <div className="flex gap-2">
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Annual Leave" required className="flex-1 p-2 border border-slate-300 rounded-lg text-sm"/>
            <button type="submit" disabled={isAdding} className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50">Add</button>
        </div>
      </form>
      
      <div className="max-h-48 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
        {allHolidays.length === 0 && <p className="text-xs text-slate-500 text-center py-2">No regional or individual holidays.</p>}
        {allHolidays.map((holiday, index) => (
          <div key={`${holiday.date}-${index}`} className={`flex items-center justify-between p-2 rounded text-xs ${holiday.type === 'Individual' ? 'bg-white' : 'bg-transparent'}`}>
            <div className="flex items-center gap-2">
              <span className={`font-mono ${holiday.type === 'Individual' ? 'text-indigo-600' : 'text-slate-500'}`}>{holiday.date}</span>
              <span className="font-medium text-slate-800">{holiday.name}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${holiday.type === 'Individual' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'}`}>
                {holiday.type}
              </span>
            </div>
            {holiday.type === 'Individual' && (
              <button onClick={() => onDelete(holiday.id)} className="p-1 text-slate-400 hover:text-red-500 rounded-full"><Trash2 size={12} /></button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};


export const Resources: React.FC<ResourcesProps> = ({ resources, onAddResource, onDeleteResource, onUpdateResourceCategory, onUpdateResourceRegion, onUpdateResourceType, onUpdateResourceName, onAddIndividualHoliday, onDeleteIndividualHoliday }) => {
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceCategory, setNewResourceCategory] = useState<Role>(Role.EA);
  const [newResourceRegion, setNewResourceRegion] = useState<string>('HK');
  const [newResourceType, setNewResourceType] = useState<'Internal' | 'External'>('Internal');
  const [isAdding, setIsAdding] = useState(false);
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);
  
  // Name Editing State
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResourceName.trim() || isAdding) return;
    
    setIsAdding(true);
    await onAddResource(newResourceName.trim(), newResourceCategory, newResourceRegion, newResourceType);
    setIsAdding(false);
    setNewResourceName('');
  };
  
  const startEditing = (resource: Resource) => {
      setEditingResourceId(resource.id);
      setTempName(resource.name);
  };

  const saveName = async () => {
      if (editingResourceId && tempName.trim()) {
          await onUpdateResourceName(editingResourceId, tempName.trim());
      }
      setEditingResourceId(null);
  };

  const cancelEditing = () => {
      setEditingResourceId(null);
      setTempName('');
  };
  
  const categoryColors: Record<Role, string> = {
    [Role.CNF]: 'bg-slate-100 text-slate-800 border-slate-200 focus:ring-slate-500',
    [Role.BRAND_SOLUTIONS]: 'bg-orange-100 text-orange-800 border-orange-200 focus:ring-orange-500',
    [Role.COE]: 'bg-cyan-100 text-cyan-800 border-cyan-200 focus:ring-cyan-500',
    [Role.EA]: 'bg-pink-100 text-pink-800 border-pink-200 focus:ring-pink-500',
    [Role.DM]: 'bg-yellow-100 text-yellow-800 border-yellow-200 focus:ring-yellow-500',
    [Role.DEV]: 'bg-blue-100 text-blue-800 border-blue-200 focus:ring-blue-500',
    [Role.PREP_DEV]: 'bg-teal-100 text-teal-800 border-teal-200 focus:ring-teal-500',
    [Role.PLM_D365]: 'bg-green-100 text-green-800 border-green-200 focus:ring-green-500',
    [Role.BA]: 'bg-purple-100 text-purple-800 border-purple-200 focus:ring-purple-500',
    [Role.APP_SUPPORT]: 'bg-red-100 text-red-800 border-red-200 focus:ring-red-500',
  };

  const countries = Object.keys(GOV_HOLIDAYS_DB);

  const groupedAndSortedResources = useMemo(() => {
    const groups: Record<string, Record<string, Resource[]>> = {};

    resources.forEach(resource => {
        const department = resource.category || 'Uncategorized';
        const country = resource.holiday_region || 'No Region';

        if (!groups[department]) {
            groups[department] = {};
        }
        if (!groups[department][country]) {
            groups[department][country] = [];
        }
        groups[department][country].push(resource);
    });

    const sortedDepartments = Object.keys(groups).sort((a, b) => a.localeCompare(b));
    
    return sortedDepartments.map(department => ({
        department,
        countries: Object.keys(groups[department]).sort((a, b) => a.localeCompare(b)).map(country => ({
            country,
            resources: groups[department][country] // Already sorted by name from App.tsx
        }))
    }));
  }, [resources]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Manage Resources & Holidays</h2>
        </div>
        
        <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-6 items-center">
          <input type="text" value={newResourceName} onChange={(e) => setNewResourceName(e.target.value)} placeholder="e.g., John Doe" className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm md:col-span-2"/>
          <select value={newResourceCategory} onChange={(e) => setNewResourceCategory(e.target.value as Role)} className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
            {Object.values(Role).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
          </select>
           <div className="flex gap-2">
            <select value={newResourceType} onChange={(e) => setNewResourceType(e.target.value as 'Internal' | 'External')} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
              <option value="Internal">Internal</option>
              <option value="External">External</option>
            </select>
            <select value={newResourceRegion} onChange={(e) => setNewResourceRegion(e.target.value)} className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white">
              {countries.map(code => (<option key={code} value={code}>{code}</option>))}
            </select>
           </div>
          <button type="submit" disabled={isAdding || !newResourceName.trim()} className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            <Plus size={16} />{isAdding ? 'Adding...' : 'Add Resource'}
          </button>
        </form>

        <div className="space-y-2">
          {resources.length === 0 ? (
            <div className="text-center p-4 text-slate-400 border border-dashed rounded-lg">No resources added yet.</div>
          ) : (
             <div className="border border-slate-200 rounded-lg overflow-hidden">
                {groupedAndSortedResources.map(({ department, countries: countryGroups }) => (
                  <div key={department} className="border-b border-slate-200 last:border-b-0">
                    <h3 className="bg-slate-100 p-3 text-sm font-bold text-slate-700 tracking-wider uppercase">{department}</h3>
                    {countryGroups.map(({ country, resources: countryResources }) => (
                      <div key={country}>
                        <h4 className="bg-slate-50 px-6 py-2 text-xs font-semibold text-slate-500 uppercase border-y border-slate-100">{country}</h4>
                        <ul>
                          {countryResources.map(resource => (
                            <li key={resource.id} className="border-b border-slate-100 last:border-b-0">
                              <div className="p-3 pl-6 grid grid-cols-3 items-center gap-4 hover:bg-slate-50/50">
                                <div className="flex items-center gap-3">
                                  {editingResourceId === resource.id ? (
                                      <div className="flex items-center gap-1 w-full max-w-xs">
                                          <input 
                                            type="text" 
                                            value={tempName} 
                                            onChange={(e) => setTempName(e.target.value)} 
                                            className="text-sm border border-indigo-300 rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                            autoFocus
                                            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); else if (e.key === 'Escape') cancelEditing(); }}
                                          />
                                          <button onClick={saveName} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check size={14} /></button>
                                          <button onClick={cancelEditing} className="p-1 text-red-600 hover:bg-red-50 rounded"><X size={14} /></button>
                                      </div>
                                  ) : (
                                      <div className="flex items-center gap-2 group/name cursor-pointer" onClick={() => startEditing(resource)}>
                                          <span className="font-medium text-slate-700 w-32 truncate" title={resource.name}>{resource.name}</span>
                                          <Edit2 size={12} className="text-slate-300 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                                      </div>
                                  )}
                                  
                                  <select value={resource.category} onChange={(e) => onUpdateResourceCategory(resource.id, e.target.value as Role)} className={`text-xs font-semibold rounded-full appearance-none bg-transparent border px-2 py-0.5 focus:ring-2 cursor-pointer ${categoryColors[resource.category] || 'bg-slate-100 text-slate-600 border-slate-200 focus:ring-slate-500'}`}>
                                    {Object.values(Role).map(cat => (<option key={cat} value={cat}>{cat}</option>))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-2">
                                  <select value={resource.type || 'Internal'} onChange={(e) => onUpdateResourceType(resource.id, e.target.value as 'Internal' | 'External')} className="text-xs font-medium rounded-md appearance-none bg-white border border-slate-200 px-2 py-1 focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                                    <option value="Internal">Internal</option>
                                    <option value="External">External</option>
                                  </select>
                                  <select value={resource.holiday_region || ''} onChange={(e) => onUpdateResourceRegion(resource.id, e.target.value || null)} className="text-xs font-medium rounded-md appearance-none bg-white border border-slate-200 px-2 py-1 focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                                    <option value="">No Region</option>
                                    {countries.map(code => (<option key={code} value={code}>{code} Holidays</option>))}
                                  </select>
                                </div>
                                <div className="flex items-center gap-3 justify-end">
                                  <button onClick={() => setExpandedResourceId(prev => prev === resource.id ? null : resource.id)} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${expandedResourceId === resource.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-100'}`}>
                                    <Calendar size={12} /> Holidays <ChevronDown size={14} className={`transition-transform ${expandedResourceId === resource.id ? 'rotate-180' : ''}`} />
                                  </button>
                                  <button onClick={() => onDeleteResource(resource.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors" title={`Delete ${resource.name}`}>
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </div>
                              {expandedResourceId === resource.id && (
                                <IndividualHolidayManager
                                  resource={resource}
                                  onAdd={(items) => onAddIndividualHoliday(resource.id, items)}
                                  onDelete={onDeleteIndividualHoliday}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
          )}
        </div>
      </div>
    </div>
  );
};
