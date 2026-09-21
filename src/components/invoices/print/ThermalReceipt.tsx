import React, { CSSProperties } from 'react';
import type { InvoiceDocument } from '@/lib/invoices/invoiceDocument';
import type { Business, Sale } from '@/types';
import { formatINR } from '@/lib/utils';

/**
 * 58mm / 80mm thermal slip. For most counters this roll is the only bill the
 * customer ever sees, so it honours Invoice Themes too: heading, tagline,
 * owner phone, GSTIN, UPI QR and the custom footer (Android rule #13).
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
  const rule = <div style={{ borderTop: '1px dashed #000', margin: '4px 0' }} />;
  const bold = (s: CSSProperties = {}): CSSProperties => ({ fontWeight: 800, ...s });

  return (
    <div style={{ ...base, width: `${width}mm`, padding: width === 80 ? '3mm 4mm' : '2mm 2.5mm', background: '#fff', boxSizing: 'border-box' }}>
      <div style={center}>
        <div style={bold({ fontSize: fs + 3 })}>{business.name}</div>
        {doc.thermal.showTagline && business.tagline && <div>{business.tagline}</div>}
        {business.address && <div>{business.address}</div>}
        {doc.thermal.showPhone && business.phone && <div>Ph: {business.phone}</div>}
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
      {doc.upi.show && (
        <>
          {rule}
          <div style={center}>
            {doc.upi.qrDataUrl && (
              <img src={doc.upi.qrDataUrl} alt="UPI QR" style={{ width: width === 80 ? '34mm' : '28mm', height: 'auto', margin: '0 auto', display: 'block' }} />
            )}
            <div>UPI: {doc.upi.vpa}</div>
          </div>
        </>
      )}
      {rule}
      <div style={center}>
        <div>{doc.footerNote || 'Thank you for your visit!'}</div>
        <div style={{ marginTop: 2 }}>KamaiPlus Smart POS</div>
      </div>
    </div>
  );
}
