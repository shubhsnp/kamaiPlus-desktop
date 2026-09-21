import React, { CSSProperties } from 'react';
import type { InvoiceDocument, InvoiceTotalLine } from '@/lib/invoices/invoiceDocument';
import { C, card, right, text } from './invoiceStyles';

/**
 * Last-page block of the A4 invoice: amount in words, GST slab summary, then
 * UPI QR + terms (left) and totals + authorised signatory (right).
 */
export function A4InvoiceSummary({ doc }: { doc: InvoiceDocument }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ ...card, borderRadius: 5, padding: '6px 10px', display: 'flex', gap: 6 }}>
        <span style={text(10, 800, C.slate900, { whiteSpace: 'nowrap' })}>Amount in Words:</span>
        <span style={text(10, 400, C.slate700)}>{doc.amountInWords}</span>
      </div>

      {doc.showTaxSlabs && <TaxSlabTable doc={doc} />}

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 22, marginTop: 12 }}>
        <div style={{ width: 360, flexShrink: 0 }}>
          {doc.upi.show && <UpiCard doc={doc} />}
          {doc.terms.length > 0 && (
            <div style={{ marginTop: doc.upi.show ? 9 : 0 }}>
              <div style={text(11, 800, C.slate900)}>Terms &amp; Conditions:</div>
              {doc.terms.map((t, i) => (
                <div key={i} style={text(10, 400, C.slate500, { marginTop: 2 })}>{t}</div>
              ))}
            </div>
          )}
          {doc.footerNote && <div style={text(10, 500, C.slate600, { marginTop: 8 })}>♥ {doc.footerNote}</div>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {doc.totals.map((line, i) => (
            <TotalRow key={i} line={line} />
          ))}
          <div
            style={{
              marginTop: 5,
              padding: '9px 12px',
              borderRadius: 6,
              background: doc.color,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={text(12, 800, '#ffffff', { letterSpacing: 0.4 })}>GRAND TOTAL</span>
            <span style={{ ...text(17, 800, '#ffffff'), ...right }}>{doc.grandTotal}</span>
          </div>
          {doc.afterTotals.map((line, i) => (
            <TotalRow key={i} line={line} />
          ))}
          {doc.savingsText && (
            <div style={{ ...text(10.5, 800, C.paidText), marginTop: 5, textAlign: 'right' }}>🎉 {doc.savingsText}</div>
          )}
          {doc.showSignatory && (
            <div style={{ marginTop: 16, marginLeft: 50, textAlign: 'right' }}>
              <div style={text(10, 800, C.slate900)}>For {doc.signatoryName}</div>
              <div style={{ height: 28, borderBottom: `1px solid ${C.slate200}` }} />
              <div style={text(9.5, 800, C.slate500, { marginTop: 4, letterSpacing: 0.4 })}>AUTHORISED SIGNATORY</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TONE_COLOR: Record<string, string> = {
  default: C.slate700,
  discount: C.red,
  due: C.dueText,
  muted: C.slate500,
};

function TotalRow({ line }: { line: InvoiceTotalLine }) {
  const color = TONE_COLOR[line.tone || 'default'];
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 2px' }}>
      <span style={text(11, 400, C.slate500)}>{line.label}</span>
      <span style={{ ...text(11, line.tone === 'due' ? 800 : 600, color), ...right }}>{line.value}</span>
    </div>
  );
}

function TaxSlabTable({ doc }: { doc: InvoiceDocument }) {
  const th: CSSProperties = { ...text(9.5, 800, C.slate500, { letterSpacing: 0.3 }), padding: '5px 6px', textTransform: 'uppercase' };
  const td: CSSProperties = { ...text(10, 400, C.slate700), padding: '4px 6px' };
  const inter = doc.isInterState;
  return (
    <table style={{ marginTop: 10, width: '100%' }}>
      <thead>
        <tr style={{ background: C.slate100 }}>
          <th style={{ ...th, textAlign: 'left', borderRadius: '4px 0 0 4px' }}>HSN/SAC (Rate)</th>
          <th style={{ ...th, ...right }}>Taxable Val</th>
          {inter ? (
            <>
              <th style={{ ...th, ...right }}>IGST Rate</th>
              <th style={{ ...th, ...right }}>IGST Amt</th>
            </>
          ) : (
            <>
              <th style={{ ...th, ...right }}>CGST Rate</th>
              <th style={{ ...th, ...right }}>CGST Amt</th>
              <th style={{ ...th, ...right }}>SGST Rate</th>
              <th style={{ ...th, ...right }}>SGST Amt</th>
            </>
          )}
          <th style={{ ...th, ...right, borderRadius: '0 4px 4px 0' }}>Total Tax</th>
        </tr>
      </thead>
      <tbody>
        {doc.taxSlabs.map((s, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${C.slate100}` }}>
            <td style={td}>{s.label}</td>
            <td style={{ ...td, ...right }}>{s.taxable}</td>
            {inter ? (
              <>
                <td style={{ ...td, ...right }}>{s.igstRate}</td>
                <td style={{ ...td, ...right }}>{s.igstAmount}</td>
              </>
            ) : (
              <>
                <td style={{ ...td, ...right }}>{s.cgstRate}</td>
                <td style={{ ...td, ...right }}>{s.cgstAmount}</td>
                <td style={{ ...td, ...right }}>{s.sgstRate}</td>
                <td style={{ ...td, ...right }}>{s.sgstAmount}</td>
              </>
            )}
            <td style={{ ...td, ...right, fontWeight: 700, color: C.slate900 }}>{s.totalTax}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UpiCard({ doc }: { doc: InvoiceDocument }) {
  return (
    <div style={{ ...card, padding: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
      {doc.upi.qrDataUrl && (
        <img src={doc.upi.qrDataUrl} alt="UPI QR" style={{ width: 62, height: 62, background: '#fff', borderRadius: 4, flexShrink: 0 }} />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={text(11.5, 800, C.slate900)}>Scan &amp; Pay via UPI</div>
        <div style={text(10, 400, C.slate500, { marginTop: 2, wordBreak: 'break-all' })}>UPI VPA: {doc.upi.vpa}</div>
        <div style={text(9.5, 700, C.paidText, { marginTop: 2 })}>✓ GPay • PhonePe • Paytm • BHIM</div>
      </div>
    </div>
  );
}
