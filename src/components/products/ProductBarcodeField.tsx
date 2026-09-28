'use client';

import React, { useState } from 'react';
import { Barcode, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { barcodesInUse, nextStoreBarcodes } from '@/lib/barcode/storeBarcodes';
import { tr } from '@/lib/i18n/core';

/**
 * Add / Edit Product → barcode: type or scan it, or "Generate" the shop's own next code
 * (EAN-13 "200…", never used before — v4.78.0). Generate shows only while the box is
 * empty, so a maker's barcode is never replaced by mistake.
 */
export function ProductBarcodeField({ value, onChange, onOpenScanner }: { value: string; onChange: (v: string) => void; onOpenScanner: () => void }) {
  const [busy, setBusy] = useState(false);

  const generate = async () => {
    setBusy(true);
    try {
      const [code] = nextStoreBarcodes(await barcodesInUse(), 1);
      onChange(code);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1 gap-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          {tr('Barcode / EAN-13')}
        </label>
        <span className="flex items-center gap-2.5">
          {!value.trim() && (
            <button type="button" disabled={busy} onClick={() => void generate()} className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50" title={tr("The shop's own next barcode (200…) — it prints on the label and scans at the counter")} data-product-generate-barcode>
              <Sparkles className="w-3 h-3" />
              <span>{tr('Generate')}</span>
            </button>
          )}
          <button type="button" onClick={onOpenScanner} className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer">
            <Barcode className="w-3 h-3" />
            <span>{tr('Scan Camera')}</span>
          </button>
        </span>
      </div>
      <Input placeholder={tr('e.g. 8901030383748')} value={value} onChange={(e) => onChange(e.target.value)} data-product-barcode />
    </div>
  );
}
