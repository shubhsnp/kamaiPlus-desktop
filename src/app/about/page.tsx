import React from 'react';
import Link from 'next/link';
import { Store, Pill, UtensilsCrossed, Shirt, ArrowRight } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';

export const metadata = {
  title: 'About | KamaiPlus',
  description: 'Why KamaiPlus exists and who it is built for.',
};

const AUDIENCE = [
  { icon: Store, label: 'Kirana & General Stores' },
  { icon: Pill, label: 'Pharmacies' },
  { icon: UtensilsCrossed, label: 'Restaurants & Eateries' },
  { icon: Shirt, label: 'Apparel & Fashion Shops' },
];

export default function AboutPage() {
  return (
    <div className="bg-white">
      <MarketingHeader />

      <section className="bg-brand-black text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Built for the Backbone of India&apos;s Economy — Small Shop Owners
          </h1>
          <p className="text-base text-slate-300">
            KamaiPlus gives every Indian kirana store, pharmacy, restaurant and retail shop the same
            billing, inventory and growth tools that large retail chains use — without needing constant
            internet, expensive hardware, or a finance team.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          <div className="space-y-3">
            <h2 className="text-xl font-black text-brand-black">Why We Built KamaiPlus</h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Most billing software is built assuming always-on internet, English-only interfaces, and a
              team to manage it. That does not match how most Indian shops actually run — a single owner
              billing at the counter, patchy internet, and customers who still buy on credit (khata).
              KamaiPlus is built offline-first from the ground up, in Hindi and Marathi as well as English,
              so it works the way your shop already works — and gets out of your way.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-xl font-black text-brand-black">What We Believe</h2>
            <ul className="space-y-2 text-sm text-slate-600 leading-relaxed">
              <li>• Your shop shouldn&apos;t stop working because the internet did.</li>
              <li>• Good software should be usable on day one, with no training.</li>
              <li>• Your sales data belongs to you first — the cloud is a backup, not the only copy.</li>
              <li>• A ₹0 free plan should still be genuinely useful, not a crippled trial.</li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-black text-brand-black">Who KamaiPlus Is Built For</h2>
            <div className="grid grid-cols-2 gap-3">
              {AUDIENCE.map((a) => (
                <div key={a.label} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3.5">
                  <a.icon className="w-5 h-5 text-brand-black shrink-0" />
                  <span className="text-sm font-bold text-slate-800">{a.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-slate-100">
            <h2 className="text-xl font-black text-brand-black">Operating Entity</h2>
            <p className="text-sm text-slate-600">
              KamaiPlus is built and operated by ProVenture Solutions, Maharashtra, India.
            </p>
            <p className="text-sm text-slate-600">
              Questions? Reach us at{' '}
              <a href="mailto:info@proventure.in" className="font-bold text-brand-black underline">
                info@proventure.in
              </a>{' '}
              or visit our{' '}
              <Link href="/contact-us" className="font-bold text-brand-black underline">
                Contact page
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 border-t border-slate-100 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-5">
          <h2 className="text-2xl font-black text-brand-black tracking-tight">
            Ready to Try KamaiPlus?
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/download"
              className="inline-flex items-center gap-2 bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm px-6 py-3.5 rounded-xl"
            >
              Download App
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 border border-slate-300 hover:border-slate-400 text-brand-black font-bold text-sm px-6 py-3.5 rounded-xl"
            >
              Login to Web App
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
