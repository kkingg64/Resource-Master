
import React, { useState } from 'react';
// FIX: Replaced non-existent ResourceCategory with Role enum.
import { Resource, Role } from '../types';
import { Users, Plus, Trash2 } from 'lucide-react';

interface ResourcesProps {
  resources: Resource[];
  // FIX: Changed category type from ResourceCategory to Role.
  onAddResource: (name: string, category: Role) => Promise<void>;
  onDeleteResource: (id: string) => Promise<void>;
}

export const Resources: React.FC<ResourcesProps> = ({ resources, onAddResource, onDeleteResource }) => {
  const [newResourceName, setNewResourceName] = useState('');
  // FIX: Changed state to use Role enum and a default value from it.
  const [newResourceCategory, setNewResourceCategory] = useState<Role>(Role.DEV);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResourceName.trim() || isAdding) return;
    
    setIsAdding(true);
    await onAddResource(newResourceName.trim(), newResourceCategory);
    setIsAdding(false);
    setNewResourceName('');
  };
  
  // FIX: Updated categoryColors to match the Role enum.
  const categoryColors: Record<Role, string> = {
    [Role.DEV]: 'bg-blue-100 text-blue-800',
    [Role.QA]: 'bg-green-100 text-green-800',
    [Role.UIUX]: 'bg-orange-100 text-orange-800',
    [Role.PM]: 'bg-gray-100 text-gray-800',
    [Role.BA]: 'bg-purple-100 text-purple-800',
    [Role.DATA]: 'bg-cyan-100 text-cyan-800',
    [Role.APP_SUPPORT]: 'bg-red-100 text-red-800',
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Manage Resources</h2>
        </div>
        
        <form onSubmit={handleAdd} className="flex gap-2 mb-6 items-center">
          <input
            type="text"
            value={newResourceName}
            onChange={(e) => setNewResourceName(e.target.value)}
            placeholder="e.g., John Doe"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          {/* FIX: Changed select to use Role enum and cast value correctly. */}
          <select
            value={newResourceCategory}
            onChange={(e) => setNewResourceCategory(e.target.value as Role)}
            className="p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
          >
            {Object.values(Role).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAdding || !newResourceName.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {isAdding ? 'Adding...' : 'Add'}
          </button>
        </form>

        <div className="space-y-2">
          {resources.length === 0 ? (
            <div className="text-center p-4 text-slate-400 border border-dashed rounded-lg">
              No resources added yet.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border rounded-lg">
              {resources.map(resource => (
                <li key={resource.id} className="p-3 flex items-center justify-between hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-slate-700">{resource.name}</span>
                    {/* FIX: Use correct category colors for Role. The key is now of type Role. */}
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${categoryColors[resource.category] || 'bg-slate-100 text-slate-600'}`}>
                      {resource.category}
                    </span>
                  </div>
                  <button
                    onClick={() => onDeleteResource(resource.id)}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    title={`Delete ${resource.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
