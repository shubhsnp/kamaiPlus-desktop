import React, { CSSProperties } from 'react';
import type { InvoiceDocument } from '@/lib/invoices/invoiceDocument';
import type { Business, Sale } from '@/types';
import { formatINR } from '@/lib/utils';

/**
 * 58mm / 80mm thermal slip. For most counters this roll is the only bill the
 * customer ever sees, so it honours Invoice Themes too: heading, logo, tagline,
 * owner & both shop numbers, GSTIN, HSN, GST breakup, UPI QR, terms, signatory and
 * the custom footer (Android rule #13). Every display switch in Invoice Themes
 * changes this slip the same way it changes the A4 (v4.91.0) — colour is A4 only.
 */

export type ThermalWidth = 58 | 80;

const MONO = "'Consolas', 'Courier New', 'Lucida Console', monospace";

interface Props {
  doc: InvoiceDocument;
  sale: Sale;
  business: Business;
  width: ThermalWidth;
}

export function ThermalReceipt({ doc, sale, business, width }: Props) {
  const fs = width === 80 ? 12 : 10.5;
  const base: CSSProperties = { fontFamily: MONO, fontSize: fs, lineHeight: 1.35, color: '#000' };
  const center: CSSProperties = { textAlign: 'center' };
  const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 6 };
  const small: CSSProperties = { fontSize: fs - 1.5 };
  const rule = <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />;
  const bold = (s: CSSProperties = {}): CSSProperties => ({ fontWeight: 800, ...s });

  return (
    <div
      data-thermal-receipt={width}
      style={{ ...base, width: `${width}mm`, padding: width === 80 ? '3mm 4mm' : '2mm 2.5mm', background: '#fff', boxSizing: 'border-box' }}
    >
      <div style={center}>
        {doc.store.logoUrl && (
          <img
            src={doc.store.logoUrl}
            alt=""
            data-thermal-logo
            style={{ maxWidth: width === 80 ? '30mm' : '24mm', maxHeight: '14mm', margin: '0 auto 2px', display: 'block', filter: 'grayscale(1)' }}
          />
        )}
        <div style={bold({ fontSize: fs + 3 })}>{business.name}</div>
        {doc.thermal.showTagline && business.tagline && <div>{business.tagline}</div>}
        {business.address && <div>{business.address}</div>}
        {doc.store.ownerName && <div data-thermal-owner>{doc.store.ownerName}</div>}
        {doc.store.phoneLine && <div data-thermal-phone>{doc.store.phoneLine}</div>}
        {business.gstin && <div style={bold()}>GSTIN: {business.gstin}</div>}
        {doc.store.licenseLine && <div>{doc.store.licenseLine}</div>}
        <div style={bold({ marginTop: 3, letterSpacing: 1 })}>{doc.heading}</div>
      </div>
      {rule}
      <div>Invoice: {doc.invoiceNumber}</div>
      <div>Date: {doc.dateText}</div>
      {sale.customer_name && sale.customer_name !== 'Cash Customer' && <div>Customer: {sale.customer_name}</div>}
      {doc.billedTo.details && <div>{doc.billedTo.details}</div>}
      {doc.isB2B && <div>{doc.billedTo.gstinLine}</div>}
      <div>Payment: {doc.payment.label.replace('● ', '')}</div>
      {rule}
      <div style={bold(row)}>
        <span>Item</span>
        <span>Amount</span>
      </div>
      {rule}
      {(sale.items || []).map((item, i) => (
        <div key={i} style={{ marginBottom: 2 }}>
          <div style={{ wordBreak: 'break-word' }}>{item.product_name}</div>
          {doc.showHsn && doc.rows[i]?.hsn && doc.rows[i].hsn !== '-' && (
            <div style={small} data-thermal-hsn>
              HSN: {doc.rows[i].hsn}
            </div>
          )}
          <div style={row}>
            <span>
              {doc.rows[i]?.qty} x {formatINR(item.unit_price, false)}
            </span>
            <span style={bold()}>{doc.rows[i]?.total}</span>
          </div>
          {(item.discount_amount || 0) > 0 && <div>  Disc −{formatINR(item.discount_amount, false)}</div>}
        </div>
      ))}
      {rule}
      {doc.totals.map((t, i) => (
        <div key={i} style={row}>
          <span>{t.label}</span>
          <span>{t.value}</span>
        </div>
      ))}
      <div style={bold({ ...row, fontSize: fs + 2, marginTop: 2 })}>
        <span>TOTAL</span>
        <span>{doc.grandTotal}</span>
      </div>
      {doc.afterTotals.map((t, i) => (
        <div key={i} style={row}>
          <span>{t.label}</span>
          <span>{t.value}</span>
        </div>
      ))}
      {doc.payment.splitText && <div>{doc.payment.splitText}</div>}
      {doc.savingsText && <div style={bold(center)}>{doc.savingsText}</div>}
      {doc.showTaxSlabs && (
        <div data-thermal-gst style={small}>
          {rule}
          <div style={bold(row)}>
            <span>GST</span>
            <span>Taxable</span>
            <span>Tax</span>
          </div>
          {doc.taxSlabs.map((s, i) => (
            <div key={i} style={row}>
              <span>{s.rate}</span>
              <span>{s.taxable}</span>
              <span>{s.totalTax}</span>
            </div>
          ))}
        </div>
      )}
      {doc.thermal.showUpi && (
        <>
          {rule}
          <div style={center} data-thermal-upi>
            {doc.upi.qrDataUrl && (
              <img src={doc.upi.qrDataUrl} alt="UPI QR" style={{ width: width === 80 ? '34mm' : '28mm', height: 'auto', margin: '0 auto', display: 'block' }} />
            )}
            <div>UPI: {doc.upi.vpa}</div>
          </div>
        </>
      )}
      {doc.terms.length > 0 && (
        <div data-thermal-terms style={small}>
          {rule}
          {doc.terms.map((t, i) => (
            <div key={i} style={{ wordBreak: 'break-word' }}>
              {t}
            </div>
          ))}
        </div>
      )}
      {doc.showSignatory && (
        <div data-thermal-signatory style={{ ...small, textAlign: 'right', marginTop: 10 }}>
          <div>For {doc.signatoryName}</div>
          <div style={{ marginTop: 12 }}>Authorised Signatory</div>
        </div>
      )}
      {rule}
      <div style={center}>
        <div>{doc.footerNote || 'Thank you for your visit!'}</div>
        <div style={{ marginTop: 2 }}>KamaiPlus • Aapki Dukaan Ka Digital Sathi</div>
        <div style={{ marginTop: 1, fontSize: 9 }}>www.kamaiplus.com</div>
      </div>
    </div>
  );
}
