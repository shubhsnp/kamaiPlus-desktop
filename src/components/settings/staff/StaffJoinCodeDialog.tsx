'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { JoinCode, StaffMember, createJoinCode } from '@/lib/cloud/staff';

/**
 * v4.144.0 — the one-time code (and its QR) a staff phone joins with: KamaiPlus app → "Staff sign-in".
 * Valid 15 minutes, once.
 */
export function StaffJoinCodeDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const [code, setCode] = useState<JoinCode | null>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const make = async () => {
    if (!member) return;
    setBusy(true);
    setError(null);
    setCode(null);
    setQr('');
    const r = await createJoinCode(member.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setCode(r.code);
    QRCode.toDataURL(r.code.qr, { width: 260, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  };

  useEffect(() => {
    if (member) void make();
    else {
      setCode(null);
      setError(null);
    }
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!code) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [code]);

  const left = code ? Math.max(0, Date.parse(code.expiresAt) - now) : 0;
  const expired = Boolean(code) && left === 0;
  const mmss = `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}`;

  return (
    <Modal isOpen={Boolean(member)} onClose={onClose} title={tr('Sign in {name}’s phone', { name: member?.name || '' })} description={tr('One-time code — valid for 15 minutes.')} size="md">
      <div className="grid gap-5 sm:grid-cols-[auto_1fr] items-center" data-staff-code-dialog>
        <div className="w-[200px] h-[200px] mx-auto rounded-2xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
          {qr && !expired ? <img src={qr} alt={tr('Staff sign-in QR')} className="w-full h-full" data-staff-qr /> : <Smartphone className="w-10 h-10 text-slate-300" />}
        </div>
        <div className="space-y-3">
          {busy && <p className="text-sm font-semibold text-slate-500">{tr('Making a code…')}</p>}
          {error && <p className="text-sm font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
          {code && (
            <div>
              <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">{tr('Code')}</div>
              <div className={`text-4xl font-black font-mono tracking-[0.25em] ${expired ? 'text-slate-300 line-through' : 'text-slate-900'}`} data-staff-code>
                {code.code.slice(0, 3)} {code.code.slice(3)}
              </div>
              <div className={`text-xs font-bold mt-1 ${expired ? 'text-rose-600' : 'text-slate-500'}`}>
                {expired ? tr('Expired — make a new code.') : tr('Valid for {time}', { time: mmss })}
              </div>
            </div>
          )}
          <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside leading-relaxed">
            <li>{tr('On the staff phone, open the KamaiPlus app.')}</li>
            <li>{tr('Tap "Staff sign-in".')}</li>
            <li>{tr('Scan this QR, or type the 6-digit code.')}</li>
          </ol>
          <p className="text-[11px] text-slate-500">{tr('No Google account is needed on the staff phone.')}</p>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        <Button type="button" variant="outline" onClick={make} disabled={busy}>
          <RefreshCw className="w-4 h-4" /> {tr('New code')}
        </Button>
        <Button type="button" onClick={onClose}>{tr('Done')}</Button>
      </div>
    </Modal>
  );
}
