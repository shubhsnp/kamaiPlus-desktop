'use client';

import React, { useEffect, useState } from 'react';
import { Frame, Printer, RefreshCw, Ruler } from 'lucide-react';
import { DesktopPrinter, getDesktopApi } from '@/lib/desktop/desktopBridge';
import {
  BAR_HEIGHTS_MM, CUSTOM_LIMITS, CUSTOM_STOCK_ID, getLabelSettings, LABEL_SETTINGS_EVENT, LABEL_STOCKS, LabelContent, LabelSettings, MAX_SETUP_COPIES, saveLabelSettings, stockFor,
} from '@/lib/labels/labelSettings';
import { printAlignmentTest, printLabels } from '@/lib/labels/printLabels';
import { encodeCostCode, isValidCostCodeWord } from '@/lib/labels/labelExtras';
import { LabelPositionControl } from './LabelPositionControl';
import { LabelStockDiagram } from './LabelStockDiagram';
import { msg, tr } from '@/lib/i18n/core';

const CONTENT: { key: keyof LabelContent; label: string }[] = [
  { key: 'shopName', label: msg('Shop name') },
  { key: 'itemName', label: msg('Item name') },
  { key: 'price', label: msg('Price') },
  { key: 'mrp', label: msg('MRP (when higher)') },
  { key: 'code', label: msg('Barcode digits') },
  { key: 'date', label: msg('Printing date') },
  { key: 'qr', label: msg('QR code instead of bars') },
  { key: 'detail', label: msg('Size / colour') },
  { key: 'costCode', label: msg('Cost code (secret)') },
];

const field = 'w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-slate-50';

/**
 * Label printer setup for this computer — size (any roll or A4 sheet, or a custom
 * size), printer, print-without-dialog, what the label shows, and a test print.
 * Saved at once; Barcode Studio, the 1-click label and Settings share it.
 */
export function LabelSetupPanel({ shopName }: { shopName: string }) {
  const [s, setS] = useState<LabelSettings>(getLabelSettings);
  const [printers, setPrinters] = useState<DesktopPrinter[]>([]);
  const [loading, setLoading] = useState(false);
  const [testNote, setTestNote] = useState('');
  // What is typed in the custom size boxes. Saved only once it is a usable size: saving "3"
  // on the way to "38" came back as the default 50 and the box could not be typed (v4.85.0).
  const [customDraft, setCustomDraft] = useState<Partial<Record<keyof LabelSettings['custom'], string>>>({});
  const desktop = getDesktopApi();

  const loadPrinters = async () => {
    if (!desktop) return;
    setLoading(true);
    try {
      setPrinters(await desktop.getPrinters());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPrinters();
    const refresh = () => setS(getLabelSettings());
    window.addEventListener(LABEL_SETTINGS_EVENT, refresh);
    return () => window.removeEventListener(LABEL_SETTINGS_EVENT, refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (patch: Partial<LabelSettings>) => {
    const next = { ...s, ...patch };
    setS(next);
    saveLabelSettings(next);
  };
  const customOk = (key: keyof LabelSettings['custom'], v: string) => {
    const n = Number(v);
    const [min, max] = CUSTOM_LIMITS[key];
    return v.trim() !== '' && Number.isFinite(n) && n >= min && n <= max && (key !== 'across' || Number.isInteger(n));
  };
  const setCustom = (key: keyof LabelSettings['custom'], v: string) => {
    setCustomDraft((d) => ({ ...d, [key]: v }));
    if (customOk(key, v)) update({ custom: { ...s.custom, [key]: Number(v) } });
  };
  const endCustom = (key: keyof LabelSettings['custom']) => setCustomDraft((d) => {
    const next = { ...d };
    delete next[key];
    return next;
  });

  const testPrint = async () => {
    setTestNote(tr('Printing a test label…'));
    const res = await printLabels([{ name: tr('Test label — अनार स्पेशल'), barcode: 'TEST-1234', pricePaise: 59000, mrpPaise: 65000, costPaise: 45000, detail: 'M / Red' }], s, shopName);
    setTestNote(res.ok ? tr('Test label sent. Check the size, the text and that the barcode scans.') : tr('Could not print: {error}', { error: res.error || '' }));
  };

  // New roll → the printer learns where each label starts (v4.80.0). Unknown make: the FEED button.
  const calibrate = async () => {
    if (!desktop?.calibrateLabelPrinter || !s.printer) return;
    setTestNote(tr('Sending the calibration…'));
    const res = await desktop.calibrateLabelPrinter(s.printer);
    const byHand = tr('Calibrate it by hand: switch the printer off, hold the FEED button, switch it on and let go when the light blinks (see its manual). It feeds a few labels and learns the gap.');
    if (res.ok) setTestNote(tr('The printer is measuring the labels (it feeds 2–3 blank ones). Then press "Check size & position".'));
    else if (res.manual) setTestNote(byHand);
    else setTestNote(`${tr('Could not send the calibration: {error}', { error: res.error || '' })} ${byHand}`);
  };

  const alignmentTest = async () => {
    setTestNote(tr('Printing a frame on each label…'));
    const res = await printAlignmentTest(s);
    setTestNote(res.ok
      ? tr('Frames sent. Each frame should sit whole inside its label. Cut at a side: use Print position. On the gap between labels: choose another label size.')
      : tr('Could not print: {error}', { error: res.error || '' }));
  };

  return (
    <div className="space-y-3 text-xs">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="font-bold text-slate-700">{tr('Label size')}</span>
          <select value={s.stockId} onChange={(e) => update({ stockId: e.target.value })} className={`${field} mt-1`} data-label-stock>
            {LABEL_STOCKS.map((st) => <option key={st.id} value={st.id}>{tr(st.label)}</option>)}
            <option value={CUSTOM_STOCK_ID}>{tr('Custom roll size…')}</option>
          </select>
        </label>
        <label className="block">
          <span className="font-bold text-slate-700 flex items-center justify-between">
            {tr('Label printer')}
            {desktop && (
              <button type="button" onClick={loadPrinters} className="text-sky-700 font-bold inline-flex items-center gap-1 cursor-pointer" title={tr('Refresh printer list')}>
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {tr('Refresh')}
              </button>
            )}
          </span>
          <select value={s.printer} onChange={(e) => update({ printer: e.target.value })} disabled={!desktop} className={`${field} mt-1`} data-label-printer>
            <option value="">{tr('Ask every time (print dialog)')}</option>
            {printers.map((p) => <option key={p.name} value={p.name}>{p.displayName}{p.isDefault ? tr(' (default)') : ''}</option>)}
          </select>
        </label>
      </div>

      {s.stockId === CUSTOM_STOCK_ID && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          {([
            ['widthMm', msg('Width (mm)'), '0.5'],
            ['heightMm', msg('Height (mm)'), '0.5'],
            ['across', msg('Labels across'), '1'],
            ['gapMm', msg('Gap between (mm)'), '0.5'],
          ] as [keyof LabelSettings['custom'], string, string][]).map(([key, label, step]) => {
            const typed = customDraft[key];
            const bad = typed !== undefined && !customOk(key, typed);
            return (
              <label key={key} className="block">
                <span className="font-bold text-slate-600">{tr(label)}</span>
                <input
                  type="number"
                  step={step}
                  min={CUSTOM_LIMITS[key][0]}
                  max={CUSTOM_LIMITS[key][1]}
                  value={typed ?? String(s.custom[key])}
                  onChange={(e) => setCustom(key, e.target.value)}
                  onBlur={() => endCustom(key)}
                  className={`${field} mt-1 font-mono ${bad ? 'border-rose-400 focus:ring-rose-300' : ''}`}
                  data-label-custom={key}
                />
                {bad && <span className="block mt-0.5 text-[10px] font-bold text-rose-700" data-label-custom-error={key}>{tr('{min} to {max}', { min: CUSTOM_LIMITS[key][0], max: CUSTOM_LIMITS[key][1] })}</span>}
              </label>
            );
          })}
        </div>
      )}

      <LabelStockDiagram stock={stockFor(s)} />

      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={s.silent && Boolean(s.printer)} disabled={!s.printer} onChange={(e) => update({ silent: e.target.checked })} />
        <span className={s.printer ? 'text-slate-800 font-bold' : 'text-slate-400'}>{tr('Print straight to this printer (no dialog)')}</span>
      </label>

      <div>
        <p className="font-bold text-slate-700 mb-1">{tr('On the label')}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {CONTENT.map((c) => (
            <label key={c.key} className="flex items-center gap-1.5 cursor-pointer text-slate-700">
              <input type="checkbox" checked={s.content[c.key]} onChange={(e) => update({ content: { ...s.content, [c.key]: e.target.checked } })} />
              <span>{tr(c.label)}</span>
            </label>
          ))}
        </div>
      </div>

      {s.content.costCode && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 space-y-1.5" data-cost-code-setup>
          <label className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-slate-800">{tr('Code word (10 different letters = 1 2 3 4 5 6 7 8 9 0)')}</span>
            <input
              value={s.costCodeWord}
              onChange={(e) => update({ costCodeWord: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10) })}
              placeholder="BLACKHORSE"
              className={`${field} w-36 font-mono tracking-widest`}
              data-cost-code-word
            />
          </label>
          <p className={isValidCostCodeWord(s.costCodeWord) ? 'text-amber-900' : 'text-rose-700 font-bold'}>
            {isValidCostCodeWord(s.costCodeWord)
              ? tr('A cost of ₹245 prints as "{code}". Only you know the word.', { code: encodeCostCode(24500, s.costCodeWord) })
              : tr('Type a word with 10 different letters, e.g. BLACKHORSE. The cost code is not printed until then.')}
          </p>
        </div>
      )}

      <LabelPositionControl value={s.offsetMm} onChange={(offsetMm) => update({ offsetMm })} />

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <label className="flex items-center gap-2">
          <span className="font-bold text-slate-700">{tr('Barcode height')}</span>
          <select value={s.barHeightMm} onChange={(e) => update({ barHeightMm: Number(e.target.value) || 0 })} className={`${field} w-auto`} data-label-bar-height>
            <option value={0}>{tr('Auto (fill the label)')}</option>
            {BAR_HEIGHTS_MM.map((mm) => <option key={mm} value={mm}>{`${mm} mm`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className="font-bold text-slate-700">{tr('Copies per item')}</span>
          <input type="number" min="1" max={MAX_SETUP_COPIES} value={s.copies} onChange={(e) => update({ copies: Math.max(1, Math.min(MAX_SETUP_COPIES, Math.round(Number(e.target.value)) || 1)) })} className={`${field} w-20 font-mono`} data-label-copies />
        </label>
        <button type="button" onClick={testPrint} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer" data-label-test>
          <Printer className="w-3.5 h-3.5" /> {tr('Test print')}
        </button>
        <button type="button" onClick={alignmentTest} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold cursor-pointer" data-label-align-test>
          <Frame className="w-3.5 h-3.5" /> {tr('Check size & position')}
        </button>
        {desktop?.calibrateLabelPrinter && s.printer && (
          <button type="button" onClick={calibrate} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold cursor-pointer" title={tr('After loading a new roll: the printer measures the labels and the gap')} data-label-calibrate>
            <Ruler className="w-3.5 h-3.5" /> {tr('Calibrate printer')}
          </button>
        )}
        {testNote && <span className="text-slate-600">{testNote}</span>}
      </div>
    </div>
  );
}
