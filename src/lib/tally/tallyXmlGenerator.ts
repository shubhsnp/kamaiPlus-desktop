import { Business, Customer, Sale, SalesReturn } from '@/types';
import { getSalePaymentBreakdown, getNetPaymentBreakdown, getReturnsForSale } from '@/lib/sales/saleMath';
import { periodSupplies, SupplyLine } from '@/lib/gst/periodSupplies';
import { splitIntraStateTax } from '@/lib/gst/taxSplit';

export interface TallyExportOptions {
  business: Business | null | undefined;
  /** Bills of the period. */
  sales: Sale[];
  customers?: Customer[];
  /** Return records (all, or at least those of the period's bills and those dated in it). */
  returns?: SalesReturn[];
  /** Bills that this period's returns came from but are not in `sales`. */
  originals?: Sale[];
  /** The period: bills and returns inside these dates (none = all). */
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

/** A ledger master. The name goes in LANGUAGENAME.LIST / NAME.LIST, the way Tally itself exports. */
function ledgerMaster(name: string, parent: string, extra = ''): string {
  return `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <LEDGER NAME="${escapeXml(name)}" ACTION="Create">\n            <LANGUAGENAME.LIST>\n              <NAME.LIST TYPE="String">\n                <NAME>${escapeXml(name)}</NAME>\n              </NAME.LIST>\n            </LANGUAGENAME.LIST>\n            <PARENT>${escapeXml(parent)}</PARENT>\n${extra}          </LEDGER>\n        </TALLYMESSAGE>\n`;
}

/**
 * One ledger line. Tally: debits are negative with ISDEEMEDPOSITIVE Yes, credits positive with No.
 * A customer (Sundry Debtor) line is the party line and carries the bill reference, so udhar is
 * tracked bill by bill (not "On Account").
 */
function entry(ledger: string, paise: number, debit: boolean, bill?: { name: string; type: 'New Ref' | 'Agst Ref' }): string {
  const sign = debit ? '-' : '';
  let x = `            <ALLLEDGERENTRIES.LIST>\n              <LEDGERNAME>${escapeXml(ledger)}</LEDGERNAME>\n              <ISDEEMEDPOSITIVE>${debit ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>\n`;
  if (bill) x += `              <ISPARTYLEDGER>Yes</ISPARTYLEDGER>\n`;
  x += `              <AMOUNT>${sign}${amt(paise)}</AMOUNT>\n`;
  if (bill) x += `              <BILLALLOCATIONS.LIST>\n                <NAME>${escapeXml(bill.name)}</NAME>\n                <BILLTYPE>${bill.type}</BILLTYPE>\n                <AMOUNT>${sign}${amt(paise)}</AMOUNT>\n              </BILLALLOCATIONS.LIST>\n`;
  return x + `            </ALLLEDGERENTRIES.LIST>\n`;
}

/** Taxable value and tax of a set of lines, with CGST + SGST split once (K-D40). */
function totals(lines: SupplyLine[]) {
  const taxable = Math.abs(lines.reduce((a, l) => a + l.taxable, 0));
  const tax = Math.abs(lines.reduce((a, l) => a + l.tax, 0));
  const inter = lines[0]?.inter || false;
  const { cgst, sgst } = inter ? { cgst: 0, sgst: 0 } : splitIntraStateTax(tax);
  return { taxable, cgst, sgst, igst: inter ? tax : 0, total: taxable + tax };
}

/** Make the payment parts add up to `total` exactly: rounding on parts goes to the biggest part. */
function balance(pay: { cash: number; bank: number; credit: number }, total: number) {
  const diff = total - (pay.cash + pay.bank + pay.credit);
  if (diff !== 0) {
    const key = (Object.keys(pay) as (keyof typeof pay)[]).sort((a, b) => pay[b] - pay[a])[0];
    pay[key] = Math.max(0, pay[key] + diff);
    const left = total - (pay.cash + pay.bank + pay.credit);
    if (left !== 0) pay.cash += left;
  }
  return pay;
}

const VOUCHER_HEAD = (type: 'Sales' | 'Credit Note', date: string, number: string, party: string, gstin: string, narration: string) =>
  `        <TALLYMESSAGE xmlns:UDF="TallyUDF">\n          <VOUCHER VCHTYPE="${type}" ACTION="Create" OBJVIEW="Accounting Voucher View">\n` +
  `            <DATE>${date}</DATE>\n            <EFFECTIVEDATE>${date}</EFFECTIVEDATE>\n            <VOUCHERTYPENAME>${type}</VOUCHERTYPENAME>\n` +
  `            <VOUCHERNUMBER>${escapeXml(number)}</VOUCHERNUMBER>\n            <REFERENCE>${escapeXml(number)}</REFERENCE>\n` +
  `            <PARTYLEDGERNAME>${escapeXml(party)}</PARTYLEDGERNAME>\n` +
  (gstin ? `            <PARTYGSTIN>${escapeXml(gstin)}</PARTYGSTIN>\n` : '') +
  `            <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>\n            <ISINVOICE>No</ISINVOICE>\n` +
  `            <NARRATION>${escapeXml(narration.slice(0, 900))}</NARRATION>\n`;
const VOUCHER_END = `          </VOUCHER>\n        </TALLYMESSAGE>\n`;

/**
 * Tally Prime / ERP 9 import file (v4.78.0; v4.101.0 credit notes, K-D11): the ledgers it needs,
 * one Sales voucher per bill as issued, and one Credit Note voucher per return made in the
 * period — the same lines as the GSTR-1 file (lib/gst/periodSupplies.ts), so Tally and GSTR-1
 * agree. Accounting view: a bill debits Cash / UPI-Card / the customer (udhar) as it was paid and
 * credits Sales and CGST + SGST or IGST; a credit note does the reverse, paying back the way the
 * refund was made. Every voucher balances to the paisa. Items are listed in the narration only:
 * stock lines need the same stock items and units in Tally, and failed to import before.
 */
export function generateTallyPrimeXML(options: TallyExportOptions): { xml: string; filename: string; count: number } {
  const { business, customers = [], returns = [], range, periodName = 'All' } = options;
  const companyName = business?.name || 'My Store';
  const inRange = (iso: string) => !range || (Date.parse(iso) >= range.start.getTime() && Date.parse(iso) <= range.end.getTime());
  const sales = options.sales.filter((s) => inRange(s.created_at));
  const supplies = periodSupplies({
    sales, customers, shopGstin: business?.gstin || '', returns, originals: options.originals,
    start: range?.start || new Date(0), end: range?.end || new Date(8.64e15),
  });
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const buyerName = (sale: Sale) => sale.customer_name || customerById.get(sale.customer_id || '')?.name || 'Cash Customer';

  // Group the lines: per bill (sales vouchers) and per return (credit note vouchers), oldest first.
  const group = (lines: SupplyLine[], key: (l: SupplyLine) => string) => {
    const map = new Map<string, SupplyLine[]>();
    for (const l of lines) {
      const k = key(l);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(l);
    }
    return Array.from(map.values());
  };
  const bills = group(supplies.invoices, (l) => l.sale.id).sort((a, b) => a[0].sale.created_at.localeCompare(b[0].sale.created_at));
  const notes = group(supplies.creditNotes, (l) => l.ret!.id).sort((a, b) => a[0].ret!.created_at.localeCompare(b[0].ret!.created_at));

  const vouchers: { party: string | null; xml: string }[] = [];
  for (const lines of bills) {
    const { sale } = lines[0];
    const t = totals(lines);
    if (t.total <= 0) continue;
    // As paid at the counter; returns made before return records existed stay netted on the bill.
    const records = getReturnsForSale(sale.id, returns);
    const p = records.length === 0 && (sale.returned_amount || 0) > 0 ? getNetPaymentBreakdown(sale, []) : getSalePaymentBreakdown(sale);
    const pay = balance({ cash: p.cash, bank: p.upi + p.card, credit: p.credit }, t.total);
    const party = pay.credit > 0 ? buyerName(sale) : null;
    const items = (sale.items || []).map((i) => `${i.product_name} x ${i.quantity}`).join(', ');
    let x = VOUCHER_HEAD('Sales', formatTallyDate(sale.created_at), sale.invoice_number, party || (pay.cash >= pay.bank ? TALLY_LEDGERS.cash : TALLY_LEDGERS.bank), lines[0].buyerGstin, `KamaiPlus bill ${sale.invoice_number} - ${buyerName(sale)}: ${items}`);
    if (pay.credit > 0 && party) x += entry(party, pay.credit, true, { name: sale.invoice_number, type: 'New Ref' });
    if (pay.cash > 0) x += entry(TALLY_LEDGERS.cash, pay.cash, true);
    if (pay.bank > 0) x += entry(TALLY_LEDGERS.bank, pay.bank, true);
    x += entry(TALLY_LEDGERS.sales, t.taxable, false);
    if (t.cgst > 0) x += entry(TALLY_LEDGERS.cgst, t.cgst, false);
    if (t.sgst > 0) x += entry(TALLY_LEDGERS.sgst, t.sgst, false);
    if (t.igst > 0) x += entry(TALLY_LEDGERS.igst, t.igst, false);
    vouchers.push({ party, xml: x + VOUCHER_END });
  }
  for (const lines of notes) {
    const { sale, ret } = lines[0];
    const t = totals(lines);
    if (t.total <= 0 || !ret) continue;
    // Paid back the way the refund was made: cash, UPI, or off the customer's khata.
    const toKhata = ret.refund_method === 'store_credit' || ret.refund_method === 'khata_deduction';
    const party = toKhata ? buyerName(sale) : null;
    const back = party || (ret.refund_method === 'upi' ? TALLY_LEDGERS.bank : TALLY_LEDGERS.cash);
    const nameOf = (id: string) => (sale.items || []).find((it) => it.product_id === id)?.product_name || id;
    const items = (ret.items || []).map((i) => `${i.product_name || nameOf(i.product_id)} x ${i.quantity}`).join(', ');
    const number = ret.return_number || ret.id;
    let x = VOUCHER_HEAD('Credit Note', formatTallyDate(ret.created_at), number, back, lines[0].buyerGstin, `KamaiPlus return ${number} against bill ${sale.invoice_number} - ${buyerName(sale)}: ${items}`);
    x += entry(TALLY_LEDGERS.sales, t.taxable, true);
    if (t.cgst > 0) x += entry(TALLY_LEDGERS.cgst, t.cgst, true);
    if (t.sgst > 0) x += entry(TALLY_LEDGERS.sgst, t.sgst, true);
    if (t.igst > 0) x += entry(TALLY_LEDGERS.igst, t.igst, true);
    x += entry(back, t.total, false, party ? { name: sale.invoice_number, type: 'Agst Ref' } : undefined);
    vouchers.push({ party, xml: x + VOUCHER_END });
  }

  let xml = `<?xml version="1.0" encoding="utf-8"?>\n<ENVELOPE>\n  <HEADER>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n  </HEADER>\n  <BODY>\n    <IMPORTDATA>\n      <REQUESTDESC>\n        <REPORTNAME>Vouchers</REPORTNAME>\n        <STATICVARIABLES>\n          <SVCURRENTCOMPANY>${escapeXml(companyName)}</SVCURRENTCOMPANY>\n        </STATICVARIABLES>\n      </REQUESTDESC>\n      <REQUESTDATA>\n`;
  // 1. Ledgers: sales, GST (with their duty head), UPI / card receipts, customers on udhar.
  xml += ledgerMaster(TALLY_LEDGERS.sales, 'Sales Accounts');
  for (const [name, head] of [[TALLY_LEDGERS.cgst, 'Central Tax'], [TALLY_LEDGERS.sgst, 'State Tax'], [TALLY_LEDGERS.igst, 'Integrated Tax']]) {
    xml += ledgerMaster(name, 'Duties & Taxes', `            <TAXTYPE>GST</TAXTYPE>\n            <GSTDUTYHEAD>${head}</GSTDUTYHEAD>\n`);
  }
  xml += ledgerMaster(TALLY_LEDGERS.bank, 'Bank Accounts');
  new Set(vouchers.map((v) => v.party).filter((p): p is string => Boolean(p))).forEach((party) => {
    xml += ledgerMaster(party, 'Sundry Debtors', `            <ISBILLWISEON>Yes</ISBILLWISEON>\n`);
  });
  // 2. Vouchers.
  for (const v of vouchers) xml += v.xml;
  xml += `      </REQUESTDATA>\n    </IMPORTDATA>\n  </BODY>\n</ENVELOPE>\n`;
  const cleanStore = companyName.replace(/[^a-zA-Z0-9]/g, '_');
  return { xml, filename: `${cleanStore}_TallyPrime_${periodName.replace(/[^a-zA-Z0-9]/g, '_')}.xml`, count: vouchers.length };
}
