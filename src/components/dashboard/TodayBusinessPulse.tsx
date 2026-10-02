'use client';

import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { amountTone, formatINRCompact } from '@/lib/utils';
import { ProfitMask, CashierPrivacyToggleButton } from '@/components/privacy/ProfitMask';
import { 
  TrendingUp, 
  BookOpen, 
  Wallet, 
  ArrowRight, 
  CircleDollarSign,
  Receipt,
  ShoppingBasket
} from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

/** A Home card that opens its screen — or, with that screen switched off, just shows the figure. */
function CardLink({ on, href, children, ...data }: { on: boolean; href: string; children: React.ReactNode } & Record<`data-${string}`, boolean | undefined>) {
  return on
    ? <Link href={href} className="group block focus:outline-none" {...data}>{children}</Link>
    : <div className="group block" {...data}>{children}</div>;
}

interface TodayBusinessPulseProps {
  todaysSalesTotal: number;
  todaysSalesCount: number;
  todaysGrossProfit: number;
  /** Revenue of the lines that have a buying price — the base the margin is measured on. */
  profitCoveredRevenue?: number;
  /** Some sold lines had no buying price, so profit is partial. */
  isProfitPartial?: boolean;
  netCashInHand: number;
  totalOutstandingCredit: number;
  customersWithCreditCount: number;
  /** false when no item has a buying price: the Profit card becomes "Average Bill" (v4.78.0). */
  showProfit?: boolean;
  averageBillPaise?: number;
  biggestBillPaise?: number;
}

export const TodayBusinessPulse: React.FC<TodayBusinessPulseProps> = ({
  todaysSalesTotal,
  todaysSalesCount,
  todaysGrossProfit,
  profitCoveredRevenue,
  isProfitPartial = false,
  netCashInHand,
  totalOutstandingCredit,
  customersWithCreditCount,
  showProfit = true,
  averageBillPaise = 0,
  biggestBillPaise = 0,
}) => {
  const marginBase = profitCoveredRevenue ?? todaysSalesTotal;
  const profitMarginPercent = marginBase > 0 ? Math.round((todaysGrossProfit / marginBase) * 100) : 0;

  // Cash Register, Khata and Sales Analytics can be switched off in Settings → Features
  // (then their card is not a link and shows no arrow — v4.81.0 for Khata / Analytics).
  const switches = useFeatureSwitches();
  const cashRegisterOn = switches.cash_register;
  const khataOn = switches.khata;
  const reportsOn = switches.sales_reports;
  const cashInHandCard = (
    <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-amber-50/60 dark:from-slate-900 dark:to-amber-950/20 border border-amber-200/90 dark:border-amber-800/60 hover:border-amber-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between cursor-pointer">
      <div>
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">{tr('Cash in Hand')}</span>
          </div>
          <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 text-[9px] font-black">
            {tr('Till / Galla')}
          </span>
        </div>

        <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight mt-1.5 truncate">
          {formatINRCompact(netCashInHand)}
        </div>
      </div>

      <div className="pt-1.5 mt-1.5 border-t border-amber-100/80 dark:border-amber-900/40 flex items-center justify-between text-[10px] sm:text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
          {tr('Cash Sales - Exp')}
        </span>
        {cashRegisterOn && (
          <span className="text-amber-700 dark:text-amber-400 font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[10px]">
            <span>{tr('Register')}</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-2.5">
      {/* Header with Title & Cashier Privacy Toggle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {tr('Today\'s Business Pulse')}
          </h2>
        </div>
        <CashierPrivacyToggleButton />
      </div>

      {/* 4-Stat Responsive Metric Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {/* 1. Today's Sales */}
        <Link href="/transactions?filter=today" className="group block focus:outline-none">
          <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-emerald-50/60 dark:from-slate-900 dark:to-emerald-950/20 border border-emerald-200/90 dark:border-emerald-800/60 hover:border-emerald-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate">{tr('Today\'s Sales')}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-[9px] font-black">
                  {todaysSalesCount} {tr('Bills')}
                </span>
              </div>

              <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight mt-1.5 truncate">
                {formatINRCompact(todaysSalesTotal)}
              </div>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-emerald-100/80 dark:border-emerald-900/40 flex items-center justify-between text-[10px] sm:text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                {tr('Total Revenue')}
              </span>
              <span className="text-emerald-700 dark:text-emerald-400 font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[10px]">
                <span>{tr('Bills')}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
            </div>
          </Card>
        </Link>

        {/* 2. Today's Profit (With Privacy Mask) — or, with no buying prices anywhere, the average bill */}
        {showProfit ? (
        <div className="group block focus:outline-none">
          <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-blue-50/60 dark:from-slate-900 dark:to-blue-950/20 border border-blue-200/90 dark:border-blue-800/60 hover:border-blue-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
                  <CircleDollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{tr('Today\'s Profit')}</span>
                </div>
                {marginBase > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 text-[9px] font-black font-mono">
                    ~{profitMarginPercent}{tr('% Margin')}
                  </span>
                )}
              </div>

              <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight mt-1.5 truncate">
                <ProfitMask value={formatINRCompact(todaysGrossProfit)} />
              </div>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-blue-100/80 dark:border-blue-900/40 flex items-center justify-between text-[10px] sm:text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate" title={isProfitPartial ? tr('Some items sold today have no buying price, so they are left out of profit.') : undefined}>
                {isProfitPartial ? tr('Partial • items without buying price skipped') : tr('Gross Margin')}
              </span>
              <span className="text-blue-700 dark:text-blue-400 font-bold text-[10px]">
                {tr('Owner Only')}
              </span>
            </div>
          </Card>
        </div>
        ) : (
        <CardLink on={reportsOn} href="/reports" data-pulse-average-bill>
          <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-blue-50/60 dark:from-slate-900 dark:to-blue-950/20 border border-blue-200/90 dark:border-blue-800/60 hover:border-blue-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-blue-800 dark:text-blue-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
                  <ShoppingBasket className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate">{tr('Average Bill')}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 text-[9px] font-black">
                  {tr('Per customer')}
                </span>
              </div>

              <div className="text-base sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono tracking-tight mt-1.5 truncate">
                {formatINRCompact(averageBillPaise)}
              </div>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-blue-100/80 dark:border-blue-900/40 flex items-center justify-between gap-1 text-[10px] sm:text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate" title={tr('Add buying prices to your items to see profit here.')}>
                {tr('Biggest bill')}: <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{formatINRCompact(biggestBillPaise)}</span>
              </span>
              {reportsOn && (
              <span className="text-blue-700 dark:text-blue-400 font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[10px]">
                <span>{tr('Reports')}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
              )}
            </div>
          </Card>
        </CardLink>
        )}

        {/* 3. Cash in Drawer (Galle me Cash) */}
        {/* Opens the Cash Register only when that screen is on (Settings → Features) */}
        {cashRegisterOn ? (
          <Link href="/cash-register" className="group block focus:outline-none">{cashInHandCard}</Link>
        ) : (
          <div className="group block">{cashInHandCard}</div>
        )}

        {/* 4. Total Outstanding Credit (Khata Udhar) */}
        <CardLink on={khataOn} href="/khata">
          <Card className="p-3 sm:p-3.5 bg-gradient-to-br from-white to-rose-50/60 dark:from-slate-900 dark:to-rose-950/20 border border-rose-200/90 dark:border-rose-800/60 hover:border-rose-400 active:scale-[0.98] transition-all rounded-2xl shadow-2xs group-hover:shadow-md h-full flex flex-col justify-between cursor-pointer">
            <div>
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 text-rose-800 dark:text-rose-300 font-extrabold text-[10.5px] sm:text-xs uppercase tracking-tight truncate">
                  <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  <span className="truncate">{tr('Market Udhar')}</span>
                </div>
                <span className="px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 text-[9px] font-black">
                  {customersWithCreditCount} {tr('Debtors')}
                </span>
              </div>

              <div className={`text-base sm:text-xl font-black ${amountTone(totalOutstandingCredit, 'text-rose-600 dark:text-rose-400')} font-mono tracking-tight mt-1.5 truncate`}>
                {formatINRCompact(totalOutstandingCredit)}
              </div>
            </div>

            <div className="pt-1.5 mt-1.5 border-t border-rose-100/80 dark:border-rose-900/40 flex items-center justify-between text-[10px] sm:text-[11px]">
              <span className="text-slate-500 dark:text-slate-400 font-semibold truncate">
                {tr('Pending Ledger')}
              </span>
              {khataOn && (
              <span className="text-rose-700 dark:text-rose-400 font-bold inline-flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-[10px]">
                <span>{tr('Khata')}</span>
                <ArrowRight className="w-2.5 h-2.5" />
              </span>
              )}
            </div>
          </Card>
        </CardLink>
      </div>
    </div>
  );
};
