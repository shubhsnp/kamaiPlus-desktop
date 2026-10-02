'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, LineChart } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

/**
 * Home entry point to Sales Analytics (Android `_buildAdvancedAnalyticsBanner`).
 * v4.93.0: one slim row — the big dark banner read like an upsell in an app sold once.
 */
export function AdvancedAnalyticsBanner() {
  return (
    <Link href="/reports" className="group block" data-home-analytics>
      <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 hover:bg-indigo-50 px-3 py-2 flex items-center gap-3 transition">
        <div className="w-7 h-7 rounded-lg bg-white border border-indigo-200 flex items-center justify-center shrink-0">
          <LineChart className="w-4 h-4 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <span className="text-indigo-950 font-black text-xs shrink-0">{tr('Advanced Analytics')}</span>
          <span className="text-indigo-700/80 text-xs truncate">{tr('Deep sales reports • Customer udhar & margins • Dead stock')}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-indigo-700 text-xs font-bold group-hover:translate-x-0.5 transition-transform shrink-0">
          {tr('View')} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
