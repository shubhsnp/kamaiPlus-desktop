'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { formatINR, generateUPILink } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { Business } from '@/types';

/** The shop's UPI ID (the default one, else the first, else the single old field). */
export function shopUpiId(business?: Business | null): string {
  if (!business) return '';
  const list = business.upi_ids || [];
  return (list.find((u) => u.is_default) || list[0])?.upi_id || business.upi_id || '';
}

/**
 * Restaurant bill (v4.107.0): the same UPI QR the counter shows — the guest scans it and GPay /
 * PhonePe / Paytm open with the exact amount filled in.
 */
export function RestUpiQr({ business, amountPaise, reference }: { business?: Business | null; amountPaise: number; reference: string }) {
  const upi = shopUpiId(business);
  const [src, setSrc] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (!upi || amountPaise <= 0) {
      setSrc('');
      return;
    }
    QRCode.toDataURL(generateUPILink(upi, business?.name || 'KamaiPlus', amountPaise, reference), { width: 320, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(''));
    return () => {
      cancelled = true;
    };
  }, [upi, amountPaise, reference, business?.name]);

  if (!upi) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-500" data-pay-upi-missing>
        <QrCode className="w-5 h-5 mx-auto mb-1 text-slate-400" />
        {tr('Add your UPI ID in Settings → Store & GST Profile to show a QR here.')}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex items-center gap-3" data-pay-upi-qr>
      <div className="w-[132px] h-[132px] rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
        {src ? <img src={src} alt={tr('UPI QR for {amount}', { amount: formatINR(amountPaise) })} className="w-full h-full" /> : <QrCode className="w-8 h-8 text-slate-300" />}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="text-[10.5px] font-black uppercase tracking-wide text-emerald-800">{tr('Scan to pay')}</div>
        <div className="text-2xl font-black font-mono text-slate-900">{formatINR(amountPaise)}</div>
        <div className="text-[11px] font-semibold text-slate-600 break-all">{upi}</div>
        <div className="text-[10.5px] text-slate-500">{tr('GPay, PhonePe or Paytm open with the amount filled in.')}</div>
      </div>
    </div>
  );
}
