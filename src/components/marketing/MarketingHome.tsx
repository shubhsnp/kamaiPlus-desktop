'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Download, Check, Sparkles } from 'lucide-react';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';
import { HeroInteractiveShowcase } from './HeroInteractiveShowcase';
import { FeatureInteractiveTour } from './FeatureInteractiveTour';
import { StandeeInvoicePreview } from './StandeeInvoicePreview';
import { BusinessNicheSelector } from './BusinessNicheSelector';
import { WhyTrustKamai } from './WhyTrustKamai';
import { useAppDownloadUrl } from '@/lib/marketing/useAppDownloadUrl';

export default function MarketingHome() {
  const downloadUrl = useAppDownloadUrl();

  return (
    <div className="bg-white min-h-screen flex flex-col selection:bg-brand-yellow selection:text-brand-black">
      <MarketingHeader />

      <main className="flex-1">
        {/* 1. HERO WITH INTERACTIVE PWA SHOWCASE & DEVICE FRAME */}
        <HeroInteractiveShowcase />

        {/* 2. INTERACTIVE FEATURE TOUR WITH REAL APP SCREENSHOTS */}
        <FeatureInteractiveTour />

        {/* 3. PHYSICAL & DIGITAL OUTPUTS: STANDEE & GST INVOICES */}
        <StandeeInvoicePreview />

        {/* 4. BUSINESS TRADE / NICHE ADAPTABILITY */}
        <BusinessNicheSelector />

        {/* 5. WHY MERCHANTS TRUST KAMAIPLUS */}
        <WhyTrustKamai />

        {/* 6. TRANSPARENT PRICING TEASER */}
        <section className="py-20 sm:py-28 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
              Simple &amp; Honest
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-brand-black tracking-tight">
              Free Forever Starter. Upgrade Only If You Need Pro.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-xl mx-auto leading-relaxed">
              Start right now with unlimited counter billing, khata ledger, and thermal receipts with zero fees. Upgrade to Pro for automated cloud sync and CA reports whenever you are ready.
            </p>

            <div className="mt-8 flex flex-wrap justify-center items-center gap-4">
              <Link
                href="/plans"
                className="inline-flex items-center gap-2 bg-brand-black hover:bg-slate-800 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-slate-900/10 transition-all"
              >
                <span>View Full Pricing &amp; Comparison</span>
                <ArrowRight className="w-4 h-4 text-brand-yellow" />
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                No auto-deductions
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                GST ITC eligible
              </span>
            </div>
          </div>
        </section>

        {/* 7. HIGH-CONVERTING BOTTOM CALL TO ACTION */}
        <section className="bg-brand-black text-white py-16 border-t border-slate-800 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10 pointer-events-none" />
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl text-center md:text-left space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                Start Billing &amp; Managing Khata in 2 Minutes.
              </h2>
              <p className="text-sm text-slate-400">
                Join thousands of retailers across India using KamaiPlus for faster counters and peace of mind.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm px-6 py-3.5 rounded-xl shadow-lg transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download App</span>
              </a>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 border border-white/20 hover:border-white/50 text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all"
              >
                <span>Login to Web App</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
