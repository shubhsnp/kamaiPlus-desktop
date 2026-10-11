'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { tr } from '@/lib/i18n/core';
import { getCloudAccount } from '@/lib/cloud/cloudAccount';
import { StaffMember, staffStatus, watchStaff } from '@/lib/cloud/staff';

/**
 * Home Pulse card 2 in a restaurant (v4.149.0, Rahul 2026-10-11: "Home Pulse dono taraf ek jaisa") — a
 * restaurant has no buying prices, so instead of Today's Profit it shows the staff: how many, how many
 * online now. Same card as the Android Home (home_pulse_tab.dart _buildStaffCard). Without a cloud
 * account the list cannot load, so it just offers "Add".
 */
export function StaffPulseCard() {
  const [list, setList] = useState<StaffMember[]>([]);
  const [now, setNow] = useState(Date.now());
  // Read after mount (localStorage) so the first paint matches the prerendered page.
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const account = getCloudAccount();
    setSignedIn(Boolean(account && !account.stub));
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    let stop: (() => void) | undefined;
    watchStaff((l) => alive && setList(l)).then((s) => { if (alive) stop = s; else s(); }).catch(() => {});
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { alive = false; stop?.(); window.clearInterval(t); };
  }, [signedIn]);

  const active = list.filter((m) => m.active);
  const online = active.filter((m) => staffStatus(m, now) === 'online').length;
  const badge = online > 0 ? tr('{count} online', { count: online }) : signedIn ? tr('Team') : tr('Set up');

  return (
    <Link href="/settings?tab=staff" className="group block focus:outline-none" data-pulse-staff>
      <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-indigo-50/60 dark:from-slate-900 dark:to-indigo-950/20 border border-indigo-200/90 dark:border-indigo-800/60 hover:border-indigo-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between cursor-pointer">
        <div>
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 text-indigo-800 dark:text-indigo-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">{tr('Staff')}</span>
            </div>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${online > 0 ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200' : 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-200'}`}>
              {badge}
            </span>
          </div>

          <div className="text-base sm:text-xl font-black text-indigo-700 dark:text-indigo-300 font-mono tracking-tight mt-1.5 truncate">
            {active.length}
          </div>
        </div>

        <div className="pt-1.5 mt-1.5 border-t border-indigo-100/80 dark:border-indigo-900/40 flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
            {active.length === 0 ? tr('Add waiters — no Google on their phone') : active.length === 1 ? tr('Staff member') : tr('Staff members')}
          </span>
          <span className="text-indigo-700 dark:text-indigo-400 font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[10px]">
            <span>{active.length === 0 ? tr('Add') : tr('Manage')}</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </span>
        </div>
      </Card>
    </Link>
  );
}
