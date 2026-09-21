'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Download,
  ArrowRight,
  Receipt,
  QrCode,
  BookOpen,
  FileText,
  Sparkles,
  WifiOff,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import { useAppDownloadUrl } from '@/lib/marketing/useAppDownloadUrl';

interface ScreenTab {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  image: string;
  title: string;
  highlight: string;
  badge: string;
}

const HERO_SCREENS: ScreenTab[] = [
  {
    id: 'billing',
    label: 'POS Billing Counter',
    shortLabel: 'POS Billing',
    icon: Receipt,
    image: '/assets/screenshots/billing_pos.png',
    title: 'Lightning-Fast Counter Checkout',
    highlight: 'Instant barcode scan, loose weight billing (kg/g/litre) and 1-tap cart additions.',
    badge: '0s Counter Lag',
  },
  {
    id: 'checkout',
    label: 'Dynamic UPI & Split',
    shortLabel: 'Dynamic UPI',
    icon: QrCode,
    image: '/assets/screenshots/billing_checkout.png',
    title: 'Dynamic Bill QR & Split Tender',
    highlight: 'Customer scans exact bill QR on phone screen. Accept Cash, UPI, or Credit split.',
    badge: 'Zero Transaction Fees',
  },
  {
    id: 'khata',
    label: 'Customer Udhar Khata',
    shortLabel: 'Udhar Khata',
    icon: BookOpen,
    image: '/assets/screenshots/digital_khata.png',
    title: 'Zero-Loss Credit Ledger',
    highlight: 'Track regular customer udhar with 1-tap WhatsApp payment reminders and statements.',
    badge: 'Auto WhatsApp Reminders',
  },
  {
    id: 'invoice',
    label: 'GST Tax Invoice',
    shortLabel: 'Tax Invoice',
    icon: FileText,
    image: '/assets/screenshots/tax_invoice.png',
    title: 'A4 & Thermal Bill Designer',
    highlight: 'Professional GST & retail invoices featuring your shop logo, UPI QR, and HSN codes.',
    badge: 'Print Thermal or Share PDF',
  },
  {
    id: 'ai-inward',
    label: 'AI Wholesale Scan',
    shortLabel: 'AI Parcha Scan',
    icon: Sparkles,
    image: '/assets/screenshots/ai_inward.png',
    title: '1-Tap Wholesaler Bill Inward',
    highlight: 'Snap a photo of your supplier parcha or upload PDF. AI auto-extracts items and rates.',
    badge: 'AI Vision Powered',
  },
];

export function HeroInteractiveShowcase() {
  const [activeScreenId, setActiveScreenId] = useState<string>('billing');
  const downloadUrl = useAppDownloadUrl();
  const currentScreen = HERO_SCREENS.find((s) => s.id === activeScreenId) || HERO_SCREENS[0];

  return (
    <section className="relative bg-[#070b14] text-white pt-12 pb-20 sm:pt-16 sm:pb-28 overflow-hidden">
      {/* Subtle glowing ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-tr from-amber-500/15 via-emerald-500/10 to-transparent blur-[140px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/10 blur-[160px] pointer-events-none rounded-full" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Top Announcement Pill */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/10 backdrop-blur-md text-xs font-medium text-amber-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>100% Offline-First POS &amp; Credit Khata For Bharat</span>
            <span className="text-white/40">|</span>
            <span className="text-white/80 font-bold">Free Forever</span>
          </div>
        </div>

        {/* Hero Title & Value Proposition */}
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
            Apni Dukaan Ka Poora Hisaab,{' '}
            <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
              Ek Hi Modern App Mein.
            </span>
          </h1>
          <p className="mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-2xl mx-auto">
            KamaiPlus is the offline billing POS, customer credit ledger, barcode scanner, and WhatsApp growth engine built specifically for Indian retail shops.
          </p>

          {/* Action CTAs */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3.5">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm px-6 py-3.5 rounded-xl shadow-[0_0_30px_-5px_rgba(250,204,21,0.4)] transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>Download Android App</span>
            </a>
            <Link
              href="/auth"
              className="inline-flex items-center justify-center gap-2 bg-white/[0.07] hover:bg-white/[0.12] border border-white/15 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all hover:border-white/30 active:scale-[0.98]"
            >
              <span>Launch Web POS Free</span>
              <ArrowRight className="w-4 h-4 text-amber-300 shrink-0" />
            </Link>
          </div>

          {/* Value Micro-Points */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Works 100% Without Internet
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Dynamic NPCI UPI QR Codes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Zero Monthly Setup Fees
            </span>
          </div>
        </div>

        {/* INTERACTIVE PWA SHOWCASE TABS */}
        <div className="mt-8 sm:mt-10">
          <div className="flex items-center justify-center">
            <div className="inline-flex flex-wrap items-center justify-center gap-1.5 p-1.5 bg-slate-900/80 border border-white/10 rounded-2xl backdrop-blur-xl shadow-xl">
              {HERO_SCREENS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.id === activeScreenId;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveScreenId(tab.id)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                      isActive
                        ? 'bg-brand-yellow text-brand-black shadow-md font-black scale-[1.02]'
                        : 'text-slate-300 hover:text-white hover:bg-white/[0.05]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real Device Mockup Display with Surrounding Interactive Badges */}
          <div className="mt-8 flex flex-col items-center">
            <div className="relative w-full max-w-[340px] sm:max-w-[380px] group">
              {/* Glow backdrop */}
              <div className="absolute -inset-4 bg-gradient-to-b from-amber-500/20 via-emerald-500/15 to-transparent rounded-[50px] blur-2xl opacity-70 group-hover:opacity-100 transition-opacity" />

              {/* Screenshot Display (Image contains its own device frame) */}
              <div className="relative z-10 w-full rounded-[44px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.9)] ring-1 ring-white/10 transition-transform duration-500 group-hover:-translate-y-2">
                <img
                  key={currentScreen.image}
                  src={currentScreen.image}
                  alt={currentScreen.title}
                  className="w-full h-auto object-cover rounded-[44px]"
                />
                {/* Subtle Screen Glare Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.08] pointer-events-none rounded-[44px]" />
              </div>

              {/* Floating Highlight Card Left */}
              <div className="hidden md:flex absolute -left-48 top-16 z-20 flex-col gap-1 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl max-w-[200px] text-left">
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>100% Offline</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Bills save locally even if Wi-Fi or SIM data disconnects.
                </p>
              </div>

              {/* Floating Highlight Card Right */}
              <div className="hidden md:flex absolute -right-48 bottom-24 z-20 flex-col gap-1 p-3.5 rounded-2xl bg-slate-900/90 border border-white/10 backdrop-blur-xl shadow-2xl max-w-[210px] text-left">
                <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Voice Soundbox Alert</span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Speaks out payment confirmations aloud in Hindi &amp; English.
                </p>
              </div>
            </div>

            {/* Active Screen Info Pill below Mockup */}
            <div className="mt-6 text-center max-w-md px-4">
              <div className="inline-flex items-center gap-1.5 text-xs font-black text-amber-300 uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3" />
                <span>{currentScreen.badge}</span>
              </div>
              <h3 className="text-base font-bold text-white">{currentScreen.title}</h3>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {currentScreen.highlight}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
