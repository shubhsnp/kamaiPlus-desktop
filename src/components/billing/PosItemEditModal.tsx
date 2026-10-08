import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CartItem, Business } from '@/types';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { dozenFromPieces, formatCartQty, lineAmountPaise, piecesInDozen, roundQty } from '@/lib/billing/unitQuantity';
import { getQuantityConfigForUnit } from './posQuantityConfig';

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
  // Dozen items: pieces typed here become twelfths of a dozen (7 pcs = 7/12 dozen).
  const [pieces, setPieces] = useState('');
  // Strip items (Pharmacy): loose tablets typed here convert to fractional strips (e.g. 3 tabs of 10 = 0.3 strip).
  const [tablets, setTablets] = useState('');
  useEffect(() => { setPieces(''); setTablets(''); }, [editingCartItem]);

  if (!editingCartItem) return null;

  const qtyConfig = getQuantityConfigForUnit(editingCartItem.unit);
  const isDozen = (editingCartItem.unit || '').toLowerCase() === 'dozen';
  const isStrip = (editingCartItem.unit || '').toLowerCase() === 'strip';
  const qtyNow = parseFloat(editItemQty) || 0;
  const ratePaise = Math.round((parseFloat(editItemPrice) || 0) * 100);

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
            onChange={(e) => { setEditItemQty(e.target.value); setPieces(''); setTablets(''); }}
            autoFocus
            data-edit-qty
          />
          {isDozen && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-bold text-slate-700">{tr('Or pieces:')}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={pieces}
                onChange={(e) => {
                  setPieces(e.target.value);
                  const n = Math.round(Number(e.target.value));
                  if (n > 0) setEditItemQty(String(dozenFromPieces(n)));
                }}
                placeholder={tr('e.g. 7')}
                className="w-20 h-8 px-2 rounded-lg border border-slate-300 font-mono font-bold"
                data-edit-pieces
              />
              {qtyNow > 0 && <span className="text-slate-500 font-semibold">= {tr('{count} pcs', { count: piecesInDozen(qtyNow) })}</span>}
            </div>
          )}
          {isStrip && (
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="font-bold text-slate-700">{tr('Or pieces:')}</span>
              <input
                type="number"
                min="1"
                step="1"
                value={tablets}
                onChange={(e) => {
                  setTablets(e.target.value);
                  const n = Math.round(Number(e.target.value));
                  if (n > 0) setEditItemQty(String(roundQty(n / 10)));
                }}
                placeholder={tr('e.g. 7')}
                className="w-20 h-8 px-2 rounded-lg border border-slate-300 font-mono font-bold"
                data-edit-tablets
              />
              {qtyNow > 0 && <span className="text-slate-500 font-semibold">= {tr('{count} pcs', { count: Math.round(qtyNow * 10) })}</span>}
            </div>
          )}
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
            data-edit-price
          />
          {/* The amount follows the quantity: ½ box at ₹400 a box = ₹200. */}
          {qtyNow > 0 && ratePaise > 0 && (
            <div className="mt-1.5 flex items-center justify-between text-[11px] font-bold text-slate-700" data-edit-amount>
              <span>{formatCartQty(qtyNow)} {editingCartItem.unit || ''} × {formatINR(ratePaise)}</span>
              <span className="text-slate-900">{tr('Amount')}: {formatINR(lineAmountPaise(qtyNow, ratePaise))}</span>
            </div>
          )}
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
