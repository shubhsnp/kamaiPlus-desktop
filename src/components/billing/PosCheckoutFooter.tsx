'use client';

import { PaymentMethod } from '@/types';
import { formatINR, cn } from '@/lib/utils';
import { Receipt, QrCode, FileText, CreditCard, Banknote, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { focusPosCustomerName } from '@/components/billing/PosCustomerRow';
import { isDraftEmpty } from '@/lib/billing/billCustomer';
import { tr } from '@/lib/i18n/core';
import type { CustomerDraft } from '@/lib/billing/billCustomer';
import type { CartItem, Customer } from '@/types';

export interface PosCheckoutFooterProps {
  paymentMethod: PaymentMethod;
  selectedCustomerId: string;
  cart: CartItem[];
  splitCash: string;
  splitUpi: string;
  amountReceivedInput: string;
  customerDraft: CustomerDraft;
  setPaymentMethod: (method: PaymentMethod) => void;
  setSplitCash: (val: string | ((p: string) => string)) => void;
  setSplitUpi: (val: string | ((p: string) => string)) => void;
  khataOn: boolean;
  paymentKeysOn: boolean;
  totalItemCount: number;
  selectedCustomer: Customer | undefined;
  grandTotalPaise: number;
  discountTotalPaise: number;
  addedGstPaise: number;
  itemsValuePaise: number;
  billDiscountPaise: number;
  totalUnits: number;
  includedGstPaise: number;
  handleCompleteSale: () => Promise<void>;
  handleSaveEstimate: () => Promise<void>;
}

/**
 * The pinned bottom of the bill (v4.104.0, K-D23 — moved out of PosCheckoutPanel unchanged):
 * payment mode buttons, the grand total and cash change, the previous-udhar warning,
 * Complete Sale and Save as Estimate.
 */
export function PosCheckoutFooter(props: PosCheckoutFooterProps) {
  const {
    paymentMethod, selectedCustomerId, cart, splitCash, splitUpi, amountReceivedInput,
    customerDraft, setPaymentMethod, setSplitCash, setSplitUpi, khataOn, paymentKeysOn,
    totalItemCount, selectedCustomer, grandTotalPaise, discountTotalPaise, addedGstPaise, itemsValuePaise,
    billDiscountPaise, totalUnits, includedGstPaise, handleCompleteSale, handleSaveEstimate,
  } = props;
  return (
    <div className="pt-2.5 mt-2.5 border-t border-slate-200 space-y-2 flex-shrink-0">
      {/* Payment mode stays in sight above the total (F4 / F8 / F9 change it) */}
      {/* Payment Method Selector */}
      <div data-pos-pay-modes aria-label={tr('Payment Mode')}>
        <div className={cn('grid gap-1.5 sm:gap-2', khataOn ? 'grid-cols-4' : 'grid-cols-3')}>
          {[
            { id: 'cash', label: tr('Cash'), icon: Banknote, shortcut: 'F4' },
            { id: 'upi', label: tr('UPI / QR'), icon: QrCode, shortcut: 'F8' },
            { id: 'credit', label: tr('Credit'), icon: BookOpen, shortcut: 'F9' },
            { id: 'split', label: tr('Split'), icon: CreditCard },
          ].filter((m) => khataOn || m.id !== 'credit').map((m) => {
            const Icon = m.icon;
            const isSelected = paymentMethod === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPaymentMethod(m.id as PaymentMethod);
                  if (m.id === 'split' && !splitCash && !splitUpi) {
                    setSplitCash((grandTotalPaise / 200).toString());
                    setSplitUpi((grandTotalPaise / 200).toString());
                  }
                  if (m.id === 'credit' && !selectedCustomerId && isDraftEmpty(customerDraft)) {
                    focusPosCustomerName();
                  }
                }}
                className={cn(
                  'py-1.5 px-1 rounded-lg border text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-all text-center cursor-pointer relative',
                  isSelected
                    ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{m.label}</span>
                {m.shortcut && paymentKeysOn && (
                  <span className={cn(
                    "text-[10px] font-mono px-1 py-0.2 rounded font-bold hidden sm:inline-block",
                    isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  )}>
                    {m.shortcut}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {(discountTotalPaise > 0 || addedGstPaise > 0) && (
        <div className="space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>{tr('Items Total')}</span>
            <span className="font-semibold text-slate-800 font-mono">{formatINR(itemsValuePaise)}</span>
          </div>
          {discountTotalPaise > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-700 font-medium">
              <span>
                {tr('Total Discount')}
                {billDiscountPaise > 0 && (
                  <span className="text-[10px] ml-1 font-mono text-emerald-600">
                    {tr('(Bill: -')}{formatINR(billDiscountPaise)})
                  </span>
                )}
              </span>
              <span className="font-semibold font-mono">-{formatINR(discountTotalPaise)}</span>
            </div>
          )}
          {addedGstPaise > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>{tr('GST (added)')}</span>
              <span className="font-semibold text-slate-800 font-mono">+{formatINR(addedGstPaise)}</span>
            </div>
          )}
          {includedGstPaise > 0 && (
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{tr('Incl. GST in prices')}</span>
              <span className="font-mono">{formatINR(includedGstPaise)}</span>
            </div>
          )}
        </div>
      )}
      {/* High-Contrast POS Grand Total & Tender Card */}
      <div className="p-3 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white rounded-2xl border border-slate-800 shadow-md space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              {tr('Total Payable')}
            </span>
            <span className="text-[11px] font-mono text-slate-400 font-medium">
              {totalItemCount} {totalItemCount === 1 ? tr('item') : tr('items')} • {totalUnits} {tr('units')}
            </span>
          </div>
          <div className="text-right">
            <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight leading-none drop-shadow-sm">
              {formatINR(grandTotalPaise)}
            </div>
            {includedGstPaise > 0 && (
              <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                {tr('(Incl.')} {formatINR(includedGstPaise)} GST)
              </span>
            )}
          </div>
        </div>

        {/* Cash Mode Tender & Return Change Display */}
        {paymentMethod === 'cash' && amountReceivedInput && (() => {
          const tenderedPaise = Math.round((parseFloat(amountReceivedInput) || 0) * 100);
          const returnChangePaise = tenderedPaise - grandTotalPaise;

          if (returnChangePaise > 0) {
            return (
              <div className="pt-2 mt-1 border-t border-slate-800/80">
                <div className="p-2.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">💵</span>
                    <div>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-300 block leading-tight">
                        {tr('Return Change')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {tr('Tendered:')} {formatINR(tenderedPaise)}
                      </span>
                    </div>
                  </div>
                  <span className="font-mono font-black text-amber-300 text-xl sm:text-2xl tracking-tight">
                    {formatINR(returnChangePaise)}
                  </span>
                </div>
              </div>
            );
          } else if (returnChangePaise === 0) {
            return (
              <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-emerald-400 font-bold">
                <span>{tr('✓ Exact Cash Tendered')}</span>
                <span className="font-mono">{formatINR(tenderedPaise)}</span>
              </div>
            );
          } else {
            return (
              <div className="pt-1.5 mt-1 border-t border-slate-800/80 flex items-center justify-between text-xs text-rose-400 font-bold">
                <span>{tr('⚠️ Short by:')}</span>
                <span className="font-mono">{formatINR(Math.abs(returnChangePaise))}</span>
              </div>
            );
          }
        })()}
      </div>

      {/* Customer Balance Warning Banner if Selected Customer has Pending Udhar */}
      {selectedCustomer && (selectedCustomer.current_balance || 0) > 0 && (
        <div className="p-2 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-xs text-rose-950 font-bold shadow-2xs">
          <span className="flex items-center gap-1.5">
            <span>{tr('⚠️ Previous Udhar Due:')}</span>
            <span className="text-slate-600 font-normal">({selectedCustomer.name})</span>
          </span>
          <span className="font-mono font-black text-rose-700 text-sm">
            {formatINR(selectedCustomer.current_balance)}
          </span>
        </div>
      )}

      <Button
        size="lg"
        disabled={cart.length === 0}
        onClick={() => handleCompleteSale()}
        className={cn(
          'w-full text-xs sm:text-sm font-black py-3 sm:py-3.5 shadow-md cursor-pointer transition-all flex items-center justify-center gap-2 rounded-xl',
          'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-emerald-600/20'
        )}
      >
        <Receipt className="w-4 h-4 mr-1 text-white" />
        <span>{tr('Complete Sale & Print')}</span>
        <kbd className="ml-1 px-1.5 py-0.5 rounded bg-emerald-700 text-emerald-100 font-mono text-[10px] font-bold border border-emerald-500">Enter ↵</kbd>
      </Button>
      {/* Estimate / quotation (v4.102.0, K-D07): no stock, khata or cash until converted to a bill. */}
      <button
        type="button"
        disabled={cart.length === 0}
        onClick={() => handleSaveEstimate()}
        data-save-estimate
        className="w-full text-xs font-bold py-2 rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
      >
        <FileText className="w-3.5 h-3.5" />
        <span>{tr('Save as Estimate')}</span>
      </button>
    </div>
  );
}
