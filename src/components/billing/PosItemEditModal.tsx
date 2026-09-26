import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CartItem, Business, ProductUnit } from '@/types';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

export function getQuantityConfigForUnit(unit?: ProductUnit) {
  const normUnit = (unit || '').toLowerCase() || 'piece';

  if (normUnit === 'kg') {
    return {
      unitLabel: tr('Weight (Kilograms - kg)'),
      step: 'any',
      placeholder: tr('e.g. 0.05, 0.25, 0.5, 1'),
      decimalNotice: tr('Decimals supported (Grams / Kg)'),
      chips: [
        { label: '10g', val: '0.01' },
        { label: '25g', val: '0.025' },
        { label: '50g', val: '0.05' },
        { label: '100g', val: '0.1' },
        { label: '250g', val: '0.25' },
        { label: '500g', val: '0.5' },
        { label: tr('1 kg'), val: '1' },
        { label: tr('2 kg'), val: '2' },
        { label: tr('5 kg'), val: '5' },
      ],
    };
  }

  if (normUnit === 'gram') {
    return {
      unitLabel: tr('Weight (Grams - g)'),
      step: 'any',
      placeholder: tr('e.g. 10, 25, 50, 100, 250, 500'),
      decimalNotice: tr('Grams count'),
      chips: [
        { label: '10g', val: '10' },
        { label: '25g', val: '25' },
        { label: '50g', val: '50' },
        { label: '100g', val: '100' },
        { label: '250g', val: '250' },
        { label: '500g', val: '500' },
        { label: '1000g', val: '1000' },
      ],
    };
  }

  if (normUnit === 'litre') {
    return {
      unitLabel: tr('Volume (Litres - L)'),
      step: 'any',
      placeholder: tr('e.g. 0.25, 0.5, 1, 2'),
      decimalNotice: tr('Decimals supported (ml / Litres)'),
      chips: [
        { label: '100ml', val: '0.1' },
        { label: '250ml', val: '0.25' },
        { label: '500ml', val: '0.5' },
        { label: '1 L', val: '1' },
        { label: '2 L', val: '2' },
        { label: '5 L', val: '5' },
      ],
    };
  }

  if (normUnit === 'ml') {
    return {
      unitLabel: tr('Volume (Millilitres - ml)'),
      step: '1',
      placeholder: tr('e.g. 50, 100, 250, 500'),
      decimalNotice: tr('Millilitres count'),
      chips: [
        { label: tr('50 ml'), val: '50' },
        { label: tr('100 ml'), val: '100' },
        { label: tr('200 ml'), val: '200' },
        { label: tr('250 ml'), val: '250' },
        { label: tr('500 ml'), val: '500' },
        { label: tr('1000 ml'), val: '1000' },
      ],
    };
  }

  if (normUnit === 'strip') {
    return {
      unitLabel: tr('Quantity (Strips)'),
      step: 'any',
      placeholder: tr('e.g. 1, 2, 3 or 0.5 (half strip)'),
      decimalNotice: tr('Strip counts (0.5 for loose/half strip)'),
      chips: [
        { label: tr('1 Strip'), val: '1' },
        { label: tr('2 Strips'), val: '2' },
        { label: tr('3 Strips'), val: '3' },
        { label: tr('4 Strips'), val: '4' },
        { label: tr('5 Strips'), val: '5' },
        { label: tr('10 Strips'), val: '10' },
        { label: tr('½ Strip (Loose)'), val: '0.5' },
      ],
    };
  }

  if (normUnit === 'dozen') {
    return {
      unitLabel: tr('Quantity (Dozen)'),
      step: 'any',
      placeholder: tr('e.g. 0.5, 1, 1.5, 2'),
      decimalNotice: tr('Dozen count (0.5 = 6 pcs)'),
      chips: [
        { label: tr('½ Dozen (6)'), val: '0.5' },
        { label: tr('1 Dozen (12)'), val: '1' },
        { label: tr('1.5 Dozen (18)'), val: '1.5' },
        { label: tr('2 Dozen (24)'), val: '2' },
        { label: tr('3 Dozen (36)'), val: '3' },
        { label: tr('5 Dozen (60)'), val: '5' },
      ],
    };
  }

  if (normUnit === 'meter' || normUnit === 'foot' || normUnit === 'sqft') {
    return {
      unitLabel: tr('Length / Area ({v1})', { v1: normUnit.toUpperCase() }),
      step: 'any',
      placeholder: tr('e.g. 0.5, 1, 2.5, 5'),
      decimalNotice: tr('Decimals supported'),
      chips: [
        { label: '0.5', val: '0.5' },
        { label: '1', val: '1' },
        { label: '2', val: '2' },
        { label: '2.5', val: '2.5' },
        { label: '3', val: '3' },
        { label: '5', val: '5' },
        { label: '10', val: '10' },
      ],
    };
  }

  if (normUnit === 'plate' || normUnit === 'portion') {
    return {
      unitLabel: normUnit === 'plate' ? tr('Order Quantity (Plates)') : tr('Order Quantity (Portions)'),
      step: 'any',
      placeholder: tr('e.g. 0.5 (half), 1 (full), 2'),
      decimalNotice: tr('Plates / Portions (0.5 for Half)'),
      chips: [
        { label: tr('½ (Half)'), val: '0.5' },
        { label: tr('1 (Full)'), val: '1' },
        { label: '2', val: '2' },
        { label: '3', val: '3' },
        { label: '4', val: '4' },
        { label: '5', val: '5' },
      ],
    };
  }

  return {
    unitLabel: tr('Quantity ({v1})', { v1: normUnit.charAt(0).toUpperCase() + normUnit.slice(1) }),
    step: '1',
    placeholder: tr('e.g. 1, 2, 3, 5'),
    decimalNotice: tr('Whole count / Units'),
    chips: [
      { label: '1', val: '1' },
      { label: '2', val: '2' },
      { label: '3', val: '3' },
      { label: '4', val: '4' },
      { label: '5', val: '5' },
      { label: '6', val: '6' },
      { label: '10', val: '10' },
      { label: '12', val: '12' },
      { label: '24', val: '24' },
    ],
  };
}

export interface PosItemEditModalProps {
  editingCartItem: CartItem | null;
  setEditingCartItem: (item: CartItem | null) => void;
  business: Business | null | undefined;
  editItemQty: string;
  setEditItemQty: (val: string) => void;
  editItemPrice: string;
  setEditItemPrice: (val: string) => void;
  editItemDiscountType: "flat" | "percentage";
  setEditItemDiscountType: (type: "flat" | "percentage") => void;
  editItemDiscount: string;
  setEditItemDiscount: (val: string) => void;
  handleSaveEditItem: () => void;
}

export const PosItemEditModal: React.FC<PosItemEditModalProps> = ({
  editingCartItem,
  setEditingCartItem,
  business,
  editItemQty,
  setEditItemQty,
  editItemPrice,
  setEditItemPrice,
  editItemDiscountType,
  setEditItemDiscountType,
  editItemDiscount,
  setEditItemDiscount,
  handleSaveEditItem
}) => {
  if (!editingCartItem) return null;

  const qtyConfig = getQuantityConfigForUnit(editingCartItem.unit);

  return (
    <Modal
      isOpen={Boolean(editingCartItem)}
      onClose={() => setEditingCartItem(null)}
      title={tr('Edit Item: {v1}', { v1: editingCartItem.product_name || '' })}
      size="sm"
    >
      <div className="space-y-3 p-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <span>{qtyConfig.unitLabel}</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-black uppercase">
                {editingCartItem.unit || tr('Unit')}
              </span>
            </label>
            <span className="text-[10px] text-slate-500 font-semibold">{qtyConfig.decimalNotice}</span>
          </div>
          <Input
            type="number"
            step={qtyConfig.step}
            placeholder={qtyConfig.placeholder}
            value={editItemQty}
            onChange={(e) => setEditItemQty(e.target.value)}
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {qtyConfig.chips.map((chip) => (
              <button
                key={chip.val}
                type="button"
                onClick={() => setEditItemQty(chip.val)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  editItemQty === chip.val
                    ? 'bg-amber-400 text-slate-950 font-black shadow-xs ring-1 ring-amber-500'
                    : 'bg-slate-100 hover:bg-amber-100 hover:text-amber-950 border border-slate-200 text-slate-700'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Unit Price (₹)')}</label>
          <Input
            type="number"
            step="0.01"
            value={editItemPrice}
            onChange={(e) => setEditItemPrice(e.target.value)}
          />
        </div>

        <div className="space-y-1.5 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">{tr('Line Item Discount')}</label>
            <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg">
              <button
                type="button"
                onClick={() => setEditItemDiscountType('flat')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer',
                  editItemDiscountType === 'flat'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {tr('₹ Flat')}
              </button>
              <button
                type="button"
                onClick={() => setEditItemDiscountType('percentage')}
                className={cn(
                  'px-2 py-0.5 rounded text-[10.5px] font-bold transition-all cursor-pointer',
                  editItemDiscountType === 'percentage'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {tr('% Percent')}
              </button>
            </div>
          </div>

          <div className="relative">
            <Input
              type="number"
              step={editItemDiscountType === 'percentage' ? '1' : '0.01'}
              min="0"
              max={editItemDiscountType === 'percentage' ? 100 : undefined}
              placeholder={editItemDiscountType === 'percentage' ? tr('e.g. 10 for 10%') : '0.00'}
              value={editItemDiscount}
              onChange={(e) => setEditItemDiscount(e.target.value)}
              leftIcon={<span className="text-xs font-bold text-slate-500">{editItemDiscountType === 'percentage' ? '%' : '₹'}</span>}
            />
          </div>

          {editItemDiscountType === 'percentage' && (
            <div className="flex items-center gap-1.5 pt-1">
              {['5', '10', '15', '20', '50'].map((chipPct) => (
                <button
                  key={chipPct}
                  type="button"
                  onClick={() => setEditItemDiscount(chipPct)}
                  className={cn(
                    'px-2 py-0.5 rounded text-[10.5px] font-bold transition-all border cursor-pointer',
                    editItemDiscount === chipPct
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  )}
                >
                  {chipPct}%
                </button>
              ))}
            </div>
          )}

          {(() => {
            const qty = parseFloat(editItemQty) || 0;
            const unitPrice = parseFloat(editItemPrice) || 0;
            const val = parseFloat(editItemDiscount) || 0;
            if (val > 0 && qty > 0 && unitPrice > 0) {
              const discountRupees = editItemDiscountType === 'percentage'
                ? ((qty * unitPrice) * Math.min(100, val)) / 100
                : Math.min(qty * unitPrice, val);
              const netRupees = Math.max(0, qty * unitPrice - discountRupees);
              return (
                <div className="flex items-center justify-between text-[11px] font-bold text-emerald-800 pt-1">
                  <span>{tr('Savings: -₹')}{discountRupees.toFixed(2)}</span>
                  <span>{tr('Net Total: ₹')}{netRupees.toFixed(2)}</span>
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setEditingCartItem(null)}>
            {tr('Cancel')}
          </Button>
          <Button size="sm" onClick={handleSaveEditItem} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
            {tr('Update Line Item')}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
