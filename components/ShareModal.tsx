
import React, { useState } from 'react';
import { Project } from '../types';
import { X, Share2, Users, Send } from 'lucide-react';

interface ShareModalProps {
  project: Project;
  onClose: () => void;
  onShare: (email: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ project, onClose, onShare }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onShare(email);
      setEmail('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg m-4">
        <div className="flex justify-between items-center p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">Share "{project.name}"</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter user email to share with"
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Send size={16} />
              Share
            </button>
          </form>
          <p className="text-xs text-slate-400 mt-2">Shared users will have view-only access.</p>
        </div>

        <div className="bg-slate-50 p-4 border-t border-slate-200 rounded-b-xl">
          <h3 className="text-sm font-semibold text-slate-600 mb-2 flex items-center gap-2">
             <Users size={16} />
             Shared with
          </h3>
          <div className="space-y-1">
            {(!project.shared_with || project.shared_with.length === 0) ? (
              <p className="text-xs text-slate-400 italic">Not shared with anyone yet.</p>
            ) : (
              project.shared_with.map(userEmail => (
                <div key={userEmail} className="bg-white text-xs text-slate-700 px-2 py-1 rounded border border-slate-200">
                  {userEmail}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
