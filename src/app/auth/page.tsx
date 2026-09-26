// src/app/auth/page.tsx
'use client';

import React from 'react';
import { AuthForm } from '@/components/auth/AuthForm';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ShieldCheck } from 'lucide-react';
import { tr } from '@/lib/i18n/core';

export default function AuthPage() {
  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <LanguageSwitcher className="absolute top-4 right-4 z-20" />

      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Official Brand Logo & Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 sm:w-22 sm:h-22 mb-3 rounded-2xl bg-slate-900/80 p-2 border border-slate-800 shadow-xl flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Kamai+ Logo"
              className="w-full h-full object-contain drop-shadow-md"
            />
          </div>

          <div className="flex items-center gap-2 justify-center">
            <h1 className="text-3xl font-black text-amber-400 tracking-tight">Kamai+</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 text-[10px] font-bold border border-amber-400/20">
              <ShieldCheck className="w-3 h-3 text-amber-400" />
              <span>{tr('Verified POS')}</span>
            </span>
          </div>

          <p className="text-sm font-medium text-slate-400 mt-1">
            आपकी दुकान का डिजिटल साथी
          </p>
        </div>

        {/* Local master-password lock for this computer */}
        <AuthForm />

        <div className="mt-6 text-center text-xs text-slate-500 font-medium">
          {tr('Your store data stays on this computer.')}
        </div>
      </div>
    </main>
  );
}