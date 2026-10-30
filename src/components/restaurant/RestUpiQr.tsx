'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';
import { formatINR, generateUPILink } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import type { Business } from '@/types';
import { shopUpiId } from '@/lib/restaurant/checkPrint';

/**
 * Restaurant bill (v4.107.0): the same UPI QR the counter shows — the guest scans it and GPay /
 * PhonePe / Paytm open with the exact amount filled in. v4.183.0: drawn to fit the bill window's
 * fixed box; `qrOnly` is the picture alone, beside the Cash + UPI boxes.
 */
export function RestUpiQr({ business, amountPaise, reference, qrOnly = false }: { business?: Business | null; amountPaise: number; reference: string; qrOnly?: boolean }) {
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
      <div className={missingBox(qrOnly)} data-pay-upi-missing>
        <QrCode className="w-5 h-5 mx-auto mb-1 text-slate-400" />
        {tr('Add your UPI ID in Settings → Store & GST Profile to show a QR here.')}
      </div>
    );
  }
  const picture = (
    <div className="w-[132px] h-[132px] rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
      {src ? <img src={src} alt={tr('UPI QR for {amount}', { amount: formatINR(amountPaise) })} className="w-full h-full" /> : <QrCode className="w-8 h-8 text-slate-300" />}
    </div>
  );
  if (qrOnly) return <div className="shrink-0" data-pay-upi-qr>{picture}</div>;
  return (
    <div className="h-full flex items-center gap-3" data-pay-upi-qr>
      {picture}
      <div className="min-w-0 space-y-1">
        <div className="text-[10.5px] font-black uppercase tracking-wide text-emerald-800">{tr('Scan to pay')}</div>
        <div className="text-2xl font-black font-mono text-slate-900">{formatINR(amountPaise)}</div>
        <div className="text-[11px] font-semibold text-slate-600 break-all">{upi}</div>
        <div className="text-[10.5px] text-slate-500">{tr('GPay, PhonePe or Paytm open with the amount filled in.')}</div>
      </div>
    </div>
  );
}

const missingBox = (qrOnly: boolean) =>
  qrOnly
    ? 'shrink-0 w-[132px] h-[132px] rounded-lg border border-dashed border-slate-300 bg-white p-2 flex flex-col justify-center text-center text-[10.5px] leading-tight font-semibold text-slate-500'
    : 'h-full rounded-lg border border-dashed border-slate-300 bg-white px-3 flex flex-col justify-center text-center text-xs font-semibold text-slate-500';
