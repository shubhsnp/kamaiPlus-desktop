'use client';

import { formatINR } from '@/lib/utils';
import { numberToWordsINR } from '@/lib/invoices/gstCalculator';
import { QrCode, Landmark } from 'lucide-react';
import { tr } from '@/lib/i18n/core';
import type { Business, Customer, Sale } from '@/types';

export interface ConsolidatedStatementA4Props {
  selectedSales: Sale[];
  customer: Customer;
  business: Business | null | undefined;
  qrDataUrl: string;
  totalGrandTotalPaise: number;
  totalPaidPaise: number;
  totalDuePaise: number;
}

/**
 * The A4 page of the consolidated statement (v4.104.0, K-D23 — moved out of ConsolidatedStatementModal
 * unchanged): shop header, customer, the bills table, totals with UPI QR / bank, terms and signature.
 */
export function ConsolidatedStatementA4(props: ConsolidatedStatementA4Props) {
  const {
    selectedSales, customer, business, qrDataUrl, totalGrandTotalPaise, totalPaidPaise,
    totalDuePaise,
  } = props;
  return (
    <div
      id="modal-consolidated-statement"
      data-format="a4"
      className="bg-white text-slate-900 p-6 sm:p-8 rounded-xl shadow-xl border border-slate-200 w-full max-w-[720px] space-y-4"
    >
      {/* 1. Header Banner */}
      <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">
            {business?.name || tr('Retail Store')}
          </h1>
          {business?.tagline && (
            <p className="text-xs text-amber-300 font-medium italic">{business.tagline}</p>
          )}
          <div className="text-[11px] text-slate-300 space-y-0.5 pt-0.5">
            {business?.address && <div>{business.address}{business.pincode ? ` - ${business.pincode}` : ''}</div>}
            <div className="flex items-center gap-3 text-slate-300 flex-wrap">
              {business?.phone && <span>{tr('Ph:')} {business.phone}</span>}
              {business?.email && <span>{tr('Email:')} {business.email}</span>}
            </div>
            {business?.gstin && (
              <div className="text-amber-300 font-mono font-bold pt-0.5">
                GSTIN: {business.gstin}
              </div>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right self-stretch sm:self-auto bg-slate-800/80 p-2.5 rounded-lg border border-slate-700 text-xs">
          <div className="text-xs font-black uppercase tracking-wider text-amber-400">
            {tr('Consolidated Statement')}
          </div>
          <div className="text-white/80 text-[11px] mt-1">
            {tr('Date:')} <b className="text-white">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</b>
          </div>
          <div className="text-white/80 text-[11px]">
            {tr('Invoices Count:')} <b className="text-white">{selectedSales.length} {tr('Bills')}</b>
          </div>
        </div>
      </div>

      {/* 2. Customer Details Box */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start justify-between gap-3 text-xs">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
            {tr('Statement Billed To')}
          </div>
          <div className="text-sm font-black text-slate-900">{customer.name}</div>
          {customer.phone && (
            <div className="text-slate-600 font-mono text-[11px] mt-0.5">
              📱 +91 {customer.phone}
            </div>
          )}
          {customer.address && (
            <div className="text-slate-500 text-[11px] mt-0.5 max-w-sm">{customer.address}</div>
          )}
        </div>

        <div className="text-left sm:text-right space-y-1">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {tr('Payment Terms')}
          </div>
          <div className="font-bold text-slate-800 uppercase">{tr('Khata Credit Account')}</div>
          {customer.gstin && (
            <div className="font-mono text-[11px] font-bold text-slate-700">
              {tr('Customer GSTIN:')} {customer.gstin}
            </div>
          )}
        </div>
      </div>

      {/* 3. Invoices Breakdown Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
              <th className="py-2.5 px-3 w-8 text-center">#</th>
              <th className="py-2.5 px-3 w-24">{tr('Date')}</th>
              <th className="py-2.5 px-3 w-28">{tr('Invoice #')}</th>
              <th className="py-2.5 px-3">{tr('Items Purchased')}</th>
              <th className="py-2.5 px-3 text-right w-24">{tr('Bill Total')}</th>
              <th className="py-2.5 px-3 text-right w-20">{tr('Paid')}</th>
              <th className="py-2.5 px-3 text-right w-24 text-rose-600">{tr('Due (₹)')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {selectedSales.map((sale, idx) => {
              const itemsSummary = sale.items
                ? sale.items.map((i) => `${i.quantity}x ${i.product_name}`).join(', ')
                : '-';

              return (
                <tr key={sale.id} className="hover:bg-slate-50/60">
                  <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                  <td className="py-2 px-3 text-slate-600 font-medium whitespace-nowrap">
                    {new Date(sale.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="py-2 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                    #{sale.invoice_number}
                  </td>
                  <td className="py-2 px-3 text-slate-700 max-w-[220px] truncate" title={itemsSummary}>
                    {itemsSummary}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                    {formatINR(sale.grand_total)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-emerald-600 font-medium">
                    {formatINR(sale.amount_received || 0)}
                  </td>
                  <td className="py-2 px-3 text-right font-mono font-black text-rose-600">
                    {formatINR(sale.balance_due || 0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 4. Totals and Payment Summary Section */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
        {/* Left: UPI QR Box & Bank Details */}
        <div className="flex-1 space-y-2.5 w-full">
          {/* Amount in Words */}
          <div className="text-[11px] text-slate-600">
            <span className="font-bold text-slate-700">{tr('Amount in Words:')}</span>
            <div className="italic font-semibold text-slate-900">{numberToWordsINR(totalDuePaise)}</div>
          </div>

          {/* UPI QR Block */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="UPI QR" className="w-20 h-20 rounded-lg border bg-white p-1 shrink-0 shadow-2xs" />
            ) : (
              <div className="w-20 h-20 rounded-lg border bg-slate-200 flex items-center justify-center text-slate-400 text-[10px] text-center p-1">
                {tr('No UPI Configured')}
              </div>
            )}
            <div className="text-xs space-y-0.5">
              <div className="font-bold text-slate-900 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5 text-amber-600" />
                <span>{tr('Scan & Pay via UPI')}</span>
              </div>
              {business?.upi_id && <div className="text-[11px] font-mono text-slate-700 font-bold">{business.upi_id}</div>}
              <div className="text-[10px] text-slate-500 font-medium">{tr('GPay • PhonePe • Paytm • BHIM')}</div>
            </div>
          </div>

          {/* Bank Account Info */}
          {business?.bank_account_no && (
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-700 flex flex-wrap gap-x-3 gap-y-0.5 font-medium">
              <span className="font-bold text-slate-900 flex items-center gap-1">
                <Landmark className="w-3 h-3 text-slate-500" />
                <span>{tr('Bank:')}</span>
              </span>
              <span>{business.bank_name || '-'}</span>
              <span>A/C: <b className="font-mono">{business.bank_account_no}</b></span>
              <span>IFSC: <b className="font-mono">{business.bank_ifsc || '-'}</b></span>
            </div>
          )}
        </div>

        {/* Right: Net Summary Calculation Card */}
        <div className="w-full sm:w-64 space-y-2 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200 shrink-0">
          <div className="flex justify-between text-slate-600">
            <span>{tr('Total Invoiced:')}</span>
            <span className="font-mono font-bold text-slate-900">{formatINR(totalGrandTotalPaise)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 font-medium">
            <span>{tr('Total Received:')}</span>
            <span className="font-mono font-bold">(-) {formatINR(totalPaidPaise)}</span>
          </div>
          <div className="border-t border-slate-300 pt-2 flex justify-between items-baseline text-slate-900">
            <span className="font-bold text-rose-600">{tr('Net Balance Due:')}</span>
            <span className="font-mono text-lg font-black text-rose-600">{formatINR(totalDuePaise)}</span>
          </div>
        </div>
      </div>

      {/* 5. Terms & Signatory Footer */}
      <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-[10.5px] text-slate-500">
        <div className="space-y-0.5 text-center sm:text-left">
          <div>{tr('Thank you for your business! Please clear the pending balance at your earliest convenience.')}</div>
          <div className="text-slate-400">{tr('Generated via KamaiPlus Smart Billing System')}</div>
        </div>
        <div className="text-center sm:text-right shrink-0">
          <div className="h-8"></div>
          <div className="border-t border-slate-300 pt-1 font-bold text-slate-700">
            {tr('For')} {business?.name || tr('Retail Store')} {tr('(Authorized Signatory)')}
          </div>
        </div>
      </div>
    </div>
  );
}
