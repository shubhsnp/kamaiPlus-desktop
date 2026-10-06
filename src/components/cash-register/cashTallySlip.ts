import { formatINR } from '@/lib/utils';

export interface CashTallySlipParams {
  expectedDrawerCashPaise: number;
  totalCalculatedCashPaise: number;
  totalNotesCount: number;
  discrepancyPaise: number;
  denominations: { [key: number]: number };
  noteDenominations: number[];
}

export function generateCashTallyTextBreakdown(params: CashTallySlipParams): string {
  const { expectedDrawerCashPaise, totalCalculatedCashPaise, totalNotesCount, discrepancyPaise, denominations, noteDenominations } = params;
  const isExactMatch = discrepancyPaise === 0;
  const isExcess = discrepancyPaise > 0;

  let text = `CASH DRAWER TALLY\n`;
  text += `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
  text += `Expected: ${formatINR(expectedDrawerCashPaise)}\n`;
  text += `Counted: ${formatINR(totalCalculatedCashPaise)} (${totalNotesCount} Notes)\n`;
  text += `Diff: ${isExactMatch ? 'Exact Match (₹0)' : isExcess ? '+' + formatINR(discrepancyPaise) : formatINR(discrepancyPaise)}\n\n`;
  text += `DENOMINATIONS BREAKDOWN:\n`;

  let hasNotes = false;
  noteDenominations.forEach((denom) => {
    const count = denominations[denom] || 0;
    if (count > 0) {
      hasNotes = true;
      text += `₹${denom} × ${count} = ₹${denom * count}\n`;
    }
  });

  if (!hasNotes) {
    text += `No notes counted.\n`;
  }

  return text;
}

export function generateCashTallySlipHtml(params: CashTallySlipParams): string {
  const { expectedDrawerCashPaise, totalCalculatedCashPaise, totalNotesCount, discrepancyPaise, denominations, noteDenominations } = params;
  const isExactMatch = discrepancyPaise === 0;
  const isExcess = discrepancyPaise > 0;

  let rowsHtml = '';
  noteDenominations.forEach((denom) => {
    const count = denominations[denom] || 0;
    if (count > 0) {
      rowsHtml += `
        <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
          <span>₹${denom} × ${count}</span>
          <span>₹${denom * count}</span>
        </div>
      `;
    }
  });

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Cash Tally Slip</title>
      <style>
        @page { size: 58mm auto; margin: 0; }
        body { font-family: monospace; font-size: 11px; padding: 6px; margin: 0; width: 56mm; }
        .center { text-align: center; }
        .bold { font-weight: 800; }
        .rule { border-top: 1px dashed #000; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="center bold" style="font-size: 13px;">CASH TALLY SLIP</div>
      <div class="center" style="font-size: 10px;">${new Date().toLocaleString('en-IN')}</div>
      <div class="rule"></div>
      ${rowsHtml || '<div class="center">No notes counted</div>'}
      <div class="rule"></div>
      <div style="display:flex; justify-content:space-between;" class="bold">
        <span>Total Counted:</span>
        <span>₹${(totalCalculatedCashPaise / 100).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;">
        <span>Total Notes:</span>
        <span>${totalNotesCount}</span>
      </div>
      <div class="rule"></div>
      <div style="display:flex; justify-content:space-between;">
        <span>Expected:</span>
        <span>₹${(expectedDrawerCashPaise / 100).toFixed(2)}</span>
      </div>
      <div style="display:flex; justify-content:space-between;" class="bold">
        <span>Diff:</span>
        <span>${isExactMatch ? 'MATCH' : (isExcess ? '+' : '') + (discrepancyPaise / 100).toFixed(2)}</span>
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>
  `;
}
