
import React, { useState } from 'react';
import { X, UserPlus, Users, Link as LinkIcon, Check } from 'lucide-react';
import { Project } from '../types';

interface ShareModalProps {
  project: Project;
  onClose: () => void;
  onShare: (email: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ project, onClose, onShare }) => {
  const [email, setEmail] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onShare(email);
      setEmail('');
    }
  };

  const copyLink = () => {
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users size={18} className="text-indigo-600" />
            Share "{project.name}"
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">Invite people</label>
            <div className="flex gap-2">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Add email address (e.g. jane@oms.com)"
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button 
                type="submit"
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <UserPlus size={16} /> Invite
              </button>
            </div>
          </form>

          <div className="mb-6">
             <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">People with access</h4>
             <div className="space-y-3">
                <div className="flex items-center justify-between">
                   <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                         OWN
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">Owner</div>
                        <div className="text-xs text-slate-500">Full Access</div>
                      </div>
                   </div>
                   <span className="text-xs text-slate-400">Owner</span>
                </div>

                {project.sharedWith.length === 0 && (
                   <p className="text-sm text-slate-400 italic pl-11">No one else has access.</p>
                )}

                {project.sharedWith.map((email, idx) => (
                   <div key={idx} className="flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">
                           {email.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-800">{email}</div>
                          <div className="text-xs text-slate-500">Viewer</div>
                        </div>
                     </div>
                     <select className="text-xs border-none bg-transparent text-slate-500 cursor-pointer focus:ring-0">
                       <option>Can view</option>
                     </select>
                   </div>
                ))}
             </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button 
              type="button" 
              onClick={copyLink}
              className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {isCopied ? <Check size={16} /> : <LinkIcon size={16} />}
              {isCopied ? 'Link Copied!' : 'Copy Link'}
            </button>
            <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
