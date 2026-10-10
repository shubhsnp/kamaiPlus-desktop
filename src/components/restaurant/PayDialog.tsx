'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, CreditCard, FileText, Printer, Smartphone, UserRound, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { readSilentPrint, saveSilentPrint } from '@/lib/hardware/printerWatch';
import { DiscountInput, RestOrder, orderTotals, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { RestPayMethod, cleanGuestPhone } from '@/lib/restaurant/settle';
import type { Business } from '@/types';
import { RestUpiQr } from '@/components/restaurant/RestUpiQr';

const METHODS: { id: RestPayMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'split', label: 'Cash + UPI', icon: Wallet },
];

export interface SettleExtras {
  guestName: string;
  guestPhone: string;
  /** true = print at once (no bill window); false = show the bill: Print, PDF, WhatsApp. */
  printNow: boolean;
}

/**
 * Bill and payment (v4.106.0, v4.107.0): the GST breakup, an optional discount, how it was paid (cash
 * shows the change, UPI shows the shop's QR for the exact amount), the guest's name / mobile for the
 * WhatsApp bill, and what happens after paying — print straight away, or the bill window with Print,
 * PDF and WhatsApp (the same "print straight away" setting as the counter). The bill number comes
 * from the shop's normal series.
 */
export function PayDialog({ order, settings, business, open, busy, onClose, onSettle }: {
  order: RestOrder;
  settings: RestaurantSettings;
  business?: Business | null;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSettle: (method: RestPayMethod, receivedPaise: number, discount: DiscountInput | null, extras: SettleExtras) => void;
}) {
  const [method, setMethod] = useState<RestPayMethod>('cash');
  const [received, setReceived] = useState('');
  const [discType, setDiscType] = useState<'flat' | 'percentage'>('percentage');
  const [discValue, setDiscValue] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [printNow, setPrintNow] = useState(false);
  const [splitCash, setSplitCash] = useState('');

  useEffect(() => {
    if (open) {
      setMethod('cash');
      setReceived('');
      setDiscType('percentage');
      setDiscValue('');
      // A takeaway / delivery guest typed when the order was opened (v4.139.0).
      setGuestName(order.guest?.name || '');
      setGuestPhone(order.guest?.phone || '');
      setPrintNow(readSilentPrint());
      setSplitCash('');
    }
  }, [open]);

  const discount: DiscountInput | null = discValue ? { type: discType, value: parseFloat(discValue) || 0 } : null;
  const totals = useMemo(() => orderTotals(order, settings, discount), [order, settings, discValue, discType]); // eslint-disable-line react-hooks/exhaustive-deps
  const receivedPaise = received ? Math.round((parseFloat(received) || 0) * 100) : 0;
  const short = method === 'cash' && received !== '' && receivedPaise < totals.grandTotal;
  const change = method === 'cash' && receivedPaise > totals.grandTotal ? receivedPaise - totals.grandTotal : 0;
  const phoneBad = guestPhone.trim() !== '' && !cleanGuestPhone(guestPhone);
  const splitCashPaise = splitCash ? Math.round((parseFloat(splitCash) || 0) * 100) : 0;
  const splitUpiPaise = Math.max(0, totals.grandTotal - splitCashPaise);
  const splitBad = method === 'split' && (splitCashPaise <= 0 || splitCashPaise >= totals.grandTotal);
  const quick = useMemo(() => {
    const g = Math.ceil(totals.grandTotal / 100);
    const steps = [g, Math.ceil(g / 50) * 50, Math.ceil(g / 100) * 100, Math.ceil(g / 500) * 500];
    return Array.from(new Set(steps.filter((v) => v >= g))).slice(0, 4);
  }, [totals.grandTotal]);
  const foodPaise = totals.items.reduce((n, i) => n + (i.product_id.startsWith('restaurant_') ? 0 : i.total_amount + i.discount_amount), 0);
  const who = order.kind === 'table' ? `${tr('Table')} ${order.label}` : `${tr('Takeaway')} ${order.label}`;

  const choosePrint = (on: boolean) => {
    setPrintNow(on);
    saveSilentPrint(on);
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('Bill — {name}', { name: who })} description={piecesText(totals.pieces)} size="lg">
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]" data-restaurant-pay>
        {/* Left: what the guest pays */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-sm">
            <Row label={tr('Items')} value={formatINR(foodPaise)} />
            {totals.discountTotal > 0 && <Row label={tr('Discount')} value={`− ${formatINR(totals.discountTotal)}`} tone="text-rose-600" />}
            {totals.serviceChargePaise > 0 && <Row label={`${tr('Service charge')} ${settings.serviceChargePercent}%`} value={formatINR(totals.serviceChargePaise)} />}
            {totals.packingPaise > 0 && <Row label={tr('Packing charge')} value={formatINR(totals.packingPaise)} />}
            {totals.deliveryPaise > 0 && <Row label={tr('Delivery charge')} value={formatINR(totals.deliveryPaise)} />}
            <Row label={`GST ${settings.gstRate}% ${settings.gstInclusive ? tr('(included)') : tr('(added)')}`} value={formatINR(totals.taxTotal)} muted />
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

          <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500"><UserRound className="w-3.5 h-3.5" /> {tr('Guest (optional)')}</div>
            <div className="grid grid-cols-2 gap-2">
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={tr('Name')} aria-label={tr('Guest name')} maxLength={40}
                className="h-9 px-3 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600" data-pay-guest-name />
              <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value.replace(/[^\d+ ]/g, ''))} placeholder={tr('Mobile')} aria-label={tr('Guest mobile')} inputMode="tel" maxLength={14}
                className={cn('h-9 px-3 rounded-lg border text-sm font-mono font-semibold focus:outline-none', phoneBad ? 'border-rose-400 focus:border-rose-500' : 'border-slate-300 focus:border-emerald-600')} data-pay-guest-phone />
            </div>
            <p className={cn('text-[10.5px]', phoneBad ? 'text-rose-600 font-bold' : 'text-slate-500')}>
              {phoneBad ? tr('Enter a 10-digit mobile number, or leave it empty.') : tr('The mobile fills WhatsApp when you send the bill.')}
            </p>
          </div>
        </div>

        {/* Right: how it is paid, and what happens after */}
        <div className="space-y-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5">{tr('Paid by')}</span>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setMethod(id)} aria-pressed={method === id} data-pay-method={id}
                  className={cn('h-14 rounded-xl border-2 flex flex-col items-center justify-center gap-0.5 text-xs font-black cursor-pointer transition-colors leading-tight text-center px-1',
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
          {method === 'upi' && <RestUpiQr business={business} amountPaise={totals.grandTotal} reference={`${order.kind === 'table' ? 'Table' : 'Takeaway'} ${order.label}`} />}
          {method === 'split' && (
            <div className="space-y-2" data-pay-split>
              <div className="flex items-center gap-2">
                <label htmlFor="rest-split-cash" className="text-[11px] font-black uppercase tracking-wide text-slate-500 w-20 shrink-0">{tr('Cash part')}</label>
                <input id="rest-split-cash" value={splitCash} onChange={(e) => setSplitCash(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0"
                  className="flex-1 h-11 px-3 rounded-xl border border-slate-300 text-lg font-mono font-black text-right focus:outline-none focus:border-emerald-600" data-pay-split-cash />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm">
                <span className="font-bold text-slate-600">{tr('UPI part')}</span>
                <span className="font-mono font-black text-slate-900" data-pay-split-upi>{formatINR(splitUpiPaise)}</span>
              </div>
              {splitBad && splitCash !== '' && <p className="text-xs font-bold text-rose-600">{tr('The cash part must be more than ₹0 and less than the total.')}</p>}
              {!splitBad && <RestUpiQr business={business} amountPaise={splitUpiPaise} reference={`${order.kind === 'table' ? 'Table' : 'Takeaway'} ${order.label}`} />}
            </div>
          )}
          {method === 'card' && <p className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-600">{tr('Swipe the card on your machine for {amount}, then settle here.', { amount: formatINR(totals.grandTotal) })}</p>}

          <div>
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5">{tr('After paying')}</span>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={tr('After paying')}>
              <AfterChoice active={printNow} onClick={() => choosePrint(true)} icon={Printer} title={tr('Print straight away')} hint={tr('Bill goes to the printer')} data="print" />
              <AfterChoice active={!printNow} onClick={() => choosePrint(false)} icon={FileText} title={tr('Show the bill')} hint={tr('Print, PDF or WhatsApp')} data="show" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tr('Back')}</Button>
            <Button type="button" variant="success" size="lg" isLoading={busy} disabled={short || phoneBad || splitBad || totals.grandTotal <= 0}
              onClick={() => onSettle(method, method === 'split' ? splitCashPaise : receivedPaise, discount, { guestName, guestPhone, printNow })} data-pay-settle>
              {printNow ? <Printer className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {printNow ? tr('Settle & Print Bill') : tr('Settle & Show Bill')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function AfterChoice({ active, onClick, icon: Icon, title, hint, data }: { active: boolean; onClick: () => void; icon: typeof Printer; title: string; hint: string; data: string }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick} data-pay-after={data}
      className={cn('text-left rounded-xl border-2 px-3 py-2 cursor-pointer transition-colors', active ? 'border-emerald-600 bg-emerald-50' : 'border-slate-200 bg-white hover:border-slate-400')}>
      <span className={cn('flex items-center gap-1.5 text-xs font-black', active ? 'text-emerald-800' : 'text-slate-800')}><Icon className="w-4 h-4" /> {title}</span>
      <span className="block text-[10.5px] text-slate-500 mt-0.5">{hint}</span>
    </button>
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
