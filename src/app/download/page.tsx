'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import { Download, Smartphone, Globe, ArrowRight, WifiOff } from 'lucide-react';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { useAppDownloadUrl } from '@/lib/marketing/useAppDownloadUrl';

export default function DownloadPage() {
  const downloadUrl = useAppDownloadUrl();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    QRCode.toDataURL(downloadUrl, { margin: 1, width: 240, color: { dark: '#0F172A', light: '#FFFFFF' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [downloadUrl]);

  return (
    <div className="bg-white">
      <MarketingHeader />

      <section className="bg-brand-black text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div className="space-y-5 text-center md:text-left">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              Get KamaiPlus on Your Phone
            </h1>
            <p className="text-base text-slate-300">
              Download the Android app for the fastest, most reliable billing counter experience —
              or use the web app in any browser, no install needed.
            </p>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-brand-yellow hover:bg-amber-400 text-brand-black font-black text-sm px-6 py-3.5 rounded-xl"
              >
                <Download className="w-4 h-4" />
                Download for Android
              </a>
              <Link
                href="/auth"
                className="inline-flex items-center gap-2 border border-white/30 hover:border-white/60 text-white font-bold text-sm px-6 py-3.5 rounded-xl"
              >
                Login to Web App
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-xs text-slate-500">Works on Android 6.0 and above. 100% offline billing once installed.</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white rounded-2xl p-5 flex flex-col items-center gap-3 w-fit">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Scan to download KamaiPlus" className="w-48 h-48" />
              ) : (
                <div className="w-48 h-48 bg-slate-100 rounded-lg" />
              )}
              <span className="text-xs font-bold text-brand-black">Scan to Download</span>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="border border-slate-200 rounded-2xl p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <h2 className="font-black text-base text-brand-black">Android App</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              The full KamaiPlus experience — Bluetooth thermal printing, barcode scanning with your
              camera, and 100% offline billing. Recommended for your main billing counter.
            </p>
          </div>
          <div className="border border-slate-200 rounded-2xl p-6 space-y-3">
            <div className="w-11 h-11 rounded-xl bg-brand-black text-brand-yellow flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <h2 className="font-black text-base text-brand-black">Web App</h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Login from any computer or phone browser at the same account — no installation needed.
              Great for checking reports from home or a second counter.
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
          <div className="flex items-start gap-3 border border-amber-200 bg-amber-50 rounded-2xl p-5">
            <WifiOff className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">
              Both the app and the web app save your data locally first, so billing keeps working even
              when the internet does not. Everything syncs to the cloud automatically once you are back online.
            </p>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
