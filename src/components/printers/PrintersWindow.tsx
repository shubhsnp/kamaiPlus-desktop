'use client';

import React, { useEffect, useState } from 'react';
import { Barcode, ChevronDown } from 'lucide-react';
import { Business } from '@/types';
import { BillPrinterSetup } from '@/components/billing/BillPrinterSetup';
import { LabelSetupPanel } from '@/components/labels/LabelSetupPanel';
import { readSilentPrint, saveSilentPrint, SILENT_PRINT_EVENT } from '@/lib/hardware/printerWatch';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/**
 * "Printers" (v4.78.0) — from the Home tile and the status bar: the bill printer (size,
 * printer, print straight away, test print) and, one click down, the barcode label printer.
 * Same settings on this computer as Billing and Settings; "print straight away" is the
 * counter's own switch (Billing picks the change up at once).
 */
export function PrintersWindow({ onClose, business, openLabel = false }: { onClose: () => void; business?: Business | null; openLabel?: boolean }) {
  const [autoPrint, setAutoPrint] = useState(readSilentPrint);
  const [labelOpen, setLabelOpen] = useState(openLabel);

  useEffect(() => {
    const on = () => setAutoPrint(readSilentPrint());
    window.addEventListener(SILENT_PRINT_EVENT, on);
    return () => window.removeEventListener(SILENT_PRINT_EVENT, on);
  }, []);

  // v4.186.0: no barcode labels in this shop (Barcode Studio off — a restaurant, kirana…) = no label printer here.
  const labelsOn = useFeatureSwitches().barcode_studio;

  return (
    <BillPrinterSetup title={tr('Printers')} onClose={onClose} business={business} autoPrint={autoPrint} onAutoPrintChange={saveSilentPrint}>
      {labelsOn && <div className="rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setLabelOpen((o) => !o)}
          className="w-full flex items-center gap-2 p-2.5 text-left cursor-pointer hover:bg-slate-50 rounded-xl"
          aria-expanded={labelOpen}
          data-home-label-printer
        >
          <Barcode className="w-4 h-4 text-slate-700 shrink-0" />
          <span className="min-w-0">
            <span className="block font-black text-slate-800">{tr('Barcode label printer')}</span>
            <span className="block text-slate-500">{tr('Label size, printer and what the label shows.')}</span>
          </span>
          <ChevronDown className={cn('w-4 h-4 ml-auto text-slate-500 transition-transform', labelOpen && 'rotate-180')} />
        </button>
        {labelOpen && (
          <div className="px-2.5 pb-2.5 pt-1 border-t border-slate-100">
            <LabelSetupPanel shopName={business?.name || ''} />
          </div>
        )}
      </div>}
    </BillPrinterSetup>
  );
}
