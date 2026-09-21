'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { formatINR } from '@/lib/utils';

type Duration = '1year' | '1month';

const FAQS = [
  {
    q: 'Can I use the Free plan forever without paying?',
    a: 'Yes, absolutely! The Free plan allows unlimited basic POS billing, local store management, and customer Khata ledger with zero time limit and no credit card required.',
  },
  {
    q: 'What is included in the Paid (Pro) plan?',
    a: 'The Pro plan unlocks all advanced tools: automatic WhatsApp cloud bills, expiry date radar, GSTR-1 tax export, custom barcode tag printing, low-stock purchase orders, and priority support.',
  },
  {
    q: 'How does payment and activation work?',
    a: 'After you sign up, you can pay instantly via UPI (Google Pay, PhonePe, Paytm, BHIM) or Credit/Debit Card. Your store is upgraded to Pro immediately.',
  },
  {
    q: 'Can I use KamaiPlus offline without internet?',
    a: 'Yes! All counter billing, barcode scanning, thermal printing, and Khata ledger operate 100% offline. Internet is only used for cloud backup and sending WhatsApp messages.',
  },
  {
    q: 'Can I claim GST Input Tax Credit (ITC) on my subscription?',
    a: 'Yes. An official GST tax invoice is generated for every paid subscription so you can claim full GST input tax credit.',
  },
];

export default function PlansPage() {
  const [duration, setDuration] = useState<Duration>('1year');
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);
  const [annualPrice, setAnnualPrice] = useState<number>(1499);
  const [monthlyPrice, setMonthlyPrice] = useState<number>(199);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.config?.proAnnualPrice) setAnnualPrice(data.config.proAnnualPrice);
        if (data?.config?.proMonthlyPrice) setMonthlyPrice(data.config.proMonthlyPrice);
      })
      .catch(() => {});
  }, []);

  const proPrices = {
    '1year': {
      original: annualPrice * 2 * 100,
      discounted: annualPrice * 100,
      monthlyEquivalent: `₹${Math.round(annualPrice / 12)} / month`,
      savings: 'Save 50%',
    },
    '1month': {
      original: monthlyPrice * 2 * 100,
      discounted: monthlyPrice * 100,
      monthlyEquivalent: 'Billed monthly',
      savings: 'Standard',
    },
  } as const;

  const price = proPrices[duration];

  return (
    <div className="bg-white">
      <MarketingHeader />

      <section className="bg-brand-black text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">Simple, Transparent Pricing</h1>
          <p className="text-base text-slate-300">
            Start for free forever, or upgrade to Pro to unlock automated WhatsApp bills, GST filing and more.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="flex justify-center">
            <div className="bg-slate-100 p-1 rounded-xl border border-slate-200 inline-flex items-center">
              <button
                type="button"
                onClick={() => setDuration('1year')}
                className={`px-4 py-2 rounded-lg text-sm font-black ${
                  duration === '1year' ? 'bg-white text-brand-black shadow-sm border border-slate-300' : 'text-slate-500'
                }`}
              >
                Annual (50% Off)
              </button>
              <button
                type="button"
                onClick={() => setDuration('1month')}
                className={`px-4 py-2 rounded-lg text-sm font-black ${
                  duration === '1month' ? 'bg-white text-brand-black shadow-sm border border-slate-300' : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* FREE PLAN */}
            <div className="border border-slate-300 rounded-2xl p-6 flex flex-col justify-between space-y-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-lg font-black text-brand-black">Free Forever</h2>
                    <p className="text-xs text-slate-500">Essential counter billing for shops</p>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-black bg-slate-100 text-slate-700">₹0</span>
                </div>

                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-black text-brand-black">₹0</span>
                  <span className="text-xs text-slate-500 font-semibold">/ lifetime free</span>
                </div>

                <Link
                  href="/auth"
                  className="block w-full text-center py-2.5 rounded-lg border border-slate-300 text-brand-black font-bold text-sm"
                >
                  Get Started Free
                </Link>

                <div className="space-y-2 pt-2">
                  {[
                    'POS counter billing & item search',
                    'Customer credit khata ledger',
                    'Cash register note counter & till tally',
                    'Standard thermal print & WhatsApp link',
                    '100% offline local database',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {['Automatic cloud backup & sync', 'Expiry date radar & batches', 'GSTR-1 tax reports & HSN'].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-slate-400">
                      <X className="w-4 h-4 text-slate-300 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* PRO PLAN */}
            <div className="border-2 border-amber-400 rounded-2xl p-6 flex flex-col justify-between space-y-5 relative">
              <div className="absolute -top-3 right-5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-brand-yellow text-brand-black flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                All Features
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-lg font-black text-brand-black">KamaiPlus Pro</h2>
                    <p className="text-xs text-slate-500">Complete digital retail suite</p>
                  </div>
                  <span className="px-2.5 py-1 rounded text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                    {price.savings}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-xs text-slate-400 line-through font-bold">{formatINR(price.original)}</span>
                  <span className="text-3xl font-black text-brand-black">{formatINR(price.discounted)}</span>
                  <span className="text-xs text-slate-500 font-semibold">/ {duration === '1month' ? 'month' : 'year'}</span>
                </div>
                <div className="text-xs text-amber-800 font-bold -mt-3">{price.monthlyEquivalent}</div>

                <Link
                  href="/auth"
                  className="block w-full text-center py-2.5 rounded-lg bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm"
                >
                  Get Started with Pro
                </Link>

                <div className="space-y-2 pt-2">
                  {[
                    'Everything in Free Forever',
                    'Automatic cloud backup & multi-device sync',
                    'Batch numbers & expiry date radar',
                    'Government GSTR-1 & HSN tax reports',
                    'Custom barcode sticker label studio',
                    '1-click low-stock WhatsApp purchase orders',
                    'Staff roles & cashier lock PINs',
                    'All professional invoice designer themes',
                  ].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm font-bold text-brand-black">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* FAQ */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <h2 className="text-xl font-black text-brand-black text-center">Frequently Asked Questions</h2>
            <div className="space-y-2 max-w-2xl mx-auto">
              {FAQS.map((faq, idx) => (
                <div
                  key={faq.q}
                  onClick={() => setOpenFaqIdx(openFaqIdx === idx ? null : idx)}
                  className="p-4 bg-white border border-slate-200 rounded-xl cursor-pointer"
                >
                  <div className="flex items-center justify-between font-bold text-sm text-brand-black gap-3">
                    <span>{faq.q}</span>
                    <span className="text-slate-400 shrink-0">{openFaqIdx === idx ? '−' : '+'}</span>
                  </div>
                  {openFaqIdx === idx && (
                    <p className="text-sm text-slate-600 mt-2 leading-relaxed pt-2 border-t border-slate-100">{faq.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center pt-4">
            <Link href="/download" className="inline-flex items-center gap-2 text-brand-black font-bold text-sm underline">
              Not ready yet? See how to download the app
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
