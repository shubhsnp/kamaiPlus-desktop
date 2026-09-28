import { Business, Customer, Sale, SalesReturn } from '@/types';
import { breakupSales, SaleBreakup } from './saleBreakup';

export interface TallyExportOptions {
  business: Business | null | undefined;
  sales: Sale[];
  customers?: Customer[];
  returns?: SalesReturn[];
  /** Only bills inside these dates (none = all). */
  range?: { start: Date; end: Date };
  /** Goes into the file name, e.g. "Sep_2026". */
  periodName?: string;
}

/** Ledgers the import creates (Cash already exists in every Tally company). */
export const TALLY_LEDGERS = {
  sales: 'Sales Account',
  cgst: 'Output CGST',
  sgst: 'Output SGST',
  igst: 'Output IGST',
  cash: 'Cash',
  bank: 'UPI / Card Receipts',
};

/** Date as Tally wants it: YYYYMMDD (the shop's local date). */
export function formatTallyDate(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function escapeXml(unsafe: string = ''): string {
  return String(unsafe).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

const amt = (paise: number) => (Math.round(paise) / 100).toFixed(2);

function ledgerMaster(name: string, parent: string, extra = ''): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <LEDGER NAME="${escapeXml(name)}" ACTION="Create">\n            <NAME>${escapeXml(name)}</NAME>\n            <PARENT>${escapeXml(parent)}</PARENT>\n${extra}          </LEDGER>\n        </TALLYMESSAGE>\n`;
}

function entry(ledger: string, paise: number, debit: boolean): string {
  // Tally: debits are negative with ISDEEMEDPOSITIVE Yes, credits positive with No.
  return `            <ALLLEDGERENTRIES.LIST>\n              <LEDGERNAME>${escapeXml(ledger)}</LEDGERNAME>\n              <ISDEEMEDPOSITIVE>${debit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>\n              <AMOUNT>${debit ? '-' : ''}${amt(paise)}</AMOUNT>\n            </ALLLEDGERENTRIES.LIST>\n`;
}

/** The party of a bill with udhar (a Sundry Debtor), else null. */
const partyOf = (b: SaleBreakup) => (b.pay.credit > 0 ? b.buyerName : null);

/**
 * Tally Prime / ERP 9 import file (v4.78.0): the ledgers it needs and one Sales voucher per
 * bill of the period, in the accounting view — debit Cash / UPI-Card / the customer (udhar)
 * as the bill was paid, credit Sales, CGST + SGST or IGST. Every voucher balances to the
 * paisa. Items are listed in the narration only: stock lines need the same stock items and
 * units in Tally, and failed to import before. Figures match the GSTR-1 file
 * (lib/tally/saleBreakup.ts): no estimates, returns taken off.
 */
export function generateTallyPrimeXML(options: TallyExportOptions): { xml: string; filename: string; count: number } {
  const { business, sales, customers = [], returns = [], range, periodName = 'All' } = options;
  const companyName = business?.name || 'My Store';
  const bills = breakupSales(sales, { shopGstin: business?.gstin || '', customers, returns }, range);

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n        <STATICVARIABLES>\n          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>\n        </STATICVARIABLES>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;

  // 1. Ledgers: sales, GST (with their duty head), UPI / card receipts, customers on udhar.
  xml += ledgerMaster(TALLY_LEDGERS.sales, 'Sales Accounts');
  for (const [name, head] of [[TALLY_LEDGERS.cgst, 'Central Tax'], [TALLY_LEDGERS.sgst, 'State Tax'], [TALLY_LEDGERS.igst, 'Integrated Tax']]) {
    xml += ledgerMaster(name, 'Duties & Taxes', `            <TAXTYPE>GST</TAXTYPE>\n            <GSTDUTYHEAD>${head}</GSTDUTYHEAD>\n`);
  }
  xml += ledgerMaster(TALLY_LEDGERS.bank, 'Bank Accounts');
  const parties = new Set(bills.map(partyOf).filter((p): p is string => Boolean(p)));
  parties.forEach((party) => {
    xml += ledgerMaster(party, 'Sundry Debtors', `            <ISBILLWISEON>Yes</ISBILLWISEON>\n`);
  });

  // 2. One Sales voucher per bill.
  for (const b of bills) {
    const date = formatTallyDate(b.sale.created_at);
    const party = partyOf(b);
    const items = (b.sale.items || []).map((i) => `${i.product_name} x ${i.quantity}`).join(', ');
    xml += `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">\n`;
    xml += `            <DATE>${date}</DATE>\n            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>\n            <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>\n`;
    xml += `            <VOUCHERNUMBER>${escapeXml(b.sale.invoice_number)}</VOUCHERNUMBER>\n            <REFERENCE>${escapeXml(b.sale.invoice_number)}</REFERENCE>\n`;
    xml += `            <PARTYLEDGERNAME>${escapeXml(party || (b.pay.cash >= b.pay.bank ? TALLY_LEDGERS.cash : TALLY_LEDGERS.bank))}</PARTYLEDGERNAME>\n`;
    if (b.buyerGstin) xml += `            <PARTYGSTIN>${escapeXml(b.buyerGstin)}</PARTYGSTIN>\n`;
    xml += `            <NARRATION>${escapeXml(`KamaiPlus bill ${b.sale.invoice_number} - ${b.buyerName}${b.returned > 0 ? ' (after returns)' : ''}: ${items}`.slice(0, 900))}</NARRATION>\n`;
    if (b.pay.cash > 0) xml += entry(TALLY_LEDGERS.cash, b.pay.cash, true);
    if (b.pay.bank > 0) xml += entry(TALLY_LEDGERS.bank, b.pay.bank, true);
    if (b.pay.credit > 0 && party) xml += entry(party, b.pay.credit, true);
    xml += entry(TALLY_LEDGERS.sales, b.taxable, false);
    if (b.cgst > 0) xml += entry(TALLY_LEDGERS.cgst, b.cgst, false);
    if (b.sgst > 0) xml += entry(TALLY_LEDGERS.sgst, b.sgst, false);
    if (b.igst > 0) xml += entry(TALLY_LEDGERS.igst, b.igst, false);
    xml += `          </VOUCHER>\n        </TALLYMESSAGE>\n`;
  }

  xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>\n`;
  const cleanStore = companyName.replace(/[^a-zA-Z0-9]/g, '_');
  return { xml, filename: `${cleanStore}_TallyPrime_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xml`, count: bills.length };
}
