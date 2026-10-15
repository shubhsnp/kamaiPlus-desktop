'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Cloud,
  QrCode,
  ShieldCheck,
  Smartphone,
  UserMinus,
  UserPlus,
  Users,
  Undo2,
  Trash2,
  Shield,
  Banknote,
  TrendingUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { showConfirm } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';
import { cn, formatINR } from '@/lib/utils';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { isCloudSendOn, sendToCloudNow, setCloudSendOn } from '@/lib/cloud/cloudPush';
import { readVerticalProfile } from '@/lib/business/verticalProfile';
import {
  StaffMember,
  StaffPermissions,
  deleteStaff,
  setStaffActive,
  staffRolesFor,
  staffStatus,
  watchStaff,
} from '@/lib/cloud/staff';
import { db } from '@/lib/db';
import { getLocalDayStart } from '@/lib/staff/staffMetrics';
import { AddStaffDialog } from './AddStaffDialog';
import { StaffJoinCodeDialog } from './StaffJoinCodeDialog';
import { StaffPerformanceDialog } from './StaffPerformanceDialog';
import { StaffSalaryDialog } from './StaffSalaryDialog';

/**
 * Settings → Staff: staff sign in with one-time codes on their phones.
 * Now enhanced with permanent delete, live performance & order count, and salary & advances.
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
  const [perfFor, setPerfFor] = useState<StaffMember | null>(null);
  const [salaryFor, setSalaryFor] = useState<StaffMember | null>(null);
  const [now, setNow] = useState(Date.now());
  const [syncOn, setSyncOn] = useState(() => isCloudSendOn());
  const [todayStats, setTodayStats] = useState<Record<string, { count: number; totalPaise: number }>>({});

  const turnOnSync = () => {
    setCloudSendOn(true);
    setSyncOn(true);
    void sendToCloudNow();
  };

  const startAdding = async () => {
    if (!syncOn) {
      const ok = await showConfirm(
        tr('Staff phones get your menu, tables and orders through the cloud. Turn on cloud sync on this computer now?'),
        { title: tr('Turn on cloud sync'), confirmLabel: tr('Turn on and continue') }
      );
      if (!ok) return;
      turnOnSync();
    }
    setAdding(true);
  };

  // Watch cloud staff list
  useEffect(() => {
    if (!account || account.stub) return;
    let stop: (() => void) | null = null;
    let alive = true;
    watchStaff(
      (l) => alive && setList(l),
      () => alive && setError(tr('Could not load the staff list. Check the internet.'))
    )
      .then((s) => (alive ? (stop = s) : s()))
      .catch(() => alive && setError(tr('Could not load the staff list. Check the internet.')));
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => {
      alive = false;
      stop?.();
      window.clearInterval(t);
    };
  }, [account?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load today's sales performance for all staff
  useEffect(() => {
    if (!list || list.length === 0) return;
    let alive = true;
    const fetchTodayStats = async () => {
      try {
        const startIso = getLocalDayStart();
        const sales = await db.sales.where('created_at').aboveOrEqual(startIso).toArray();
        if (!alive) return;
        const stats: Record<string, { count: number; totalPaise: number }> = {};
        for (const m of list) {
          const clean = m.name.trim().toLowerCase();
          const matched = sales.filter((s) => {
            const creator = (s.created_by || '').trim().toLowerCase();
            if (creator === clean) return true;
            return (s.notes || '').toLowerCase().includes(clean);
          });
          stats[clean] = {
            count: matched.length,
            totalPaise: matched.reduce((sum, s) => sum + (s.grand_total || 0), 0),
          };
        }
        setTodayStats(stats);
      } catch {}
    };
    void fetchTodayStats();
    return () => {
      alive = false;
    };
  }, [list, now]);

  if (!account || account.stub) {
    return (
      <Card className="p-5 rounded-2xl border border-slate-200 space-y-3" data-staff-tab="no-account">
        <div className="flex items-center gap-2">
          <Cloud className="w-5 h-5 text-sky-600" />
          <h3 className="text-sm font-black text-slate-900">{tr('Staff sign-in needs the shop’s Google account')}</h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          {tr('Connect this shop’s Google account and turn on cloud sync first. Then add staff here — they sign in on their own phones with a one-time code.')}
        </p>
        <Link href="/cloud-backup" className="inline-flex h-9 px-4 items-center rounded-xl bg-slate-900 text-white text-xs font-bold">
          {tr('Open Backup & Restore')}
        </Link>
      </Card>
    );
  }

  const remove = async (m: StaffMember) => {
    if (!(await showConfirm(tr('Remove {name}? Their phone is signed out at once.', { name: m.name })))) return;
    await setStaffActive(m.id, false).catch(() => setError(tr('Could not save. Check the internet and try again.')));
  };

  const permanentlyDelete = async (m: StaffMember) => {
    const ok = await showConfirm(
      tr('Permanently delete {name}? Their login, phone connection, and staff record will be completely erased. Past bills and orders already created will remain safe.', { name: m.name }),
      { title: tr('Delete Staff Permanently'), danger: true, confirmLabel: tr('Delete permanently') }
    );
    if (!ok) return;

    try {
      await deleteStaff(m.id);
      setList((prev) => (prev ? prev.filter((x) => x.id !== m.id) : null));
    } catch {
      setError(tr('Could not delete staff member. Check the internet and try again.'));
    }
  };

  const addBack = async (m: StaffMember) => {
    await setStaffActive(m.id, true)
      .then(() => setCodeFor({ ...m, active: true }))
      .catch(() => setError(tr('Could not save. Check the internet and try again.')));
  };

  const handleSalaryUpdated = (memberId: string, salaryPaise: number) => {
    setList((prev) => (prev ? prev.map((x) => (x.id === memberId ? { ...x, monthlySalaryPaise: salaryPaise } : x)) : null));
  };

  const roleLabel = (id: string) => roles.find((r) => r.id === id)?.label || id;

  return (
    <div className="space-y-4" data-staff-tab="ready">
      <Card className="p-4 sm:p-5 rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">{tr('Staff Management')}</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                {tr('Add staff with a name and a role, see their bills today, and keep their salary & advances. Staff sign in on their phone with the join code.')}
              </p>
            </div>
          </div>
          <Button type="button" variant="success" onClick={() => void startAdding()} disabled={!anyRole} data-staff-add>
            <UserPlus className="w-4 h-4" /> {tr('Add staff')}
          </Button>
        </div>
        {!syncOn && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs font-semibold text-rose-900 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5" data-staff-sync-off>
            <span className="flex-1">
              {tr('Cloud sync is off on this computer, so staff phones cannot see your menu, tables or orders. Turn it on to send them.')}
            </span>
            <Button type="button" size="sm" onClick={turnOnSync} className="shrink-0" data-staff-sync-on>
              {tr('Turn on cloud sync')}
            </Button>
          </div>
        )}
        {!anyRole && (
          <p className="mt-3 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            {tr('Staff sign-in for this kind of shop is coming next. Today it works for restaurant waiters.')}
          </p>
        )}
      </Card>

      {error && (
        <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

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
              const mStats = todayStats[m.name.trim().toLowerCase()] || { count: 0, totalPaise: 0 };
              return (
                <li key={m.id} className={cn('p-4 space-y-3', !m.active && 'bg-slate-50/70')} data-staff-row={m.id}>
                  {/* Main header row */}
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0', m.active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-500')}>
                      {m.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn('text-sm font-black truncate', m.active ? 'text-slate-900' : 'text-slate-400 line-through')}>
                          {m.name}
                        </span>
                        <span className="text-[10px] font-black uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2 py-0.5">
                          {roleLabel(m.role)}
                        </span>
                        {/* Live performance badge button */}
                        {m.active && (
                          <button
                            type="button"
                            onClick={() => setPerfFor(m)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                            title={tr('View performance details')}
                            data-staff-perf-badge={m.id}
                          >
                            <TrendingUp className="w-3 h-3 text-emerald-600" />
                            <span>{mStats.count} {tr('bills')} ({formatINR(mStats.totalPaise)})</span>
                          </button>
                        )}
                        {/* Salary summary badge if set */}
                        {m.active && (m.monthlySalaryPaise ?? 0) > 0 && (
                          <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                            ₹{(m.monthlySalaryPaise! / 100).toLocaleString('en-IN')} {tr('/ mo')}
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5" data-staff-status={st}>
                        <span className={cn('w-2 h-2 rounded-full', st === 'online' ? 'bg-emerald-500' : st === 'joined' ? 'bg-slate-400' : st === 'not_joined' ? 'bg-amber-400' : 'bg-slate-300')} />
                        {st === 'online' ? tr('Online now') : st === 'joined' ? tr('Signed in') : st === 'not_joined' ? tr('Not signed in yet') : tr('Removed')}
                        {m.deviceName && st !== 'removed' && <span className="text-slate-400">· {m.deviceName}</span>}
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.active ? (
                        <>
                          <Button type="button" variant="outline" size="sm" onClick={() => setCodeFor(m)} data-staff-code-btn>
                            <QrCode className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{st === 'not_joined' ? tr('Sign in phone') : tr('New phone')}</span>
                          </Button>

                          <Button type="button" variant="outline" size="sm" onClick={() => setSalaryFor(m)} title={tr('Salary & Advances')} data-staff-salary-btn={m.id}>
                            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="hidden md:inline">{tr('Salary & Advance')}</span>
                          </Button>

                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(m)} className="text-slate-600 hover:text-slate-900" title={tr('Temporarily remove')} data-staff-remove>
                            <UserMinus className="w-3.5 h-3.5" />
                            <span className="hidden lg:inline">{tr('Remove')}</span>
                          </Button>
                        </>
                      ) : (
                        <Button type="button" variant="outline" size="sm" onClick={() => addBack(m)} data-staff-add-back>
                          <Undo2 className="w-3.5 h-3.5" /> {tr('Add back')}
                        </Button>
                      )}

                      {/* Permanent Delete Option (Immediate) */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => permanentlyDelete(m)}
                        className="text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                        title={tr('Permanently delete staff record')}
                        data-staff-delete-perm={m.id}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <p className="text-[11px] text-slate-500 flex items-start gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
        {tr('Removing signs their phone out immediately. Permanent delete completely wipes their access credentials.')}
      </p>

      {/* Dialogs */}
      <AddStaffDialog
        open={adding}
        vertical={vertical}
        onClose={() => setAdding(false)}
        onAdded={(id, name) => {
          setAdding(false);
          setCodeFor({ id, name, role: '', active: true, createdAt: '' });
        }}
      />
      <StaffJoinCodeDialog
        member={codeFor ? (list?.find((m) => m.id === codeFor.id) || codeFor) : null}
        onClose={() => setCodeFor(null)}
      />
      <StaffPerformanceDialog open={Boolean(perfFor)} member={perfFor} onClose={() => setPerfFor(null)} />
      <StaffSalaryDialog
        open={Boolean(salaryFor)}
        member={salaryFor}
        businessId={account?.bizId}
        onClose={() => setSalaryFor(null)}
        onSalaryUpdated={handleSalaryUpdated}
      />
    </div>
  );
}
