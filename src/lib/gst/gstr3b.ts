// GSTR-3B summary of a period (v4.101.0, tracker K-D22) — the monthly return's tax figures,
// from the same lines as GSTR-1 (lib/gst/periodSupplies.ts): bills of the period plus credit notes
// for goods returned in it, so 3B and GSTR-1 agree. Input tax credit (table 4) is not worked out
// here: purchase bills in the app do not carry the supplier's GSTIN and tax, and the portal fills
// ITC from GSTR-2B — the shop or CA takes it from there.
import type { Business, Customer, Sale, SalesReturn } from '@/types';
import { periodSupplies } from '@/lib/gst/periodSupplies';
import { splitIntraStateTax } from '@/lib/gst/taxSplit';

export interface TaxRow {
  /** Paise. */
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export interface Gstr3bSummary {
  /** 3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted), net of credit notes. */
  outwardTaxable: TaxRow;
  /** 3.1(c) Other outward supplies — nil rated, exempted (0 % lines). */
  nilExempt: number;
  /** Tax payable = 3.1(a) tax (before input tax credit). */
  taxPayable: number;
  /** Credit notes of the period included above (goods returned). */
  creditNotes: { count: number; taxable: number; tax: number };
  /** Bills counted. */
  bills: number;
}

export function buildGstr3bSummary(params: {
  sales: Sale[];
  customers: Customer[];
  business: Pick<Business, 'gstin'>;
  returns?: SalesReturn[];
  originals?: Sale[];
  start?: Date;
  end?: Date;
}): Gstr3bSummary {
  const supplies = periodSupplies({
    sales: params.sales, customers: params.customers, shopGstin: params.business.gstin || '',
    returns: params.returns || [], originals: params.originals,
    start: params.start || new Date(0), end: params.end || new Date(8.64e15),
  });
  let taxable = 0, igst = 0, intra = 0, nil = 0;
  for (const l of [...supplies.invoices, ...supplies.creditNotes]) {
    if (l.rt <= 0) { nil += l.taxable; continue; }
    taxable += l.taxable;
    if (l.inter) igst += l.tax;
    else intra += l.tax;
  }
  const { cgst, sgst } = splitIntraStateTax(intra);
  const cn = supplies.creditNotes;
  return {
    outwardTaxable: { taxable, igst, cgst, sgst },
    nilExempt: nil,
    taxPayable: igst + cgst + sgst,
    creditNotes: { count: supplies.notes.length, taxable: -cn.reduce((a, l) => a + l.taxable, 0), tax: -cn.reduce((a, l) => a + l.tax, 0) },
    bills: new Set(supplies.invoices.map((l) => l.sale.id)).size,
  };
}
