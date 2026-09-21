'use client';

import { Business, Sale } from '@/types';
import { formatINR } from '@/lib/utils';
import { saveHtmlAsPdf, safeFileName } from '@/lib/print/printDocument';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

interface BulkInvoiceReportOptions {
  sales: Sale[];
  business: Business;
  dateRangeLabel?: string;
  customerName?: string;
}

export async function generateBulkInvoicesPDF({
  sales,
  business,
  dateRangeLabel = 'All Dates',
  customerName,
}: BulkInvoiceReportOptions): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!sales || sales.length === 0) {
    return { ok: false, error: 'No invoices selected to download.' };
  }

  const storeName = business.name || 'Kamai+ Store';
  const storePhone = business.phone ? `Ph: ${business.phone}` : '';
  const storeGst = business.gstin ? `GSTIN: ${business.gstin}` : '';
  const storeAddress = business.address || '';

  const totalAmountPaise = sales.reduce((acc, s) => acc + (s.grand_total || 0), 0);

  // Generate multi-page continuous invoices HTML
  const invoicesHtml = sales
    .map((sale, idx) => {
      const isCredit = sale.payment_method === 'credit' || (sale.balance_due || 0) > 0;
      const formattedDate = formatDate(sale.created_at);

      const itemsRows = (sale.items || [])
        .map(
          (item, i) => `
          <tr>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px;">${i + 1}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: bold;">${item.product_name}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: center;">${item.quantity} ${item.unit || 'unit'}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-family: monospace;">₹${(item.unit_price / 100).toFixed(2)}</td>
            <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-size: 11px; text-align: right; font-family: monospace; font-weight: bold;">₹${((item.total_amount || (item.unit_price * item.quantity)) / 100).toFixed(2)}</td>
          </tr>
        `
        )
        .join('');

      return `
        <div class="invoice-container" style="page-break-after: always; padding: 24px; max-width: 800px; margin: 0 auto; background: #fff;">
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
            <div>
              <h1 style="font-size: 20px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">${storeName}</h1>
              <div style="font-size: 11px; color: #475569; margin-top: 2px;">${storeAddress}</div>
              <div style="font-size: 11px; color: #475569; font-weight: 600;">${storePhone} ${storeGst ? '• ' + storeGst : ''}</div>
            </div>
            <div style="text-align: right;">
              <span style="display: inline-block; padding: 3px 8px; background: #0f172a; color: #fff; font-size: 11px; font-weight: 800; border-radius: 4px; letter-spacing: 0.5px;">TAX INVOICE</span>
              <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 4px; font-family: monospace;">#${sale.invoice_number}</div>
              <div style="font-size: 11px; color: #64748b;">${formattedDate}</div>
            </div>
          </div>

          <!-- Billed To & Payment Status -->
          <div style="display: flex; justify-content: space-between; background: #f8fafc; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; border: 1px solid #e2e8f0;">
            <div>
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Customer Details</div>
              <div style="font-size: 12px; font-weight: bold; color: #0f172a;">${sale.customer_name || 'Cash Customer'}</div>
              ${sale.customer_phone ? `<div style="font-size: 11px; color: #475569;">+91 ${sale.customer_phone}</div>` : ''}
            </div>
            <div style="text-align: right;">
              <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase;">Payment Status</div>
              <div style="font-size: 12px; font-weight: bold; color: ${isCredit ? '#b91c1c' : '#047857'};">
                ${isCredit ? 'CREDIT / UDHAR' : sale.payment_method.toUpperCase()}
              </div>
              <div style="font-size: 11px; color: #64748b;">Invoice ${idx + 1} of ${sales.length}</div>
            </div>
          </div>

          <!-- Items Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: left;">
                <th style="padding: 6px 8px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">#</th>
                <th style="padding: 6px 8px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase;">Item Description</th>
                <th style="padding: 6px 8px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; text-align: center;">Qty</th>
                <th style="padding: 6px 8px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; text-align: right;">Rate (₹)</th>
                <th style="padding: 6px 8px; font-size: 10px; font-weight: 800; color: #475569; text-transform: uppercase; text-align: right;">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsRows}
            </tbody>
          </table>

          <!-- Totals Calculation -->
          <div style="display: flex; justify-content: flex-end;">
            <div style="width: 240px; border-top: 1px solid #cbd5e1; padding-top: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px; color: #475569; margin-bottom: 4px;">
                <span>Subtotal:</span>
                <span style="font-family: monospace;">₹${((sale.subtotal || sale.grand_total) / 100).toFixed(2)}</span>
              </div>
              ${(sale.discount_total || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #047857; margin-bottom: 4px;">
                  <span>Discount:</span>
                  <span style="font-family: monospace;">-₹${(sale.discount_total / 100).toFixed(2)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 900; color: #0f172a; border-top: 2px solid #0f172a; padding-top: 4px;">
                <span>Grand Total:</span>
                <span style="font-family: monospace;">₹${(sale.grand_total / 100).toFixed(2)}</span>
              </div>
              ${(sale.balance_due || 0) > 0 ? `
                <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #b91c1c; margin-top: 4px;">
                  <span>Balance Due:</span>
                  <span style="font-family: monospace;">₹${(sale.balance_due / 100).toFixed(2)}</span>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Footer Tagline -->
          <div style="margin-top: 24px; padding-top: 10px; border-top: 1px dashed #cbd5e1; text-align: center; font-size: 10px; color: #64748b;">
            ${business.footer_message || 'Thank You! Visit Again.'} • Generated by KamaiPlus POS
          </div>
        </div>
      `;
    })
    .join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Bulk Invoices - ${customerName || dateRangeLabel}</title>
      <style>
        @page {
          size: A4;
          margin: 10mm;
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background: #f8fafc;
          color: #0f172a;
        }
        @media print {
          body {
            background: #fff;
          }
          .invoice-container {
            page-break-after: always;
            box-shadow: none !important;
            border: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${invoicesHtml}
    </body>
    </html>
  `;

  const safeCustomer = customerName ? safeFileName(customerName, 'Customer') : 'All';
  const fileName = `Invoices_${safeCustomer}_${safeFileName(dateRangeLabel, 'Period')}_${Date.now()}.pdf`;

  const res = await saveHtmlAsPdf(fullHtml, fileName, 'Invoices');
  return { ok: res.ok, path: res.path, error: res.error };
}
