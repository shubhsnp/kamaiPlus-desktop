'use client';

import { Business, Customer } from '@/types';
import { formatINR } from '@/lib/utils';
import { saveHtmlAsPdf, safeFileName } from '@/lib/print/printDocument';

const formatDate = (dateStr: string) => {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

interface BulkMonthEndStatementOptions {
  customers: Customer[];
  business: Business;
  periodLabel?: string;
}

export async function generateBulkMonthEndStatementPDF({
  customers,
  business,
  periodLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
}: BulkMonthEndStatementOptions): Promise<{ ok: boolean; path?: string; error?: string }> {
  if (!customers || customers.length === 0) {
    return { ok: false, error: 'No customers found to generate statement.' };
  }

  const storeName = business.name || 'Kamai+ Store';
  const storePhone = business.phone ? `Ph: ${business.phone}` : '';
  const storeGst = business.gstin ? `GSTIN: ${business.gstin}` : '';
  const storeAddress = business.address || '';
  const storeFooter = business.footer_message || 'Thank You! Visit Again.';

  // Filter & sort parties with outstanding balances
  const udharParties = customers
    .filter((c) => (c.current_balance || 0) > 0)
    .sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));

  const advanceParties = customers
    .filter((c) => (c.current_balance || 0) < 0)
    .sort((a, b) => (a.current_balance || 0) - (b.current_balance || 0));

  const settledParties = customers.filter((c) => (c.current_balance || 0) === 0);

  const totalUdharPaise = udharParties.reduce((sum, c) => sum + (c.current_balance || 0), 0);
  const totalAdvancePaise = advanceParties.reduce((sum, c) => sum + Math.abs(c.current_balance || 0), 0);

  const rowsHtml = udharParties
    .map(
      (c, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-weight: bold; color: #0f172a;">${c.name}</td>
        <td style="padding: 6px 8px; font-family: monospace; color: #475569;">${c.phone ? '+91 ' + c.phone : '—'}</td>
        <td style="padding: 6px 8px; color: #475569;">${c.address || '—'}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #fee2e2; color: #991b1b; font-weight: bold; font-size: 10px;">
            UDHAR DUE
          </span>
        </td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #b91c1c; font-size: 12px;">
          ${formatINR(c.current_balance || 0)}
        </td>
      </tr>
    `
    )
    .join('');

  const advanceRowsHtml = advanceParties
    .map(
      (c, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center; color: #64748b;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-weight: bold; color: #0f172a;">${c.name}</td>
        <td style="padding: 6px 8px; font-family: monospace; color: #475569;">${c.phone ? '+91 ' + c.phone : '—'}</td>
        <td style="padding: 6px 8px; color: #475569;">${c.address || '—'}</td>
        <td style="padding: 6px 8px; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: #d1fae5; color: #065f46; font-weight: bold; font-size: 10px;">
            ADVANCE PAID
          </span>
        </td>
        <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: 900; color: #047857; font-size: 12px;">
          ${formatINR(Math.abs(c.current_balance || 0))}
        </td>
      </tr>
    `
    )
    .join('');

  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Month-End Khata Statement - ${periodLabel}</title>
      <style>
        @page {
          size: A4;
          margin: 12mm;
        }
        body {
          font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #0f172a;
        }
        .statement-card {
          max-width: 820px;
          margin: 0 auto;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          margin-bottom: 20px;
        }
        th {
          background: #f1f5f9;
          font-size: 10.5px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          padding: 7px 8px;
          border-bottom: 2px solid #cbd5e1;
        }
      </style>
    </head>
    <body>
      <div class="statement-card">
        <!-- Store Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 14px;">
          <div>
            <h1 style="font-size: 22px; font-weight: 900; margin: 0; color: #0f172a; text-transform: uppercase;">${storeName}</h1>
            <div style="font-size: 11px; color: #475569; margin-top: 2px;">${storeAddress}</div>
            <div style="font-size: 11px; color: #475569; font-weight: 600;">${storePhone} ${storeGst ? '• ' + storeGst : ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="display: inline-block; padding: 4px 10px; background: #0f172a; color: #fff; font-size: 11px; font-weight: 800; border-radius: 4px;">
              CONSOLIDATED KHATA STATEMENT
            </div>
            <div style="font-size: 13px; font-weight: 900; color: #0f172a; margin-top: 5px;">Period: ${periodLabel}</div>
            <div style="font-size: 11px; color: #64748b;">Generated: ${formatDate(new Date().toISOString())}</div>
          </div>
        </div>

        <!-- Ledger Summary KPI Tiles -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 10px 14px;">
            <div style="font-size: 10.5px; font-weight: 800; color: #991b1b; text-transform: uppercase;">Total Udhar Due (Receivable)</div>
            <div style="font-size: 18px; font-weight: 900; color: #b91c1c; font-family: monospace; margin-top: 2px;">
              ${formatINR(totalUdharPaise)}
            </div>
            <div style="font-size: 10px; color: #7f1d1d; margin-top: 2px;">${udharParties.length} Customer Accounts Pending</div>
          </div>

          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 10px 14px;">
            <div style="font-size: 10.5px; font-weight: 800; color: #065f46; text-transform: uppercase;">Total Advance Balance</div>
            <div style="font-size: 18px; font-weight: 900; color: #047857; font-family: monospace; margin-top: 2px;">
              ${formatINR(totalAdvancePaise)}
            </div>
            <div style="font-size: 10px; color: #064e3b; margin-top: 2px;">${advanceParties.length} Parties in Credit Advance</div>
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px;">
            <div style="font-size: 10.5px; font-weight: 800; color: #475569; text-transform: uppercase;">Total Registered Parties</div>
            <div style="font-size: 18px; font-weight: 900; color: #0f172a; font-family: monospace; margin-top: 2px;">
              ${customers.length} Accounts
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${settledParties.length} Fully Settled (₹0.00)</div>
          </div>
        </div>

        <!-- Udhar Parties Table -->
        <h3 style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 12px 0 4px 0; display: flex; align-items: center; justify-content: space-between;">
          <span>Outstanding Udhar Customer Accounts (${udharParties.length})</span>
          <span style="font-size: 11px; color: #b91c1c;">Total Due: ${formatINR(totalUdharPaise)}</span>
        </h3>

        ${udharParties.length > 0 ? `
          <table>
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th style="text-align: left;">Customer Name</th>
                <th style="text-align: left;">Contact Phone</th>
                <th style="text-align: left;">Address / Area</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Pending Udhar (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        ` : `
          <div style="padding: 16px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px;">
            🎉 Nil Udhar! All customer accounts are fully settled.
          </div>
        `}

        ${advanceParties.length > 0 ? `
          <h3 style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase; margin: 16px 0 4px 0; display: flex; align-items: center; justify-content: space-between;">
            <span>Advance Deposit Parties (${advanceParties.length})</span>
            <span style="font-size: 11px; color: #047857;">Total Advance: ${formatINR(totalAdvancePaise)}</span>
          </h3>
          <table>
            <thead>
              <tr>
                <th style="width: 32px; text-align: center;">#</th>
                <th style="text-align: left;">Customer Name</th>
                <th style="text-align: left;">Contact Phone</th>
                <th style="text-align: left;">Address / Area</th>
                <th style="text-align: center;">Status</th>
                <th style="text-align: right;">Advance Balance (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${advanceRowsHtml}
            </tbody>
          </table>
        ` : ''}

        <!-- Signatory & Footer -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 36px; padding-top: 14px; border-top: 1px solid #e2e8f0;">
          <div style="font-size: 10px; color: #64748b;">
            <div>${storeFooter}</div>
            <div style="margin-top: 2px;">Official Merchant Financial Statement • Powered by KamaiPlus</div>
          </div>
          <div style="text-align: center; width: 180px;">
            <div style="border-bottom: 1px solid #0f172a; height: 35px; margin-bottom: 4px;"></div>
            <div style="font-size: 10.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">Authorized Signatory</div>
            <div style="font-size: 9.5px; color: #64748b;">${storeName}</div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const fileName = `Khata_Month_End_Statement_${safeFileName(periodLabel, 'Month')}_${Date.now()}.pdf`;
  const res = await saveHtmlAsPdf(fullHtml, fileName, 'Statements');
  return { ok: res.ok, path: res.path, error: res.error };
}
