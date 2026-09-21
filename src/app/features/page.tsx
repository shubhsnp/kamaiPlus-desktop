import React from 'react';
import Link from 'next/link';
import {
  Receipt,
  Wallet,
  Boxes,
  FileSpreadsheet,
  Banknote,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata = {
  title: 'Features | KamaiPlus',
  description: 'Billing, khata, inventory, GST reports, WhatsApp marketing and more — everything KamaiPlus does for your shop.',
};

const FEATURES = [
  {
    icon: Receipt,
    title: 'Billing & POS',
    points: [
      'Fast counter billing with barcode scan and item search',
      'Bluetooth thermal printer support for instant receipts',
      'Share bills directly on WhatsApp, no printer needed',
    ],
  },
  {
    icon: Wallet,
    title: 'Khata (Credit Ledger)',
    points: [
      'Track udhaar for every regular customer, item-wise',
      'Send payment reminders on WhatsApp in one tap',
      'Full customer-wise payment history',
    ],
  },
  {
    icon: Boxes,
    title: 'Inventory & Purchases',
    points: [
      'Real-time stock tracking with low-stock alerts',
      '1-click WhatsApp purchase orders to suppliers',
      'Custom barcode sticker label printing studio',
    ],
  },
  {
    icon: FileSpreadsheet,
    title: 'GST & Tax Reports',
    points: [
      'Auto-generated GSTR-1 and HSN summary reports',
      'Professional tax invoices with multiple designer themes',
      'GST input tax credit-ready billing',
    ],
  },
  {
    icon: Banknote,
    title: 'Cash Register & Day-End Closing',
    points: [
      'Cash note counter and till tally at shift end',
      'Day-end closing Z-report with sales & expense summary',
      'Cash-in-hand tracking, deducting the day\'s expenses',
    ],
  },
  {
    icon: MessageCircle,
    title: 'WhatsApp Growth Marketing',
    points: [
      'Automatic WhatsApp bills sent to every customer',
      'Low-stock purchase orders sent to suppliers automatically',
      'Tools to bring repeat customers back to your shop',
    ],
  },
  {
    icon: RefreshCw,
    title: 'Offline-First & Multi-Device Sync',
    points: [
      'Billing, khata and inventory all work with zero internet',
      'Automatic cloud backup once you are back online',
      'Access your shop data from more than one device',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Staff Roles & Security',
    points: [
      'Separate staff logins with cashier PIN locks',
      'Role-based access so staff only see what they need',
      'Your data stays private to your business',
    ],
  },
];

export default function FeaturesPage() {
  return (
    <div className="bg-white">
      <MarketingHeader />

      <section className="bg-brand-black text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Everything You Need to Run &amp; Grow Your Shop
          </h1>
          <p className="text-base text-slate-300 max-w-xl mx-auto">
            One offline-first app for billing, khata, inventory, GST filing and WhatsApp marketing —
            built specifically for Indian retail businesses.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="border border-slate-200 rounded-2xl p-6 sm:p-7 space-y-4">
              <div className="w-11 h-11 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
                <f.icon className="w-5 h-5" />
              </div>
              <h2 className="font-black text-base text-brand-black">{f.title}</h2>
              <ul className="space-y-2">
                {f.points.map((p) => (
                  <li key={p} className="text-sm text-slate-500 leading-relaxed pl-4 relative before:content-['—'] before:absolute before:left-0 before:text-slate-300">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-100 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-2xl font-black text-brand-black tracking-tight">
            See These Features In Action
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm px-6 py-3.5 rounded-xl"
            >
              Download App
            </Link>
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-brand-black font-bold text-sm px-6 py-3.5 rounded-xl"
            >
              See Plans &amp; Pricing
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
