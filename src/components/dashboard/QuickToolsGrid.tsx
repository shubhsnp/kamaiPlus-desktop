'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Package, 
  Boxes, 
  ShoppingBag, 
  Barcode, 
  TrendingUp, 
  FileSpreadsheet, 
  Calculator,
  ShieldCheck,
  Users,
  HardDrive
} from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { isPathEnabled, useFeatureSwitches } from '@/lib/features/featureSwitches';
import { GST_STAND_IN_HREF } from '@/lib/dashboard/homeTiles';

interface QuickToolsGridProps {
  productsCount: number;
}

export const QuickToolsGrid: React.FC<QuickToolsGridProps> = ({
  productsCount,
}) => {
  // Screens switched off in Settings → Features get no shortcut tile. Billing and Khata are in
  // the quick actions right above (v4.93.0: they were on Home twice, with two names).
  const switches = useFeatureSwitches();
  const toolSections = [
    {
      title: tr('Daily Counter & Ops'),
      dotColor: 'bg-emerald-500',
      tools: [
        {
          title: tr('Cash Register'),
          subtitle: tr('Shift & Z-Report'),
          href: '/cash-register',
          icon: Calculator,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
        },
        {
          title: tr('Tally Counter'),
          subtitle: tr('Notes Hisab & Draft'),
          href: '/cash-register?tally=open',
          icon: Calculator,
          color: 'text-purple-600 dark:text-purple-400',
          bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
        },
        {
          title: tr('Transactions'),
          subtitle: tr('Audit & Returns'),
          href: '/transactions',
          icon: ShieldCheck,
          color: 'text-teal-600 dark:text-teal-400',
          bg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800',
        },
      ],
    },
    {
      title: tr('Stock & Sourcing'),
      dotColor: 'bg-blue-500',
      tools: [
        {
          title: tr('Products'),
          subtitle: tr('{productsCount} SKUs', { productsCount: productsCount }),
          href: '/products',
          icon: Package,
          color: 'text-blue-600 dark:text-blue-400',
          bg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800',
        },
        {
          title: tr('Inventory & Stock'),
          subtitle: tr('Stock Alerts'),
          href: '/inventory',
          icon: Boxes,
          color: 'text-cyan-600 dark:text-cyan-400',
          bg: 'bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800',
        },
        {
          title: tr('Purchases & Bills'),
          subtitle: tr('Vendor Inward'),
          href: '/purchases',
          icon: ShoppingBag,
          color: 'text-amber-600 dark:text-amber-400',
          bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
        },
        {
          title: tr('Barcode Studio'),
          subtitle: tr('Price Stickers'),
          href: '/barcode-generator',
          icon: Barcode,
          color: 'text-purple-600 dark:text-purple-400',
          bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800',
        },
      ],
    },
    {
      title: tr('Ledger, Analytics & GST'),
      dotColor: 'bg-purple-500',
      tools: [
        {
          title: tr('Customers'),
          subtitle: tr('Loyalty & Visits'),
          href: '/customers',
          icon: Users,
          color: 'text-sky-600 dark:text-sky-400',
          bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
        },
        {
          title: tr('Sales Analytics'),
          subtitle: tr('Parties • Items • Profit'),
          href: '/reports',
          icon: TrendingUp,
          color: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
        },
        {
          title: tr('GST & Accounting'),
          subtitle: tr('GSTR-1 Reports'),
          href: '/gst-reports',
          icon: FileSpreadsheet,
          color: 'text-indigo-600 dark:text-indigo-400',
          bg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800',
        },
        // GST Reports switched off: its slot goes to the CA / Tally exports in Data Backup.
        ...(switches.gst_reports ? [] : [{
          title: tr('Backup & CA Exports'),
          subtitle: tr('Excel • Tally • Safe copy'),
          href: GST_STAND_IN_HREF,
          icon: HardDrive,
          color: 'text-slate-600 dark:text-slate-300',
          bg: 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700',
        }]),
      ],
    },
  ].map((sec) => ({ ...sec, tools: sec.tools.filter((tool) => isPathEnabled(tool.href, switches)) }))
    .filter((sec) => sec.tools.length > 0);

  return (
    <div className="space-y-4">
      {toolSections.map((sec) => (
        <div key={sec.title} className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${sec.dotColor}`} />
              <span>{sec.title}</span>
            </h2>
          </div>

          {/* Tiles re-flow, so a switched-off screen never leaves a gap (v4.78.0); v4.147.0: each tile
              keeps a compact width instead of stretching across a wide screen (one tile was a full row). */}
          <div className="grid gap-2 sm:gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }} data-home-tool-grid>
            {sec.tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.title} href={tool.href} className="group block min-w-0" data-home-tool={tool.href}>
                  <div className="h-full p-2.5 sm:p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all flex items-center justify-between gap-2 cursor-pointer">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 border ${tool.bg} ${tool.color} group-hover:scale-105 transition-transform`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
                          {tool.title}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">
                          {tool.subtitle}
                        </div>
                      </div>
                    </div>

                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};
