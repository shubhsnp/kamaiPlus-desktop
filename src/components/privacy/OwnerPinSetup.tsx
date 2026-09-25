'use client';

import React, { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { setOwnerCashierPin } from '@/lib/auth/cashierPrivacy';
import { verifyMasterPassword } from '@/lib/auth/masterPassword';

/**
 * Sets (or resets) the 4-digit owner PIN. Only the owner knows the master
 * password, so it is what proves who is setting the PIN — for a first PIN, a
 * change, and a forgotten PIN alike.
 */
export function OwnerPinSetup({ onDone, onCancel, intro }: { onDone: () => void; onCancel?: () => void; intro: string }) {
  const [password, setPassword] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{4}$/.test(newPin)) return setError('The PIN must be exactly 4 digits.');
    if (newPin !== confirmPin) return setError('The two PINs do not match.');
    setBusy(true);
    const ok = await verifyMasterPassword(password).catch(() => false);
    setBusy(false);
    if (!ok) return setError('Master password is incorrect.');
    setOwnerCashierPin(newPin);
    onDone();
  };

  const pinInput = 'w-full text-center text-lg tracking-widest font-mono py-1.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900';
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-xs text-slate-600">{intro}</p>
      {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{error}</div>}
      <div className="space-y-1">
        <label className="text-xs font-bold text-slate-700 block">Master password (the one you open the app with)</label>
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:border-slate-900" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 block">New 4-digit PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} className={pinInput} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-700 block">Repeat PIN</label>
          <input type="password" inputMode="numeric" maxLength={4} value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))} className={pinInput} required />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button variant="outline" size="sm" type="button" onClick={onCancel}>Back</Button>}
        <Button size="sm" type="submit" disabled={busy} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
          <KeyRound className="w-3.5 h-3.5" /> Save PIN
        </Button>
      </div>
    </form>
  );
}
