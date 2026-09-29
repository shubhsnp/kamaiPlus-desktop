'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { billPrinterMismatch } from '@/lib/hardware/printerDetect';
import { usePrinterFacts } from '@/lib/hardware/printerWatch';
import { tr } from '@/lib/i18n/core';

/**
 * Under a bill printer choice (v4.80.0): says so when it is a barcode label printer (bills would
 * print on the labels) or a receipt printer for A4 bills. Nothing is changed on its own.
 */
export function BillPrinterWarning({ name, format }: { name: string; format: PaperFormat }) {
  const facts = usePrinterFacts();
  if (!name) return null;
  const mismatch = billPrinterMismatch(facts?.find((p) => p.name === name) || { name }, format);
  if (!mismatch) return null;
  return (
    <span className="mt-1.5 flex items-start gap-1.5 p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 font-bold" role="alert" data-bill-printer-warning={mismatch}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
      <span>
        {mismatch === 'label'
          ? tr('{name} is a barcode label printer. Bills would print on your labels — choose your receipt or A4 printer.', { name })
          : tr('{name} is a receipt printer. For A4 bills choose an A4 printer, or change the bill size to 80 mm / 58 mm.', { name })}
      </span>
    </span>
  );
}
