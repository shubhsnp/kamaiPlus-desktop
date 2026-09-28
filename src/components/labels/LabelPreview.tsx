'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildLabelHtml, LabelData } from '@/lib/labels/labelSheet';
import { LabelSettings, labelPageMm, stockFor } from '@/lib/labels/labelSettings';
import { qrImages } from '@/lib/labels/printLabels';
import { tr } from '@/lib/i18n/core';

const PX_PER_MM = 96 / 25.4;

/**
 * The labels exactly as they will print — the same HTML the printer gets, in a
 * sandboxed frame, magnified to fit. Long runs show the first `max` labels.
 */
export function LabelPreview({ labels, settings, shopName, max = 48 }: { labels: LabelData[]; settings: LabelSettings; shopName: string; max?: number }) {
  const stock = stockFor(settings);
  const shown = useMemo(() => labels.slice(0, max), [labels, max]);
  const [qr, setQr] = useState<Record<string, string> | undefined>(undefined);

  useEffect(() => {
    let live = true;
    if (!settings.content.qr) {
      setQr(undefined);
      return;
    }
    qrImages(shown.map((l) => l.barcode)).then((m) => live && setQr(m)).catch(() => {});
    return () => {
      live = false;
    };
  }, [settings.content.qr, shown]);

  const html = useMemo(() => {
    const pageWidthPx = labelPageMm(stock).widthMm * PX_PER_MM;
    const zoom = Math.max(0.6, Math.min(3, 440 / pageWidthPx));
    return buildLabelHtml(shown, stock, settings.content, {
      shopName,
      dateText: new Date().toLocaleDateString('en-IN'),
      previewZoom: +zoom.toFixed(2),
      qrDataUrls: qr,
      costCodeWord: settings.costCodeWord,
    });
  }, [shown, stock, settings.content, settings.costCodeWord, shopName, qr]);

  return (
    <div className="space-y-1.5">
      <iframe title={tr('Label preview')} srcDoc={html} sandbox="" className="w-full h-[62vh] rounded-xl border border-slate-300 bg-slate-200" data-label-preview />
      {labels.length > max && (
        <p className="text-[11px] text-slate-500 text-center">{tr('Preview shows the first {shown} of {total} labels — all of them print.', { shown: max, total: labels.length })}</p>
      )}
    </div>
  );
}
