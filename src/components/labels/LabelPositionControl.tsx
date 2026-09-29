'use client';

import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { MAX_OFFSET_MM } from '@/lib/labels/labelSettings';
import { tr } from '@/lib/i18n/core';

const STEP_MM = 0.5;

type Offset = { x: number; y: number };

/**
 * Print position (v4.80.0): moves the whole print in 0.5 mm steps when a label printer
 * starts a little high or to one side — works with any printer and driver.
 */
export function LabelPositionControl({ value, onChange }: { value: Offset; onChange: (next: Offset) => void }) {
  const clamp = (n: number) => Math.max(-MAX_OFFSET_MM, Math.min(MAX_OFFSET_MM, +n.toFixed(1)));
  const move = (dx: number, dy: number) => onChange({ x: clamp(value.x + dx), y: clamp(value.y + dy) });
  const btn = 'w-8 h-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 cursor-pointer';

  const parts: string[] = [];
  if (value.y) parts.push(value.y > 0 ? tr('{mm} mm down', { mm: value.y }) : tr('{mm} mm up', { mm: -value.y }));
  if (value.x) parts.push(value.x > 0 ? tr('{mm} mm right', { mm: value.x }) : tr('{mm} mm left', { mm: -value.x }));

  return (
    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5" data-label-position>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-slate-700">{tr('Print position')}</span>
        <button type="button" className={btn} onClick={() => move(0, -STEP_MM)} title={tr('Move up')} aria-label={tr('Move up')} data-label-move="up"><ArrowUp className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => move(0, STEP_MM)} title={tr('Move down')} aria-label={tr('Move down')} data-label-move="down"><ArrowDown className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => move(-STEP_MM, 0)} title={tr('Move left')} aria-label={tr('Move left')} data-label-move="left"><ArrowLeft className="w-3.5 h-3.5" /></button>
        <button type="button" className={btn} onClick={() => move(STEP_MM, 0)} title={tr('Move right')} aria-label={tr('Move right')} data-label-move="right"><ArrowRight className="w-3.5 h-3.5" /></button>
        <span className="font-mono font-bold text-slate-900" data-label-offset>{parts.length ? parts.join(', ') : tr('Not moved')}</span>
        {parts.length > 0 && (
          <button type="button" onClick={() => onChange({ x: 0, y: 0 })} className="text-sky-700 font-bold cursor-pointer">{tr('Reset')}</button>
        )}
      </div>
      <p className="text-slate-500">{tr('Print cut at the top? Move it down and test again. Cut at one side? Move it the other way.')}</p>
    </div>
  );
}
