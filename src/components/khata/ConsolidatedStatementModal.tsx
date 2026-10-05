'use client';

import { useState, useEffect, useRef } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Sale, Customer, Business } from '@/types';
import { formatINR, generateUPILink } from '@/lib/utils';
import QRCode from 'qrcode';
import { Printer, Download, FileText, CheckCircle2, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import { ConsolidatedStatementA4 } from '@/components/khata/ConsolidatedStatementA4';

interface ConsolidatedStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSales: Sale[];
  customer: Customer;
  business?: Business | null;
}

export function ConsolidatedStatementModal({
  isOpen,
  onClose,
  selectedSales,
  customer,
  business,
}: ConsolidatedStatementModalProps) {
  const [format, setFormat] = useState<'a4' | 'thermal-80'>('a4');
  const [viewMode, setViewMode] = useState<'fit' | 'full'>('fit');
  const [scaleFactor, setScaleFactor] = useState<number>(1);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Aggregated totals
  const totalGrandTotalPaise = selectedSales.reduce((sum, s) => sum + (s.grand_total || 0), 0);
  const totalPaidPaise = selectedSales.reduce((sum, s) => sum + (s.amount_received || 0), 0);
  const totalDuePaise = selectedSales.reduce((sum, s) => sum + (s.balance_due || 0), 0);

  // Responsive scale factor calculation for mobile and desktop preview
  useEffect(() => {
    const calculateScale = () => {
      if (previewContainerRef.current) {
        const containerWidth = previewContainerRef.current.clientWidth - 24;
        const targetWidth = format === 'a4' ? 700 : 340;
        if (containerWidth > 0) {
          if (viewMode === 'fit') {
            const factor = containerWidth < targetWidth ? containerWidth / targetWidth : 1;
            setScaleFactor(factor);
          } else {
            setScaleFactor(1);
          }
        }
      }
    };

    calculateScale();
    const t1 = setTimeout(calculateScale, 60);
    const t2 = setTimeout(calculateScale, 200);
    window.addEventListener('resize', calculateScale);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', calculateScale);
    };
  }, [format, viewMode, isOpen]);

  // Generate UPI QR Code for the net balance due
  useEffect(() => {
    if (business?.upi_id && totalDuePaise > 0) {
      const upiUrl = generateUPILink(
        business.upi_id,
        business.name,
        totalDuePaise,
        `Stmt_${customer?.name?.replace(/\s+/g, '_') || 'Customer'}`
      );
      QRCode.toDataURL(upiUrl, {
        width: 180,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      }).then((url) => setQrDataUrl(url)).catch(() => setQrDataUrl(''));
    } else {
      setQrDataUrl('');
    }
  }, [business, totalDuePaise, customer]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  // High-Resolution PDF Download using unified generator
  const handleDownloadPdf = async () => {
    const el = document.getElementById('modal-consolidated-statement');
    if (!el) return;
    setIsGeneratingPdf(true);
    const prevMode = viewMode;
    const scrollContainer = previewContainerRef.current;

    try {
      if (prevMode !== 'full') {
        setViewMode('full');
      }
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
      await new Promise((r) => setTimeout(r, 60));
      const targetEl = document.getElementById('modal-consolidated-statement') || el;
      const fileName = `Statement_${customer?.name?.replace(/\s+/g, '_') || 'Customer'}_${Date.now()}.pdf`;
      const { downloadInvoicePdfFromElement } = await import('@/lib/invoices/pdfGenerator');
      await downloadInvoicePdfFromElement(targetEl, fileName);
      showToast(tr('✅ Statement PDF downloaded successfully!'));
    } catch (err: any) {
      console.error('PDF generation error:', err);
      showToast(tr('⚠️ Could not generate PDF directly. Please use Print button.'));
    } finally {
      if (prevMode !== 'full') {
        setViewMode(prevMode);
      }
      setIsGeneratingPdf(false);
    }
  };

  // Direct Browser Print via hidden iframe (No popup blockers)
  const handlePrint = () => {
    const el = document.getElementById('modal-consolidated-statement');
    if (!el) {
      window.print();
      return;
    }
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.right = '0';
    printFrame.style.bottom = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = '0';
    document.body.appendChild(printFrame);

    const isThermal = format === 'thermal-80';
    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Statement - ${customer.name}</title>
            <style>
              @page {
                size: ${isThermal ? '80mm auto' : 'A4 portrait'};
                margin: ${isThermal ? '2mm' : '10mm'};
              }
              body {
                font-family: ${isThermal ? 'monospace' : "'Mukta', 'Noto Sans Devanagari', 'Inter', system-ui, sans-serif"};
                margin: 0;
                padding: ${isThermal ? '2px' : '0'};
                background: #ffffff;
                color: #000000;
                font-size: ${isThermal ? '11px' : '12px'};
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              * { box-sizing: border-box; }
              table { width: 100%; border-collapse: collapse; }
              .text-right { text-align: right; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .font-black { font-weight: 900; }
            </style>
          </head>
          <body>
            ${el.outerHTML}
          </body>
        </html>
      `);
      doc.close();
      printFrame.contentWindow?.focus();
      setTimeout(() => {
        printFrame.contentWindow?.print();
        document.body.removeChild(printFrame);
      }, 350);
    }
  };


  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-amber-500" />
          <span>{tr('Consolidated Statement / Bill (')}{selectedSales.length} {tr('Invoices)')}</span>
        </div>
      }
      description={tr('Combined multi-invoice billing statement for {name}.', { name: customer?.name })}
      size="xl"
    >
      <div className="space-y-3.5 p-1">
        {/* Toast */}
        {toastMsg && (
          <div className="p-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </div>
        )}

        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 dark:bg-slate-800/70 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80">
          {/* Format Switcher */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
            <button
              type="button"
              onClick={() => setFormat('a4')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                format === 'a4'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tr('A4 Statement')}
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal-80')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                format === 'thermal-80'
                  ? 'bg-slate-900 text-white shadow-xs dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tr('80mm Thermal Receipt')}
            </button>
          </div>

          {/* Zoom View Mode */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'fit' ? 'full' : 'fit')}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs hover:bg-slate-50"
              title={viewMode === 'fit' ? tr('Zoom to 100%') : tr('Fit to screen')}
            >
              {viewMode === 'fit' ? <ZoomIn className="w-3.5 h-3.5 text-amber-600" /> : <ZoomOut className="w-3.5 h-3.5 text-amber-600" />}
              <span>{viewMode === 'fit' ? tr('Fit') : '100%'}</span>
            </button>

            {/* Action Buttons */}
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs gap-1.5 cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300" />
              <span>{tr('Print')}</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 font-bold text-xs gap-1.5 cursor-pointer shadow-2xs"
            >
              {isGeneratingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 text-sky-600" />}
              <span>{tr('Download PDF')}</span>
            </Button>

          </div>
        </div>

        {/* Scrollable Canvas Container with Zoom/Fit Transform */}
        <div
          ref={previewContainerRef}
          className="bg-slate-100 dark:bg-slate-950/80 p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-auto flex justify-center items-start min-h-[420px]"
        >
          <div
            style={{
              transform: viewMode === 'fit' && scaleFactor < 1 ? `scale(${scaleFactor})` : 'none',
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease',
              marginBottom: viewMode === 'fit' && scaleFactor < 1 ? `-${(1 - scaleFactor) * 100}%` : '0',
            }}
            className="flex justify-center w-full"
          >
            {format === 'a4' ? (
              /* ========================================================================= */
              /* A4 CONSOLIDATED STATEMENT INVOICE CANVAS */
              /* ========================================================================= */
              <ConsolidatedStatementA4
                {...{
                  selectedSales, customer, business, qrDataUrl, totalGrandTotalPaise, totalPaidPaise,
                  totalDuePaise,
                }}
              />
            ) : (
              /* ========================================================================= */
              /* 80MM THERMAL RECEIPT CANVAS */
              /* ========================================================================= */
              <div
                id="modal-consolidated-statement"
                data-format="thermal-80"
                className="bg-white p-4 text-slate-950 font-mono text-[11px] space-y-2.5 border border-slate-200 shadow-xl w-[320px] rounded-lg"
              >
                {/* Store Header */}
                <div className="text-center space-y-0.5 pb-2 border-b border-dashed border-slate-400">
                  <h2 className="font-black text-sm uppercase">{business?.name || tr('Retail Store')}</h2>
                  {business?.address && <p className="text-[10px] text-slate-600">{business.address}</p>}
                  {business?.phone && <p className="text-[10px] text-slate-600">{tr('Ph:')} {business.phone}</p>}
                  {business?.gstin && <p className="text-[10px] font-bold">GSTIN: {business.gstin}</p>}
                  <div className="font-black uppercase text-[11px] pt-1 text-slate-900">
                    {tr('CONSOLIDATED STATEMENT')}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} • {selectedSales.length} {tr('Bills')}
                  </div>
                </div>

                {/* Customer Details */}
                <div className="space-y-0.5 pb-2 border-b border-dashed border-slate-400 text-[11px]">
                  <div>{tr('Customer:')} <b className="text-slate-900">{customer.name}</b></div>
                  {customer.phone && <div>{tr('Phone:')} <span className="font-mono">{customer.phone}</span></div>}
                </div>

                {/* Invoices List */}
                <div className="space-y-1.5 pb-2 border-b border-dashed border-slate-400">
                  <div className="flex justify-between font-bold text-[10.5px] uppercase border-b border-slate-200 pb-0.5">
                    <span>{tr('Inv# / Date')}</span>
                    <span>{tr('Due (₹)')}</span>
                  </div>
                  {selectedSales.map((sale) => (
                    <div key={sale.id} className="text-[10.5px]">
                      <div className="flex justify-between font-bold">
                        <span>#{sale.invoice_number} ({new Date(sale.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})</span>
                        <span className="font-mono">{formatINR(sale.balance_due || 0)}</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 truncate">
                        {tr('Total:')} {formatINR(sale.grand_total)} {tr('| Paid:')} {formatINR(sale.amount_received || 0)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Summary Totals */}
                <div className="space-y-1 pb-2 border-b border-dashed border-slate-400 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('Total Invoiced:')}</span>
                    <span className="font-mono">{formatINR(totalGrandTotalPaise)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>{tr('Total Paid:')}</span>
                    <span className="font-mono">(-) {formatINR(totalPaidPaise)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-300">
                    <span>{tr('Net Balance Due:')}</span>
                    <span className="font-mono text-rose-600">{formatINR(totalDuePaise)}</span>
                  </div>
                </div>

                {/* QR Code in Thermal */}
                {qrDataUrl && (
                  <div className="text-center pt-1 flex flex-col items-center space-y-1">
                    <img src={qrDataUrl} alt="UPI QR" className="w-24 h-24 p-1 border border-slate-300" />
                    <div className="text-[10px] font-bold">{tr('Scan to Pay via UPI')}</div>
                    {business?.upi_id && <div className="text-[10.5px] font-mono text-slate-600">{business.upi_id}</div>}
                  </div>
                )}

                {/* Thermal Footer */}
                <div className="text-center text-[10.5px] text-slate-500 pt-1">
                  <div>{tr('Thank you for your business!')}</div>
                  <div>{tr('KamaiPlus POS')}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
