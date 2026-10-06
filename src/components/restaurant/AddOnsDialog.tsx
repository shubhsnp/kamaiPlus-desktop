'use client';

import React, { useEffect, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { cn, formatINR, parseRupeesToPaise } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { RestAddOn } from '@/lib/restaurant/settings';

/**
 * Add-ons and a note for ONE piece of a dish (v4.106.0): pick from the shop's add-on list, type a
 * one-off ("Extra cheese ₹20"), and write a note for the cook ("less spicy"). Works before and after
 * the KOT — after it, the kitchen gets "cancel the plain one, add this one".
 */
export function AddOnsDialog({ title, library, onClose, onApply }: {
  /** The dish, shown as the window title; null = closed. */
  title: string | null;
  library: RestAddOn[];
  onClose: () => void;
  onApply: (addOns: RestAddOn[], note: string) => void;
}) {
  const [picked, setPicked] = useState<RestAddOn[]>([]);
  const [custom, setCustom] = useState<RestAddOn[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (title !== null) {
      setPicked([]);
      setCustom([]);
      setName('');
      setPrice('');
      setNote('');
    }
  }, [title]);

  const isPicked = (a: RestAddOn) => picked.some((p) => p.name === a.name);
  const toggle = (a: RestAddOn) => setPicked((prev) => (isPicked(a) ? prev.filter((p) => p.name !== a.name) : [...prev, a]));
  const addCustom = () => {
    const n = name.trim();
    if (!n) return;
    const a = { name: n.slice(0, 30), pricePaise: price ? parseRupeesToPaise(price) : 0 };
    setCustom((prev) => (prev.some((c) => c.name.toLowerCase() === a.name.toLowerCase()) ? prev : [...prev, a]));
    setPicked((prev) => (prev.some((c) => c.name.toLowerCase() === a.name.toLowerCase()) ? prev : [...prev, a]));
    setName('');
    setPrice('');
  };
  const all = [...library, ...custom.filter((c) => !library.some((l) => l.name.toLowerCase() === c.name.toLowerCase()))];
  const extra = picked.reduce((n, a) => n + a.pricePaise, 0);

  return (
    <Modal isOpen={title !== null} onClose={onClose} title={title || ''} description={tr('Add-ons and note for one piece')} size="md">
      <div className="space-y-4" data-restaurant-addons>
        {all.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {all.map((a) => (
              <button
                key={a.name}
                type="button"
                onClick={() => toggle(a)}
                aria-pressed={isPicked(a)}
                className={cn(
                  'h-10 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors',
                  isPicked(a) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-800 border-slate-300 hover:border-emerald-500'
                )}
              >
                {isPicked(a) && <Check className="w-3.5 h-3.5" />}
                {a.name}
                {a.pricePaise > 0 && <span className={cn('font-mono', isPicked(a) ? 'text-emerald-100' : 'text-emerald-700')}>+{formatINR(a.pricePaise)}</span>}
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5" htmlFor="rest-addon-name">{tr('Something else')}</label>
          <div className="flex gap-2">
            <input
              id="rest-addon-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder={tr('e.g. Extra paneer')}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600"
            />
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              inputMode="decimal"
              placeholder="₹"
              aria-label={tr('Extra price (₹)')}
              className="w-20 h-10 px-3 rounded-xl border border-slate-300 text-sm font-mono font-semibold text-right focus:outline-none focus:border-emerald-600"
            />
            <Button type="button" variant="outline" onClick={addCustom} disabled={!name.trim()} aria-label={tr('Add')}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5" htmlFor="rest-addon-note">{tr('Note for the kitchen')}</label>
          <input
            id="rest-addon-note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 80))}
            placeholder={tr('e.g. less spicy, no onion')}
            className="w-full h-10 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
          <span className="text-xs font-bold text-slate-600">{extra > 0 ? tr('Adds {amount} to this piece', { amount: formatINR(extra) }) : tr('No extra charge')}</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>{tr('Cancel')}</Button>
            <Button type="button" variant="success" disabled={picked.length === 0 && !note.trim()} onClick={() => onApply(picked, note)} data-addons-apply>{tr('Apply')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
