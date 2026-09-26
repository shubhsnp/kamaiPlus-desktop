'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, LineChart } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

/** Home entry point to Sales Analytics (Android `_buildAdvancedAnalyticsBanner`). */
export function AdvancedAnalyticsBanner() {
  return (
    <Link href="/reports" className="group block">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border border-indigo-800 p-4 flex items-center gap-4 shadow-sm group-hover:shadow-md transition">
        <div className="absolute -right-8 -top-10 w-40 h-40 rounded-full bg-indigo-500/10" />
        <div className="w-11 h-11 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0">
          <LineChart className="w-5 h-5 text-indigo-200" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white font-black text-sm">{tr('Advanced Analytics')}</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black tracking-wider">{tr('INSIGHTS')}</span>
          </div>
          <p className="text-indigo-200/80 text-xs truncate">{tr('Deep sales reports • Customer udhar & margins • Dead stock')}</p>
        </div>
        <span className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold group-hover:bg-white/20 transition">
          {tr('View')} <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </div>
    </Link>
  );
}
