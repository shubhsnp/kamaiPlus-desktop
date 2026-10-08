'use client';

import React from 'react';
import { formatINR } from '@/lib/utils';
import type { SharedInvoicePayload } from '@/lib/invoices/whatsappInvoice';

export interface SharedInvoiceSheetProps {
  data: SharedInvoicePayload;
  qrDataUrl: string;
  viewMode: "fit" | "full";
  previewContainerRef: React.RefObject<HTMLDivElement>;
  scaleFactor: number;
}

/**
 * The bill a customer opens from the WhatsApp link (v4.104.0, K-D23 — moved out of app/invoice/page.tsx
 * unchanged): the printable sheet, fitted to the screen or full size.
 */
export function SharedInvoiceSheet(props: SharedInvoiceSheetProps) {
  const {
    data, qrDataUrl, viewMode, previewContainerRef, scaleFactor,
  } = props;
  return (
    <div 
      ref={previewContainerRef}
      className="w-full max-w-3xl flex flex-col items-center overflow-x-auto"
    >
      <div
        style={
          scaleFactor < 1 && viewMode === 'fit'
            ? {
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'top center',
                width: '740px',
                marginBottom: `-${Math.round((1 - scaleFactor) * 850)}px`,
              }
            : {
                width: '100%',
              }
        }
        className="transition-all duration-150 flex justify-center w-full"
      >
        <div 
          id="printable-invoice-container"
          data-format="a4"
          className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl p-6 sm:p-10 space-y-6 shadow-sm text-slate-900 border-t-8 border-t-slate-900 font-sans"
        >
      {/* Invoice Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between pb-6 border-b border-slate-200 gap-6">
        <div className="flex items-start gap-4">
          {data.b_logo ? (
            <img
              src={data.b_logo}
              alt={data.b_name}
              className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white flex-shrink-0"
            />
          ) : (
            <img
              src="/logo.png"
              alt={data.b_name}
              className="w-16 h-16 object-contain rounded-xl border border-slate-200 p-1 bg-white flex-shrink-0"
            />
          )}
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-slate-950 tracking-tight">
              {data.b_name}
            </h1>
            {data.b_tagline && (
              <p className="text-xs font-semibold text-slate-500 italic">{data.b_tagline}</p>
            )}
            {data.b_address && (
              <p className="text-xs text-slate-600 leading-snug max-w-sm">{data.b_address}</p>
            )}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-slate-600">
              {data.b_phone && <span className="font-mono"><strong>Ph:</strong> {data.b_phone}</span>}
            </div>
            {data.b_gstin && data.b_gstin.trim().length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-900 text-xs font-mono font-bold mt-1">
                <span className="text-slate-500 font-sans text-[10px] uppercase font-bold">GSTIN:</span>
                <span>{data.b_gstin}</span>
              </div>
            )}
          </div>
        </div>

        <div className="sm:text-right space-y-2 flex-shrink-0 w-full sm:w-auto bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl border sm:border-0 border-slate-200">
          <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white text-xs font-black uppercase tracking-wider">
            Tax Invoice
          </div>
          <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
            Original for Recipient
          </div>
          <div className="space-y-0.5 text-xs pt-1">
            <div className="text-slate-950 font-bold">
              <span className="text-slate-500 font-medium">Invoice No: </span>
              <span className="font-mono font-black text-sm">#{data.s_inv}</span>
            </div>
            <div className="text-slate-600">
              <span className="text-slate-500">Date: </span>
              <span className="font-semibold">{new Date(data.s_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
            <div className="text-slate-600">
              <span className="text-slate-500">Payment: </span>
              <span className="font-bold uppercase text-slate-900">{data.s_method}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Billed To Customer Card */}
      <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Billed To:</span>
          <div className="font-black text-sm text-slate-950">{data.s_cust || 'Cash Customer'}</div>
          {data.s_phone && <div className="text-slate-600 font-mono">Phone: {data.s_phone}</div>}
        </div>
        <div className="sm:text-right space-y-1 sm:border-l sm:border-slate-200 sm:pl-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Payment Status:</span>
          <div className="pt-0.5">
            <span className={`inline-block px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
              data.s_status === 'paid' 
                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' 
                : 'bg-amber-100 text-amber-950 border border-amber-300'
            }`}>
              {data.s_status === 'paid' ? 'Fully Paid' : 'Credit / Balance Due'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 pt-0.5">
            Place of Supply: <strong>27 - Maharashtra</strong>
          </div>
        </div>
      </div>

      {/* Itemized Table */}
      <div className="rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white font-bold text-[11px] uppercase tracking-wider">
              <th className="py-2.5 px-3 w-10 text-center">#</th>
              <th className="py-2.5 px-3">Item Description</th>
              <th className="py-2.5 px-3 text-right">Qty</th>
              <th className="py-2.5 px-3 text-right">Rate</th>
              <th className="py-2.5 px-3 text-right">Tax (GST)</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-slate-900">
            {data.items.map((item, idx) => (
              <tr key={idx} className="even:bg-slate-50/60 hover:bg-slate-50">
                <td className="py-3 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
                <td className="py-3 px-3 font-bold text-slate-950">
                  {item.name}
                </td>
                <td className="py-3 px-3 text-right font-semibold text-slate-700">
                  {item.qty} <span className="text-[10px] text-slate-500">{item.unit || 'pcs'}</span>
                </td>
                <td className="py-3 px-3 text-right text-slate-700 font-mono">
                  {formatINR(item.price)}
                </td>
                <td className="py-3 px-3 text-right text-slate-600 font-mono">
                  {item.tax > 0 ? `${item.tax}%` : '0%'}
                </td>
                <td className="py-3 px-3 text-right font-black text-slate-950 font-mono text-sm">
                  {formatINR(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Financial Summary Breakdown & Dynamic UPI QR */}
      <div className="pt-2 flex flex-col sm:flex-row justify-between gap-6 items-start">
        {/* Left: Dynamic QR & Terms */}
        <div className="flex-1 space-y-3.5 w-full">
          {qrDataUrl && (
            <div className="flex items-center gap-3.5 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <img src={qrDataUrl} alt="UPI QR" className="w-20 h-20 rounded-lg border border-slate-200 bg-white p-1 flex-shrink-0" />
              <div className="text-xs space-y-0.5 min-w-0">
                <div className="font-black text-slate-900">Scan & Pay with any UPI app</div>
                <div className="text-slate-600 font-mono text-[11px] font-bold truncate">{data.b_upi}</div>
                <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm, BHIM</div>
              </div>
            </div>
          )}

          {data.b_terms && (
            <div className="text-[10px] text-slate-500 space-y-0.5">
              <div className="font-bold uppercase tracking-wider text-slate-600">Terms & Conditions:</div>
              <p className="leading-snug">{data.b_terms}</p>
            </div>
          )}
        </div>

        {/* Right: Totals Column */}
        <div className="w-full sm:w-80 rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-xs flex-shrink-0">
          <div className="flex justify-between text-slate-600">
            <span>Taxable Subtotal:</span>
            <span className="font-mono font-bold text-slate-800">{formatINR(data.s_subtotal)}</span>
          </div>

          {data.s_tax > 0 && (
            <div className="flex justify-between text-slate-600 py-1 border-y border-slate-200/80 text-[11px]">
              <span>Total GST:</span>
              <span className="font-mono">{formatINR(data.s_tax)}</span>
            </div>
          )}

          {/* Grand Total Highlight Badge */}
          <div className="flex justify-between items-center p-3 rounded-lg bg-slate-900 text-white font-black text-sm my-2">
            <span className="uppercase tracking-wide text-xs">Grand Total:</span>
            <span className="font-mono text-lg text-amber-400">{formatINR(data.s_total)}</span>
          </div>

          <div className="flex justify-between text-slate-700 pt-1">
            <span>Amount Paid ({data.s_method.toUpperCase()}):</span>
            <span className="font-mono font-bold">{formatINR(data.s_received)}</span>
          </div>

          {data.s_balance > 0 && (
            <div className="flex justify-between items-center p-2 rounded bg-amber-100 border border-amber-300 font-bold text-amber-950 text-xs">
              <span>Credit / Balance Due:</span>
              <span className="font-mono font-black">{formatINR(data.s_balance)}</span>
            </div>
          )}

          {/* Signatory Box */}
          <div className="pt-6 text-center space-y-1">
            <div className="border-b border-dashed border-slate-400 w-36 mx-auto mb-1" />
            <div className="text-[10px] font-bold text-slate-900 uppercase">For {data.b_name}</div>
            <div className="text-[9px] text-slate-500">Authorised Signatory</div>
          </div>
        </div>
      </div>

      {/* Footer Seal & Signature */}
      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[10px] text-slate-500 gap-2">
        <div className="flex items-center gap-1.5">
          <img src="/logo.png" alt="KamaiPlus" className="w-3.5 h-3.5 object-contain" />
          <span>Generated via <strong>Kamai<span className="text-red-600">Plus</span></strong> • Aapki Dukaan Ka Digital Sathi • www.kamaiplus.com</span>
        </div>
        <div>Thank you for your visit!</div>
      </div>
    </div>
      </div>
    </div>
  );
}
