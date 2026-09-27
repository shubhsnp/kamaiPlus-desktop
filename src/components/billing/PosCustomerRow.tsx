'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Phone, User, UserPlus, X } from 'lucide-react';
import { Customer } from '@/types';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { CustomerDraft, isDraftEmpty, resolveBillCustomer, splitDraft, suggestCustomers } from '@/lib/billing/billCustomer';

/** Puts the cursor in the (visible) customer name / mobile box — used instead of a pop-up. */
export function focusPosCustomerName(field: 'name' | 'phone' = 'name') {
  window.setTimeout(() => {
    const boxes = Array.from(document.querySelectorAll<HTMLInputElement>(`input[data-pos-customer-${field}]`));
    boxes.find((el) => el.offsetParent !== null)?.focus();
  }, 0);
}

interface PosCustomerRowProps {
  customers: Customer[];
  selectedCustomer?: Customer;
  draft: CustomerDraft;
  onDraftChange: (draft: CustomerDraft) => void;
  /** '' = back to walk-in (no customer). */
  onSelect: (customerId: string) => void;
}

/**
 * Customer on the POS counter — one row, no pop-up. Type a name or a mobile number:
 * saved customers show underneath (↑ ↓ Enter or click to pick). Anyone new is saved
 * with the bill when it is completed (lib/billing/billCustomer.ts). Empty = walk-in.
 */
export function PosCustomerRow({ customers, selectedCustomer, draft, onDraftChange, onSelect }: PosCustomerRowProps) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState<'name' | 'phone' | null>(null);
  const [highlight, setHighlight] = useState(-1);

  const { name: typedName, phone: typedPhone } = draft;
  const suggestions = useMemo(() => suggestCustomers(customers, { name: typedName, phone: typedPhone }), [customers, typedName, typedPhone]);
  const resolved = useMemo(() => resolveBillCustomer(customers, { name: typedName, phone: typedPhone }), [customers, typedName, typedPhone]);
  const exactId = resolved.kind === 'existing' ? resolved.customer.id : '';

  // An exact match (same mobile, or the only customer with that name) is pre-selected,
  // so Enter picks it; a partial match leaves Enter for moving on to the mobile box.
  useEffect(() => {
    setHighlight(exactId ? suggestions.findIndex((c) => c.id === exactId) : -1);
  }, [exactId, suggestions]);

  const pick = (id: string) => {
    onSelect(id);
    setOpen(false);
    setHighlight(-1);
  };

  const onKeyDown = (field: 'name' | 'phone') => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h <= 0 ? suggestions.length - 1 : h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && highlight >= 0 && suggestions[highlight]) {
        pick(suggestions[highlight].id);
      } else if (field === 'name') {
        (e.currentTarget.closest('[data-pos-customer-row]')?.querySelector('input[data-pos-customer-phone]') as HTMLInputElement | null)?.focus();
      } else {
        setOpen(false);
        e.currentTarget.blur();
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (selectedCustomer) {
    return (
      <div className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2 flex items-center justify-between gap-2 shadow-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 font-black text-xs flex items-center justify-center flex-shrink-0">
            {selectedCustomer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-900 truncate flex items-center gap-1.5">
              <span className="truncate">{selectedCustomer.name}</span>
              {selectedCustomer.current_balance > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold shrink-0">
                  {tr('Due:')} {formatINR(selectedCustomer.current_balance)}
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 font-mono">{selectedCustomer.phone || tr('No phone')}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { onSelect(''); focusPosCustomerName(); }}
          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-white rounded-full transition cursor-pointer"
          title={tr('Remove customer (walk-in bill)')}
          aria-label={tr('Remove customer (walk-in bill)')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const { phoneDigits } = splitDraft(draft);
  const inputClass = 'w-full bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 rounded-xl pl-8 pr-2 py-2 text-xs font-semibold focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 transition-all min-h-[38px]';

  return (
    <div
      data-pos-customer-row
      className="relative w-full"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOpen(false);
          setFocused(null);
        }
      }}
    >
      <div className="grid grid-cols-5 gap-1.5">
        <div className="relative col-span-3">
          <User className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            data-pos-customer-name
            type="text"
            value={draft.name}
            onFocus={() => { setFocused('name'); setOpen(true); }}
            onChange={(e) => { onDraftChange({ ...draft, name: e.target.value }); setOpen(true); }}
            onKeyDown={onKeyDown('name')}
            placeholder={tr('Customer name or search')}
            aria-label={tr('Customer name')}
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div className="relative col-span-2">
          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            data-pos-customer-phone
            type="tel"
            inputMode="numeric"
            maxLength={14}
            value={draft.phone}
            onFocus={() => { setFocused('phone'); setOpen(true); }}
            onChange={(e) => { onDraftChange({ ...draft, phone: e.target.value.replace(/[^\d+\s-]/g, '') }); setOpen(true); }}
            onKeyDown={onKeyDown('phone')}
            placeholder={tr('Mobile number')}
            aria-label={tr('Customer mobile number')}
            className={cn(inputClass, 'font-mono')}
            autoComplete="off"
          />
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((c, i) => (
            <div
              key={c.id}
              data-pos-customer-option
              onMouseDown={(e) => { e.preventDefault(); pick(c.id); }}
              onMouseEnter={() => setHighlight(i)}
              className={cn('p-2.5 cursor-pointer flex items-center justify-between gap-3 text-xs transition-colors', i === highlight ? 'bg-amber-50' : 'hover:bg-slate-50')}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-amber-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                    <span className="truncate">{c.name}</span>
                    {c.current_balance > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-extrabold font-mono shrink-0">
                        {tr('Due:')} {formatINR(c.current_balance)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{c.phone || tr('No phone')}</div>
                </div>
              </div>
              {i === highlight && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            </div>
          ))}
        </div>
      )}

      {!isDraftEmpty(draft) && (
        <div className="mt-1 text-[10.5px] font-bold flex items-center gap-1.5 min-h-[16px]">
          {resolved.kind === 'existing' && (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-emerald-800 truncate">{tr('Saved customer: {name}', { name: resolved.customer.name })}</span>
              <button type="button" onClick={() => pick(resolved.customer.id)} className="ml-auto text-sky-700 hover:underline cursor-pointer shrink-0">
                {tr('Select')}
              </button>
            </>
          )}
          {resolved.kind === 'new' && (
            <>
              <UserPlus className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span className="text-amber-800 truncate">{tr('New customer — saved when the bill is completed')}</span>
            </>
          )}
          {resolved.kind === 'error' && (focused !== 'phone' || phoneDigits.length >= 10) && (
            <span className="text-rose-700">{resolved.message}</span>
          )}
        </div>
      )}
    </div>
  );
}
