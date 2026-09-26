'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Supplier } from '@/types';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import { localDateKey } from '@/lib/reports/cashDrawer';
import { nextSupplierBalance, recordSupplierEntry, SupplierEntryKind, SupplierPaymentMode } from '@/lib/suppliers/supplierLedger';
import { msg, paymentMethodLabel, tr } from '@/lib/i18n/core';

interface SupplierEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: Supplier;
  kind: SupplierEntryKind;
  onSaved: (message: string) => void;
}

const MODES: { id: SupplierPaymentMode; label: string }[] = [
  { id: 'cash', label: msg('Cash') },
  { id: 'upi', label: 'UPI' },
  { id: 'bank', label: msg('Bank / Cheque') },
];

/** "Bought on credit" (you owe more) or "Paid the supplier" (you owe less). */
export function SupplierEntryModal({ isOpen, onClose, supplier, kind, onSaved }: SupplierEntryModalProps) {
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<SupplierPaymentMode>('cash');
  const [note, setNote] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setAmount(kind === 'payment' && supplier.current_balance > 0 ? (supplier.current_balance / 100).toFixed(2) : '');
    setMode('cash');
    setNote('');
    setDate(localDateKey(new Date()));
    setError(null);
    setSaving(false);
  }, [isOpen, kind, supplier]);

  const amountPaise = amount.trim() ? parseRupeesToPaise(amount) : 0;
  const after = nextSupplierBalance(supplier.current_balance || 0, kind, amountPaise);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountPaise <= 0) return setError(tr('Enter an amount greater than ₹0.'));
    setSaving(true);
    // Keep today's entries at the real time; a back-dated entry is placed at noon that day.
    const today = localDateKey(new Date());
    const when = !date || date === today ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
    const res = await recordSupplierEntry({
      supplierId: supplier.id,
      kind,
      amountPaise,
      paymentMode: kind === 'payment' ? mode : undefined,
      note,
      date: when,
    });
    if (!res.ok) {
      setError(res.error || tr('Could not save.'));
      setSaving(false);
      return;
    }
    onSaved(
      kind === 'purchase'
        ? tr('Added {v1} purchase for {name}.', { v1: formatINR(amountPaise), name: supplier.name })
        : tr('Recorded {amount} {mode} payment to {name}.', { amount: formatINR(amountPaise), mode: paymentMethodLabel(mode), name: supplier.name }) + (mode === 'cash' ? tr(" Also added to today's cash expenses.") : '')
    );
    onClose();
  };

  const isPayment = kind === 'payment';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isPayment ? tr('Pay {name}', { name: supplier.name }) : tr('Purchase on Credit — {name}', { name: supplier.name })}
      description={isPayment ? tr('Money you paid to this supplier.') : tr('Goods you bought and will pay for later.')}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label={tr('Amount (₹)')} type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />

        {isPayment && (
          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-900">{tr('Paid by')}</span>
            <div className="flex gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-bold cursor-pointer ${mode === m.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
                >
                  {tr(m.label)}
                </button>
              ))}
            </div>
            {mode === 'cash' && <p className="text-[11px] text-slate-500">{tr('Cash payments also show in today\'s Cash Register expenses.')}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input label={tr('Date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label={isPayment ? tr('Note (optional)') : tr('Bill no. / note')} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex justify-between">
          <span className="text-slate-600">{tr('Balance after this entry')}</span>
          <span className={`font-black font-mono ${after > 0 ? 'text-rose-700' : after < 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
            {after > 0 ? tr('You owe {v1}', { v1: formatINR(after) }) : after < 0 ? tr('Advance {v1}', { v1: formatINR(-after) }) : tr('Settled')}
          </span>
        </div>

        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{error}</div>}

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? tr('Saving…') : isPayment ? tr('Save Payment') : tr('Save Purchase')}</Button>
        </div>
      </form>
    </Modal>
  );
}
