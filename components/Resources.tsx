
import React, { useState } from 'react';
import { Resource } from '../types';
import { Users, Plus, Trash2 } from 'lucide-react';

interface ResourcesProps {
  resources: Resource[];
  onAddResource: (name: string) => Promise<void>;
  onDeleteResource: (id: string) => Promise<void>;
}

export const Resources: React.FC<ResourcesProps> = ({ resources, onAddResource, onDeleteResource }) => {
  const [newResourceName, setNewResourceName] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResourceName.trim() || isAdding) return;
    
    setIsAdding(true);
    await onAddResource(newResourceName.trim());
    setIsAdding(false);
    setNewResourceName('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-6 h-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-slate-800">Manage Resources</h2>
        </div>
        
        <form onSubmit={handleAdd} className="flex gap-2 mb-6">
          <input
            type="text"
            value={newResourceName}
            onChange={(e) => setNewResourceName(e.target.value)}
            placeholder="e.g., John Doe"
            className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <button
            type="submit"
            disabled={isAdding || !newResourceName.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
            {isAdding ? 'Adding...' : 'Add Resource'}
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
                  <span className="font-medium text-slate-700">{resource.name}</span>
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
