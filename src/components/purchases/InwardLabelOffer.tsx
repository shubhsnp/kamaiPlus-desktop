'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Barcode, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LabelHandoffItem, saveLabelHandoff } from '@/lib/labels/labelSettings';
import { tr } from '@/lib/i18n/core';

export interface InwardLabels {
  name: string;
  items: LabelHandoffItem[];
}

/** After a manual inward: "Print N labels" opens Barcode Studio with them (one per piece). */
export function InwardLabelOffer({ offer, onDismiss }: { offer: InwardLabels; onDismiss: () => void }) {
  const router = useRouter();
  const count = offer.items.reduce((n, i) => n + i.copies, 0);
  const print = () => {
    saveLabelHandoff(offer.items);
    onDismiss();
    router.push('/barcode-generator?from=inward');
  };
  return (
    <div className="p-3 rounded-xl border border-slate-300 bg-white flex items-center justify-between gap-2 text-xs shadow-sm" data-inward-label-offer>
      <span className="font-bold text-slate-800 truncate">{tr('Labels for {name}?', { name: offer.name })}</span>
      <span className="flex items-center gap-1.5 shrink-0">
        <Button size="sm" onClick={print} className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs gap-1">
          <Barcode className="w-3.5 h-3.5 text-amber-400" />
          {tr('Print {count} labels', { count })}
        </Button>
        <button type="button" onClick={onDismiss} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label={tr('Close')}>
          <X className="w-4 h-4" />
        </button>
      </span>
    </div>
  );
}
