'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Barcode, CheckCircle2, Database, Download, FileSpreadsheet, RefreshCw, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { saveLastImportIds } from '@/lib/labels/labelSettings';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import { Product } from '@/types';
import { showAlert } from '@/lib/ui/dialogs';
import { buildImportRows, ColumnRole, findHeaderRow, guessColumnRoles, planImport } from '@/lib/import/catalogImport';
import { applyImportPlan, ImportResult } from '@/lib/import/catalogImportDb';
import { ImportColumnMapper } from './ImportColumnMapper';
import { ImportPreview } from './ImportPreview';
import { tr } from '@/lib/i18n/core';
import { setFeatureSwitch, useFeatureSwitches } from '@/lib/features/featureSwitches';

interface CatalogImportModalProps {
  onClose: () => void;
  businessId: string;
  onImportComplete?: (result: ImportResult) => void;
}

interface Sheet {
  name: string;
  grid: unknown[][];
}

const SAMPLE_ROWS = [
  { 'Item Name': 'Parle-G Biscuit 100g', Company: 'Parle', Category: 'Biscuits', Price: 10, Unit: 'packet', Barcode: '8901719101037' },
  { 'Item Name': 'Anar Special', Company: 'Win', Category: 'Anar', Price: 590, Unit: 'box', Barcode: '' },
  { 'Item Name': '1000 Wala', Company: 'Sunstar', Category: 'Garland', Price: 140, Unit: 'piece', Barcode: '' },
];

/**
 * Excel / CSV price-list import (Products and Inventory → Import Excel):
 * pick a file → check the columns → see what changes → import. Uploading the same
 * sheet again with new prices updates those prices; nothing is added twice.
 */
export function CatalogImportModal({ onClose, businessId, onImportComplete }: CatalogImportModalProps) {
  const switches = useFeatureSwitches();
  // New items from rows without a price (saved at ₹0, v4.87.0).
  const [unpricedCount, setUnpricedCount] = useState(0);
  const labelsOn = switches.barcode_studio; // Settings → Features: no "Print labels" when off
  const [step, setStep] = useState<'pick' | 'map' | 'preview' | 'done'>('pick');
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [roles, setRoles] = useState<ColumnRole[]>([]);
  const [prefixSection, setPrefixSection] = useState(true);
  const [giveBarcodes, setGiveBarcodes] = useState(true);
  const [existing, setExisting] = useState<Product[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const grid = sheets[sheetIndex]?.grid || [];
  const headerIndex = useMemo(() => findHeaderRow(grid), [grid]);
  const headers = useMemo(() => ((grid[headerIndex] as unknown[]) || []).map((h) => String(h ?? '').trim()), [grid, headerIndex]);
  const samples = useMemo(
    () => headers.map((_, c) => grid.slice(headerIndex + 1, headerIndex + 6).map((r) => String((r as unknown[])[c] ?? '').trim())),
    [grid, headerIndex, headers]
  );
  const rows = useMemo(() => buildImportRows(grid, headerIndex, roles, { prefixSection }), [grid, headerIndex, roles, prefixSection]);
  const plan = useMemo(() => (existing ? planImport(rows, existing, roles.includes('mrp')) : null), [rows, existing, roles]);
  const canContinue = roles.includes('name') && roles.includes('price');

  const chooseSheet = (index: number, all: Sheet[]) => {
    setSheetIndex(index);
    const g = all[index]?.grid || [];
    setRoles(guessColumnRoles(((g[findHeaderRow(g)] as unknown[]) || []).map((h) => String(h ?? ''))));
  };

  const readFile = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const all: Sheet[] = wb.SheetNames.map((name) => ({
        name,
        grid: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', blankrows: false }),
      })).filter((s) => s.grid.length > 1);
      if (all.length === 0) {
        showAlert(tr('The uploaded spreadsheet contains no data rows.'));
        return;
      }
      // Start on the first sheet whose headings name an item and a price.
      const best = all.findIndex((s) => {
        const r = guessColumnRoles(((s.grid[findHeaderRow(s.grid)] as unknown[]) || []).map((h) => String(h ?? '')));
        return r.includes('name') && r.includes('price');
      });
      setFileName(file.name);
      setSheets(all);
      chooseSheet(Math.max(0, best), all);
      setStep('map');
    } catch (err) {
      console.error('Spreadsheet read error:', err);
      showAlert(tr('Failed to read spreadsheet. Please ensure it is a valid .xlsx, .xls or .csv file.'));
    } finally {
      setBusy(false);
    }
  };

  const toPreview = async () => {
    setExisting(await db.products.toArray());
    setStep('preview');
  };

  const runImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const shop = businessId ? await db.businesses.get(businessId) : undefined;
      const res = await applyImportPlan(plan, {
        businessId,
        taxInclusive: shop?.gst_pricing_mode !== 'exclusive',
        mapped: {
          mrp: roles.includes('mrp'), cost: roles.includes('cost'), unit: roles.includes('unit'), stock: roles.includes('stock'),
          category: roles.includes('category'), gst: roles.includes('gst'), hsn: roles.includes('hsn'), wholesale: roles.includes('wholesale'),
        },
        giveBarcodes,
      });
      setResult(res);
      setUnpricedCount(plan.creates.filter((r) => r.pricePaise === null).length);
      // A sheet with wholesale prices: the Retail / Wholesale switch comes on by itself (v4.87.0).
      if (roles.includes('wholesale') && plan.creates.concat(plan.updates.map((u) => u.row)).some((r) => r.wholesalePaise)) setFeatureSwitch('wholesale_price', true);
      // New and re-priced items: Barcode Studio offers their labels ("Last Excel import").
      saveLastImportIds(res.createdIds.concat(res.updatedIds));
      setStep('done');
      onImportComplete?.(res);
    } catch (err) {
      console.error('Import commit error:', err);
      showAlert(tr('Failed to commit items to local database.'));
    } finally {
      setBusy(false);
    }
  };

  const downloadSample = async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    // With the Wholesale price switch on, the sample shows the extra "Wholesale" column (v4.87.0).
    const rows = switches.wholesale_price ? SAMPLE_ROWS.map((r) => ({ ...r, Wholesale: Math.round(r.Price * 0.9) })) : SAMPLE_ROWS;
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Items');
    XLSX.writeFile(wb, 'KamaiPlus_Price_List_Sample.xlsx');
  };

  return (
    <Modal isOpen onClose={onClose} title={tr('Import price list (Excel / CSV)')} size="xl">
      <div className="space-y-4 p-1">
        {step === 'pick' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) void readFile(f);
              }}
              onClick={() => inputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-amber-500 rounded-3xl p-8 text-center cursor-pointer transition bg-slate-50/50 hover:bg-amber-50/20"
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                data-import-file
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void readFile(f);
                  e.target.value = '';
                }}
              />
              {busy ? (
                <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
                  <UploadCloud className="w-8 h-8" />
                </div>
              )}
              <h4 className="text-base font-black text-slate-900 mt-3">{tr('Drop your price list here, or click to choose it')}</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {tr('Any Excel or CSV with an item name and a price. Company, category, unit, barcode and stock columns are used when present. Upload the same sheet again later to update prices.')}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div className="text-xs text-slate-600">{tr('Starting a new list? Download a sample sheet.')}</div>
              </div>
              <Button size="sm" variant="outline" onClick={downloadSample} className="w-full sm:w-auto font-bold text-xs bg-white">
                <Download className="w-3.5 h-3.5 mr-1" /> {tr('Download Sample .XLSX')}
              </Button>
            </div>
          </div>
        )}

        {(step === 'map' || step === 'preview') && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span className="font-black text-slate-900">{fileName}</span>
            {sheets.length > 1 && step === 'map' && (
              <select
                value={sheetIndex}
                onChange={(e) => chooseSheet(Number(e.target.value), sheets)}
                className="h-8 px-2 rounded-lg border border-slate-300 bg-white font-bold"
                aria-label={tr('Sheet')}
              >
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>{tr('Sheet')}: {s.name}</option>
                ))}
              </select>
            )}
            <span className="text-slate-500">{tr('{count} rows', { count: rows.length })}</span>
          </div>
        )}

        {step === 'map' && (
          <>
            <ImportColumnMapper headers={headers} samples={samples} roles={roles} onChange={setRoles} />
            <label className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer">
              <input type="checkbox" checked={prefixSection} onChange={(e) => setPrefixSection(e.target.checked)} className="mt-0.5" />
              <span>{tr('Put the category in front of names that start with a size or number (e.g. "8 वाला" under चौरसा → "चौरसा 8 वाला").')}</span>
            </label>
          </>
        )}

        {step === 'preview' && plan && (
          <>
            <ImportPreview plan={plan} />
            <div className="space-y-1.5 text-xs text-slate-700">
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={giveBarcodes} onChange={(e) => setGiveBarcodes(e.target.checked)} className="mt-0.5" />
                <span>{tr('Give every new item its own barcode (for labels and scanning).')}</span>
              </label>
              {!roles.includes('stock') && <p className="text-slate-500">{tr('No stock column: new items are not counted (Unlimited stock), so billing never stops them.')}</p>}
              <p className="text-slate-500">{tr('The price in the sheet is the selling price. Items not in the sheet are not changed.')}</p>
            </div>
          </>
        )}

        {step === 'done' && result && (
          <div className="py-6 text-center space-y-3" data-import-done>
            <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900">{tr('Price list imported')}</h3>
            <p className="text-xs text-slate-600">
              {tr('{created} new items, {updated} updated, {unchanged} unchanged, {skipped} skipped.', { created: result.created, updated: result.updated, unchanged: result.unchanged, skipped: result.skipped })}
              {result.barcodesGiven > 0 && <> {tr('{count} items got a new barcode.', { count: result.barcodesGiven })}</>}
            </p>
            {unpricedCount > 0 && (
              <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block" data-import-unpriced>
                {tr('{count} items have no price yet: their labels print without a price, and the counter asks for the price when they are billed.', { count: unpricedCount })}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
          {step === 'map' && <Button variant="outline" size="sm" onClick={() => setStep('pick')}>{tr('Choose Different File')}</Button>}
          {step === 'preview' && <Button variant="outline" size="sm" onClick={() => setStep('map')} disabled={busy}>{tr('Back')}</Button>}
          {(step === 'pick' || step === 'done') && <span />}
          {step === 'map' && (
            <Button size="sm" onClick={toPreview} disabled={!canContinue} className="bg-slate-900 text-white font-black text-xs px-5 h-10 rounded-xl">
              {tr('Next: check changes')}
            </Button>
          )}
          {step === 'preview' && plan && (
            <Button
              size="sm"
              onClick={runImport}
              disabled={busy || plan.creates.length + plan.updates.length === 0}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-5 h-10 rounded-xl"
            >
              {busy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-4 h-4" />}
              <span>{tr('Import: {created} new, {updated} updates', { created: plan.creates.length, updated: plan.updates.length })}</span>
            </Button>
          )}
          {step === 'done' && (
            <div className="flex items-center gap-2">
              {labelsOn && result && result.created + result.updated > 0 && (
                <Link
                  href="/barcode-generator?from=import"
                  prefetch={false}
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-900 font-black text-xs"
                  data-import-print-labels
                >
                  <Barcode className="w-4 h-4" /> {tr('Print labels for these {count} items', { count: result.created + result.updated })}
                </Link>
              )}
              <Button size="sm" onClick={onClose} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs h-10 px-6 rounded-xl">
                {tr('Done & View Catalog')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
