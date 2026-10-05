'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { decodeInvoicePayload, SharedInvoicePayload } from '@/lib/invoices/whatsappInvoice';
import { formatINR, generateUPILink } from '@/lib/utils';
import QRCode from 'qrcode';
import { Printer, Share2, ShieldCheck, Download, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SharedInvoiceSheet } from '@/components/invoices/SharedInvoiceSheet';


function InvoiceContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SharedInvoicePayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'fit' | 'full'>('fit');
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const [scaleFactor, setScaleFactor] = useState<number>(1);

  useEffect(() => {
    const calculateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 16;
        const targetWidth = 720;
        if (containerWidth < targetWidth && viewMode === 'fit') {
          setScaleFactor(Math.max(0.42, containerWidth / targetWidth));
        } else {
          setScaleFactor(1);
        }
      }
    };

    calculateScale();
    window.addEventListener('resize', calculateScale);
    return () => window.removeEventListener('resize', calculateScale);
  }, [viewMode, data]);

  useEffect(() => {
    const encoded = searchParams.get('d');
    const saleId = searchParams.get('id');

    if (encoded) {
      const decoded = decodeInvoicePayload(encoded);
      if (decoded) {
        setData(decoded);
        setLoading(false);
        return;
      }
    }

    if (saleId) {
      db.sales.get(saleId).then(async (sale) => {
        if (sale) {
          const biz = await db.businesses.get(sale.business_id) || await db.businesses.toCollection().first();
          if (biz) {
            setData({
              b_name: biz.name,
              b_tagline: biz.tagline,
              b_logo: biz.logo_url,
              b_owner: biz.owner_name,
              b_phone: biz.phone,
              b_email: biz.email,
              b_address: biz.address,
              b_gstin: biz.gstin,
              b_upi: biz.upi_id,
              b_terms: biz.terms_conditions,
              s_inv: sale.invoice_number,
              s_date: sale.created_at,
              s_cust: sale.customer_name,
              s_phone: sale.customer_phone,
              s_subtotal: sale.subtotal,
              s_discount: sale.discount_total,
              s_tax: sale.tax_total,
              s_total: sale.grand_total,
              s_received: sale.amount_received,
              s_balance: sale.balance_due,
              s_method: sale.payment_method,
              s_status: sale.payment_status,
              items: sale.items.map((i) => ({
                name: i.product_name,
                qty: i.quantity,
                unit: i.unit,
                price: i.unit_price,
                tax: i.tax_rate,
                discount: i.discount_amount,
                total: i.total_amount,
              })),
            });
          }
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (data?.b_upi) {
      const upiUrl = generateUPILink(
        data.b_upi,
        data.b_name,
        data.s_balance > 0 ? data.s_balance : data.s_total,
        data.s_inv
      );

      QRCode.toDataURL(upiUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setQrDataUrl)
        .catch(() => setQrDataUrl(''));
    }
  }, [data]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('printable-invoice-container');
    if (!el || !data) return;
    setIsGeneratingPdf(true);
    try {
      const fileName = data.s_inv.endsWith('.pdf') ? data.s_inv : `Invoice_${data.s_inv}.pdf`;
      const { downloadInvoicePdfFromElement } = await import('@/lib/invoices/pdfGenerator');
      await downloadInvoicePdfFromElement(el, fileName);
    } catch (err) {
      console.error('PDF generation failed:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Tax Invoice #${data?.s_inv} from ${data?.b_name}`,
        text: `Invoice #${data?.s_inv} from ${data?.b_name} for ${data ? formatINR(data.s_total) : ''}`,
        url: window.location.href,
      }).catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-xs font-semibold text-slate-500">Loading digital invoice...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 text-center">
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-sm w-full space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h2 className="text-sm font-bold text-slate-900">Invoice Not Found</h2>
          <p className="text-xs text-slate-500">The invoice link might be incomplete or expired.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 flex flex-col items-center">
      {/* Top Action Bar (hidden in print) */}
      <div className="w-full max-w-2xl mb-4 flex items-center justify-between no-print gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1 text-xs font-bold transition-all"
            title="Go to Dashboard / App Home"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Home</span>
          </Link>
          <span className="text-xs font-bold text-slate-900 truncate max-w-[150px] sm:max-w-none">{data.b_name}</span>
          <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium border border-slate-200">
            <ShieldCheck className="w-3 h-3 text-slate-600" />
            <span>Digital Bill</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Responsive Zoom View Mode Pill */}
          <div className="flex items-center p-0.5 bg-slate-200/80 rounded-lg text-xs">
            <button
              type="button"
              onClick={() => setViewMode('fit')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'fit' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Fit to mobile screen width"
            >
              📱 Fit
            </button>
            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={`px-2 py-1 rounded-md text-xs font-bold transition cursor-pointer ${
                viewMode === 'full' ? 'bg-white text-slate-950 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Actual 100% resolution"
            >
              🔍 100%
            </button>
          </div>

          <Button variant="outline" size="sm" onClick={handleShare} className="text-xs font-bold">
            <Share2 className="w-3.5 h-3.5 mr-1" />
            <span className="hidden sm:inline">Share</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="text-xs font-bold">
            <Download className="w-3.5 h-3.5 mr-1" />
            <span>{isGeneratingPdf ? 'PDF...' : 'PDF'}</span>
          </Button>
          <Button variant="primary" size="sm" onClick={handlePrint} className="text-xs font-bold">
            <Printer className="w-3.5 h-3.5 mr-1" />
            <span>Print</span>
          </Button>
        </div>
      </div>

      {/* Printable / Interactive Clean Corporate Invoice Sheet with Smooth Responsive Scaling */}
      <SharedInvoiceSheet {...{ data, qrDataUrl, viewMode, previewContainerRef, scaleFactor }} />
    </div>
  );
}

export default function SharedInvoicePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading invoice...</div>}>
      <InvoiceContent />
    </Suspense>
  );
}
