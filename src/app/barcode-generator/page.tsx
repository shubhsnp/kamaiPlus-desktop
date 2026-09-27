'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Barcode, Bluetooth, CheckCircle2, ChevronDown, ChevronUp, Printer, Settings2, XCircle } from 'lucide-react';
import { db } from '@/lib/db';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Product } from '@/types';
import { formatINR } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { bluetoothPrinter } from '@/lib/hardware/bluetoothPrinter';
import { EscPosEncoder } from '@/lib/hardware/escpos';
import { ensureProductBarcodes } from '@/lib/barcode/storeBarcodes';
import { getLabelSettings, getLastImportIds, LABEL_SETTINGS_EVENT, LabelSettings } from '@/lib/labels/labelSettings';
import { expandCopies, printLabels } from '@/lib/labels/printLabels';
import { LabelSetupPanel } from '@/components/labels/LabelSetupPanel';
import { LabelPreview } from '@/components/labels/LabelPreview';
import { LabelQueuePanel, QueueItem } from '@/components/labels/LabelQueuePanel';
import { CustomLabelModal } from '@/components/labels/CustomLabelModal';
import { tr } from '@/lib/i18n/core';

/**
 * Barcode Studio (v4.71.0): pick items (one, a category, all, or the last Excel
 * import), set copies, print on this computer's label printer. Every catalogue item
 * gets a saved barcode before its label prints, so each label scans at the counter.
 * Label size / printer live in LabelSetupPanel (also in Settings → Invoice & Bill Rules).
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
  const [customOpen, setCustomOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(() => !getLabelSettings().printer);
  const [lastImportIds, setLastImportIds] = useState<string[]>([]);

  useEffect(() => {
    const refresh = () => setSettings(getLabelSettings());
    window.addEventListener(LABEL_SETTINGS_EVENT, refresh);
    setLastImportIds(getLastImportIds());
    return () => window.removeEventListener(LABEL_SETTINGS_EVENT, refresh);
  }, []);

  /** Adds items with their saved barcodes (items without one get a store code now). */
  const addProducts = async (list: Product[]) => {
    if (list.length === 0) return;
    setBusy(true);
    try {
      const codes = await ensureProductBarcodes(list);
      setQueue((prev) => {
        const byId = new Map(prev.map((q) => [q.id, q]));
        for (const p of list) {
          const had = byId.get(p.id);
          byId.set(p.id, had
            ? { ...had, copies: had.copies + settings.copies }
            : { id: p.id, name: p.name, barcode: codes.get(p.id) || '', pricePaise: p.selling_price, mrpPaise: p.mrp, copies: settings.copies, stock: p.is_unlimited_stock ? null : p.current_stock });
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

  const labels = useMemo(() => expandCopies(queue), [queue]);

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
        enc.textLine(`MRP: ${formatINR(l.mrpPaise || l.pricePaise)} | PRICE: ${formatINR(l.pricePaise)}`);
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
            <span>{tr('Print {count} labels', { count: labels.length })}</span>
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
              onCustom={() => setCustomOpen(true)}
              busy={busy}
            />
          </Card>
        </div>

        <div className="lg:col-span-7">
          <Card className="p-3 bg-white border border-slate-200 shadow-2xs">
            {labels.length === 0 ? (
              <div className="h-[62vh] flex items-center justify-center text-xs text-slate-400 text-center px-6">
                {tr('Add items on the left — the labels appear here exactly as they will print.')}
              </div>
            ) : (
              <LabelPreview labels={labels} settings={settings} shopName={shopName} />
            )}
          </Card>
        </div>
      </div>

      {customOpen && <CustomLabelModal defaultCopies={settings.copies} onClose={() => setCustomOpen(false)} onAdd={(item) => setQueue((q) => [...q, item])} />}
    </div>
  );
}
