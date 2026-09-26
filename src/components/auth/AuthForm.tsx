'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredUser, setStoredUser, AuthUser } from '@/lib/auth';
import { db as localDb } from '@/lib/db';
import { clearMasterPasswordAfterRecovery, hasMasterPassword, markUnlocked, setMasterPassword, verifyMasterPassword } from '@/lib/auth/masterPassword';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { 
  CheckCircle2, 
  AlertCircle, 
  Lock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  KeyRound
} from 'lucide-react';
import { tr } from '@/lib/i18n/core';

export const AuthForm: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot password: the licence key of this computer lets the owner set a new one.
  const [recovering, setRecovering] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const api = getDesktopApi();
    if (!api) {
      setError(tr('Password recovery works in the installed KamaiPlus Desktop app.'));
      return;
    }
    setLoading(true);
    const res = await api.verifyLicenceKey(recoveryKey).catch(() => ({ ok: false, error: tr('Could not check the key. Please try again.') }));
    setLoading(false);
    if (!res.ok) {
      setError(res.error || tr('That key did not match.'));
      return;
    }
    clearMasterPasswordAfterRecovery();
    setRecovering(false);
    setRecoveryKey('');
    setPassword('');
    setConfirmPassword('');
    setHasPassword(false);
    setNotice(tr('Licence key verified. Set a new password — all your bills and data are safe.'));
  };

  // Check if a master password already exists
  useEffect(() => {
    setHasPassword(hasMasterPassword());
  }, []);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!(await verifyMasterPassword(password))) {
        throw new Error(tr('Incorrect Password. Please try again.'));
      }

      setWelcomeMessage(tr('App Unlocked Successfully!'));
      
      // Simulate network delay for UX
      await new Promise(resolve => setTimeout(resolve, 800));

      await performLocalLogin();

    } catch (err: any) {
      setError(err.message || tr('Failed to unlock app.'));
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (password.length < 4) {
        throw new Error(tr('Password must be at least 4 characters long.'));
      }
      if (password !== confirmPassword) {
        throw new Error(tr('Passwords do not match.'));
      }

      // Save only a salted hash of the password on this computer
      await setMasterPassword(password);
      
      setWelcomeMessage(tr('Master Password Set Successfully!'));
      
      await new Promise(resolve => setTimeout(resolve, 800));

      await performLocalLogin();

    } catch (err: any) {
      setError(err.message || tr('Failed to set password.'));
      setLoading(false);
    }
  };

  const performLocalLogin = async () => {
    markUnlocked();
    // Generate or fetch local offline user
    let localBiz = await localDb.businesses.toCollection().first();

    // Unlocking a shop that is still signed in (app restart): keep its user as it
    // is (owner name etc.), only renew the session time.
    const existing = getStoredUser();
    if (localBiz && existing && existing.business_id === localBiz.id) {
      setStoredUser({ ...existing, login_timestamp: Date.now() });
      setTimeout(() => router.replace('/'), 500);
      return;
    }
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
          {hasPassword ? tr('Unlock KamaiPlus') : tr('Set Master Password')}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {hasPassword ? tr('Enter your password to open your store.') : tr('Secure your offline store with a password.')}
        </p>
      </div>

      {welcomeMessage && (
        <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-3 animate-in fade-in zoom-in-95">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="font-black text-white text-sm">{welcomeMessage} 👋</div>
            <div className="text-xs text-emerald-300/80">{tr('Opening your store & POS billing counter...')}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5 animate-in fade-in zoom-in-95">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && !error && (
        <div className="mb-4 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {recovering ? (
        <form onSubmit={handleRecover} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            {tr('Forgot your password? Enter the')} <span className="font-bold text-slate-200">{tr('licence key')}</span> {tr('you received when you bought KamaiPlus (it starts with')} <span className="font-mono">KPD-</span>{tr('). Your bills and data are not touched.')}
          </p>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <KeyRound className="h-4 w-4 text-slate-500" />
            </div>
            <input
              required
              autoFocus
              spellCheck={false}
              value={recoveryKey}
              onChange={(e) => setRecoveryKey(e.target.value.toUpperCase())}
              className="block w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-white text-sm font-mono tracking-wider focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 outline-none placeholder:text-slate-600"
              placeholder={tr('KPD-XXXX-XXXX-XXXX-XXXX')}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !recoveryKey.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{tr('Verify Key & Reset Password')}</span>
          </button>
          <button type="button" onClick={() => { setRecovering(false); setError(''); }} className="w-full text-xs text-slate-400 hover:text-white cursor-pointer">
            {tr('Back to unlock')}
          </button>
        </form>
      ) : hasPassword ? (
        <form onSubmit={handleUnlock} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">{tr('Master Password / PIN')}</label>
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
            <span>{tr('Unlock App')}</span>
          </button>
          <button
            type="button"
            onClick={() => { setRecovering(true); setError(''); setNotice(null); }}
            className="w-full text-xs font-semibold text-slate-400 hover:text-amber-400 cursor-pointer"
          >
            {tr('Forgot password?')}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">{tr('Create Password / PIN')}</label>
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
                placeholder={tr('Enter new password')}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 ml-1">{tr('Confirm Password')}</label>
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
                placeholder={tr('Re-enter password')}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl hover:shadow-amber-500/20 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            <span>{tr('Set Password & Start')}</span>
          </button>
        </form>
      )}
    </div>
  );
};

export default AuthForm;
