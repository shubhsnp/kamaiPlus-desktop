import React, { CSSProperties } from 'react';
import type { InvoiceDocument, InvoiceRow } from '@/lib/invoices/invoiceDocument';
import { A4_HEIGHT_PX, A4_WIDTH_PX, C, PRINT_FONT, card, ellipsis, right, text, tint } from './invoiceStyles';
import { A4InvoiceSummary } from './A4InvoiceSummary';

/**
 * A4 Tax Invoice — a port of the Android native PDF layout (MainActivity.java):
 * theme accent stripe, store header with heading pill, "Billed To" card with the
 * payment badge, themed table (5 columns for retail, 8 statutory GST columns),
 * GST slab summary, UPI + terms / totals + signatory, branding strip and page
 * numbers on every page.
 *
 * Pure markup with inline styles only: it is rendered on screen as the preview
 * and to a standalone HTML string for printing and PDF export.
 */

const PAD_X = 48;

interface Props {
  doc: InvoiceDocument;
  brandLogoUrl?: string;
  /** On-screen preview: pages get a gap and a shadow. */
  preview?: boolean;
}

export const A4_PREVIEW_GAP = 16;

export function A4TaxInvoice({ doc, brandLogoUrl, preview }: Props) {
  const total = doc.pages.length;
  return (
    <div style={{ fontFamily: PRINT_FONT, color: C.slate900 }}>
      {doc.pages.map((rows, i) => (
        <InvoicePage
          key={i}
          doc={doc}
          rows={rows}
          pageNo={i + 1}
          totalPages={total}
          brandLogoUrl={brandLogoUrl}
          preview={preview}
        />
      ))}
    </div>
  );
}

function InvoicePage({
  doc,
  rows,
  pageNo,
  totalPages,
  brandLogoUrl,
  preview,
}: {
  doc: InvoiceDocument;
  rows: InvoiceRow[];
  pageNo: number;
  totalPages: number;
  brandLogoUrl?: string;
  preview?: boolean;
}) {
  const isLast = pageNo === totalPages;
  return (
    <div
      className="kp-page"
      style={{
        position: 'relative',
        width: A4_WIDTH_PX,
        height: A4_HEIGHT_PX,
        background: '#ffffff',
        overflow: 'hidden',
        padding: `32px ${PAD_X}px 0`,
        ...(preview
          ? { marginBottom: pageNo < totalPages ? A4_PREVIEW_GAP : 0, boxShadow: '0 1px 3px rgba(15,23,42,0.18)', borderRadius: 4 }
          : {}),
      }}
    >
      <div style={{ height: 5, borderRadius: 2, background: doc.color }} />
      {pageNo === 1 ? <FirstPageHeader doc={doc} /> : <ContinuationHeader doc={doc} pageNo={pageNo} totalPages={totalPages} />}
      <ItemsTable doc={doc} rows={rows} />
      {isLast && <A4InvoiceSummary doc={doc} />}
      <BrandingStrip color={doc.color} logoUrl={brandLogoUrl} />
      <div style={{ ...text(10, 500, C.slate500), position: 'absolute', left: 0, right: 0, bottom: 14, textAlign: 'center' }}>
        Page {pageNo} of {totalPages}
      </div>
    </div>
  );
}

function FirstPageHeader({ doc }: { doc: InvoiceDocument }) {
  const s = doc.store;
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginTop: 11 }}>
        <div style={{ display: 'flex', gap: 13, minWidth: 0, flex: 1 }}>
          {s.logoUrl && (
            <div style={{ ...card, width: 58, height: 58, padding: 3, flexShrink: 0, borderRadius: 8, background: '#fff' }}>
              <img src={s.logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ ...text(19, 800, C.slate900, { lineHeight: 1.2 }), ...ellipsis, maxWidth: 380 }}>{s.name}</div>
            {s.tagline && <div style={{ ...text(11, 500, C.slate500), marginTop: 2, ...ellipsis, maxWidth: 360 }}>{s.tagline}</div>}
            {s.address && <div style={{ ...text(11, 400, C.slate600), marginTop: 2, maxWidth: 360 }}>{s.address}</div>}
            {s.contactLine && <div style={{ ...text(11, 400, C.slate600), marginTop: 2, maxWidth: 380 }}>{s.contactLine}</div>}
            {s.licenseLine && <div style={{ ...text(10.5, 600, C.slate600), marginTop: 2, maxWidth: 380 }}>{s.licenseLine}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              display: 'inline-block',
              minWidth: 190,
              padding: '5px 13px',
              borderRadius: 5,
              background: tint(doc.color, 24),
              border: `1px solid ${tint(doc.color, 70)}`,
              ...text(12, 800, doc.color, { letterSpacing: 0.6, textAlign: 'right' }),
            }}
          >
            {doc.heading}
          </div>
          <div style={{ ...text(12.5, 800, C.slate900), marginTop: 6 }}>#{doc.invoiceNumber}</div>
          <div style={{ ...text(11, 400, C.slate500), marginTop: 2 }}>Date: {doc.dateText}</div>
          {doc.placeOfSupply && <div style={{ ...text(11, 400, C.slate500), marginTop: 1 }}>POS: {doc.placeOfSupply}</div>}
        </div>
      </div>
      <div style={{ height: 1, background: C.slate200, marginTop: 10 }} />
      <BilledToCard doc={doc} />
    </>
  );
}

const BADGE: Record<string, { bg: string; border: string; color: string }> = {
  paid: { bg: C.paidBg, border: C.paidBorder, color: C.paidText },
  partial: { bg: C.dueBg, border: C.dueBorder, color: C.dueText },
  unpaid: { bg: C.dueBg, border: C.dueBorder, color: C.dueText },
  estimate: { bg: C.slate100, border: C.slate200, color: C.slate600 },
  returned: { bg: C.roseBg, border: C.roseBorder, color: C.red },
};

function BilledToCard({ doc }: { doc: InvoiceDocument }) {
  const b = doc.billedTo;
  const badge = BADGE[doc.payment.tone] || BADGE.paid;
  return (
    <div style={{ ...card, position: 'relative', marginTop: 9, padding: '8px 12px 8px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ position: 'absolute', left: 0, top: 5, bottom: 5, width: 4, borderRadius: 2, background: doc.color }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={text(9.5, 800, C.slate500, { letterSpacing: 0.4 })}>BILLED TO:</span>
          <span style={{ ...text(12, 800, C.slate900), ...ellipsis }}>{b.name}</span>
        </div>
        {b.details && <div style={{ ...text(10.5, 400, C.slate500), marginTop: 2 }}>{b.details}</div>}
        {b.address && <div style={{ ...text(10.5, 400, C.slate500), marginTop: 1 }}>{b.address}</div>}
        {b.gstinLine && <div style={{ ...text(10.5, 600, C.slate600), marginTop: 1 }}>{b.gstinLine}</div>}
        {doc.payment.splitText && <div style={{ ...text(10, 500, C.slate500), marginTop: 1 }}>Paid via {doc.payment.splitText}</div>}
      </div>
      <div
        style={{
          flexShrink: 0,
          padding: '4px 9px',
          borderRadius: 5,
          background: badge.bg,
          border: `1px solid ${badge.border}`,
          ...text(10, 800, badge.color, { whiteSpace: 'nowrap' }),
        }}
      >
        {doc.payment.label}
      </div>
    </div>
  );
}

function ContinuationHeader({ doc, pageNo, totalPages }: { doc: InvoiceDocument; pageNo: number; totalPages: number }) {
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        <span style={{ ...text(16, 800, C.slate900), ...ellipsis, maxWidth: 260 }}>{doc.store.name}</span>
        <span style={text(10.5, 500, C.slate500)}>
          {doc.heading} (Continued - Page {pageNo} of {totalPages})
        </span>
        <span style={text(12.5, 800, C.slate900)}>#{doc.invoiceNumber}</span>
      </div>
      <div style={{ height: 1, background: C.slate200, marginTop: 9 }} />
    </>
  );
}

function ItemsTable({ doc, rows }: { doc: InvoiceDocument; rows: InvoiceRow[] }) {
  const th: CSSProperties = { ...text(10.5, 800, '#ffffff', { letterSpacing: 0.3 }), padding: '7px 6px', textTransform: 'uppercase' };
  const td: CSSProperties = { ...text(11.2, 400, C.slate700), padding: '6px 6px', verticalAlign: 'top', borderBottom: `1px solid ${C.slate100}` };
  const statutory = doc.statutory;
  return (
    <table style={{ marginTop: 10, tableLayout: 'fixed', width: '100%' }}>
      <colgroup>
        <col style={{ width: 30 }} />
        <col />
        {statutory && doc.showHsn && <col style={{ width: 62 }} />}
        <col style={{ width: statutory ? 66 : 96 }} />
        <col style={{ width: statutory ? 76 : 104 }} />
        {statutory && <col style={{ width: 84 }} />}
        {statutory && <col style={{ width: 76 }} />}
        <col style={{ width: statutory ? 90 : 116 }} />
      </colgroup>
      <thead>
        <tr style={{ background: doc.color }}>
          <th style={{ ...th, textAlign: 'left', borderRadius: '5px 0 0 5px' }}>#</th>
          <th style={{ ...th, textAlign: 'left' }}>Item Description</th>
          {statutory && doc.showHsn && <th style={{ ...th, textAlign: 'left' }}>HSN</th>}
          <th style={{ ...th, ...right }}>Qty</th>
          <th style={{ ...th, ...right }}>Rate</th>
          {statutory && <th style={{ ...th, ...right }}>Taxable</th>}
          {statutory && <th style={{ ...th, ...right }}>GST</th>}
          <th style={{ ...th, ...right, borderRadius: '0 5px 5px 0' }}>Total (₹)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, idx) => (
          <tr key={r.sno} style={{ background: idx % 2 === 1 ? C.slate50 : '#ffffff' }}>
            <td style={{ ...td, color: C.slate500 }}>{r.sno}</td>
            <td style={td}>
              <div style={text(11.2, 600, C.slate900, { wordBreak: 'break-word' })}>{r.name}</div>
              {r.meta.map((m, k) => (
                <div key={k} style={text(9.5, 500, C.slate500, { marginTop: 1 })}>{m}</div>
              ))}
            </td>
            {statutory && doc.showHsn && <td style={{ ...td, ...ellipsis }}>{r.hsn}</td>}
            <td style={{ ...td, ...right }}>{r.qty}</td>
            <td style={{ ...td, ...right }}>{r.rate}</td>
            {statutory && <td style={{ ...td, ...right }}>{r.taxable}</td>}
            {statutory && (
              <td style={{ ...td, ...right, color: C.slate500 }}>
                <div>{r.gstAmount}</div>
                <div style={text(9, 600, C.slate400)}>{r.gstRate}</div>
              </td>
            )}
            <td style={{ ...td, ...right, fontWeight: 800, color: C.slate900 }}>{r.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function BrandingStrip({ color, logoUrl }: { color: string; logoUrl?: string }) {
  return (
    <div
      style={{
        ...card,
        position: 'absolute',
        left: PAD_X,
        right: PAD_X,
        bottom: 38,
        height: 32,
        padding: '0 11px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}
    >
      {logoUrl && <img src={logoUrl} alt="" style={{ width: 20, height: 20, objectFit: 'contain' }} />}
      <span style={text(10.5, 800, color)}>⚡ KAMAI+ POS</span>
      <span style={text(10, 400, C.slate600)}>• India&apos;s #1 Retail POS &amp; GST Billing App</span>
    </div>
  );
}
