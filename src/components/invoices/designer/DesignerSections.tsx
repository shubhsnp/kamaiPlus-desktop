'use client';

import React from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { InvoiceThemeConfig } from '@/types';
import { INVOICE_HEADINGS, INVOICE_PALETTE } from '@/lib/invoices/themeDefaults';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';

type Patch = (patch: Partial<InvoiceThemeConfig>) => void;

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[11px] font-black flex items-center justify-center">{n}</span>
      <span>{children}</span>
    </h2>
  );
}

/** 1. Theme colour — the Android palette plus a custom colour. */
export function ThemeColorSection({ config, onChange }: { config: InvoiceThemeConfig; onChange: Patch }) {
  const active = config.primary_color.toLowerCase();
  const paletteMatch = INVOICE_PALETTE.find((p) => p.hex.toLowerCase() === active);
  return (
    <Card className="p-4 bg-white border border-slate-200 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle n={1}>{tr('Select Invoice Theme & Color')}</SectionTitle>
        <span className="text-[11px] font-bold text-slate-600">{(paletteMatch ? tr(paletteMatch.label) : null) || tr('Custom colour')}</span>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        {INVOICE_PALETTE.map((p) => {
          const selected = p.hex.toLowerCase() === active;
          return (
            <button
              key={p.hex}
              type="button"
              title={tr(p.label)}
              onClick={() => onChange({ primary_color: p.hex, theme_id: p.themeId })}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center cursor-pointer border-2 border-white shadow-2xs transition-transform',
                selected ? 'ring-2 ring-offset-2 ring-slate-900 scale-110' : 'hover:scale-105'
              )}
              style={{ backgroundColor: p.hex }}
            >
              {selected && <Check className="w-4 h-4 text-white stroke-[3]" />}
            </button>
          );
        })}
        <label className="flex items-center gap-1.5 pl-2 ml-1 border-l border-slate-200 text-[11px] font-bold text-slate-600 cursor-pointer">
          <input
            type="color"
            value={config.primary_color}
            onChange={(e) => onChange({ primary_color: e.target.value.toUpperCase() })}
            className="w-9 h-9 rounded-full border-2 border-white shadow-2xs p-0.5 bg-white cursor-pointer"
          />
          {tr('Custom')}
        </label>
      </div>
    </Card>
  );
}

const TOGGLES: { key: keyof InvoiceThemeConfig; label: string }[] = [
  { key: 'show_logo', label: msg('Show Store Logo') },
  { key: 'show_tagline', label: msg('Show Tagline') },
  { key: 'show_owner', label: msg('Show Owner & Phone') },
  { key: 'show_upi_qr', label: msg('Show UPI QR (payment code)') },
  { key: 'show_signature', label: msg('Authorised Signatory') },
  { key: 'show_gst_breakup', label: msg('Show GST Tax Breakup') },
  { key: 'show_hsn_code', label: msg('Show HSN/SAC Code') },
  { key: 'show_mrp_savings', label: msg('Show MRP Savings Badge') },
  { key: 'show_terms', label: msg('Show Terms & Conditions') },
];

/** 2. Heading and display toggles — every one of them changes the printed bill (A4 and thermal). */
export function DisplayOptionsSection({ config, onChange, hasUpi = true }: { config: InvoiceThemeConfig; onChange: Patch; hasUpi?: boolean }) {
  return (
    <Card className="p-4 bg-white border border-slate-200 space-y-3 shadow-2xs">
      <SectionTitle n={2}>{tr('Header & Invoice Display Options')}</SectionTitle>
      <div className="space-y-1.5">
        <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">{tr('Invoice Document Heading')}</div>
        <div className="grid grid-cols-2 gap-1.5">
          {INVOICE_HEADINGS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => onChange({ custom_title: h })}
              className={cn(
                'px-2 py-2 rounded-lg border text-[11px] font-black cursor-pointer transition-all',
                config.custom_title === h ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              )}
            >
              {h}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {TOGGLES.map((t) => {
          const checked = Boolean(config[t.key]);
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange({ [t.key]: !checked } as Partial<InvoiceThemeConfig>)}
              className={cn(
                'px-2.5 py-2 rounded-lg border text-left flex items-center gap-2 cursor-pointer transition-all',
                checked ? 'border-emerald-400 bg-emerald-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'
              )}
            >
              <span
                className={cn(
                  'w-4 h-4 rounded flex items-center justify-center border shrink-0',
                  checked ? 'bg-emerald-600 border-emerald-600' : 'border-slate-300 bg-white'
                )}
              >
                {checked && <Check className="w-3 h-3 text-white stroke-[3]" />}
              </span>
              <span className="text-[11.5px] font-bold text-slate-800 truncate">{tr(t.label)}</span>
            </button>
          );
        })}
      </div>
      {config.show_upi_qr && (
        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5" data-designer-upi>
          <label className="flex items-center gap-2 text-[11.5px] font-bold text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={config.show_upi_qr_thermal !== false}
              onChange={(e) => onChange({ show_upi_qr_thermal: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 cursor-pointer"
              data-designer-upi-thermal
            />
            {tr('Also print the UPI QR on 58mm / 80mm thermal bills')}
          </label>
          {!hasUpi && (
            <p className="text-[10.5px] font-semibold text-amber-800" data-designer-upi-missing>
              {tr('No UPI ID saved yet, so no QR prints.')}{' '}
              <Link href="/settings?tab=upi" className="underline">{tr('Add UPI ID in Settings')}</Link>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

/** 3. Terms (up to four lines print) and the thank-you footer. */
export function TermsFooterSection({ config, onChange }: { config: InvoiceThemeConfig; onChange: Patch }) {
  return (
    <Card className="p-4 bg-white border border-slate-200 space-y-3 shadow-2xs">
      <SectionTitle n={3}>{tr('Terms & Footer Note')}</SectionTitle>
      <label className="block text-[11.5px] font-bold text-slate-700">
        {tr('Terms & Conditions')} <span className="font-medium text-slate-400">{tr('(one per line, first 4 lines print)')}</span>
        <textarea
          rows={4}
          value={config.custom_terms || ''}
          onChange={(e) => onChange({ custom_terms: e.target.value })}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
          placeholder={tr('1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.')}
        />
      </label>
      <label className="block text-[11.5px] font-bold text-slate-700">
        {tr('Footer Thank You Note')}
        <input
          type="text"
          value={config.custom_footer || ''}
          onChange={(e) => onChange({ custom_footer: e.target.value })}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
          placeholder={tr('Thank you for shopping with us! Visit again.')}
        />
      </label>
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span className="text-[10.5px] font-bold text-slate-400">{tr('Presets:')}</span>
        {[
          'Thank You! Visit Again 🙏',
          'Goods once sold cannot be returned',
          'Sunday Closed • Open 9AM - 10PM',
          'Fixed Rate Shop • No Bargaining',
        ].map((tagline) => (
          <button
            key={tagline}
            type="button"
            onClick={() => onChange({ custom_footer: tagline })}
            className="px-2 py-0.5 rounded text-[10.5px] font-semibold bg-slate-100 text-slate-700 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 cursor-pointer transition"
          >
            {tagline}
          </button>
        ))}
      </div>
    </Card>
  );
}
