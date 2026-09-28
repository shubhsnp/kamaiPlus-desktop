'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PackagePlus, Plus, Printer, RefreshCw, Save } from 'lucide-react';
import { db } from '@/lib/db';
import { Category, Product } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { generalCategoryId } from '@/lib/products/defaultCategory';
import { lookupBarcode } from '@/lib/barcode/barcodeDictionary';
import { mapUnit, normName } from '@/lib/import/catalogImport';
import { emptyEntryRow, isBlankEntryRow, planStockEntry, StockEntryRow } from '@/lib/inward/stockEntry';
import { applyStockEntry, StockEntryResult } from '@/lib/inward/stockEntryDb';
import { clearStockEntryDraft, readStockEntryDraft, saveStockEntryDraft } from '@/lib/inward/stockEntryDraft';
import { showAlert } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';
import { EntryColumns, entryGridTemplate, StockEntryRowView } from './StockEntryRowView';

let rowSeq = 0;
const newKey = () => `r${Date.now().toString(36)}_${rowSeq++}`;

/** Always one empty row at the end to type into. */
function withTrailingBlank(rows: StockEntryRow[]): StockEntryRow[] {
  return rows.length && isBlankEntryRow(rows[rows.length - 1]) ? rows : [...rows, emptyEntryRow(newKey())];
}

interface StockEntryModalProps {
  categories: Category[];
  onClose: () => void;
  /** Saved: the labels go to the print list; printNow = print them straight away. */
  onSaved: (result: StockEntryResult, printNow: boolean) => void;
}

/**
 * "New stock + labels" (v4.77.0): type name, price and quantity of what came in. Each row
 * becomes a saved item with counted stock and its own barcode (or restocks a saved one),
 * and gets one label per piece. Rows are kept as a draft until saved.
 */
export function StockEntryModal({ categories, onClose, onSaved }: StockEntryModalProps) {
  const business = useBusiness();
  const switches = useFeatureSwitches();
  const allProducts = useLiveQuery(() => db.products.toArray()) || [];
  const sellable = useMemo(() => allProducts.filter((p) => p.is_active !== false && !p.has_variants), [allProducts]);

  const draft = useMemo(() => readStockEntryDraft(), []);
  const [rows, setRows] = useState<StockEntryRow[]>(() => withTrailingBlank(draft?.rows || []));
  const [categoryId, setCategoryId] = useState(draft?.categoryId || '');
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const columns: EntryColumns = { mrp: switches.product_selling_price, cost: switches.product_cost_price, gst: switches.product_gst_rate, hsn: switches.product_hsn };
  const category = useMemo(() => {
    const id = categories.some((c) => c.id === categoryId) ? categoryId : generalCategoryId(categories);
    return { id, name: categories.find((c) => c.id === id)?.name || 'General' };
  }, [categories, categoryId]);

  const plan = useMemo(() => planStockEntry(rows, allProducts, { separateSellingPrice: switches.product_selling_price }), [rows, allProducts, switches.product_selling_price]);
  const errorCount = Object.keys(plan.errors).length;
  const filled = rows.filter((r) => !isBlankEntryRow(r)).length;

  // The saved item a row will restock — picked, scanned, or typed with its exact name.
  const linkedFor = useMemo(() => {
    const byId = new Map(sellable.map((p) => [p.id, p]));
    const byCode = new Map(sellable.filter((p) => p.barcode?.trim()).map((p) => [p.barcode!.trim(), p]));
    const byName = new Map<string, Product>();
    sellable.forEach((p) => { if (!byName.has(normName(p.name))) byName.set(normName(p.name), p); });
    return (r: StockEntryRow): Product | null => (r.productId && byId.get(r.productId)) || (r.barcode && byCode.get(r.barcode)) || (r.name.trim() && byName.get(normName(r.name))) || null;
  }, [sellable]);

  useEffect(() => {
    if (filled) saveStockEntryDraft({ rows: rows.filter((r) => !isBlankEntryRow(r)), categoryId });
    else clearStockEntryDraft();
  }, [rows, categoryId, filled]);

  const focusRow = (key: string, field = 'name') =>
    window.setTimeout(() => listRef.current?.querySelector<HTMLInputElement>(`[data-entry-row="${key}"] [data-entry-${field}]`)?.focus(), 0);

  useEffect(() => {
    focusRow(rows[rows.length - 1].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (key: string, patch: Partial<StockEntryRow>) => setRows((prev) => withTrailingBlank(prev.map((r) => (r.key === key ? { ...r, ...patch } : r))));
  const remove = (key: string) => setRows((prev) => withTrailingBlank(prev.filter((r) => r.key !== key)));
  const nextRow = (key: string) => {
    const at = rows.findIndex((r) => r.key === key);
    const next = rows[at + 1];
    if (next) return focusRow(next.key);
    const blank = emptyEntryRow(newKey());
    setRows((prev) => [...prev, blank]);
    focusRow(blank.key);
  };

  // The barcode gun typed into the name box: a saved item's code restocks it; a new code
  // is kept for the new item, with its name and price from the offline barcode list.
  const onScan = async (key: string, code: string) => {
    const saved = sellable.find((p) => p.barcode?.trim() === code);
    if (saved) {
      change(key, { productId: saved.id, name: saved.name, unit: saved.unit, price: '', mrp: '', barcode: '' });
      return focusRow(key, 'qty');
    }
    const known = await lookupBarcode(code).catch(() => null);
    const row = rows.find((r) => r.key === key);
    const patch: Partial<StockEntryRow> = { barcode: code, name: known?.name || '' };
    if (known) {
      if (!row?.price) patch.price = String(switches.product_selling_price ? known.selling_price || known.mrp : known.mrp || known.selling_price);
      if (switches.product_selling_price && !row?.mrp && known.mrp) patch.mrp = String(known.mrp);
      patch.unit = mapUnit(known.unit).unit;
      if (switches.product_gst_rate && known.tax_rate) patch.gst = String(known.tax_rate);
      if (switches.product_hsn && known.hsn) patch.hsn = known.hsn;
    }
    change(key, patch);
    focusRow(key, known ? 'qty' : 'name');
  };

  const save = async (printNow: boolean) => {
    if (saving) return;
    setShowErrors(true);
    if (errorCount) {
      focusRow(Object.keys(plan.errors)[0], 'name');
      return;
    }
    if (plan.lines.length === 0) {
      focusRow(rows[0].key);
      return;
    }
    setSaving(true);
    try {
      const result = await applyStockEntry(plan, {
        businessId: business?.id || 'biz_default',
        taxInclusive: business?.gst_pricing_mode !== 'exclusive',
        category,
      });
      clearStockEntryDraft();
      onSaved(result, printNow);
    } catch (err: any) {
      showAlert(tr('Could not save: {error}', { error: err?.message || '' }));
    } finally {
      setSaving(false);
    }
  };

  // Ctrl+Enter = Save & print (from any box).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      void save(true);
    }
  };

  const clearAll = () => {
    const blank = emptyEntryRow(newKey());
    setRows([blank]);
    setShowErrors(false);
    focusRow(blank.key);
  };

  return (
    <Modal isOpen onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><PackagePlus className="w-4 h-4 text-emerald-600" />{tr('New stock + labels')}</span>} description={tr('Type what came in. Each item is saved with its stock and its own barcode, and gets one label per piece.')}>
      <div className="space-y-3 text-xs" onKeyDown={onKeyDown}>
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <label className="flex items-center gap-2">
            <span className="font-bold text-slate-700">{tr('Category for new items')}</span>
            <select value={category.id} onChange={(e) => setCategoryId(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold" data-entry-category>
              {!categories.some((c) => c.id === category.id) && <option value={category.id}>{category.name}</option>}
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <span className="text-[11px] text-slate-500">{tr('Enter = next box • Ctrl+Enter = Save & print')}</span>
        </div>

        <div className="border border-slate-200 rounded-xl">
          <div className="grid gap-1.5 px-1 py-1.5 bg-slate-50 border-b border-slate-200 rounded-t-xl text-[10px] font-black uppercase tracking-wide text-slate-500" style={{ gridTemplateColumns: entryGridTemplate(columns) }}>
            <span />
            <span>{tr('Item')}</span>
            <span>{columns.mrp ? tr('Price ₹') : tr('MRP ₹')}</span>
            {columns.mrp && <span>{tr('MRP ₹')}</span>}
            {columns.cost && <span>{tr('Cost ₹')}</span>}
            {columns.gst && <span>{tr('GST')}</span>}
            {columns.hsn && <span>{tr('HSN')}</span>}
            <span className="text-center">{tr('Qty')}</span>
            <span>{tr('Unit')}</span>
            <span />
          </div>
          <div ref={listRef} className="p-1 space-y-0.5 max-h-[52vh] overflow-y-auto" data-entry-list>
            {rows.map((r, i) => (
              <StockEntryRowView
                key={r.key}
                row={r}
                index={i}
                linked={linkedFor(r)}
                products={sellable}
                columns={columns}
                error={showErrors ? plan.errors[r.key] : undefined}
                onChange={(patch) => change(r.key, patch)}
                onRemove={() => remove(r.key)}
                onNextRow={() => nextRow(r.key)}
                onScan={(code) => void onScan(r.key, code)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => nextRow(rows[rows.length - 1].key)} className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> {tr('Add row')}
          </button>
          {filled > 0 && <button type="button" onClick={clearAll} className="text-rose-600 font-bold cursor-pointer">{tr('Clear all rows')}</button>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200">
          <div className="font-bold text-slate-700" data-entry-summary>
            {tr('{created} new • {restocked} restocked • {labels} labels', { created: plan.created, restocked: plan.restocked, labels: plan.labels })}
            {showErrors && errorCount > 0 && <span className="ml-2 text-rose-700">{tr('Rows to fix: {count}', { count: errorCount })}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={saving} onClick={() => void save(false)} className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-bold cursor-pointer disabled:opacity-50" data-entry-save>
              <Save className="w-3.5 h-3.5" /> {tr('Save, print later')}
            </button>
            <button type="button" disabled={saving} onClick={() => void save(true)} className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-slate-900 hover:bg-slate-950 text-white font-black cursor-pointer disabled:opacity-50" data-entry-save-print>
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 text-amber-400" />}
              {tr('Save & print {count} labels', { count: plan.labels })}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
