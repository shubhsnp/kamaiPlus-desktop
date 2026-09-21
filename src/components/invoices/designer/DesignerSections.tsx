'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { InvoiceThemeConfig } from '@/types';
import { INVOICE_HEADINGS, INVOICE_PALETTE } from '@/lib/invoices/themeDefaults';
import { cn } from '@/lib/utils';

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
        <SectionTitle n={1}>Select Invoice Theme &amp; Color</SectionTitle>
        <span className="text-[11px] font-bold text-slate-600">{paletteMatch?.label || 'Custom colour'}</span>
      </div>
      <div className="flex items-center gap-2.5 flex-wrap">
        {INVOICE_PALETTE.map((p) => {
          const selected = p.hex.toLowerCase() === active;
          return (
            <button
              key={p.hex}
              type="button"
              title={p.label}
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
          Custom
        </label>
      </div>
    </Card>
  );
}

const TOGGLES: { key: keyof InvoiceThemeConfig; label: string }[] = [
  { key: 'show_logo', label: 'Show Store Logo' },
  { key: 'show_tagline', label: 'Show Tagline' },
  { key: 'show_owner', label: 'Show Owner & Phone' },
  { key: 'show_upi_qr', label: 'Show Dynamic UPI QR' },
  { key: 'show_signature', label: 'Authorised Signatory' },
  { key: 'show_gst_breakup', label: 'Show GST Tax Breakup' },
  { key: 'show_hsn_code', label: 'Show HSN/SAC Code' },
  { key: 'show_mrp_savings', label: 'Show MRP Savings Badge' },
  { key: 'show_terms', label: 'Show Terms & Conditions' },
  { key: 'show_pharmacy_rx', label: '💊 Pharmacy Rx & D.L.' },
];

/** 2. Heading and display toggles — every one of them changes the printed bill. */
export function DisplayOptionsSection({ config, onChange }: { config: InvoiceThemeConfig; onChange: Patch }) {
  return (
    <Card className="p-4 bg-white border border-slate-200 space-y-3 shadow-2xs">
      <SectionTitle n={2}>Header &amp; Invoice Display Options</SectionTitle>
      <div className="space-y-1.5">
        <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">Invoice Document Heading</div>
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
              <span className="text-[11.5px] font-bold text-slate-800 truncate">{t.label}</span>
            </button>
          );
        })}
      </div>
      {config.show_pharmacy_rx && (
        <div className="p-3 bg-sky-50/70 rounded-xl border border-sky-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[10.5px] font-bold text-slate-700">
            Drug License (D.L.) No
            <input
              type="text"
              value={config.drug_license_no || ''}
              onChange={(e) => onChange({ drug_license_no: e.target.value })}
              placeholder="e.g. 20B/21B-44910"
              className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:border-sky-500"
            />
          </label>
          <label className="text-[10.5px] font-bold text-slate-700">
            Registered Pharmacist No
            <input
              type="text"
              value={config.pharmacist_reg_no || ''}
              onChange={(e) => onChange({ pharmacist_reg_no: e.target.value })}
              placeholder="e.g. PH-109281"
              className="mt-0.5 w-full px-2 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-mono focus:outline-none focus:border-sky-500"
            />
          </label>
        </div>
      )}
    </Card>
  );
}

/** 3. Terms (up to four lines print) and the thank-you footer. */
export function TermsFooterSection({ config, onChange }: { config: InvoiceThemeConfig; onChange: Patch }) {
  return (
    <Card className="p-4 bg-white border border-slate-200 space-y-3 shadow-2xs">
      <SectionTitle n={3}>Terms &amp; Footer Note</SectionTitle>
      <label className="block text-[11.5px] font-bold text-slate-700">
        Terms &amp; Conditions <span className="font-medium text-slate-400">(one per line, first 4 lines print)</span>
        <textarea
          rows={4}
          value={config.custom_terms || ''}
          onChange={(e) => onChange({ custom_terms: e.target.value })}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
          placeholder={'1. Goods once sold will not be taken back.\n2. Subject to local jurisdiction.'}
        />
      </label>
      <label className="block text-[11.5px] font-bold text-slate-700">
        Footer Thank You Note
        <input
          type="text"
          value={config.custom_footer || ''}
          onChange={(e) => onChange({ custom_footer: e.target.value })}
          className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-slate-900"
          placeholder="Thank you for shopping with us! Visit again."
        />
      </label>
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span className="text-[10.5px] font-bold text-slate-400">Presets:</span>
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
