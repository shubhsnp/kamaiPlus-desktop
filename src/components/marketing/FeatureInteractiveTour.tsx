'use client';

import React, { useState } from 'react';
import {
  QrCode,
  Receipt,
  BookOpen,
  Sparkles,
  Printer,
  FileSpreadsheet,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface TourFeature {
  id: string;
  tabLabel: string;
  badge: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  bullets: string[];
  image: string;
}

const TOUR_FEATURES: TourFeature[] = [
  {
    id: 'upi',
    tabLabel: 'Dynamic UPI & Standee',
    badge: 'Zero Commission',
    icon: QrCode,
    title: 'Dynamic Bill UPI QR & Counter Standee',
    desc: 'Customer scans the exact bill amount directly on your phone screen or your printable shop standee. No more amount typing mistakes.',
    bullets: [
      'Instant voice soundbox alert in Hindi & English when payment arrives',
      'Dynamic bill QR auto-fills exact amount (e.g. ₹297.00)',
      '1-Click printable official counter standee with shop branding',
      '100% direct bank settlement with zero transaction cuts',
    ],
    image: '/assets/screenshots/upi_standee.png',
  },
  {
    id: 'pos',
    tabLabel: 'Fast POS Billing',
    badge: '0ms Latency',
    icon: Receipt,
    title: 'Lightning-Fast Counter Checkout Counter',
    desc: 'Speed up rush hour billing with instant item search, phone camera barcode scanning, and multi-cart bill holding.',
    bullets: [
      'Loose item weighing by kg, gram & litre (Atta, Rice, Sugar, Oil)',
      'Works with phone camera or USB/Bluetooth laser barcode scanners',
      'Hold Bill feature allows attending the next customer immediately',
      'Runs 100% offline on IndexedDB — never slows down',
    ],
    image: '/assets/screenshots/billing_pos.png',
  },
  {
    id: 'khata',
    tabLabel: 'Customer Udhar Khata',
    badge: 'Recover Faster',
    icon: BookOpen,
    title: 'Customer Credit Ledger & WhatsApp Reminders',
    desc: 'Replace torn paper bahi-khata registers with a clean digital credit book that reminds customers automatically.',
    bullets: [
      'Track You’ll Get, Advance, and Net Balance per customer',
      '1-Tap WhatsApp payment reminder with instant UPI pay link',
      'Download complete ledger statement in PDF with 1 tap',
      'Zero lost records: automatically synced with offline persistence',
    ],
    image: '/assets/screenshots/digital_khata.png',
  },
  {
    id: 'ai',
    tabLabel: 'AI Parcha Inward',
    badge: 'AI Vision',
    icon: Sparkles,
    title: 'AI Wholesale Invoice & Slip Scanner',
    desc: 'Stop typing hundreds of items manually. Take a photo of your wholesaler bill or parcha, and AI adds them to your inventory.',
    bullets: [
      'Extracts product names, purchase rates, quantities & MRP automatically',
      'Supports handwritten wholesaler parchas and printed invoices',
      'Upload single/multi-page supplier invoice PDFs',
      'Bulk inventory Excel / CSV upload option included',
    ],
    image: '/assets/screenshots/ai_inward.png',
  },
  {
    id: 'invoice',
    tabLabel: 'GST Tax Invoices',
    badge: 'Print & Share',
    icon: Printer,
    title: 'GST & Retail Invoices with Live Preview',
    desc: 'Print crisp 2-inch or 3-inch thermal receipts or send branded A4 tax invoices directly on WhatsApp.',
    bullets: [
      'Customise with store logo, tagline, contact, and bank UPI QR',
      'Direct Bluetooth thermal printing to any standard POS printer',
      'Auto-formats Tax Invoice, Retail Invoice, or Cash Memo',
      'Tax-inclusive MRP and Tax-exclusive billing modes supported',
    ],
    image: '/assets/screenshots/tax_invoice.png',
  },
  {
    id: 'gst',
    tabLabel: 'Tax & Tally Reports',
    badge: 'CA Friendly',
    icon: FileSpreadsheet,
    title: 'GSTR-1 Reports & 1-Click Tally XML Export',
    desc: 'Give your Chartered Accountant clean, error-free sales ledgers without spending weekends matching paper receipts.',
    bullets: [
      'Auto-generated Table 12 HSN sales summary',
      'B2B Wholesale register with customer GSTIN tracking',
      '1-Click Tally Prime XML export for instant voucher import',
      'Full JSON data snapshot backup & restore anytime',
    ],
    image: '/assets/screenshots/gst_reports.png',
  },
];

export function FeatureInteractiveTour() {
  const [activeId, setActiveId] = useState<string>('upi');
  const current = TOUR_FEATURES.find((f) => f.id === activeId) || TOUR_FEATURES[0];

  return (
    <section className="py-20 sm:py-28 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
            Real Retail Workflows
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-brand-black tracking-tight">
            Designed For The Speed Of Indian Shops
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500">
            Click any feature below to preview real screens and tools inside the KamaiPlus platform.
          </p>
        </div>

        {/* Feature Selector Tabs */}
        <div className="flex items-center justify-start lg:justify-center gap-2 overflow-x-auto pb-4 mb-10 no-scrollbar">
          {TOUR_FEATURES.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveId(item.id)}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all border ${
                  isActive
                    ? 'bg-brand-black text-white border-brand-black shadow-lg shadow-slate-900/10'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-brand-yellow' : 'text-slate-500'}`} />
                <span>{item.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Split Screen Tour: Content Left, Real Screenshot Right */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column: Feature Details */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-100/70 text-amber-900 text-xs font-black uppercase tracking-wider">
                {current.badge}
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-brand-black tracking-tight leading-tight">
                {current.title}
              </h3>
              <p className="text-base text-slate-600 leading-relaxed">
                {current.desc}
              </p>

              <div className="space-y-3 pt-2">
                {current.bullets.map((bullet) => (
                  <div key={bullet} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-sm font-semibold text-slate-800 leading-normal">
                      {bullet}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-4 flex items-center gap-4">
                <Link
                  href="/auth"
                  className="inline-flex items-center gap-2 bg-brand-black hover:bg-slate-800 text-white font-bold text-sm px-5 py-3 rounded-xl transition-all"
                >
                  <span>Try It Now Free</span>
                  <ChevronRight className="w-4 h-4 text-brand-yellow" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-brand-black transition-colors"
                >
                  <span>Explore all tools</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Right Column: Sleek Phone Frame with Screenshot */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[300px] sm:max-w-[330px] group">
                {/* Glow ring */}
                <div className="absolute -inset-2 bg-gradient-to-tr from-amber-400/20 to-emerald-400/20 rounded-[44px] blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Screenshot Display (Image contains its own device frame) */}
                <div className="relative z-10 w-full rounded-[44px] shadow-2xl ring-1 ring-black/5 transition-transform duration-500 group-hover:-translate-y-2">
                  <img
                    key={current.image}
                    src={current.image}
                    alt={current.title}
                    className="w-full h-auto object-cover rounded-[44px]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
