'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Printer, Settings2 } from 'lucide-react';
import { Product } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { ensureProductBarcode } from '@/lib/barcode/storeBarcodes';
import { getLabelSettings, LABEL_SETTINGS_EVENT, LabelSettings, stockFor } from '@/lib/labels/labelSettings';
import { printLabels } from '@/lib/labels/printLabels';
import { productLabelExtras } from '@/lib/labels/labelExtras';
import { LabelPreview } from '@/components/labels/LabelPreview';
import { LabelSetupPanel } from '@/components/labels/LabelSetupPanel';
import { tr } from '@/lib/i18n/core';

interface QuickBarcodePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  storeName?: string;
}

/**
 * Products → 🖨 on an item: its labels on this computer's label printer (v4.71.0 —
 * same engine, size and printer as Barcode Studio). An item without a barcode gets
 * its own store code saved first, so the label scans back to it.
 */
export const QuickBarcodePrintModal: React.FC<QuickBarcodePrintModalProps> = ({ isOpen, onClose, product, storeName = '' }) => {
  const [settings, setSettings] = useState<LabelSettings>(getLabelSettings);
  const [copies, setCopies] = useState<number>(() => getLabelSettings().copies);
  const [showSetup, setShowSetup] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [error, setError] = useState('');
  const [barcodeValue, setBarcodeValue] = useState('');

  useEffect(() => {
    const refresh = () => setSettings(getLabelSettings());
    window.addEventListener(LABEL_SETTINGS_EVENT, refresh);
    return () => window.removeEventListener(LABEL_SETTINGS_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (!isOpen || !product) return;
    let live = true;
    setError('');
    setBarcodeValue(product.barcode?.trim() || '');
    if (!product.barcode?.trim()) {
      ensureProductBarcode(product).then((code) => live && setBarcodeValue(code)).catch((err) => console.error('Barcode assign failed:', err));
    }
    return () => {
      live = false;
    };
  }, [isOpen, product]);

  const labels = useMemo(
    () => (product && barcodeValue ? Array.from({ length: copies }, () => ({ name: product.name, barcode: barcodeValue, pricePaise: product.selling_price, mrpPaise: product.mrp, ...productLabelExtras(product) })) : []),
    [product, barcodeValue, copies]
  );

  if (!isOpen || !product) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    setError('');
    try {
      const res = await printLabels(labels, settings, storeName);
      if (res.ok) onClose();
      else setError(tr('Could not print: {error}', { error: res.error || '' }));
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tr('1-Click Barcode Print')} size="md">
      <div className="space-y-3 text-xs">
        {labels.length > 0 && <LabelPreview labels={labels} settings={settings} shopName={storeName} max={4} />}

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-600">{tr('Copies')}</span>
          {[1, 5, 10, 20].map((num) => (
            <button key={num} type="button" onClick={() => setCopies(num)} className={`px-3 py-1 rounded-lg font-bold border cursor-pointer ${copies === num ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
              {num}
            </button>
          ))}
          <input type="number" min="1" max="500" value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(500, Number(e.target.value) || 1)))} className="w-16 h-7 px-2 rounded-lg border border-slate-300 font-mono" aria-label={tr('Copies')} />
        </div>

        <button type="button" onClick={() => setShowSetup(!showSetup)} className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
          <span className="flex items-center gap-1.5 font-bold text-slate-700"><Settings2 className="w-3.5 h-3.5" /> {tr(stockFor(settings).label)}</span>
          <span className="text-slate-500">{settings.printer || tr('print dialog')} · {showSetup ? tr('Hide') : tr('Change')}</span>
        </button>
        {showSetup && <LabelSetupPanel shopName={storeName} />}

        {error && <p className="text-rose-700 font-bold">{error}</p>}

        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <Button variant="outline" onClick={onClose} className="flex-1 py-2 text-xs font-bold">{tr('Cancel')}</Button>
          <Button onClick={handlePrint} disabled={isPrinting || !barcodeValue} className="flex-1 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5">
            <Printer className="w-3.5 h-3.5" />
            <span>{tr('Print')} {copies} {copies === 1 ? tr('Label') : tr('Labels')}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
