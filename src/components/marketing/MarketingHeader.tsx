'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { useAppDownloadUrl } from '@/lib/marketing/useAppDownloadUrl';

const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/plans', label: 'Plans' },
  { href: '/download', label: 'Download' },
  { href: '/about', label: 'About' },
  { href: '/contact-us', label: 'Contact' },
];

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const downloadUrl = useAppDownloadUrl();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
          <img src="/logo.png" alt="KamaiPlus" className="w-8 h-8 rounded-lg object-contain" />
          <span className="font-black text-base text-brand-black tracking-tight">KamaiPlus</span>
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-slate-600 hover:text-brand-black"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3 shrink-0">
          <Link
            href="/auth"
            className="text-sm font-bold text-slate-700 hover:text-brand-black px-3 py-2"
          >
            Login
          </Link>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-black text-brand-black bg-brand-yellow hover:bg-amber-400 px-4 py-2 rounded-lg"
          >
            Download App
          </a>
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden p-2 -mr-2 text-slate-700"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 sm:px-6 py-4 space-y-1">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="block px-2 py-2.5 rounded-lg text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              {link.label}
            </Link>
          ))}
          <div className="flex items-center gap-3 pt-3 mt-2 border-t border-slate-100">
            <Link
              href="/auth"
              onClick={() => setMenuOpen(false)}
              className="flex-1 text-center text-sm font-bold text-slate-700 border border-slate-300 rounded-lg py-2.5"
            >
              Login
            </Link>
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-center text-sm font-black text-brand-black bg-brand-yellow rounded-lg py-2.5"
            >
              Download App
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
