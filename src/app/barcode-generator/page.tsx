'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Bluetooth, CheckCircle2, ChevronDown, ChevronUp, PackagePlus, Printer, Settings2, XCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { bluetoothPrinter } from '@/lib/hardware/bluetoothPrinter';
import { EscPosEncoder } from '@/lib/hardware/escpos';
import { ensureProductBarcodes } from '@/lib/barcode/storeBarcodes';
import { productLabelExtras } from '@/lib/labels/labelExtras';
import { clearLabelHandoff, getLabelSettings, getLastImportIds, LABEL_SETTINGS_EVENT, LabelSettings, readLabelHandoff, stockFor } from '@/lib/labels/labelSettings';
import { expandCopies, printLabels } from '@/lib/labels/printLabels';
import { LabelSetupPanel } from '@/components/labels/LabelSetupPanel';
import { LabelPreview } from '@/components/labels/LabelPreview';
import { LabelQueuePanel, QueueItem } from '@/components/labels/LabelQueuePanel';
import { StockEntryModal } from '@/components/labels/StockEntryModal';
import { LoosePackModal } from '@/components/labels/LoosePackModal';
import { StockEntryResult } from '@/lib/inward/stockEntryDb';
import { stockEntryDraftCount } from '@/lib/inward/stockEntryDraft';
import { tr } from '@/lib/i18n/core';

/**
 * Barcode Studio (v4.71.0): pick items (one, a category, all, or the last Excel
 * import), set copies, print on this computer's label printer. Every catalogue item
 * gets a saved barcode before its label prints, so each label scans at the counter.
 * Label size / printer live in LabelSetupPanel (also in Settings → Invoice & Bill Rules).
 * "New stock + labels" (v4.77.0): type what came in — saved as items with stock and a
 * barcode, one label per piece (?new=1 opens it; ?from=inward brings Purchases' labels).
 */
export default function BarcodeGeneratorPage() {
  const business = useBusiness();
  const shopName = business?.name || '';
  // Labels are printed per size / colour (each variant has its own barcode), not for the parent.
  const products = useLiveQuery(async () => (await db.products.toArray()).filter((p) => p.is_active !== false && !p.has_variants)) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const [settings, setSettings] = useState<LabelSettings>(getLabelSettings);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [looseOpen, setLooseOpen] = useState(false);
  const [draftRows, setDraftRows] = useState(0);
  const [setupOpen, setSetupOpen] = useState(() => !getLabelSettings().printer);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setSettings(getLabelSettings());
    window.addEventListener(LABEL_SETTINGS_EVENT, refresh);
    setLastImportIds(getLastImportIds());
    setDraftRows(stockEntryDraftCount());
    if (new URLSearchParams(window.location.search).get('new') === '1') setEntryOpen(true);
    return () => window.removeEventListener(LABEL_SETTINGS_EVENT, refresh);
  }, []);

  /** Adds items with their saved barcodes (items without one get a store code now); copies per item if given. */
  const addProducts = async (list: Product[], copiesById?: Map<string, number>) => {
    if (list.length === 0) return;
    setBusy(true);
    try {
      const codes = await ensureProductBarcodes(list);
      setQueue((prev) => {
        const byId = new Map(prev.map((q) => [q.id, q]));
        for (const p of list) {
          const had = byId.get(p.id);
          const copies = copiesById?.get(p.id) || settings.copies;
          byId.set(p.id, had
            ? { ...had, copies: Math.min(999, had.copies + copies) }
            : { id: p.id, name: p.name, barcode: codes.get(p.id) || '', pricePaise: p.selling_price, mrpPaise: p.mrp, ...productLabelExtras(p), copies, stock: p.is_unlimited_stock ? null : p.current_stock });
        }
        return Array.from(byId.values());
      });
    } finally {
      setBusy(false);
    }
  };

  const lastImport = useMemo(() => {
    const ids = new Set(lastImportIds);
    return products.filter((p) => ids.has(p.id));
  }, [products, lastImportIds]);

  // Opened from "Print labels" after an Excel import: start with those items.
  const [autoLoaded, setAutoLoaded] = useState(false);
  useEffect(() => {
    if (autoLoaded || lastImport.length === 0) return;
    if (new URLSearchParams(window.location.search).get('from') === 'import') {
      setAutoLoaded(true);
      void addProducts(lastImport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastImport.length, autoLoaded]);

  // Opened from "Print labels" after stock came in (Purchases): those items, one label per piece.
  const [inwardLoaded, setInwardLoaded] = useState(false);
  useEffect(() => {
    if (inwardLoaded || products.length === 0) return;
    if (new URLSearchParams(window.location.search).get('from') !== 'inward') return;
    setInwardLoaded(true);
    const handoff = readLabelHandoff();
    const copies = new Map(handoff.map((h) => [h.id, h.copies]));
    const list = products.filter((p) => copies.has(p.id));
    if (list.length) void addProducts(list, copies).then(clearLabelHandoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products.length, inwardLoaded]);

  // "New stock + labels" saved: its labels join the print list (and print at once if asked).
  const handleStockSaved = async (res: StockEntryResult, printNow: boolean) => {
    setEntryOpen(false);
    setDraftRows(0);
    setQueue((prev) => {
      const byId = new Map(prev.map((q) => [q.id, q]));
      for (const l of res.labels) {
        const had = byId.get(l.id);
        byId.set(l.id, had ? { ...had, ...l, copies: Math.min(999, had.copies + l.copies) } : { ...l });
      }
      return Array.from(byId.values());
    });
    const saved = tr('Saved: {created} new items, {restocked} restocked.', { created: res.created, restocked: res.restocked });
    const count = res.labels.reduce((n, l) => n + l.copies, 0);
    if (!printNow || count === 0) {
      setNotice({ ok: true, text: `${saved} ${tr('{count} labels are in the print list.', { count })}` });
      return;
    }
    setBusy(true);
    try {
      const out = await printLabels(expandCopies(res.labels), settings, shopName);
      setNotice(out.ok
        ? { ok: true, text: `${saved} ${tr('{count} labels sent to the printer.', { count })}` }
        : { ok: false, text: `${saved} ${tr('Could not print: {error}', { error: out.error || '' })}` });
    } finally {
      setBusy(false);
    }
  };

  const labels = useMemo(() => expandCopies(queue), [queue]);
  // One row of the roll (or sheet) with a made-up item — shown until the list has labels.
  const across = stockFor(settings).across;
  const sampleLabels = useMemo(() => Array.from({ length: across }, () => ({
    name: tr('Sample item — अनार स्पेशल'), barcode: '2000000000015', pricePaise: 9900, mrpPaise: 12000, costPaise: 7500, detail: 'M / Red',
  })), [across]);

  const handlePrint = async () => {
    if (labels.length === 0) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await printLabels(labels, settings, shopName);
      setNotice(res.ok
        ? { ok: true, text: tr('{count} labels sent to the printer.', { count: labels.length }) }
        : { ok: false, text: tr('Could not print: {error}', { error: res.error || '' }) });
    } finally {
      setBusy(false);
    }
  };

  // Bluetooth ESC/POS receipt printers (58 / 80 mm). They print ASCII only: Hindi / Marathi names come out as "?".
  const handleBluetoothPrint = async () => {
    if (labels.length === 0) return;
    try {
      const enc = new EscPosEncoder(80);
      for (const l of labels) {
        enc.alignCenter();
        if (settings.content.shopName && shopName) enc.bold(true).textLine(shopName).bold(false);
        if (settings.content.itemName) enc.doubleHeight(true).textLine(l.name).doubleHeight(false);
        // Price / MRP follow "On the label" like the label printer does (v4.85.0 — both always printed).
        const priceLine = [
          settings.content.mrp && l.mrpPaise && l.mrpPaise > l.pricePaise ? `MRP: ${formatINR(l.mrpPaise)}` : '',
          settings.content.price ? `PRICE: ${formatINR(l.pricePaise)}` : '',
        ].filter(Boolean).join(' | ');
        if (priceLine) enc.textLine(priceLine);
        if (settings.content.qr) enc.qrcode(l.barcode, 5);
        else enc.barcode(l.barcode, 'CODE128', 50);
        if (settings.content.code) enc.textLine(l.barcode);
        enc.feed(1);
        enc.hr();
      }
      enc.feed(2);
      enc.cut();
      await bluetoothPrinter.sendRawBytes(enc.getBytes());
      setNotice({ ok: true, text: tr('{count} labels sent to the Bluetooth printer.', { count: labels.length }) });
    } catch (err: any) {
      setNotice({ ok: false, text: err?.message || tr('Bluetooth label printing failed.') });
    }
  };

  return (
    <div className="space-y-4 pb-16">
      <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <Barcode className="w-4 h-4 text-slate-800 shrink-0" />
            <h1 className="text-sm sm:text-lg font-black text-slate-900 truncate">{tr('Barcode & Price Label Studio')}</h1>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate">{tr('Every label carries the item\'s own saved barcode — it scans straight into the bill.')}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={handleBluetoothPrint} disabled={labels.length === 0} className="text-xs font-bold gap-1" title={tr('Bluetooth receipt printer — English names only')}>
            <Bluetooth className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tr('Bluetooth')}</span>
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={busy || labels.length === 0} className="bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs gap-1 px-3" data-print-labels>
            <Printer className="w-3.5 h-3.5 text-amber-400" />
            <span>{labels.length === 1 ? tr('Print 1 label') : tr('Print {count} labels', { count: labels.length })}</span>
          </Button>
        </div>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${notice.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`} data-print-notice>
          {notice.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-5 space-y-3.5">
          <div className="p-3 sm:p-3.5 rounded-xl border border-emerald-300 bg-emerald-50 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black text-emerald-900">{tr('New stock arrived?')}</p>
              <p className="text-[11px] text-emerald-800">{tr('Type name, price and quantity — items are saved with their stock and barcode, one label per piece.')}</p>
            </div>
            <Button size="sm" onClick={() => setEntryOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1 shrink-0" data-new-stock>
              <PackagePlus className="w-3.5 h-3.5" />
              {draftRows > 0 ? tr('Continue ({count} rows)', { count: draftRows }) : tr('New stock + labels')}
            </Button>
          </div>

          <Card className="p-3 sm:p-3.5 bg-white border border-slate-200 shadow-2xs">
            <button type="button" onClick={() => setSetupOpen(!setupOpen)} className="w-full flex items-center justify-between cursor-pointer">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Settings2 className="w-3.5 h-3.5" /> {tr('Label printer & size')}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-500">
                {settings.printer || tr('print dialog')}
                {setupOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
            </button>
            {setupOpen && <div className="pt-3 mt-2.5 border-t border-slate-100"><LabelSetupPanel shopName={shopName} /></div>}
          </Card>

          <Card className="p-3 sm:p-3.5 bg-white border border-slate-200 shadow-2xs">
            <LabelQueuePanel
              queue={queue}
              onChange={setQueue}
              products={products}
              categories={categories}
              onAdd={(list) => void addProducts(list)}
              lastImportCount={lastImport.length}
              onAddLastImport={() => void addProducts(lastImport)}
              onLoosePack={() => setLooseOpen(true)}
              busy={busy}
            />
          </Card>
        </div>

        {/* Stays in view while the left side scrolls (v4.85.0). An empty list shows a sample
            label with the current setup, so size / content changes are seen at once. */}
        <div className="lg:col-span-7 lg:sticky lg:top-4 lg:self-start">
          <Card className="p-3 bg-white border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-black text-slate-900 uppercase tracking-wider">{tr('Preview')}</span>
              <span className="text-slate-500 truncate" data-preview-stock>{tr(stockFor(settings).label)}</span>
            </div>
            {labels.length === 0 && (
              <p className="px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900" data-preview-sample>
                {tr('Sample label — add items on the left to see yours, exactly as they will print.')}
              </p>
            )}
            <LabelPreview labels={labels.length ? labels : sampleLabels} settings={settings} shopName={shopName} />
          </Card>
        </div>
      </div>

      {looseOpen && (
        <LoosePackModal
          products={products}
          onClose={() => setLooseOpen(false)}
          onAdd={(items) => {
            setLooseOpen(false);
            setQueue((prev) => {
              const byId = new Map(prev.map((q) => [q.id, q]));
              for (const it of items) {
                const had = byId.get(it.id);
                byId.set(it.id, had ? { ...had, copies: Math.min(999, had.copies + it.copies) } : it);
              }
              return Array.from(byId.values());
            });
          }}
        />
      )}
      {entryOpen && (
        <StockEntryModal
          categories={categories}
          onClose={() => { setEntryOpen(false); setDraftRows(stockEntryDraftCount()); }}
          onSaved={(res, printNow) => void handleStockSaved(res, printNow)}
        />
      )}
    </div>
  );
}
