'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cloud, QrCode, ShieldCheck, Smartphone, UserMinus, UserPlus, Users, Undo2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showConfirm } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { isCloudSendOn, sendToCloudNow, setCloudSendOn } from '@/lib/cloud/cloudPush';
import { readVerticalProfile } from '@/lib/business/verticalProfile';
import { StaffMember, setStaffActive, staffRolesFor, staffStatus, watchStaff } from '@/lib/cloud/staff';
import { AddStaffDialog } from './AddStaffDialog';
import { StaffJoinCodeDialog } from './StaffJoinCodeDialog';

/**
 * Settings → Staff (v4.144.0): the shop's staff sign in on their own phones with a one-time code —
 * never with the owner's Google account — and each role sees only its work (lib/cloud/staff.ts).
 */
export function StaffTab() {
  const account = getCloudAccount();
  const vertical = readVerticalProfile()?.vertical ?? null;
  const roles = staffRolesFor(vertical);
  const anyRole = roles.some((r) => r.available);
  const [list, setList] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [codeFor, setCodeFor] = useState<StaffMember | null>(null);
  const [now, setNow] = useState(Date.now());
  // v4.161.0 (Rahul: "staff ke mobile me dish dikh nahi rahi"): a waiter's phone gets the menu, the tables and
  // the running orders only through the cloud. A shop with staff but cloud sync off sent nothing — the
  // phone showed no dishes. Turning sync on is now one click here, and Add staff asks for it first.
  const [syncOn, setSyncOn] = useState(() => isCloudSendOn());
  const turnOnSync = () => {
    setCloudSendOn(true);
    setSyncOn(true);
    void sendToCloudNow();
  };
  const startAdding = async () => {
    if (!syncOn) {
      const ok = await showConfirm(tr('Staff phones get your menu, tables and orders through the cloud. Turn on cloud sync on this computer now?'), { title: tr('Turn on cloud sync'), confirmLabel: tr('Turn on and continue') });
      if (!ok) return;
      turnOnSync();
    }
    setAdding(true);
  };

  useEffect(() => {
    if (!account || account.stub) return;
    let stop: (() => void) | null = null;
    let alive = true;
    watchStaff((l) => alive && setList(l), () => alive && setError(tr('Could not load the staff list. Check the internet.')))
      .then((s) => (alive ? (stop = s) : s()))
      .catch(() => alive && setError(tr('Could not load the staff list. Check the internet.')));
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive = false;
      stop?.();
      window.clearInterval(t);
    };
  }, [account?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!account || account.stub) {
    return (
      <Card className="p-5 rounded-2xl border border-slate-200 space-y-3" data-staff-tab="no-account">
        <div className="flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-600" /><h3 className="text-sm font-black text-slate-900">{tr('Staff sign-in needs the shop’s Google account')}</h3></div>
        <p className="text-xs text-slate-600 leading-relaxed">{tr('Connect this shop’s Google account and turn on cloud sync first. Then add staff here — they sign in on their own phones with a one-time code.')}</p>
        <Link href="/cloud-backup" className="inline-flex h-9 px-4 items-center rounded-xl bg-slate-900 text-white text-xs font-bold">{tr('Open Backup & Restore')}</Link>
      </Card>
    );
  }

  const remove = async (m: StaffMember) => {
    if (!(await showConfirm(tr('Remove {name}? Their phone is signed out at once.', { name: m.name })))) return;
    await setStaffActive(m.id, false).catch(() => setError(tr('Could not save. Check the internet and try again.')));
  };
  const addBack = async (m: StaffMember) => {
    await setStaffActive(m.id, true).then(() => setCodeFor({ ...m, active: true })).catch(() => setError(tr('Could not save. Check the internet and try again.')));
  };
  const roleLabel = (id: string) => roles.find((r) => r.id === id)?.label || id;

  return (
    <div className="space-y-4" data-staff-tab="ready">
      <Card className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0"><Users className="w-5 h-5" /></div>
            <div>
              <h3 className="text-base font-black text-slate-900">{tr('Staff')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">{tr('Your staff sign in on their own phones with a one-time code. No Google account on their phone, and each role sees only its work — never your bills, khata or reports.')}</p>
            </div>
          </div>
          <Button type="button" variant="success" onClick={() => void startAdding()} disabled={!anyRole} data-staff-add>
            <UserPlus className="w-4 h-4" /> {tr('Add staff')}
          </Button>
        </div>
        {!syncOn && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5" data-staff-sync-off>
            <span className="flex-1">{tr('Cloud sync is off on this computer, so staff phones cannot see your menu, tables or orders. Turn it on to send them.')}</span>
            <Button type="button" size="sm" onClick={turnOnSync} className="shrink-0" data-staff-sync-on>{tr('Turn on cloud sync')}</Button>
          </div>
        )}
        {!anyRole && (
          <p className="mt-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">{tr('Staff sign-in for this kind of shop is coming next. Today it works for restaurant waiters.')}</p>
        )}
      </Card>

      {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}

      <Card className="p-0 rounded-2xl border border-slate-200 bg-white overflow-hidden">
        {list === null ? (
          <p className="p-5 text-xs text-slate-500">{tr('Loading…')}</p>
        ) : list.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Smartphone className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">{tr('No staff yet')}</p>
            <p className="text-xs text-slate-500">{tr('Add a staff member, then scan the code on their phone.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100" data-staff-list>
            {list.map((m) => {
              const st = staffStatus(m, now);
              return (
                <li key={m.id} className={cn('flex items-center gap-3 px-4 py-3', !m.active && 'bg-slate-50/70')} data-staff-row={m.id}>
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-sm font-black shrink-0', m.active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-500')}>{m.name.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('text-sm font-black truncate', m.active ? 'text-slate-900' : 'text-slate-400 line-through')}>{m.name}</span>
                      <span className="text-[10px] font-black uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">{roleLabel(m.role)}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5" data-staff-status={st}>
                      <span className={cn('w-2 h-2 rounded-full', st === 'online' ? 'bg-emerald-500' : st === 'joined' ? 'bg-slate-400' : st === 'not_joined' ? 'bg-amber-400' : 'bg-slate-300')} />
                      {st === 'online' ? tr('Online now') : st === 'joined' ? tr('Signed in') : st === 'not_joined' ? tr('Not signed in yet') : tr('Removed')}
                      {m.deviceName && st !== 'removed' && <span className="text-slate-400">· {m.deviceName}</span>}
                    </div>
                  </div>
                  {m.active ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button type="button" variant="outline" size="sm" onClick={() => setCodeFor(m)} data-staff-code-btn>
                        <QrCode className="w-4 h-4" /> {st === 'not_joined' ? tr('Sign in phone') : tr('New phone')}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(m)} className="text-rose-700" data-staff-remove>
                        <UserMinus className="w-4 h-4" /> {tr('Remove')}
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => addBack(m)} data-staff-add-back>
                      <Undo2 className="w-4 h-4" /> {tr('Add back')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        {tr('Removing a staff member signs their phone out within seconds. Orders they took stay.')}
      </p>

      <AddStaffDialog open={adding} vertical={vertical} onClose={() => setAdding(false)}
        onAdded={(id, name) => { setAdding(false); setCodeFor({ id, name, role: '', active: true, createdAt: '' }); }} />
      <StaffJoinCodeDialog member={codeFor} onClose={() => setCodeFor(null)} />
    </div>
  );
}
