'use client';

import React from 'react';
import { Barcode } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { LabelSetupPanel } from '@/components/labels/LabelSetupPanel';
import { tr } from '@/lib/i18n/core';

/** Settings → Invoice & Bill Rules: the barcode-label printer, next to the bill printer. */
export function LabelPrinterCard() {
  const business = useBusiness();
  return (
    <Card className="p-4 sm:p-5 bg-white border border-slate-200/90 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <Barcode className="w-4 h-4 text-slate-700" />
        <div>
          <h3 className="text-sm font-black text-slate-900">{tr('Barcode label printer (this computer)')}</h3>
          <p className="text-[11px] text-slate-500">{tr('Any label size or A4 sticker sheet. Set once — Barcode Studio and every label print use it.')}</p>
        </div>
      </div>
      <LabelSetupPanel shopName={business?.name || ''} />
    </Card>
  );
}
