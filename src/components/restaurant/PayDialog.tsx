'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Banknote, BookOpen, CreditCard, FileText, Printer, QrCode, Smartphone, UserRound, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { readSilentPrint } from '@/lib/hardware/printerWatch';
import { DiscountInput, RestOrder, orderRef, orderTotals, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { RestPayMethod, cleanGuestPhone } from '@/lib/restaurant/settle';
import type { Business } from '@/types';
import { RestUpiQr } from '@/components/restaurant/RestUpiQr';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { checkCreditLimit } from '@/lib/billing/creditLimit';
import { db } from '@/lib/db';
import type { Customer } from '@/types';

const METHODS: { id: RestPayMethod; label: string; icon: typeof Banknote }[] = [
  { id: 'cash', label: 'Cash', icon: Banknote },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'split', label: 'Cash + UPI', icon: Wallet },
  // v4.175.0: on the guest's khata, as at the counter (only with Khata on).
  { id: 'credit', label: 'Udhar', icon: BookOpen },
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
  // v4.175.0: the saved customer with this mobile — fills the name, shows their udhar (guestCustomer.ts).
  const [known, setKnown] = useState<Customer | null>(null);
  const switches = useFeatureSwitches();
  const methods = METHODS.filter((m) => m.id !== 'credit' || switches.khata);

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
  const goodPhone = cleanGuestPhone(guestPhone);
  useEffect(() => {
    let live = true;
    if (!goodPhone) { setKnown(null); return; }
    void db.customers.where('phone').anyOf([goodPhone, `+91${goodPhone}`, `91${goodPhone}`, `0${goodPhone}`]).first().then((c) => {
      if (!live) return;
      setKnown(c || null);
      // A customer saved with only a mobile carries it as the name — do not type the number into the name box.
      if (c?.name && cleanGuestPhone(c.name) !== goodPhone) setGuestName((n) => n.trim() ? n : c.name);
    }).catch(() => {});
    return () => { live = false; };
  }, [goodPhone]);
  const udharNoGuest = method === 'credit' && !guestName.trim() && !goodPhone;
  const limit = method === 'credit' && known ? checkCreditLimit(known, totals.grandTotal) : null;
  const splitCashPaise = splitCash ? Math.round((parseFloat(splitCash) || 0) * 100) : 0;
  const splitUpiPaise = Math.max(0, totals.grandTotal - splitCashPaise);
  const splitBad = method === 'split' && (splitCashPaise <= 0 || splitCashPaise >= totals.grandTotal);
  const quick = useMemo(() => {
    const g = Math.ceil(totals.grandTotal / 100);
    const steps = [g, Math.ceil(g / 50) * 50, Math.ceil(g / 100) * 100, Math.ceil(g / 500) * 500];
    return Array.from(new Set(steps.filter((v) => v >= g))).slice(0, 4);
  }, [totals.grandTotal]);
  const foodPaise = totals.items.reduce((n, i) => n + (i.product_id.startsWith('restaurant_') ? 0 : i.total_amount + i.discount_amount), 0);
  // v4.143.0: a delivery said "Takeaway DL-01" here.
  // v4.161.0: a Fast POS token reads "Token TK-05 · Dine-in".
  const who = order.fast ? `${tr('Token')} ${order.label} · ${order.fast.dineIn ? tr('Dine-in') : tr('Takeaway')}`
    : order.kind === 'table' ? `${tr('Table')} ${order.label}` : order.kind === 'delivery' ? `${tr('Delivery')} ${order.label}` : `${tr('Takeaway')} ${order.label}`;

  // The new method's text fades in; nothing around it moves.
  const paneRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    paneRef.current?.animate?.([{ opacity: 0 }, { opacity: 1 }], { duration: 140, easing: 'ease-out' });
  }, [method, open]);

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('Bill — {name}', { name: who })} description={piecesText(totals.pieces)} size="lg" className="max-w-[780px]">
      <div className="space-y-3" data-restaurant-pay>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Left: what the guest pays */}
        <div className="space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5 text-sm">
            <Row label={tr('Items')} value={formatINR(foodPaise)} />
            {/* Always there, even at ₹0: typing a discount must not push the boxes below it down. */}
            <Row label={tr('Discount')} value={`− ${formatINR(totals.discountTotal)}`} tone={totals.discountTotal > 0 ? 'text-rose-600' : 'text-slate-400'} />
            {totals.serviceChargePaise > 0 && <Row label={`${tr('Service charge')} ${settings.serviceChargePercent}%`} value={formatINR(totals.serviceChargePaise)} />}
            {totals.packingPaise > 0 && <Row label={tr('Packing charge')} value={formatINR(totals.packingPaise)} />}
            {totals.deliveryPaise > 0 && <Row label={tr('Delivery charge')} value={formatINR(totals.deliveryPaise)} />}
            {settings.gstRate > 0 && <Row label={`GST ${settings.gstRate}% ${settings.gstInclusive ? tr('(included)') : tr('(added)')}`} value={formatINR(totals.taxTotal)} muted />}
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
            <p className={cn('text-[10.5px] leading-[14px] min-h-[28px] line-clamp-2', phoneBad ? 'text-rose-600 font-bold' : 'text-slate-500')}>
              {phoneBad ? tr('Enter a 10-digit mobile number, or leave it empty.') : known
                ? tr('Saved customer {name} · udhar {amount}', { name: known.name, amount: formatINR(known.current_balance || 0) })
                : tr('A mobile saves the guest as a customer and fills WhatsApp when you send the bill.')}
            </p>
          </div>
        </div>

        {/* Right: how it is paid, and what happens after */}
        <div className="space-y-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5">{tr('Paid by')}</span>
            <div className={cn('grid gap-2', methods.length > 4 ? 'grid-cols-5' : 'grid-cols-4')}>
              {methods.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setMethod(id)} aria-pressed={method === id} data-pay-method={id}
                  className={cn('h-[60px] rounded-xl border-2 flex flex-col items-center justify-center gap-1 text-xs font-black cursor-pointer transition-colors leading-none text-center whitespace-nowrap px-0',
                    method === id ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400')}>
                  <Icon className="w-5 h-5" /> {tr(label)}
                </button>
              ))}
            </div>
          </div>

          {/* v4.183.0: one fixed box for every method, so the window never changes size or moves; a
              message has its line kept free in advance. The text only fades. */}
          <div className="h-[176px] rounded-2xl border border-slate-200 bg-slate-50/60 p-3 overflow-y-auto" data-pay-pane={method}>
            <div ref={paneRef} className="h-full">
              {method === 'cash' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label htmlFor="rest-received" className="text-[11px] font-black uppercase tracking-wide text-slate-500 w-20 shrink-0">{tr('Received')}</label>
                    <input id="rest-received" value={received} onChange={(e) => setReceived(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder={String(Math.ceil(totals.grandTotal / 100))}
                      className="flex-1 min-w-0 h-11 px-3 rounded-xl border border-slate-300 bg-white text-lg font-mono font-black text-right focus:outline-none focus:border-emerald-600" data-pay-received />
                  </div>
                  <div className="flex justify-end gap-1.5">
                    {quick.map((v) => (
                      <button key={v} type="button" onClick={() => setReceived(String(v))} className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white hover:border-emerald-500 text-xs font-black font-mono cursor-pointer">₹{v}</button>
                    ))}
                  </div>
                  <div className="min-h-[40px] text-right">
                    {short && <p className="text-xs font-bold text-rose-600">{tr('Received is {amount} short.', { amount: formatINR(totals.grandTotal - receivedPaise) })}</p>}
                    {change > 0 && <p className="text-lg font-black text-emerald-700" data-pay-change>{tr('Give back {amount}', { amount: formatINR(change) })}</p>}
                  </div>
                </div>
              )}
              {method === 'upi' && <RestUpiQr business={business} amountPaise={totals.grandTotal} reference={orderRef(order)} />}
              {method === 'split' && (
                <div className="h-full flex items-center gap-3" data-pay-split>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <label htmlFor="rest-split-cash" className="block text-[11px] font-black uppercase tracking-wide text-slate-500">{tr('Cash part')}</label>
                    <input id="rest-split-cash" value={splitCash} onChange={(e) => setSplitCash(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" placeholder="0"
                      className="w-full h-10 px-3 rounded-xl border border-slate-300 bg-white text-lg font-mono font-black text-right focus:outline-none focus:border-emerald-600" data-pay-split-cash />
                    <div className="flex items-center justify-between rounded-xl bg-white border border-slate-200 px-3 h-9 text-sm">
                      <span className="font-bold text-slate-600">{tr('UPI part')}</span>
                      <span className="font-mono font-black text-slate-900" data-pay-split-upi>{formatINR(splitUpiPaise)}</span>
                    </div>
                    <div className="min-h-[28px]">
                      {splitBad && splitCash !== '' && <p className="text-[11px] leading-[14px] font-bold text-rose-600">{tr('The cash part must be more than ₹0 and less than the total.')}</p>}
                    </div>
                  </div>
                  {splitBad ? (
                    <div className="shrink-0 w-[132px] h-[132px] rounded-lg border border-dashed border-slate-300 bg-white p-2 flex flex-col items-center justify-center gap-1 text-center text-[10.5px] leading-tight font-semibold text-slate-500">
                      <QrCode className="w-6 h-6 text-slate-300" />
                      {tr('QR comes after the cash part')}
                    </div>
                  ) : <RestUpiQr business={business} amountPaise={splitUpiPaise} reference={orderRef(order)} qrOnly />}
                </div>
              )}
              {method === 'credit' && (
                <div className="h-full flex flex-col justify-center gap-2" data-pay-udhar>
                  <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs font-semibold text-amber-900">
                    {tr('{amount} goes on the guest\'s khata (udhar). Nothing is paid now.', { amount: formatINR(totals.grandTotal) })}
                  </p>
                  <div className="min-h-[34px]">
                    {udharNoGuest && <p className="text-xs font-bold text-rose-600">{tr('Udhar needs the guest\'s name or mobile (left).')}</p>}
                    {limit?.over && <p className="text-xs font-bold text-rose-600">{tr('Over the udhar limit: {name} will owe {after} (limit {limit}).', { name: known?.name || '', after: formatINR(limit.after), limit: formatINR(limit.limit) })}</p>}
                  </div>
                </div>
              )}
              {method === 'card' && (
                <div className="h-full flex flex-col items-center justify-center gap-2 text-center">
                  <CreditCard className="w-7 h-7 text-slate-400" />
                  <p className="max-w-[290px] text-[13px] font-semibold text-slate-600">{tr('Swipe the card on your machine for {amount}, then settle here.', { amount: formatINR(totals.grandTotal) })}</p>
                </div>
              )}
            </div>
          </div>
          {/* v4.186.0 (Rahul): "After paying" (print straight away / show the bill) is set once in Printer setup —
              the Settle button says which it will do. */}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
        <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tr('Back')}</Button>
        <Button type="button" variant="success" size="lg" isLoading={busy} disabled={short || phoneBad || splitBad || udharNoGuest || totals.grandTotal <= 0} className="min-w-[250px]"
          onClick={() => onSettle(method, method === 'split' ? splitCashPaise : receivedPaise, discount, { guestName, guestPhone, printNow })} data-pay-settle>
          {printNow ? <Printer className="w-4 h-4" /> : <FileText className="w-4 h-4" />} {printNow ? tr('Settle & Print Bill') : tr('Settle & Show Bill')}
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
