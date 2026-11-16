'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import type { Business, Sale } from '@/types';
import { sendBillByLink, WA_AUTO_SENT_EVENT, waSendRecord, WaSendRecord } from '@/lib/whatsapp/autoSendBill';
import { tr } from '@/lib/i18n/core';

/** Why the linked WhatsApp did not send — in shop words. */
export function waSendErrorText(error?: string): string {
  switch (error) {
    case 'not-on-whatsapp': return tr('this number is not on WhatsApp');
    case 'bad-number': return tr('the mobile number is not right');
    case 'not-connected':
    case 'not-linked':
    case 'worker-stopped': return tr('WhatsApp is not connected (Settings → WhatsApp)');
    case 'timeout': return tr('WhatsApp did not answer (internet?)');
    default: return tr('WhatsApp could not send it');
  }
}

/**
 * v4.185.0 — one line in the bill window: what the linked WhatsApp did with this bill.
 * Nothing when it was never sent that way (no line, no clutter).
 */
export function WaBillSendStatus({ sale, business }: { sale: Sale; business: Business | null | undefined }) {
  const [record, setRecord] = useState<WaSendRecord | undefined>(() => waSendRecord(sale.id));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRecord(waSendRecord(sale.id));
    const onChange = (e: Event) => {
      const id = (e as CustomEvent<{ saleId?: string }>).detail?.saleId;
      if (!id || id === sale.id) setRecord(waSendRecord(sale.id));
    };
    window.addEventListener(WA_AUTO_SENT_EVENT, onChange);
    return () => window.removeEventListener(WA_AUTO_SENT_EVENT, onChange);
  }, [sale.id]);

  if (!record) return null;
  const again = async () => {
    if (!business || busy) return;
    setBusy(true);
    try { await sendBillByLink(sale, business, true); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold" data-wa-send-status={record.state}>
      {record.state === 'sending' && <span className="inline-flex items-center gap-1.5 text-slate-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr('Sending on WhatsApp to {phone}…', { phone: record.phone })}</span>}
      {record.state === 'sent' && <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" /> {tr('Sent on WhatsApp to {phone}', { phone: record.phone })}</span>}
      {record.state === 'failed' && (
        <>
          <span className="inline-flex items-center gap-1.5 text-rose-700"><AlertTriangle className="w-3.5 h-3.5" /> {tr('Not sent on WhatsApp: {reason}', { reason: waSendErrorText(record.error) })}</span>
          <button type="button" onClick={again} disabled={busy} className="text-emerald-700 underline cursor-pointer disabled:opacity-50" data-wa-send-again>{tr('Send again')}</button>
        </>
      )}
    </div>
  );
}
