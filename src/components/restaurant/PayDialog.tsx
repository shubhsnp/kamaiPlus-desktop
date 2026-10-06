'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, Printer, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { DiscountInput, RestOrder, orderTotals } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import type { RestPayMethod } from '@/lib/restaurant/settle';

const METHODS: { id: RestPayMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
];

/**
 * Bill and payment (v4.106.0): the GST breakup, an optional discount, how it was paid (cash shows the
 * change to give back), and "Settle & Print". The bill number comes from the shop's normal series.
 */
export function PayDialog({ order, settings, open, busy, onClose, onSettle }: {
  order: RestOrder;
  settings: RestaurantSettings;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSettle: (method: RestPayMethod, receivedPaise: number, discount: DiscountInput | null) => void;
}) {
  const [method, setMethod] = useState<RestPayMethod>('cash');
  const [received, setReceived] = useState('');
  const [discType, setDiscType] = useState<'flat' | 'percentage'>('percentage');
  const [discValue, setDiscValue] = useState('');

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setReceived('');
      setDiscType('percentage');
      setDiscValue('');
    }
  }, [open]);

  const discount: DiscountInput | null = discValue ? { type: discType, value: parseFloat(discValue) || 0 } : null;
  const totals = useMemo(() => orderTotals(order, settings, discount), [order, settings, discValue, discType]); // eslint-disable-line react-hooks/exhaustive-deps
  const receivedPaise = received ? Math.round((parseFloat(received) || 0) * 100) : 0;
  const short = method === 'cash' && received !== '' && receivedPaise < totals.grandTotal;
  const change = method === 'cash' && receivedPaise > totals.grandTotal ? receivedPaise - totals.grandTotal : 0;
  const quick = useMemo(() => {
    const g = Math.ceil(totals.grandTotal / 100);
    const steps = [g, Math.ceil(g / 50) * 50, Math.ceil(g / 100) * 100, Math.ceil(g / 500) * 500];
    return Array.from(new Set(steps.filter((v) => v >= g))).slice(0, 4);
  }, [totals.grandTotal]);
  const gstPart = totals.taxTotal;

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('Bill — {name}', { name: order.kind === 'table' ? `${tr('Table')} ${order.label}` : `${tr('Takeaway')} ${order.label}` })} description={tr('{count} pieces', { count: totals.pieces })} size="md">
      <div className="space-y-4" data-restaurant-pay>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-sm">
          <Row label={tr('Items')} value={formatINR(totals.items.reduce((n, i) => n + (i.product_id.startsWith('restaurant_') ? 0 : i.total_amount + i.discount_amount), 0))} />
          {totals.discountTotal > 0 && <Row label={tr('Discount')} value={`− ${formatINR(totals.discountTotal)}`} tone="text-rose-600" />}
          {totals.serviceChargePaise > 0 && <Row label={`${tr('Service charge')} ${settings.serviceChargePercent}%`} value={formatINR(totals.serviceChargePaise)} />}
          {totals.packingPaise > 0 && <Row label={tr('Packing charge')} value={formatINR(totals.packingPaise)} />}
          <Row label={`GST ${settings.gstRate}% ${settings.gstInclusive ? tr('(included)') : tr('(added)')}`} value={formatINR(gstPart)} muted />
          <div className="flex items-end justify-between pt-2 mt-1 border-t border-slate-200">
            <span className="text-xs font-black uppercase tracking-wide text-slate-500">{tr('Total')}</span>
            <span className="text-3xl font-black font-mono text-slate-900" data-pay-total>{formatINR(totals.grandTotal)}</span>
          </div>
          {totals.items.length === 0 && <p className="text-xs text-rose-600">{tr('Nothing to bill yet.')}</p>}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 w-20 shrink-0">{tr('Discount')}</span>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden shrink-0" role="group" aria-label={tr('Discount type')}>
            {(['percentage', 'flat'] as const).map((t) => (
              <button key={t} type="button" onClick={() => setDiscType(t)} aria-pressed={discType === t}
                className={cn('h-9 px-3 text-xs font-black cursor-pointer', discType === t ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}>{t === 'percentage' ? '%' : '₹'}</button>
            ))}
          </div>
          <input value={discValue} onChange={(e) => setDiscValue(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0" aria-label={tr('Discount')}
            className="w-24 h-9 px-3 rounded-lg border border-slate-300 text-sm font-mono font-semibold text-right focus:outline-none focus:border-emerald-600" />
        </div>

        <div>
          <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5">{tr('Paid by')}</span>
          <div className="grid grid-cols-3 gap-2">
            {METHODS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setMethod(id)} aria-pressed={method === id} data-pay-method={id}
                className={cn('h-14 rounded-xl border-2 flex items-center justify-center gap-2 text-sm font-black cursor-pointer transition-colors',
                  method === id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400')}>
                <Icon className="w-5 h-5" /> {tr(label)}
              </button>
            ))}
          </div>
        </div>

        {method === 'cash' && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label htmlFor="rest-received" className="text-[11px] font-black uppercase tracking-wide text-slate-500 w-20 shrink-0">{tr('Received')}</label>
              <input id="rest-received" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={String(Math.ceil(totals.grandTotal / 100))}
                className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-lg font-mono font-black text-right focus:outline-none focus:border-emerald-600" data-pay-received />
            </div>
            <div className="flex flex-wrap gap-1.5 pl-[88px]">
              {quick.map((v) => (
                <button key={v} type="button" onClick={() => setReceived(String(v))} className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:border-emerald-500 text-xs font-black font-mono cursor-pointer">₹{v}</button>
              ))}
            </div>
            {short && <p className="text-xs font-bold text-rose-600 pl-[88px]">{tr('Received is {amount} short.', { amount: formatINR(totals.grandTotal - receivedPaise) })}</p>}
            {change > 0 && <p className="text-sm font-black text-emerald-700 pl-[88px]" data-pay-change>{tr('Give back {amount}', { amount: formatINR(change) })}</p>}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tr('Back')}</Button>
          <Button type="button" variant="success" size="lg" isLoading={busy} disabled={short || totals.grandTotal <= 0}
            onClick={() => onSettle(method, receivedPaise, discount)} data-pay-settle>
            <Printer className="w-4 h-4" /> {tr('Settle & Print Bill')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, tone, muted }: { label: string; value: string; tone?: string; muted?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between', muted && 'text-xs text-slate-500')}>
      <span className={muted ? '' : 'text-slate-600 font-semibold'}>{label}</span>
      <span className={cn('font-mono font-bold', tone || (muted ? '' : 'text-slate-900'))}>{value}</span>
    </div>
  );
}
