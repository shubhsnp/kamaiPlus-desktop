'use client';

import React from 'react';
import {
  WifiOff,
  ShieldCheck,
  Smartphone,
  Globe2,
  HardDrive,
  Clock,
  Sparkles,
  Zap,
} from 'lucide-react';

const PILLARS = [
  {
    icon: WifiOff,
    title: '100% Offline Resilience',
    desc: 'Powered by local IndexedDB. Billing and khata continue running smoothly even if Wi-Fi or mobile networks drop out completely.',
  },
  {
    icon: HardDrive,
    title: 'Your Data Stays on Your Device',
    desc: 'Unlike cloud-only software that locks you in, your customers, stock and bills live safely on your machine with 1-click full JSON backups.',
  },
  {
    icon: Smartphone,
    title: 'Zero Proprietary Hardware Lock-In',
    desc: 'No expensive proprietary POS hardware needed. Run on any phone, tablet, or PC, with standard 2-inch or 3-inch Bluetooth thermal printers.',
  },
  {
    icon: Globe2,
    title: 'Native Bharat Language Support',
    desc: 'Switch between Hindi, Marathi, and English in a single tap. Designed for how Indian shopkeepers and counter operators actually speak.',
  },
  {
    icon: Zap,
    title: '2-Minute Immediate Setup',
    desc: 'No technical consultants, IT setup or training required. Type your shop name, add starter items, and print your first bill today.',
  },
  {
    icon: ShieldCheck,
    title: '18% GST Input Credit (ITC) Eligible',
    desc: 'Kamai+ Pro invoices are fully GST-compliant. Claim complete 18% Input Tax Credit on your business tax returns.',
  },
];

export function WhyTrustKamai() {
  return (
    <section className="py-20 sm:py-28 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-black text-slate-700 uppercase tracking-wider mb-3">
            Built For Trust
          </div>
          <h2 className="text-2xl sm:text-4xl font-black text-brand-black tracking-tight">
            Why Indian Shopkeepers Choose KamaiPlus
          </h2>
          <p className="mt-3 text-sm sm:text-base text-slate-500">
            A software engineered to keep your counter running, protect your cash flow, and never get in your way.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="p-6 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-md transition-all space-y-3"
              >
                <div className="w-10 h-10 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-black text-base text-brand-black">{pillar.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{pillar.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
