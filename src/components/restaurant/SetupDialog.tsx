'use client';

import React, { useEffect, useState } from 'react';
import { Plus, Printer, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, parseRupeesToPaise } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { gstAllowed } from '@/lib/business/verticalProfile';
import { MAX_ADDONS, MAX_TABLES, RestaurantSettings, defaultTableNames, sanitizeRestaurantSettings, saveRestaurantSettings } from '@/lib/restaurant/settings';

const GST_CHOICES = [0, 5, 12, 18];

/**
 * Restaurant set-up (v4.106.0): how many tables and what they are called, the GST on the bill (5 % by
 * default, inclusive or added on top), service and packing charge, and the add-on list. The shop can
 * change all of it whenever it likes; running orders are not touched.
 */
export function SetupDialog({ open, settings, onClose }: { open: boolean; settings: RestaurantSettings; onClose: () => void }) {
  const [tables, setTables] = useState('');
  const [gst, setGst] = useState('5');
  // v4.120.0: a shop without a GSTIN charges no GST (AU-12); old shops (no category profile): as before.
  const gstOk = gstAllowed();
  const [inclusive, setInclusive] = useState(true);
  const [service, setService] = useState('0');
  const [packing, setPacking] = useState('0');
  const [delivery, setDelivery] = useState('0');
  const [remoteKots, setRemoteKots] = useState(false);
  const [addOns, setAddOns] = useState<{ name: string; price: string }[]>([]);
  const [count, setCount] = useState('10');

  useEffect(() => {
    if (!open) return;
    setTables(settings.tables.join(', '));
    setCount(String(settings.tables.length));
    setGst(String(settings.gstRate));
    setInclusive(settings.gstInclusive);
    setService(String(settings.serviceChargePercent));
    setPacking(String(settings.packingChargePaise / 100));
    setDelivery(String(settings.deliveryChargePaise / 100));
    setRemoteKots(settings.printRemoteKots);
    setAddOns(settings.addOns.map((a) => ({ name: a.name, price: String(a.pricePaise / 100) })));
  }, [open, settings]);

  const save = () => {
    saveRestaurantSettings(sanitizeRestaurantSettings({
      tables: tables.split(/[,\n]/),
      gstRate: gstOk ? parseFloat(gst) : 0,
      gstInclusive: inclusive,
      serviceChargePercent: parseFloat(service) || 0,
      packingChargePaise: packing ? parseRupeesToPaise(packing) : 0,
      deliveryChargePaise: delivery ? parseRupeesToPaise(delivery) : 0,
      printRemoteKots: remoteKots,
      addOns: addOns.map((a) => ({ name: a.name, pricePaise: a.price ? parseRupeesToPaise(a.price) : 0 })),
    }));
    onClose();
  };

  const field = 'h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600';
  const label = 'text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5';

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('Restaurant set-up')} description={tr('Tables, GST, charges and add-ons. Running orders are not changed.')} size="lg">
      <div className="space-y-5" data-restaurant-setup-form>
        <section>
          <label className={label} htmlFor="rest-tables">{tr('Tables')}</label>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-slate-600">{tr('Quick: number of tables')}</span>
            <input value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" aria-label={tr('Number of tables')} className={cn(field, 'w-16 text-center font-mono')} />
            <Button type="button" variant="outline" size="sm" onClick={() => setTables(defaultTableNames(Math.min(MAX_TABLES, parseInt(count, 10) || 1)).join(', '))}>{tr('Make T1, T2…')}</Button>
          </div>
          <textarea id="rest-tables" value={tables} onChange={(e) => setTables(e.target.value)} rows={3}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600" />
          <p className="text-[11px] text-slate-500 mt-1">{tr('Separate the names with commas, e.g. T1, T2, Garden 1, Family room. Up to {max}.', { max: MAX_TABLES })}</p>
        </section>

        <section className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className={label}>{tr('GST on the bill')}</span>
            {!gstOk && <p className="text-[11px] text-amber-700 mb-1.5" data-rest-gst-needs-gstin>{tr('No GST without a GSTIN. Add your GSTIN in Settings → Store & GST Profile to charge GST.')}</p>}
            <div className={cn('flex flex-wrap items-center gap-1.5', !gstOk && 'opacity-50 pointer-events-none')}>
              {GST_CHOICES.map((g) => (
                <button key={g} type="button" onClick={() => setGst(String(g))} aria-pressed={parseFloat(gst) === g}
                  className={cn('h-10 px-3 rounded-xl border text-sm font-black cursor-pointer', parseFloat(gst) === g ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:border-emerald-500')}>{g}%</button>
              ))}
              <input value={gst} onChange={(e) => setGst(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label={tr('GST rate (%)')} className={cn(field, 'w-20 text-center font-mono')} />
            </div>
            <div className="mt-2 inline-flex rounded-xl border border-slate-300 overflow-hidden" role="group" aria-label={tr('How GST is shown')}>
              {([true, false] as const).map((v) => (
                <button key={String(v)} type="button" onClick={() => setInclusive(v)} aria-pressed={inclusive === v}
                  className={cn('h-9 px-3 text-xs font-bold cursor-pointer', inclusive === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-600')}>{v ? tr('Prices include GST') : tr('Add GST on top')}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label} htmlFor="rest-service">{tr('Service charge (%)')}</label>
              <input id="rest-service" value={service} onChange={(e) => setService(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={cn(field, 'w-full font-mono')} />
            </div>
            <div>
              <label className={label} htmlFor="rest-packing">{tr('Takeaway packing (₹)')}</label>
              <input id="rest-packing" value={packing} onChange={(e) => setPacking(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={cn(field, 'w-full font-mono')} />
            </div>
            <div>
              <label className={label} htmlFor="rest-delivery">{tr('Delivery charge (₹)')}</label>
              <input id="rest-delivery" value={delivery} onChange={(e) => setDelivery(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" className={cn(field, 'w-full font-mono')} data-rest-delivery-charge />
            </div>
            <p className="col-span-2 text-[11px] text-slate-500">{tr('Service and packing charges get the same GST. Ask your CA which rate applies to you.')}</p>
            {/* v4.143.0: a switch card like the app's other on / off settings (was a bare checkbox). */}
            <button
              type="button"
              role="switch"
              aria-checked={remoteKots}
              onClick={() => setRemoteKots((v) => !v)}
              data-rest-remote-kots={remoteKots ? 'on' : 'off'}
              className={cn(
                'col-span-2 flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition-colors',
                remoteKots ? 'border-emerald-500 bg-emerald-50/70' : 'border-slate-200 bg-white hover:border-slate-400'
              )}
            >
              <span className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', remoteKots ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500')}>
                <Printer className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-xs font-black text-slate-900">{tr("Print the waiters' KOTs on this PC")}</span>
                <span className="block text-[11px] font-semibold text-slate-500 leading-snug">{tr('For the PC with the kitchen printer. Needs cloud sync on.')}</span>
              </span>
              <span className={cn('relative w-10 h-6 rounded-full shrink-0 transition-colors', remoteKots ? 'bg-emerald-600' : 'bg-slate-300')}>
                <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', remoteKots ? 'left-[18px]' : 'left-0.5')} />
              </span>
            </button>
          </div>
        </section>

        <section>
          <span className={label}>{tr('Add-ons the waiter can pick')}</span>
          <div className="space-y-2">
            {addOns.map((a, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={a.name} onChange={(e) => setAddOns((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value.slice(0, 30) } : x)))} placeholder={tr('Add-on name')} aria-label={tr('Add-on name')} className={cn(field, 'flex-1 min-w-0')} />
                <input value={a.price} onChange={(e) => setAddOns((prev) => prev.map((x, j) => (j === i ? { ...x, price: e.target.value.replace(/[^\d.]/g, '') } : x)))} inputMode="decimal" placeholder="₹" aria-label={tr('Extra price (₹)')} className={cn(field, 'w-24 text-right font-mono')} />
                <button type="button" onClick={() => setAddOns((prev) => prev.filter((_, j) => j !== i))} className="w-10 h-10 rounded-xl border border-slate-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center cursor-pointer" aria-label={tr('Remove')}><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {addOns.length < MAX_ADDONS && (
              <Button type="button" variant="outline" size="sm" onClick={() => setAddOns((prev) => [...prev, { name: '', price: '' }])}><Plus className="w-4 h-4" /> {tr('Add an add-on')}</Button>
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="button" variant="success" onClick={save} data-setup-save>{tr('Save set-up')}</Button>
        </div>
      </div>
    </Modal>
  );
}
