'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { buildLabelHtml, LabelData } from '@/lib/labels/labelSheet';
import { LabelSettings, labelPageMm, labelsPerPage, stockFor } from '@/lib/labels/labelSettings';
import { qrImages } from '@/lib/labels/printLabels';
import { tr } from '@/lib/i18n/core';

const PX_PER_MM = 96 / 25.4;
/** labelSheet.ts preview CSS: body padding 3 mm each side, 2 mm under every page. */
const BODY_PAD_MM = 6;
const PAGE_GAP_MM = 2;

/**
 * The labels exactly as they will print — the same HTML the printer gets, in a
 * sandboxed frame, magnified to fit. Long runs show the first `max` labels.
 * The frame is as tall as the labels (v4.85.0), up to `maxHeight`, so a short run
 * is not a small label above a big grey box.
 */
export function LabelPreview({ labels, settings, shopName, max = 48, maxHeight = '62vh' }: { labels: LabelData[]; settings: LabelSettings; shopName: string; max?: number; maxHeight?: string }) {
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

  const page = labelPageMm(stock);
  const zoom = +Math.max(0.6, Math.min(3, 440 / (page.widthMm * PX_PER_MM))).toFixed(2);
  const pages = Math.max(1, Math.ceil(shown.length / labelsPerPage(stock)));
  const heightPx = Math.ceil((BODY_PAD_MM + pages * (page.heightMm + PAGE_GAP_MM)) * PX_PER_MM * zoom) + 8;

  const html = useMemo(() => buildLabelHtml(shown, stock, settings.content, {
    shopName,
    dateText: new Date().toLocaleDateString('en-IN'),
    previewZoom: zoom,
    qrDataUrls: qr,
    costCodeWord: settings.costCodeWord,
    barHeightMm: settings.barHeightMm,
    offsetMm: settings.offsetMm,
  }), [shown, stock, zoom, settings.content, settings.costCodeWord, settings.barHeightMm, settings.offsetMm, shopName, qr]);

  return (
    <div className="space-y-1.5">
      <iframe
        title={tr('Label preview')}
        srcDoc={html}
        sandbox=""
        style={{ height: `${heightPx}px`, maxHeight }}
        className="block w-full rounded-xl border border-slate-300 bg-slate-200"
        data-label-preview
      />
      {labels.length > max && (
        <p className="text-[11px] text-slate-500 text-center">{tr('Preview shows the first {shown} of {total} labels — all of them print.', { shown: max, total: labels.length })}</p>
      )}
    </div>
  );
}
