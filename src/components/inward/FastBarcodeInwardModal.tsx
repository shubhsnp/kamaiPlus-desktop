'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { Barcode, CheckCircle2, RefreshCw, Save, ScanLine } from 'lucide-react';
import { db } from '@/lib/db';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { lookupBarcode } from '@/lib/barcode/barcodeDictionary';
import { playBeepSound } from '@/lib/voice/speechParser';
import { planStockEntry, StockEntryRow } from '@/lib/inward/stockEntry';
import { applyStockEntry, StockEntryResult } from '@/lib/inward/stockEntryDb';
import { scanIntoRows, ScanOutcome } from '@/lib/inward/fastInward';
import { clearStockEntryDraft, FAST_INWARD_DRAFT_KEY, readStockEntryDraft, saveStockEntryDraft } from '@/lib/inward/stockEntryDraft';
import { saveLabelHandoff } from '@/lib/labels/labelSettings';
import { showAlert } from '@/lib/ui/dialogs';
import { msg, tr } from '@/lib/i18n/core';
import { CategoryPicker } from '@/components/products/CategoryPicker';
import { FastColumns, fastGridTemplate, FastInwardRow } from './FastInwardRow';

let seq = 0;
const newKey = () => `f${Date.now().toString(36)}_${seq++}`;

const NOTE: Record<ScanOutcome, string> = {
  more: msg('Scanned again: {name} × {qty}'),
  saved: msg('Saved item: {name} — its stock goes up'),
  known: msg('Found: {name} — check the price'),
  unknown: msg('New barcode {code} — type its name and price'),
};

/**
 * Fast barcode inward (v4.78.0) — the Android app's rapid inward for a USB gun: scan, scan,
 * scan; each code is a row at once (same code again = +1), name / price / category can be
 * filled right there, quantity and category are optional. Saved in one transaction
 * (lib/inward/stockEntryDb.ts); labels can follow in Barcode Studio.
 */
export function FastBarcodeInwardModal({ onClose }: { onClose: () => void }) {
  const business = useBusiness();
  const router = useRouter();
  const switches = useFeatureSwitches();
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const draft = useMemo(() => readStockEntryDraft(FAST_INWARD_DRAFT_KEY), []);
  const [rows, setRows] = useState<StockEntryRow[]>(() => draft?.rows || []);
  // The latest rows: scans come faster than renders, and each one waits for the barcode
  // list — every change starts from here so no scan is lost.
  const rowsRef = useRef<StockEntryRow[]>(rows);
  const updateRows = (next: StockEntryRow[]) => {
    rowsRef.current = next;
    setRows(next);
  };
  const [categoryId, setCategoryId] = useState(draft?.categoryId || '');
  const [code, setCode] = useState('');
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [flashKey, setFlashKey] = useState('');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<StockEntryResult | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  const columns: FastColumns = { mrp: switches.product_selling_price, cost: switches.product_cost_price };
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const category = useMemo(() => {
    const id = categories.some((c) => c.id === categoryId) ? categoryId : generalCategoryId(categories);
    return { id, name: categories.find((c) => c.id === id)?.name || 'General' };
  }, [categories, categoryId]);
  const plan = useMemo(() => planStockEntry(rows, products, { separateSellingPrice: switches.product_selling_price, qtyOptional: true }), [rows, products, switches.product_selling_price]);
  const errorCount = Object.keys(plan.errors).length;

  const focusScan = () => window.setTimeout(() => scanRef.current?.focus(), 0);
  useEffect(() => { focusScan(); }, []);
  useEffect(() => {
    if (rows.length) saveStockEntryDraft({ rows, categoryId }, FAST_INWARD_DRAFT_KEY);
    else clearStockEntryDraft(FAST_INWARD_DRAFT_KEY);
  }, [rows, categoryId]);

  const scan = async (raw: string) => {
    const clean = raw.trim();
    setCode('');
    focusScan();
    if (clean.length < 3) return;
    const saved = products.some((p) => p.barcode?.trim() === clean);
    const known = saved ? null : await lookupBarcode(clean).catch(() => null);
    const res = scanIntoRows(rowsRef.current, clean, products, known, newKey(), { separateSellingPrice: switches.product_selling_price, categories });
    updateRows(res.rows);
    setFlashKey(res.key);
    const target = res.rows.find((r) => r.key === res.key);
    playBeepSound(res.outcome === 'unknown' ? 'alert' : 'success');
    setNote({ ok: res.outcome !== 'unknown', text: tr(NOTE[res.outcome], { name: target?.name || '', qty: target?.qty || '1', code: clean }) });
  };

  const change = (key: string, patch: Partial<StockEntryRow>) => updateRows(rowsRef.current.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async (withLabels: boolean) => {
    if (saving) return;
    setShowErrors(true);
    if (errorCount || plan.lines.length === 0) return focusScan();
    setSaving(true);
    try {
      const result = await applyStockEntry(plan, {
        businessId: business?.id || 'biz_default',
        taxInclusive: business?.gst_pricing_mode !== 'exclusive',
        category,
        categories,
        source: 'Fast barcode inward',
      });
      clearStockEntryDraft(FAST_INWARD_DRAFT_KEY);
      updateRows([]);
      setShowErrors(false);
      setNote(null);
      if (withLabels && result.labels.length) return printLabels(result);
      setDone(result);
    } catch (err: any) {
      showAlert(tr('Could not save: {error}', { error: err?.message || '' }));
    } finally {
      setSaving(false);
    }
  };

  // Barcode Studio opens with these items, one label per piece received.
  const printLabels = (result: StockEntryResult) => {
    saveLabelHandoff(result.labels.map((l) => ({ id: l.id, copies: l.copies })));
    onClose();
    router.push('/barcode-generator?from=inward');
  };

  const labelCount = done ? done.labels.reduce((n, l) => n + l.copies, 0) : 0;

  return (
    <Modal isOpen onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><ScanLine className="w-4 h-4 text-emerald-600" />{tr('Fast barcode inward')}</span>} description={tr('Scan item after item with the barcode gun. Each scan adds a row (the same code again adds 1); fill name, price and category right here. Quantity and category are optional.')}>
      {done ? (
        <div className="space-y-4 text-xs" data-fast-done>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <div className="space-y-1 text-emerald-900">
              <p className="text-sm font-black">{tr('Saved: {created} new items, {restocked} restocked.', { created: done.created, restocked: done.restocked })}</p>
              {done.startedCounting > 0 && <p>{tr('{count} items were not counted before — their stock is counted from now on.', { count: done.startedCounting })}</p>}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Close')}</Button>
            <Button type="button" variant="outline" size="sm" onClick={() => { setDone(null); focusScan(); }} data-fast-scan-more>{tr('Scan more')}</Button>
            {labelCount > 0 && (
              <Button type="button" size="sm" onClick={() => printLabels(done)} className="bg-slate-900 hover:bg-slate-950 text-white font-bold gap-1.5" data-fast-print-labels>
                <Barcode className="w-4 h-4 text-amber-400" /> {tr('Print {count} labels', { count: labelCount })}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[16rem] flex items-center gap-2 h-11 px-3 rounded-xl border-2 border-emerald-400 bg-emerald-50/40 focus-within:border-emerald-600">
              <Barcode className="w-5 h-5 text-emerald-700 shrink-0" />
              <input
                ref={scanRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void scan(code); } }}
                placeholder={tr('Scan a barcode (or type it and press Enter)')}
                className="w-full bg-transparent focus:outline-none text-sm font-mono font-bold"
                data-fast-scan
              />
            </div>
            <label className="flex items-center gap-2">
              <span className="font-bold text-slate-700">{tr('Category for new items')}</span>
              <CategoryPicker categories={categories} value={categories.some((c) => c.id === category.id) ? category.id : ''} emptyLabel={categories.some((c) => c.id === category.id) ? undefined : category.name} onChange={setCategoryId} businessId={business?.id || 'biz_default'} />
            </label>
          </div>
          {note && <div className={`px-3 py-2 rounded-lg font-bold ${note.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`} data-fast-note>{note.text}</div>}

          <div className="border border-slate-200 rounded-xl">
            <div className="grid gap-1.5 px-1 py-1.5 bg-slate-50 border-b border-slate-200 rounded-t-xl text-[10px] font-black uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: fastGridTemplate(columns) }}>
              <span />
              <span>{tr('Barcode')}</span>
              <span>{tr('Item')}</span>
              <span>{columns.mrp ? tr('Price ₹') : tr('MRP ₹')}</span>
              {columns.mrp && <span>{tr('MRP ₹')}</span>}
              {columns.cost && <span>{tr('Cost ₹')}</span>}
              <span>{tr('Category')}</span>
              <span className="text-center">{tr('Qty')}</span>
              <span />
            </div>
            <div className="p-1 space-y-0.5 max-h-[46vh] overflow-y-auto" data-fast-list>
              {rows.length === 0 ? (
                <p className="py-8 text-center text-slate-400">{tr('Scan the first barcode — rows appear here.')}</p>
              ) : rows.map((r, i) => (
                <FastInwardRow
                  key={r.key}
                  row={r}
                  index={rows.length - 1 - i}
                  linked={(r.productId && byId.get(r.productId)) || null}
                  categories={categories}
                  columns={columns}
                  flash={flashKey === r.key}
                  error={showErrors ? plan.errors[r.key] : undefined}
                  onChange={(patch) => change(r.key, patch)}
                  onRemove={() => { updateRows(rowsRef.current.filter((x) => x.key !== r.key)); focusScan(); }}
                  onBackToScan={focusScan}
                  onScan={(c) => void scan(c)}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
            <div className="font-bold text-slate-700" data-fast-summary>
              {tr('{created} new • {restocked} restocked • {labels} labels', { created: plan.created, restocked: plan.restocked, labels: plan.labels })}
              {showErrors && errorCount > 0 && <span className="ml-2 text-rose-700">{tr('Rows to fix: {count}', { count: errorCount })}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" disabled={saving || rows.length === 0} onClick={() => void save(false)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold cursor-pointer disabled:opacity-50" data-fast-save>
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {tr('Save {count} items', { count: plan.lines.length })}
              </button>
              <button type="button" disabled={saving || rows.length === 0} onClick={() => void save(true)} className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-slate-900 hover:bg-slate-950 text-white font-black cursor-pointer disabled:opacity-50" data-fast-save-labels>
                <Barcode className="w-3.5 h-3.5 text-amber-400" /> {tr('Save & print labels')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
