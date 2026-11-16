'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Smartphone } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { CLOUD_STATUS_EVENT, cloudSendActive } from '@/lib/cloud/cloudPush';
import { CLOUD_ACCOUNT_EVENT } from '@/lib/cloud/cloudAccount';

/**
 * v4.179.0: running tables reach the waiters' phones (and theirs come here) only through the cloud
 * (lib/restaurant/cloudOrders.ts, started by CloudSyncScheduler while "Sync this shop with the mobile
 * app" is on). With that off the Tables screen says so — before, a table filled on the PC simply never
 * showed on a phone, with no hint why.
 */
export function PhonesLinkNotice() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const check = () => setOn(cloudSendActive());
    check();
    window.addEventListener(CLOUD_STATUS_EVENT, check);
    window.addEventListener(CLOUD_ACCOUNT_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(CLOUD_STATUS_EVENT, check);
      window.removeEventListener(CLOUD_ACCOUNT_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, []);
  if (on) return null;
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 flex flex-wrap items-center gap-2.5 text-xs" role="status" data-phones-link="off">
      <Smartphone className="w-4 h-4 text-amber-700 shrink-0" />
      <p className="flex-1 min-w-[200px] font-semibold text-amber-900 leading-snug">
        {tr("Waiters' phones cannot see these tables: cloud sync is off on this computer. Turn it on with the same Google account as the phones.")}
      </p>
      <Link href="/cloud-backup" className="h-7 px-3 inline-flex items-center rounded-lg bg-slate-900 text-white text-[11px] font-black shrink-0">
        {tr('Turn on sync')}
      </Link>
    </div>
  );
}
