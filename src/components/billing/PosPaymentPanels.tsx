'use client';

import React from 'react';
import { QrCode } from 'lucide-react';
import { cn, formatINR } from '@/lib/utils';
import type { PaymentMethod } from '@/types';
import { tr } from '@/lib/i18n/core';

/*
 * Payment panels of the POS checkout (split breakdown, cash tender chips,
 * dynamic UPI QR card), moved out of app/billing/page.tsx. Stateless: the
 * page owns the values and passes its setters in.
 */

type SetStr = (val: string) => void;

export interface SplitPaymentPanelProps {
  grandTotalPaise: number;
  splitCash: string; setSplitCash: SetStr;
  splitUpi: string; setSplitUpi: SetStr;
  splitCard: string; setSplitCard: SetStr;
  splitCredit: string; setSplitCredit: SetStr;
  /** Settings → Features → Khata off (v4.81.0): no Credit / Udhar part. */
  creditAllowed?: boolean;
}

export function SplitPaymentPanel({ grandTotalPaise, splitCash, setSplitCash, splitUpi, setSplitUpi, splitCard, setSplitCard, splitCredit, setSplitCredit, creditAllowed = true }: SplitPaymentPanelProps) {
  const cVal = parseFloat(splitCash || '0') || 0;
  const uVal = parseFloat(splitUpi || '0') || 0;
  const crVal = parseFloat(splitCredit || '0') || 0;
  const cardVal = parseFloat(splitCard || '0') || 0;
  const allocatedPaise = Math.round((cVal + uVal + crVal + cardVal) * 100);
  const remainingPaise = grandTotalPaise - allocatedPaise;

  return (
    <div className="p-3 bg-slate-50 border border-slate-300 rounded-xl space-y-2 text-xs">
      <div className="flex items-center justify-between font-bold text-slate-800 pb-1 border-b border-slate-200">
        <span>{tr('Split Payment Breakdown:')}</span>
        <span className={remainingPaise === 0 ? 'text-emerald-700 font-extrabold' : 'text-amber-800 font-extrabold'}>
          {remainingPaise === 0 ? tr('✓ Matched Exactly') : remainingPaise > 0 ? tr('₹{v1} Remaining', { v1: (remainingPaise / 100).toFixed(2) }) : tr('₹{v1} Overpaid', { v1: Math.abs(remainingPaise / 100).toFixed(2) })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">{tr('Cash (₹)')}</label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={splitCash}
            onChange={(e) => setSplitCash(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">{tr('UPI / QR (₹)')}</label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={splitUpi}
            onChange={(e) => setSplitUpi(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">{tr('Card (₹)')}</label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={splitCard}
            onChange={(e) => setSplitCard(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
          />
        </div>

        {creditAllowed && (
        <div>
          <label className="text-[10px] font-bold text-slate-600 uppercase block mb-0.5">{tr('Credit / Udhar (₹)')}</label>
          <input
            type="number"
            step="1"
            placeholder="0"
            value={splitCredit}
            onChange={(e) => setSplitCredit(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 font-mono font-bold text-xs rounded p-1.5 focus:outline-none focus:border-slate-900"
          />
        </div>
        )}
      </div>

      {/* Quick Split Presets */}
      <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase">{tr('Preset:')}</span>
        <button
          type="button"
          onClick={() => {
            // Split in paise so the two halves always add up to the bill exactly
            // (rounding each half to whole rupees overcharged odd totals like ₹101.50).
            const cashPaise = Math.floor(grandTotalPaise / 2);
            const upiPaise = grandTotalPaise - cashPaise;
            setSplitCash((cashPaise / 100).toFixed(2));
            setSplitUpi((upiPaise / 100).toFixed(2));
            setSplitCard('0');
            setSplitCredit('0');
          }}
          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
        >
          {tr('50% Cash + 50% UPI')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSplitCash((grandTotalPaise / 100).toString());
            setSplitUpi('0');
            setSplitCard('0');
            setSplitCredit('0');
          }}
          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
        >
          {tr('All Cash')}
        </button>
        <button
          type="button"
          onClick={() => {
            setSplitCash('0');
            setSplitUpi((grandTotalPaise / 100).toString());
            setSplitCard('0');
            setSplitCredit('0');
          }}
          className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 rounded-md border border-slate-300 text-[10px] font-bold cursor-pointer"
        >
          {tr('All UPI')}
        </button>
      </div>
    </div>
  );
}

export interface CashTenderPanelProps {
  grandTotalPaise: number;
  amountReceivedInput: string;
  setAmountReceivedInput: SetStr;
}

export function CashTenderPanel({ grandTotalPaise, amountReceivedInput, setAmountReceivedInput }: CashTenderPanelProps) {
  const totalRupees = Math.ceil(grandTotalPaise / 100);
  const chips: number[] = [totalRupees];
  if (totalRupees % 50 !== 0) {
    const next50 = Math.ceil(totalRupees / 50) * 50;
    if (next50 > totalRupees && !chips.includes(next50)) chips.push(next50);
  } else if (totalRupees % 100 !== 0) {
    const next100 = Math.ceil(totalRupees / 100) * 100;
    if (next100 > totalRupees && !chips.includes(next100)) chips.push(next100);
  }
  const commonNotes = [100, 200, 500, 1000, 2000];
  for (const n of commonNotes) {
    if (n > totalRupees && !chips.includes(n) && chips.length < 5) {
      chips.push(n);
    }
  }

  return (
    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-slate-700">{tr('Cash Tendered / Received:')}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            step="1"
            placeholder={totalRupees.toString()}
            value={amountReceivedInput}
            onChange={(e) => setAmountReceivedInput(e.target.value)}
            className="w-24 bg-white border border-slate-300 text-slate-900 text-right font-mono font-bold text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-slate-900"
          />
          {amountReceivedInput && (
            <button
              type="button"
              onClick={() => setAmountReceivedInput('')}
              className="text-slate-400 hover:text-slate-600 text-[10px] font-bold"
            >
              {tr('Clear')}
            </button>
          )}
        </div>
      </div>

      {/* Quick Currency Tender Chips */}
      <div className="flex items-center gap-1.5 pt-0.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-bold text-slate-400 uppercase">{tr('Tender:')}</span>
        {chips.map((chip, idx) => (
          <button
            key={chip}
            type="button"
            onClick={() => setAmountReceivedInput(chip.toString())}
            className={cn(
              "px-2 py-0.5 rounded-md font-mono text-[11px] font-bold transition cursor-pointer border shadow-2xs",
              amountReceivedInput === chip.toString()
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
            )}
          >
            {idx === 0 ? tr('Exact ₹{chip}', { chip: chip }) : `₹${chip}`}
          </button>
        ))}
      </div>

      {amountReceivedInput && parseFloat(amountReceivedInput) * 100 > grandTotalPaise && (
        <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 flex items-center justify-between font-bold text-emerald-900">
          <span>{tr('💵 Return Change to Customer:')}</span>
          <span className="font-mono text-sm font-black text-emerald-700">
            {formatINR(Math.round(parseFloat(amountReceivedInput) * 100 - grandTotalPaise))}
          </span>
        </div>
      )}
    </div>
  );
}

export interface UpiQrCardProps {
  paymentMethod: PaymentMethod;
  splitUpi: string;
  grandTotalPaise: number;
  posQrDataUrl: string | null;
  business?: { name?: string; upi_id?: string } | null;
  setIsEnlargeQrModalOpen: (open: boolean) => void;
}

export function UpiQrCard({ paymentMethod, splitUpi, grandTotalPaise, posQrDataUrl, business, setIsEnlargeQrModalOpen }: UpiQrCardProps) {
  return (
    <div className="p-3 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white rounded-xl border border-slate-700 shadow-md space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <QrCode className="w-4 h-4 text-amber-400" />
          <span>{tr('Dynamic UPI Payment QR')}</span>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-black text-[10px]">
          {tr('Exact')} {formatINR(paymentMethod === 'split' ? Math.round(parseFloat(splitUpi || '0') * 100) : grandTotalPaise)}
        </span>
      </div>

      {posQrDataUrl ? (
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2.5 rounded-lg text-slate-900">
          <div 
            onClick={() => setIsEnlargeQrModalOpen(true)}
            className="relative group cursor-pointer flex-shrink-0"
            title={tr('Click to enlarge QR on counter display')}
          >
            <img
              src={posQrDataUrl}
              alt="Dynamic UPI QR"
              className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded border border-slate-200"
            />
            <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 rounded flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
              <span>{tr('Enlarge 📺')}</span>
            </div>
          </div>

          <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate">
              {tr('Pay to:')} <b>{business?.name}</b>
            </div>
            <div className="text-xs font-mono font-black text-emerald-700 truncate">
              {business?.upi_id || ''}
            </div>
            <div className="text-[10px] text-slate-500 font-medium leading-tight">
              {tr('Customer scans with Google Pay, PhonePe, Paytm or BHIM —')} <b>{tr('amount auto-fills instantly')}</b>.
            </div>
            <div className="flex items-center gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsEnlargeQrModalOpen(true)}
                className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-[10.5px] inline-flex items-center gap-1 cursor-pointer transition shadow-2xs"
              >
                <QrCode className="w-3 h-3 text-slate-700" />
                <span>{tr('Fullscreen 📺')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-3 bg-slate-800/80 rounded-lg text-center text-xs text-slate-300 space-y-1">
          <p className="font-bold text-amber-300">{tr('No UPI Address Configured')}</p>
          <p className="text-[11px] text-slate-400">
            {tr('Add your UPI ID in Settings to enable real-time dynamic amount QR codes.')}
          </p>
        </div>
      )}
    </div>
  );
}
