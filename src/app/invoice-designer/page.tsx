'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2, Download, Eye, Palette, Printer, Save } from 'lucide-react';
import { db } from '@/lib/db';
import { InvoiceThemeConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { resolveInvoiceConfig, themeIdForColor } from '@/lib/invoices/themeDefaults';
import { buildInvoiceDocument, getPrimaryUpiVpa, InvoiceDocument } from '@/lib/invoices/invoiceDocument';
import { buildSampleSale, sampleBusiness } from '@/lib/invoices/sampleInvoice';
import { buildUpiQrDataUrl, renderInvoiceHtml } from '@/lib/invoices/invoiceOutput';
import { getBrandLogoDataUrl, saveHtmlAsPdf } from '@/lib/print/printDocument';
import { getDesktopApi, PaperFormat } from '@/lib/desktop/desktopBridge';
import { InvoicePreview } from '@/components/invoices/InvoicePreview';
import { DisplayOptionsSection, TermsFooterSection, ThemeColorSection } from '@/components/invoices/designer/DesignerSections';

/**
 * Invoice Themes & Design — desktop port of the Android InvoiceThemesScreen.
 * The live preview is the real invoice renderer, so what you see here is
 * exactly what prints and what the PDF contains.
 */
export default function InvoiceDesignerPage() {
  const business = useLiveQuery(async () => db.businesses.toCollection().first());
  const [config, setConfig] = useState<InvoiceThemeConfig | null>(null);
  const [format, setFormat] = useState<PaperFormat>('a4');
  const [doc, setDoc] = useState<InvoiceDocument | null>(null);
  const [brandLogo, setBrandLogo] = useState('');
  const [status, setStatus] = useState<{ tone: 'ok' | 'err'; text: string; path?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Load the saved settings once the store record is available.
  useEffect(() => {
    if (business && !config) setConfig(resolveInvoiceConfig(business));
  }, [business, config]);

  useEffect(() => {
    getBrandLogoDataUrl().then(setBrandLogo);
  }, []);

  const previewBusiness = useMemo(
    () => sampleBusiness(business ? { ...business, invoice_theme_config: config || undefined } : null),
    [business, config]
  );
  const previewSale = useMemo(() => buildSampleSale(business), [business]);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    const vpa = getPrimaryUpiVpa(previewBusiness);
    const effective = resolveInvoiceConfig(previewBusiness);
    buildUpiQrDataUrl(previewSale, previewBusiness, effective.show_upi_qr ? vpa : '').then((qr) => {
      if (cancelled) return;
      setDoc(buildInvoiceDocument(previewSale, previewBusiness, { config: effective, upiVpa: vpa, qrDataUrl: qr }));
    });
    return () => {
      cancelled = true;
    };
  }, [config, previewBusiness, previewSale]);

  const patch = (p: Partial<InvoiceThemeConfig>) => setConfig((prev) => (prev ? { ...prev, ...p } : prev));

  const persist = async () => {
    if (!business || !config) return false;
    const next: InvoiceThemeConfig = {
      ...config,
      theme_id: themeIdForColor(config.primary_color),
      custom_terms: (config.custom_terms || '').trim(),
      custom_footer: (config.custom_footer || '').trim(),
    };
    await db.businesses.update(business.id, {
      invoice_theme_config: next,
      terms_conditions: next.custom_terms,
      footer_message: next.custom_footer,
      drug_license_no: next.drug_license_no || business.drug_license_no,
      pharmacist_reg_no: next.pharmacist_reg_no || business.pharmacist_reg_no,
      updated_at: new Date().toISOString(),
    });
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (await persist()) setStatus({ tone: 'ok', text: 'Invoice theme & options saved. Every new print and PDF uses them.' });
    } catch (err) {
      console.error('Failed to save invoice theme:', err);
      setStatus({ tone: 'err', text: 'Could not save the invoice settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleSamplePdf = async () => {
    if (!config) return;
    setExporting(true);
    try {
      await persist();
      const html = await renderInvoiceHtml(
        { sale: previewSale, business: { ...previewBusiness, invoice_theme_config: config } },
        'a4'
      );
      const res = await saveHtmlAsPdf(html, 'Sample_Invoice_Template.pdf', 'Invoices');
      if (res.ok) setStatus({ tone: 'ok', text: res.path ? 'Sample invoice PDF saved.' : 'Choose "Save as PDF" in the print dialog.', path: res.path });
      else setStatus({ tone: 'err', text: res.error || 'Could not create the sample PDF.' });
    } finally {
      setExporting(false);
    }
  };

  const desktop = getDesktopApi();

  return (
    <div className="space-y-4 pb-10">
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-700" /> Invoice Themes &amp; Design
          </h1>
          <p className="text-xs text-slate-500">Custom PDF styling, A4 &amp; 80mm/58mm thermal bills — the preview is the real bill.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href="/settings?tab=invoice">
            <Button variant="outline" size="sm">
              <Printer className="w-3.5 h-3.5" /> Printer Setup
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={handleSamplePdf} isLoading={exporting} disabled={!config}>
            <Download className="w-3.5 h-3.5" /> Sample PDF
          </Button>
          <Button size="sm" onClick={handleSave} isLoading={saving} disabled={!config}>
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      {status && (
        <div
          className={cn(
            'p-2.5 rounded-xl text-xs font-bold border flex flex-wrap items-center gap-2',
            status.tone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="flex-1">{status.text}</span>
          {status.path && desktop && (
            <button type="button" onClick={() => desktop.openPath(status.path!)} className="px-2 py-1 rounded-lg bg-white border border-emerald-300 cursor-pointer">
              Open PDF
            </button>
          )}
        </div>
      )}

      {!config ? (
        <div className="p-10 text-center text-sm text-slate-500">Loading store profile…</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
          <div className="xl:col-span-5 space-y-3.5">
            <ThemeColorSection config={config} onChange={patch} />
            <DisplayOptionsSection config={config} onChange={patch} />
            <TermsFooterSection config={config} onChange={patch} />
          </div>

          <div className="xl:col-span-7 xl:sticky xl:top-20 space-y-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                <Eye className="w-4 h-4 text-slate-700" /> 4. Live Interactive Preview
              </div>
              <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
                {(['a4', 'thermal-80', 'thermal-58'] as PaperFormat[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer',
                      format === f ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
                    )}
                  >
                    {f === 'a4' ? 'A4' : f === 'thermal-80' ? '80mm' : '58mm'}
                  </button>
                ))}
              </div>
            </div>
            <InvoicePreview
              doc={doc}
              sale={previewSale}
              business={previewBusiness}
              format={format}
              brandLogoUrl={brandLogo}
              className="max-h-[calc(100vh-190px)]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
