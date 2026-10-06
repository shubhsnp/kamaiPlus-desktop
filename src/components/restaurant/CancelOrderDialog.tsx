'use client';

import React, { useEffect, useState } from 'react';
import { ChefHat, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { OwnerPinPrompt } from '@/components/privacy/OwnerPinPrompt';
import { hasOwnerPin } from '@/lib/auth/cashierPrivacy';
import { cn, formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { RestOrder, orderTotals, pieceCount, piecesInKitchen, piecesText } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { VOID_REASONS } from '@/lib/restaurant/voids';

/**
 * Cancel a whole table / takeaway order (v4.108.0). A reason is required; what the kitchen already has
 * gets a cancel slip; the order is written to Today's cancelled list. When the shop has an owner PIN,
 * cancelling food the kitchen already got needs that PIN — like a manager's void in any restaurant.
 */
export function CancelOrderDialog({ order, settings, open, busy, onClose, onConfirm }: {
  order: RestOrder;
  settings: RestaurantSettings;
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [other, setOther] = useState('');
  const [pinOpen, setPinOpen] = useState(false);
  useEffect(() => {
    if (open) {
      setReason('');
      setOther('');
    }
  }, [open]);

  const inKitchen = piecesInKitchen(order);
  const finalReason = reason === 'other' ? other.trim() : reason;
  const who = order.kind === 'table' ? `${tr('Table')} ${order.label}` : `${tr('Takeaway')} ${order.label}`;
  const needsPin = inKitchen > 0 && hasOwnerPin();

  const confirm = () => {
    if (!finalReason) return;
    if (needsPin) setPinOpen(true);
    else onConfirm(finalReason);
  };

  return (
    <>
      <Modal isOpen={open && !pinOpen} onClose={onClose} title={tr('Cancel order — {name}', { name: who })} description={`${piecesText(pieceCount(order))} · ${formatINR(orderTotals(order, settings).grandTotal)}`} size="md">
        <div className="space-y-4" data-cancel-order>
          {inKitchen > 0 ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900 flex items-start gap-2">
              <ChefHat className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{tr('The kitchen already has {count} pieces — a cancel slip will print for them.', { count: inKitchen })}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-600">{tr('Nothing was sent to the kitchen yet.')}</p>
          )}

          <div>
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500 block mb-1.5">{tr('Why is it cancelled?')}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={tr('Why is it cancelled?')}>
              {[...VOID_REASONS, 'other'].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={reason === r} onClick={() => setReason(r)} data-cancel-reason={r}
                  className={cn('h-9 px-3 rounded-lg border-2 text-xs font-bold cursor-pointer transition-colors',
                    reason === r ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400')}>
                  {r === 'other' ? tr('Something else') : tr(r)}
                </button>
              ))}
            </div>
            {reason === 'other' && (
              <input autoFocus value={other} onChange={(e) => setOther(e.target.value)} maxLength={80} placeholder={tr('Write the reason')} aria-label={tr('Write the reason')}
                className="mt-2 w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-semibold focus:outline-none focus:border-rose-500" data-cancel-other />
            )}
          </div>

          <p className="text-[11px] text-slate-500">{tr('It is kept in Today\'s cancelled orders on the Tables screen.')}{needsPin ? ` ${tr('Owner PIN needed.')}` : ''}</p>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tr('Keep the order')}</Button>
            <Button type="button" size="lg" onClick={confirm} isLoading={busy} disabled={!finalReason} className="bg-rose-600 hover:bg-rose-700 border-rose-600 text-white" data-cancel-confirm>
              <Trash2 className="w-4 h-4" /> {tr('Cancel order')}
            </Button>
          </div>
        </div>
      </Modal>
      <OwnerPinPrompt isOpen={pinOpen} onClose={() => setPinOpen(false)} onUnlocked={() => { setPinOpen(false); onConfirm(finalReason); }}
        title={tr('Owner PIN required')} description={tr('Food already went to the kitchen. Only the owner can cancel this order.')} submitLabel={tr('Cancel order')} />
    </>
  );
}
