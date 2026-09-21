'use client';

import React, { useState } from 'react';
import {
  Store,
  Pill,
  UtensilsCrossed,
  Shirt,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface NicheItem {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ElementType;
  headline: string;
  description: string;
  features: string[];
}

const NICHES: NicheItem[] = [
  {
    id: 'kirana',
    label: 'Kirana & Grocery',
    sublabel: 'Loose items & FMCG',
    icon: Store,
    headline: 'Fast Counter Checkout for High-Traffic Kiranas',
    description: 'Designed around rush-hour shop realities. Scan barcodes effortlessly and bill loose grain, pulses, sugar and oils by decimal weights.',
    features: [
      'Loose item calculations by kg, gram & millilitre with instant price math',
      'Phone camera or handheld laser barcode scanning for packaged FMCG',
      'Hold Bill feature to keep queues moving without losing cart items',
      '1-Tap low-stock purchase orders sent directly to suppliers on WhatsApp',
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy & Medical',
    sublabel: 'Batches & Expiry',
    icon: Pill,
    headline: 'Batch Tracking & Expiry Date Radar for Chemists',
    description: 'Eliminate dead inventory and expired medicines before they cost your pharmacy money.',
    features: [
      '15-day and 30-day early expiry radar alert for upcoming batch expirations',
      'Record supplier batch numbers and manufacturing dates seamlessly',
      'Customer purchase history tracking for repeat chronic prescriptions',
      'Schedule-wise medicine classification and stock inward',
    ],
  },
  {
    id: 'restaurant',
    label: 'Restaurant & Cafe',
    sublabel: 'KOT & Table Billing',
    icon: UtensilsCrossed,
    headline: 'Table-Wise Ordering & Kitchen Ticket Printing',
    description: 'Keep your kitchen coordinated and bill dine-in or takeaway orders with zero confusion.',
    features: [
      'Table-wise order management and multi-ticket support',
      'Kitchen Order Ticket (KOT) printing on standard 58mm/80mm thermal rolls',
      'Split tender payments (Cash + UPI + Credit) for group dining',
      'Customer credit khata for regular daily lunch and office patrons',
    ],
  },
  {
    id: 'apparel',
    label: 'Apparel & Fashion',
    sublabel: 'Sizes, Colors & Barcodes',
    icon: Shirt,
    headline: 'Variant Stocking & Custom Barcode Sticker Studio',
    description: 'Track garments across sizes, colors, and cuts, and print your own custom price tags.',
    features: [
      'Matrix variant management for sizes (S/M/L/XL/XXL) and colors',
      'Print custom barcode stickers on standard Avery A4 sheets or thermal rolls',
      'Show store name, MRP, selling price, and customer savings on every tag',
      'Fast discount application (flat ₹ or %) at checkout',
    ],
  },
];

export function BusinessNicheSelector() {
  const [activeNicheId, setActiveNicheId] = useState<string>('kirana');
  const activeNiche = NICHES.find((n) => n.id === activeNicheId) || NICHES[0];

  return (
    <section className="py-20 sm:py-28 bg-slate-50 border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-slate-200 text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
            Tailored For Your Trade
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-brand-black tracking-tight">
            Built For Your Exact Kind Of Shop
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500">
            KamaiPlus adapts its features whether you sell groceries by the gram, medicines by batch, or garments by size.
          </p>
        </div>

        {/* Niche Selector Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          {NICHES.map((niche) => {
            const Icon = niche.icon;
            const isActive = niche.id === activeNicheId;
            return (
              <button
                key={niche.id}
                type="button"
                onClick={() => setActiveNicheId(niche.id)}
                className={`p-4 rounded-2xl border text-left transition-all ${
                  isActive
                    ? 'bg-brand-black text-white border-brand-black shadow-xl shadow-slate-900/10 scale-[1.02]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                    isActive ? 'bg-brand-yellow text-brand-black' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div className="font-black text-sm">{niche.label}</div>
                <div className={`text-xs mt-0.5 ${isActive ? 'text-slate-300' : 'text-slate-400'}`}>
                  {niche.sublabel}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Niche Details Box */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-sm">
          <div className="max-w-3xl">
            <h3 className="text-xl sm:text-2xl font-black text-brand-black mb-3">
              {activeNiche.headline}
            </h3>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed mb-8">
              {activeNiche.description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {activeNiche.features.map((feat) => (
                <div key={feat} className="flex items-start gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                  <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-normal">
                    {feat}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-black hover:text-amber-600 group"
            >
              <span>Set up your {activeNiche.label} in 2 minutes</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
