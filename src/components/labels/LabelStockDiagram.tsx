'use client';

import React from 'react';
import { LabelStock } from '@/lib/labels/labelSettings';
import { tr } from '@/lib/i18n/core';

const ROW_GAP_MM = 3;

/**
 * The chosen label stock drawn to scale (v4.80.0): the shop holds its roll or sheet next to it.
 * On the TSC TE244 a 38 × 25 mm 2-across roll set up as 50 × 25 mm printed on the gap.
 */
export function LabelStockDiagram({ stock }: { stock: LabelStock }) {
  const { widthMm: w, heightMm: h, across, gapMm } = stock;
  const sheet = stock.kind === 'sheet';
  const rows = sheet ? stock.rows || 1 : 2;
  const rowGap = sheet ? stock.rowGapMm || 0 : ROW_GAP_MM;
  const left = sheet ? stock.leftMm || 0 : 1.5;
  const top = sheet ? stock.topMm || 0 : 1.5;
  const boxW = sheet ? 210 : left * 2 + across * w + (across - 1) * gapMm;
  const boxH = sheet ? 297 : top + rows * h + (rows - 1) * rowGap + h * 0.4;

  const cells: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < across; c++) {
      const x = left + c * (w + gapMm);
      const y = top + r * (h + rowGap);
      cells.push(<rect key={`${r}-${c}`} x={x} y={y} width={w} height={h} rx={Math.min(w, h) * 0.08} fill="#fff" stroke="#64748b" strokeWidth={sheet ? 0.8 : 0.4} />);
      if (!sheet && r === 0) {
        cells.push(<text key={`t${c}`} x={x + w / 2} y={y + h / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.min(w / 4.5, h / 3)} fontWeight={800} fill="#334155">{`${w}×${h}`}</text>);
      }
    }
  }

  const text = sheet
    ? tr('A4 sticker sheet: {cols} × {rows} labels, each {w} × {h} mm.', { cols: across, rows, w, h })
    : across === 1
      ? tr('Your roll: one label across, {w} × {h} mm.', { w, h })
      : tr('Your roll: {n} labels side by side, each {w} × {h} mm.', { n: across, w, h });

  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200" data-label-stock-diagram>
      <svg viewBox={`0 0 ${boxW} ${boxH}`} className={sheet ? 'h-20 w-auto shrink-0' : 'w-32 h-auto shrink-0'} aria-hidden="true">
        <rect x={0} y={0} width={boxW} height={boxH} rx={sheet ? 2 : 1} fill={sheet ? '#fff' : '#e2e8f0'} stroke="#94a3b8" strokeWidth={sheet ? 1 : 0.3} />
        {cells}
      </svg>
      <div className="space-y-0.5">
        <p className="font-bold text-slate-800">{text}</p>
        <p className="text-slate-500">{tr('Check that your roll looks like this. With the wrong size, the print lands between two labels.')}</p>
      </div>
    </div>
  );
}
