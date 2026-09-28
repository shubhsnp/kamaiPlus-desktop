'use client';

import React from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';

/*
 * Small presentational dialogs of the POS screen, moved out of
 * app/billing/page.tsx. They hold no state — the page owns it and passes it in.
 */

export interface QuickAddScannedProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  barcode: string | null;
  name: string;
  setName: (v: string) => void;
  price: string;
  setPrice: (v: string) => void;
}

export function QuickAddScannedProductModal({ isOpen, onClose, onSubmit, barcode, name, setName, price, setPrice }: QuickAddScannedProductModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tr('Add Scanned Barcode ({v1})', { v1: barcode || '' })}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-3 p-1">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Product Name *')}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('e.g. Parle-G Biscuit 250g')}
            required
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1">{tr('Selling Price (₹) *')}</label>
          <Input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={tr('e.g. 25')}
            required
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>
            {tr('Cancel')}
          </Button>
          <Button size="sm" type="submit" className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold">
            {tr('Save to Catalog & Add to Cart')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export interface FullscreenUpiQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  amountPaise: number;
  businessName?: string;
  upiId?: string;
  qrDataUrl: string | null;
  /** The bill's customer — the payment link can go to them on WhatsApp (v4.79.0). */
  customerName?: string;
  customerPhone?: string;
}

export function FullscreenUpiQrModal({ isOpen, onClose, amountPaise, businessName, upiId, qrDataUrl, customerName, customerPhone }: FullscreenUpiQrModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tr('UPI Payment Counter QR')}
      size="md"
    >
      <div className="p-4 flex flex-col items-center text-center space-y-4">
        <div className="space-y-1">
          <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 text-xs font-black uppercase tracking-wider">
            {tr('Scan to Pay Exact Amount')}
          </span>
          <div className="text-3xl font-black text-slate-900 font-mono tracking-tight pt-1">
            {formatINR(amountPaise)}
          </div>
          <p className="text-xs text-slate-500 font-medium">
            {tr('Paying to:')} <b className="text-slate-900">{businessName}</b>{upiId ? ` (${upiId})` : ''}
          </p>
        </div>

        {/* Customer not at the counter: send a tap-to-pay link with this amount (Android parity) */}
        {upiId && amountPaise > 0 && (
          <WhatsAppButton
            variant="block"
            label={tr('Send payment link on WhatsApp')}
            request={{ kind: 'payment', amountPaise, customerName: customerName || undefined, phone: customerPhone || undefined }}
          />
        )}

        {qrDataUrl && (
          <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-lg">
            <img
              src={qrDataUrl}
              alt="Dynamic UPI QR"
              className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
            />
          </div>
        )}

        {/* Supported UPI Apps Row */}
        <div className="space-y-1.5 w-full pt-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {tr('Accepted on Any UPI App')}
          </div>
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Google Pay</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">PhonePe</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Paytm</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">BHIM</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">CRED</span>
          </div>
        </div>

        <div className="w-full pt-2 flex justify-center">
          <Button
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-6 py-2 rounded-xl"
          >
            {tr('Done / Payment Received')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export interface BillingToastData {
  message: string;
  type?: 'success' | 'info' | 'error';
}

export function BillingToast({ toast }: { toast: BillingToastData | null }) {
  if (!toast) return null;
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-bottom-3 duration-200 ${
      toast.type === 'success'
        ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40'
        : toast.type === 'info'
        ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-950/40'
        : 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/40'
    }`}>
      {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      {toast.type === 'info' && <Sparkles className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />}
      {toast.type === 'error' && <span className="text-sm shrink-0">⚠️</span>}
      <span>{toast.message}</span>
    </div>
  );
}
