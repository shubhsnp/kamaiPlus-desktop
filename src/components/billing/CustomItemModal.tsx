'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { db } from '@/lib/db';
import { tr } from '@/lib/i18n/core';
import { formatINR } from '@/lib/utils';
import type { Category, Product } from '@/types';
import {
  buildCustomItem,
  customItemPricePaise,
  CUSTOM_ITEM_NAME_MAX,
  CUSTOM_ITEM_PRESETS,
} from '@/lib/billing/customItem';

/**
 * "Custom Item" on the counter (v4.159.0, same as the phone): a line that is not in the item
 * list — carry bag, delivery charge, a loose item. Name + price + quantity; "Save to my items"
 * keeps it for next time, otherwise it lives only on this bill.
 */
export function CustomItemModal({
  isOpen,
  onClose,
  businessId,
  categories,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  categories: Category[];
  onAdd: (product: Product, quantity: number) => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [save, setSave] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setPrice('');
    setQty('1');
    setSave(false);
    setError('');
  }, [isOpen]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    const pricePaise = customItemPricePaise(price);
    const quantity = Number(qty);
    if (!cleanName) return setError(tr('Enter the item name.'));
    if (pricePaise <= 0) return setError(tr('Enter a price in rupees, e.g. 20 or 12.50.'));
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 9999) return setError(tr('Enter a quantity, e.g. 1 or 2.'));
    const product = buildCustomItem({ name: cleanName, pricePaise, businessId, categories, save });
    if (save) await db.products.put(product);
    onAdd(product, Math.round(quantity * 1000) / 1000);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tr('Custom Item')} size="md">
      <form onSubmit={submit} className="space-y-3 p-1" data-custom-item-form>
        <div className="flex flex-wrap gap-1.5">
          {CUSTOM_ITEM_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => { setName(tr(p.name)); setPrice(String(p.pricePaise / 100)); setError(''); }}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              {tr(p.name)} · {formatINR(p.pricePaise)}
            </button>
          ))}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Item name *')}</label>
          <Input
            value={name}
            maxLength={CUSTOM_ITEM_NAME_MAX}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder={tr('e.g. Carry Bag')}
            autoFocus
            data-custom-item-name
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Price (₹) *')}</label>
            <Input
              inputMode="decimal"
              value={price}
              maxLength={10}
              onChange={(e) => { setPrice(e.target.value.replace(/[^\d.]/g, '')); setError(''); }}
              placeholder={tr('e.g. 20')}
              data-custom-item-price
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Quantity')}</label>
            <Input
              inputMode="decimal"
              value={qty}
              maxLength={7}
              onChange={(e) => { setQty(e.target.value.replace(/[^\d.]/g, '')); setError(''); }}
              data-custom-item-qty
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={save} onChange={(e) => setSave(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          {tr('Save to my items for next time')}
        </label>

        {error && <p className="text-xs font-semibold text-rose-600" role="alert">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button size="sm" type="submit" className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
            {tr('Add to Bill')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
