import React, { useEffect } from 'react';
import { generateUPILink } from '@/lib/utils';
import { effectiveInvoicePrefix } from '@/lib/invoices/invoiceNumberService';
import QRCode from 'qrcode';
import { tr } from '@/lib/i18n/core';
import type { Business, PaymentMethod } from '@/types';

export interface UsePosUpiQrDeps {
  paymentMethod: PaymentMethod;
  splitUpi: string;
  setPosQrDataUrl: React.Dispatch<React.SetStateAction<string>>;
  selectedUpiIndex: number;
  business: Business | undefined;
  grandTotalPaise: number;
}

/**
 * The counter's UPI QR (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): drawn for the
 * bill's exact amount (or the UPI part of a split) with the shop's UPI ID, so GPay / PhonePe / Paytm
 * open with the amount filled in.
 */
export function usePosUpiQr(deps: UsePosUpiQrDeps) {
  const {
    paymentMethod, splitUpi, setPosQrDataUrl, selectedUpiIndex, business, grandTotalPaise,
  } = deps;
  // Real-Time Dynamic Amount UPI QR Generation (e.g. ₹848.00 auto-fills in GPay / PhonePe / Paytm)
  useEffect(() => {
    if (!business) return;

    const availableUpis = business.upi_ids && business.upi_ids.length > 0
      ? business.upi_ids
      : business.upi_id
      ? [{ id: 'def', label: tr('Primary Counter'), upi_id: business.upi_id, is_default: true }]
      : [];

    const activeUpi = availableUpis[selectedUpiIndex] || availableUpis[0];

    if (activeUpi?.upi_id && grandTotalPaise > 0) {
      const nextNum = business.next_invoice_number || 1;
      const invPrefix = effectiveInvoicePrefix(business);
      const invCode = `${invPrefix}${String(nextNum).padStart(3, '0')}`;

      // Calculate effective payable amount for UPI (handles split payment as well)
      let payablePaise = grandTotalPaise;
      if (paymentMethod === 'split') {
        const splitUpiPaise = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        payablePaise = splitUpiPaise > 0 ? splitUpiPaise : grandTotalPaise;
      }

      const upiUrl = generateUPILink(
        activeUpi.upi_id,
        business.name,
        payablePaise,
        invCode
      );

      QRCode.toDataURL(upiUrl, {
        width: 320,
        margin: 1,
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(setPosQrDataUrl)
        .catch(() => setPosQrDataUrl(''));
    } else {
      setPosQrDataUrl('');
    }
  }, [business, grandTotalPaise, paymentMethod, splitUpi, selectedUpiIndex]);
}
