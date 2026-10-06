'use client';

import React from 'react';
import { ArrowRightLeft } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { tr } from '@/lib/i18n/core';

/**
 * Move a running order to another table (v4.107.0) — the guests changed tables. The whole order goes
 * with them (what the kitchen has, add-ons, open time); the next KOT shows the new table.
 */
export function MoveTableDialog({ from, freeTables, open, onClose, onMove }: {
  from: string;
  freeTables: string[];
  open: boolean;
  onClose: () => void;
  onMove: (to: string) => void;
}) {
  return (
    <Modal isOpen={open} onClose={onClose} title={tr('Move table {from} to…', { from })} description={tr('The whole order moves; the next KOT shows the new table.')} size="md">
      {freeTables.length === 0 ? (
        <p className="text-sm font-semibold text-slate-600 py-4 text-center" data-move-none>{tr('No table is free right now.')}</p>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))' }} data-move-table>
          {freeTables.map((t) => (
            <button key={t} type="button" onClick={() => onMove(t)} data-move-to={t}
              className="h-16 rounded-xl border-2 border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50 text-lg font-black text-slate-900 cursor-pointer transition-colors flex items-center justify-center gap-1.5">
              <ArrowRightLeft className="w-4 h-4 text-emerald-600" /> {t}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
