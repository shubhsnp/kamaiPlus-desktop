'use client';

import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { RefreshCw, Smartphone, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { JoinCode, StaffMember, createJoinCode } from '@/lib/cloud/staff';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * v4.144.0 — the one-time code (and its QR) a staff phone joins with: KamaiPlus app → "Staff sign-in".
 * Valid 15 minutes, once.
 * v4.164.0 — Auto-dismisses when the staff member signs in / pairs from their phone.
 */
export function StaffJoinCodeDialog({ member, onClose }: { member: StaffMember | null; onClose: () => void }) {
  const [code, setCode] = useState<JoinCode | null>(null);
  const [qr, setQr] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [joined, setJoined] = useState(false);
  const [joinedDevice, setJoinedDevice] = useState('');
  const initialJoinedRef = useRef<string | undefined>(member?.joinedAt);

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
    if (member) {
      initialJoinedRef.current = member.joinedAt;
      setJoined(false);
      setJoinedDevice('');
      void make();
    } else {
      setCode(null);
      setError(null);
      setJoined(false);
      setJoinedDevice('');
    }
  }, [member?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time Firestore listener: detect when staff member pairs on their phone
  useEffect(() => {
    if (!member?.id) return;
    const account = getCloudAccount();
    if (!account || account.stub || !account.bizId) return;

    let unsub: (() => void) | null = null;
    let mounted = true;

    (async () => {
      try {
        const [{ getFirestoreDb }, { doc, onSnapshot }] = await Promise.all([
          import('@/lib/firebase/config'),
          import('firebase/firestore'),
        ]);
        const db = getFirestoreDb();
        if (!db || !mounted) return;

        unsub = onSnapshot(doc(db, `businesses/${account.bizId}/staff/${member.id}`), (snap) => {
          if (!mounted || !snap.exists()) return;
          const d = snap.data();
          const newJoinedAt = typeof d?.joined_at === 'string' ? d.joined_at : '';
          const init = initialJoinedRef.current || '';
          if (newJoinedAt && (!init || newJoinedAt !== init)) {
            setJoined(true);
            if (d?.device_name && typeof d.device_name === 'string') {
              setJoinedDevice(d.device_name);
            }
          }
        });
      } catch (e) {
        reportError('staff', e, 'join listener not started');
      }
    })();

    return () => {
      mounted = false;
      if (unsub) unsub();
    };
  }, [member?.id]);

  // If member prop updates from parent with joinedAt
  useEffect(() => {
    if (member?.joinedAt && (!initialJoinedRef.current || member.joinedAt !== initialJoinedRef.current)) {
      setJoined(true);
      if (member.deviceName) setJoinedDevice(member.deviceName);
    }
  }, [member?.joinedAt, member?.deviceName]);

  // Auto-close dialog after 1.8 seconds when joined
  useEffect(() => {
    if (!joined) return;
    const timer = setTimeout(() => {
      onClose();
    }, 1800);
    return () => clearTimeout(timer);
  }, [joined, onClose]);

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
      {joined ? (
        <div className="flex flex-col items-center justify-center py-6 text-center space-y-3" data-staff-joined-success>
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center animate-bounce">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div className="text-xl font-black text-slate-900">
            {tr('{name}’s phone connected!', { name: member?.name || '' })}
          </div>
          <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
            {joinedDevice ? tr('Device: {device}', { device: joinedDevice }) : tr('Staff signed in successfully!')}
          </p>
          <p className="text-xs text-slate-400 font-medium">
            {tr('Closing automatically…')}
          </p>
        </div>
      ) : (
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
      )}
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
        {!joined && (
          <Button type="button" variant="outline" onClick={make} disabled={busy}>
            <RefreshCw className="w-4 h-4" /> {tr('New code')}
          </Button>
        )}
        <Button type="button" onClick={onClose}>{tr('Done')}</Button>
      </div>
    </Modal>
  );
}
