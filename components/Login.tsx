
import React from 'react';
import { MOCK_USERS } from '../constants';
import { User } from '../types';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-slate-200">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-indigo-600/30">
            OM
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Welcome Back</h1>
          <p className="text-slate-500 mt-2 text-center">Sign in to OMS Resource Master to manage your projects.</p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => onLogin(MOCK_USERS[0])}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>
          
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">Demo Modes</span>
            </div>
          </div>

          <button
            onClick={() => onLogin(MOCK_USERS[1])}
            className="w-full flex items-center justify-center gap-3 bg-slate-800 hover:bg-slate-900 text-white font-medium py-3 px-4 rounded-xl transition-all shadow-lg shadow-slate-900/10"
          >
            Login as Guest Viewer
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-slate-400">
          <p>This is a secure demo environment.</p>
          <p>&copy; 2025 OMS Resource Master</p>
        </div>
      </div>
    </div>
  );
};
