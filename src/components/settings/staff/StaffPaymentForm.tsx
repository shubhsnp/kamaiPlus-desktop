'use client';

import React, { useState } from 'react';
import { Banknote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { parseRupeesToPaise } from '@/lib/utils';
import { recordStaffPayment } from '@/lib/staff/staffMetrics';

interface StaffPaymentFormProps {
  businessId: string;
  staffName: string;
  onCancel: () => void;
  onRecorded: () => void;
  onError: (err: string) => void;
}

export function StaffPaymentForm({
  businessId,
  staffName,
  onCancel,
  onRecorded,
  onError,
}: StaffPaymentFormProps) {
  const [payAmountRupees, setPayAmountRupees] = useState('');
  const [payType, setPayType] = useState<'advance' | 'salary'>('advance');
  const [payMode, setPayMode] = useState<'cash' | 'upi'>('cash');
  const [payNote, setPayNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paise = parseRupeesToPaise(payAmountRupees);
    if (paise <= 0) {
      onError(tr('Please enter a valid amount.'));
      return;
    }

    setSavingPayment(true);
    try {
      await recordStaffPayment({
        businessId,
        staffName,
        type: payType,
        amountPaise: paise,
        paymentMode: payMode,
        note: payNote,
      });
      setPayAmountRupees('');
      setPayNote('');
      onRecorded();
    } catch {
      onError(tr('Could not record payment. Please try again.'));
    } finally {
      setSavingPayment(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/40 space-y-3"
      data-advance-form
    >
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div>
          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Payment Type')}
          </label>
          <select
            value={payType}
            onChange={(e) => setPayType(e.target.value as any)}
            className="w-full h-9 px-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            data-advance-type
          >
            <option value="advance">{tr('Salary Advance')}</option>
            <option value="salary">{tr('Salary Payout')}</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Amount (₹)')}
          </label>
          <div className="relative">
            <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
            <input
              type="number"
              min="1"
              placeholder="2000"
              value={payAmountRupees}
              onChange={(e) => setPayAmountRupees(e.target.value)}
              required
              className="w-full h-9 pl-6 pr-2 rounded-xl border border-slate-300 text-xs font-black bg-white"
              data-advance-amount
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Payment Mode')}
          </label>
          <select
            value={payMode}
            onChange={(e) => setPayMode(e.target.value as any)}
            className="w-full h-9 px-2 rounded-xl border border-slate-300 text-xs font-bold bg-white"
            data-advance-mode
          >
            <option value="cash">{tr('Cash (Drawer)')}</option>
            <option value="upi">{tr('UPI / Bank Transfer')}</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Reason / Note')}
          </label>
          <input
            type="text"
            placeholder={tr('e.g. Festival advance')}
            value={payNote}
            onChange={(e) => setPayNote(e.target.value)}
            className="w-full h-9 px-2.5 rounded-xl border border-slate-300 text-xs font-semibold bg-white"
            data-advance-note
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {tr('Cancel')}
        </Button>
        <Button
          type="submit"
          variant="success"
          size="sm"
          disabled={savingPayment}
          data-advance-submit
        >
          <Banknote className="w-3.5 h-3.5" />
          {savingPayment ? tr('Saving…') : tr('Record Cash Expense')}
        </Button>
      </div>
    </form>
  );
}
