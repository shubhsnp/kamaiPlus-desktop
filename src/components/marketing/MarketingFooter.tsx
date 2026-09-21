import React from 'react';
import Link from 'next/link';

export function MarketingFooter() {
  return (
    <footer className="bg-brand-black text-slate-300">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-2 sm:grid-cols-4 gap-8">
        <div className="col-span-2 sm:col-span-1 space-y-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="KamaiPlus" className="w-7 h-7 rounded-lg object-contain" />
            <span className="font-black text-white text-base">KamaiPlus</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Offline-first billing, khata &amp; growth platform for Indian kirana stores, pharmacies, restaurants and retail shops.
          </p>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Product</div>
          <Link href="/features" className="block text-sm font-medium text-slate-300 hover:text-white">Features</Link>
          <Link href="/plans" className="block text-sm font-medium text-slate-300 hover:text-white">Plans &amp; Pricing</Link>
          <Link href="/download" className="block text-sm font-medium text-slate-300 hover:text-white">Download</Link>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Company</div>
          <Link href="/about" className="block text-sm font-medium text-slate-300 hover:text-white">About</Link>
          <Link href="/contact-us" className="block text-sm font-medium text-slate-300 hover:text-white">Contact Us</Link>
          <Link href="/auth" className="block text-sm font-medium text-slate-300 hover:text-white">Login</Link>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Legal</div>
          <Link href="/privacy-policy" className="block text-sm font-medium text-slate-300 hover:text-white">Privacy Policy</Link>
          <Link href="/terms-of-service" className="block text-sm font-medium text-slate-300 hover:text-white">Terms of Service</Link>
          <Link href="/refund-policy" className="block text-sm font-medium text-slate-300 hover:text-white">Refund Policy</Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-xs text-slate-500 text-center">
          &copy; {new Date().getFullYear()} KamaiPlus &middot; ProVenture Solutions, Maharashtra, India
        </div>
      </div>
    </footer>
  );
}
