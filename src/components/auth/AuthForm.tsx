'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setStoredUser, AuthUser } from '@/lib/auth';
import { db as localDb } from '@/lib/db';
import { 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  KeyRound
} from 'lucide-react';

export const AuthForm: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Check if a master password already exists
  useEffect(() => {
    const existing = localStorage.getItem('kamai_master_password');
    setHasPassword(!!existing);
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const savedPassword = localStorage.getItem('kamai_master_password');
      if (password !== savedPassword) {
        throw new Error('Incorrect Password. Please try again.');
      }

      setWelcomeMessage('App Unlocked Successfully!');
      
      // Simulate network delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      await performLocalLogin();

    } catch (err: any) {
      setError(err.message || 'Failed to unlock app.');
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (password.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match.');
      }

      // Save password locally
      localStorage.setItem('kamai_master_password', password);
      
      setWelcomeMessage('Master Password Set Successfully!');
      
      await new Promise(resolve => setTimeout(resolve, 800));

      await performLocalLogin();

    } catch (err: any) {
      setError(err.message || 'Failed to set password.');
      setLoading(false);
    }
  };

  const performLocalLogin = async () => {
    // Generate or fetch local offline user
    let localBiz = await localDb.businesses.toCollection().first();
    let bizId = localBiz?.id || 'biz_pending';
    let bizName = localBiz?.name || 'My Offline Store';

    const localUser: AuthUser = {
      uid: 'local_admin',
      id: 'local_admin',
      name: 'Store Owner',
      role: 'admin',
      business_id: bizId,
      business_name: bizName,
      shop_name: bizName,
    };

    setStoredUser(localUser);

    // Give UI a moment to show the welcome banner
    setTimeout(() => {
      if (!localBiz) {
        router.replace('/onboarding');
      } else {
        router.replace('/');
      }
    }, 500);
  };

  if (hasPassword === null) return null;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-500" />

      <div className="text-center mb-6">
        <div className="mx-auto w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-inner border border-slate-700">
          <ShieldCheck className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
          {hasPassword ? 'Unlock KamaiPlus' : 'Set Master Password'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {hasPassword ? 'Enter your password to open your store.' : 'Secure your offline store with a password.'}
        </p>
      </div>

      {welcomeMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-black text-white text-sm">{welcomeMessage} 👋</div>
            <div className="text-xs text-emerald-300/80">Opening your store &amp; POS billing counter...</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {hasPassword ? (
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">Master Password / PIN</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-600 outline-none"
                placeholder="••••••••"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl hover:shadow-amber-500/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            <span>Unlock App</span>
          </button>
        </form>
      ) : (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">Create Password / PIN</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="password"
                required
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-600 outline-none"
                placeholder="Enter new password"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">Confirm Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <CheckCircle2 className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all placeholder:text-slate-600 outline-none"
                placeholder="Re-enter password"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl hover:shadow-amber-500/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span>Set Password & Start</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default AuthForm;
