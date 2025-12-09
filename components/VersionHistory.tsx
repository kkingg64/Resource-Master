import React, { useState, useEffect } from 'react';
import { History, Save, RotateCcw, Trash2, Eye, X } from 'lucide-react';
import { IDBVersion, saveVersion, getAllVersions, deleteVersion } from '../lib/idb';

interface VersionHistoryProps {
  onClose: () => void;
  onRestore: (versionId: number) => void;
  onSaveCurrent: (name: string) => Promise<void>;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({ onClose, onRestore, onSaveCurrent }) => {
  const [versions, setVersions] = useState<IDBVersion[]>([]);
  const [newVersionName, setNewVersionName] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchVersions = async () => {
    setIsLoading(true);
    const savedVersions = await getAllVersions();
    setVersions(savedVersions);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const handleSave = async () => {
    if (!newVersionName.trim()) {
      alert('Please enter a version name.');
      return;
    }
    await onSaveCurrent(newVersionName.trim());
    setNewVersionName('');
    fetchVersions(); // Refresh the list
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this version? This cannot be undone.')) {
      await deleteVersion(id);
      fetchVersions(); // Refresh the list
    }
  };

  const handleRestore = (id: number) => {
    if (window.confirm('Are you sure you want to restore this version? It will overwrite your current plan.')) {
      onRestore(id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center animate-in fade-in duration-300" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <header className="p-4 border-b border-slate-200 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            Version History
          </h2>
          <button onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <X size={20} />
          </button>
        </header>

        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <div>
            <h3 className="text-md font-semibold text-slate-700 mb-3">Save Current Plan</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newVersionName}
                onChange={e => setNewVersionName(e.target.value)}
                placeholder="e.g., 'End of Q4 Planning'"
                className="w-full p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                <Save size={16} /> Save
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-md font-semibold text-slate-700 mb-3">Saved Versions</h3>
            {isLoading ? (
              <div className="text-center p-4 text-slate-500">Loading history...</div>
            ) : versions.length === 0 ? (
              <div className="text-center p-4 text-slate-400 border border-dashed rounded-lg">
                No versions saved yet. Use the form above to save a snapshot of your current plan.
              </div>
            ) : (
              <ul className="space-y-2">
                {versions.map(version => (
                  <li key={version.id} className="bg-slate-50 p-3 rounded-lg flex items-center justify-between border border-slate-200 hover:border-indigo-200 transition-colors">
                    <div>
                      <p className="font-semibold text-slate-800">{version.name}</p>
                      <p className="text-xs text-slate-500">
                        Saved on: {new Date(version.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestore(version.id!)}
                        className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-100 hover:bg-indigo-200 px-3 py-1.5 rounded-md transition-colors"
                        title="Restore this version"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                      <button
                        onClick={() => handleDelete(version.id!)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                        title="Delete this version"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
