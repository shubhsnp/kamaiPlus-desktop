'use client';

import React from 'react';
import Link from 'next/link';
import {
  QrCode,
  FileText,
  Volume2,
  Printer,
  Share2,
  ShieldCheck,
  Check,
  ArrowRight,
} from 'lucide-react';

export function StandeeInvoicePreview() {
  return (
    <section className="py-20 sm:py-28 bg-[#0b101d] text-white relative overflow-hidden border-b border-slate-800">
      {/* Background glow accents */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-amber-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[130px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-xs font-bold text-amber-300 uppercase tracking-wider mb-4">
            Physical &amp; Digital Outputs
          </div>
          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white">
            Professional Branding At Your Counter
          </h2>
          <p className="mt-4 text-base text-slate-400 max-w-2xl mx-auto">
            KamaiPlus gives your shop the premium polish of a modern retail chain—from dynamic payment standees to customized GST invoices.
          </p>
        </div>

        {/* Dual Visual Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Card 1: Official Counter UPI Standee */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backdrop-blur-xl relative group hover:border-amber-400/40 transition-all">
            <div>
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-amber-400/15 text-amber-300 text-xs font-black">
                  <QrCode className="w-3.5 h-3.5" />
                  <span>PRINTABLE STANDEE</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Voice Alert Ready</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                Official Counter UPI QR Standee
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Generate an official QR standee featuring your store name and bank UPI ID. Customers scan and pay directly with zero transaction cuts.
              </p>

              <div className="space-y-2.5 mb-8 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Print on standard A4 card or display on counter stand</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Audio voice announcements confirm receipt immediately</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Accepts GPay, PhonePe, Paytm, BHIM, CRED with 0% fee</span>
                </div>
              </div>
            </div>

            {/* Screenshot Graphic (Image contains its own device frame) */}
            <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[280px] transition-transform duration-500 group-hover:-translate-y-2">
              <img
                src="/assets/screenshots/upi_standee.png"
                alt="KamaiPlus Counter UPI Standee"
                className="w-full h-auto object-cover rounded-[36px] shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </div>

          {/* Card 2: Live GST Tax Invoice */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-6 sm:p-8 flex flex-col justify-between backdrop-blur-xl relative group hover:border-emerald-400/40 transition-all">
            <div>
              <div className="flex items-center justify-between gap-4 mb-5">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-400/15 text-emerald-300 text-xs font-black">
                  <FileText className="w-3.5 h-3.5" />
                  <span>TAX INVOICE PREVIEW</span>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs text-sky-400 font-bold">
                  <Printer className="w-3.5 h-3.5" />
                  <span>Thermal &amp; A4 Print</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                Branded GST &amp; WhatsApp Bills
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed mb-6">
                Print bills on Bluetooth thermal rolls or dispatch crisp digital PDF invoices to your customer's WhatsApp in a single tap.
              </p>

              <div className="space-y-2.5 mb-8 text-xs sm:text-sm text-slate-300">
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Include store logo, GSTIN, phone, and payment QR code</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Works with 2-inch &amp; 3-inch Bluetooth thermal printers</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>1-Tap WhatsApp bill dispatch with customer savings badge</span>
                </div>
              </div>
            </div>

            {/* Screenshot Graphic (Image contains its own device frame) */}
            <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[280px] transition-transform duration-500 group-hover:-translate-y-2">
              <img
                src="/assets/screenshots/tax_invoice.png"
                alt="KamaiPlus Live Tax Invoice Preview"
                className="w-full h-auto object-cover rounded-[36px] shadow-2xl ring-1 ring-white/10"
              />
            </div>
          </div>
        </div>

        {/* Quick Launch Banner */}
        <div className="mt-12 text-center">
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 text-sm font-black text-brand-yellow hover:text-amber-300 group"
          >
            <span>Launch your store and customize your invoices in under 2 minutes</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
