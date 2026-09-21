'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Business, Sale } from '@/types';
import type { InvoiceDocument } from '@/lib/invoices/invoiceDocument';
import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { A4TaxInvoice, A4_PREVIEW_GAP } from '@/components/invoices/print/A4TaxInvoice';
import { ThermalReceipt } from '@/components/invoices/print/ThermalReceipt';
import { A4_HEIGHT_PX, A4_WIDTH_PX } from '@/components/invoices/print/invoiceStyles';

interface InvoicePreviewProps {
  doc: InvoiceDocument | null;
  sale: Sale;
  business: Business;
  format: PaperFormat;
  brandLogoUrl?: string;
  className?: string;
}

/**
 * Shows the exact document that prints: the A4 pages scaled down to fit the
 * panel, or the thermal slip at its real width.
 */
export function InvoicePreview({ doc, sale, business, format, brandLogoUrl, className }: InvoicePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const available = el.clientWidth - 24;
      setScale(available > 0 ? Math.min(1, available / A4_WIDTH_PX) : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const pages = doc?.pages.length || 1;
  const a4Height = pages * A4_HEIGHT_PX + (pages - 1) * A4_PREVIEW_GAP;

  return (
    <div
      ref={hostRef}
      className={`bg-slate-100/80 rounded-2xl border border-slate-200 p-3 overflow-auto flex justify-center ${className || ''}`}
    >
      {!doc ? (
        <div className="py-16 text-xs font-semibold text-slate-400">Preparing invoice…</div>
      ) : format === 'a4' ? (
        <div style={{ width: A4_WIDTH_PX * scale, height: a4Height * scale, flexShrink: 0 }}>
          <div style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            <A4TaxInvoice doc={doc} brandLogoUrl={brandLogoUrl} preview />
          </div>
        </div>
      ) : (
        <div className="shadow-md bg-white self-start">
          <ThermalReceipt doc={doc} sale={sale} business={business} width={format === 'thermal-80' ? 80 : 58} />
        </div>
      )}
    </div>
  );
}
