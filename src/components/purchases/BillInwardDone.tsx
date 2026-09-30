'use client';

import React from 'react';
import { Barcode, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { BillInwardResult } from '@/lib/purchases/billInwardDb';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

/**
 * After a supplier's bill is saved: what happened, and its labels (one per piece) — no label
 * offer with Settings → Features → Barcode Studio & Labels off.
 */
export function BillInwardDone({ result, onClose, onPrintLabels }: { result: BillInwardResult; onClose: () => void; onPrintLabels: () => void }) {
  const labelsOn = useFeatureSwitches().barcode_studio;
  const labels = labelsOn ? result.labels.reduce((n, l) => n + l.copies, 0) : 0;
  return (
    <div className="space-y-4 text-xs" data-inward-done>
      <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="space-y-1 text-emerald-900">
          <p className="text-sm font-black">{tr('Bill inward complete')}</p>
          <p className="font-semibold">{tr('{updated} items restocked, {created} new products created.', { updated: result.restocked, created: result.created })}</p>
          {result.startedCounting > 0 && (
            <p>{tr('{count} items were not counted before — their stock is counted from now on.', { count: result.startedCounting })}</p>
          )}
          {labels > 0 && <p>{tr('Every item has its own barcode. Print the labels and stick them on the goods — they scan at the counter.')}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Close')}</Button>
        {labels > 0 && (
          <Button type="button" size="sm" onClick={onPrintLabels} className="bg-slate-900 hover:bg-slate-950 text-white font-bold gap-1.5" data-inward-print-labels>
            <Barcode className="w-4 h-4 text-amber-400" />
            {tr('Print {count} labels', { count: labels })}
          </Button>
        )}
      </div>
    </div>
  );
}
