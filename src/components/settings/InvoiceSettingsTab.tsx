'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Receipt, 
  Palette, 
  ArrowRight, 
  FileText, 
  Sparkles 
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PrintSettingsCard } from '@/components/settings/PrintSettingsCard';
import { LabelPrinterCard } from '@/components/settings/LabelPrinterCard';
import { WhatsAppSettingsCard } from '@/components/settings/WhatsAppSettingsCard';

import { formatInvoiceNumber } from '@/lib/invoices/invoiceNumberService';
import { tr } from '@/lib/i18n/core';

interface InvoiceSettingsTabProps {
  invoicePrefix: string;
  setInvoicePrefix: (val: string) => void;
  nextInvoiceNumber: string;
  setNextInvoiceNumber: (val: string) => void;
  gstPricingMode: 'exclusive' | 'inclusive';
  setGstPricingMode: (val: 'exclusive' | 'inclusive') => void;
  terms: string;
  setTerms: (val: string) => void;
  footerMessage: string;
  setFooterMessage: (val: string) => void;
}

export const InvoiceSettingsTab: React.FC<InvoiceSettingsTabProps> = ({
  invoicePrefix,
  setInvoicePrefix,
  nextInvoiceNumber,
  setNextInvoiceNumber,
  gstPricingMode,
  setGstPricingMode,
  terms,
  setTerms,
  footerMessage,
  setFooterMessage,
}) => {
  const currentSamplePreview = formatInvoiceNumber(
    invoicePrefix || 'INV-',
    parseInt(nextInvoiceNumber, 10) || 1,
    3
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Invoice Numbering & Pricing Mode */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Tax Invoice Series & Calculation Rules')}
            </h3>
          </div>

          <Link
            href="/invoice-designer"
            className="px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-bold text-xs flex items-center gap-1 shadow-2xs hover:bg-amber-100"
          >
            <Palette className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            <span>{tr('Customize Bill Layout & Themes')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={tr('Invoice Prefix')}
            placeholder={tr('e.g. INV- or BILL-')}
            value={invoicePrefix}
            onChange={(e) => setInvoicePrefix(e.target.value.toUpperCase())}
          />
          <Input
            label={tr('Next Invoice Sequence #')}
            placeholder={tr('e.g. 1')}
            type="number"
            min="1"
            value={nextInvoiceNumber}
            onChange={(e) => setNextInvoiceNumber(e.target.value)}
          />
        </div>

        {/* Live Preview Box */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">{tr('Next Generated Bill Number Preview:')}</span>
            <div className="text-[11px] text-slate-400">{tr('Zero-padded serial: e.g. INV-001, INV-002, INV-003, INV-010, INV-100')}</div>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950 border border-amber-300 dark:border-amber-700 font-mono font-black text-amber-950 dark:text-amber-300 text-sm shadow-2xs shrink-0 text-center">
            {currentSamplePreview}
          </div>
        </div>

        {/* GST Pricing Mode Selector */}
        <div>
          <label className="block text-xs font-black text-slate-700 dark:text-slate-300 mb-1.5">
            {tr('Default GST Calculation & Price Display Mode')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div
              onClick={() => setGstPricingMode('inclusive')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                gstPricingMode === 'inclusive'
                  ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                  {tr('Tax-Inclusive (MRP Pricing)')}
                </span>
                {gstPricingMode === 'inclusive' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-1">
                {tr('Selling price includes GST. Ideal for Kirana, Grocery, Retail, FMCG & Apparel.')}
              </p>
            </div>

            <div
              onClick={() => setGstPricingMode('exclusive')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                gstPricingMode === 'exclusive'
                  ? 'bg-amber-50/70 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/30'
                  : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                  {tr('Tax-Exclusive (Base + GST Extra)')}
                </span>
                {gstPricingMode === 'exclusive' && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                )}
              </div>
              <p className="text-[10.5px] text-slate-400 mt-1">
                {tr('GST added on top of base rate. Ideal for B2B Wholesale, Hardware, and Restaurants.')}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Bill Terms & Footer Note */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <FileText className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {tr('Terms & Conditions and Footer Note')}
          </h3>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tr('Standard Invoice Terms & Return Policy (Printed at Bottom of Bill)')}
          </label>
          <textarea
            rows={3}
            placeholder={tr('e.g. 1. Goods once sold will not be taken back after 7 days. 2. Subject to local jurisdiction.')}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tr('Footer Thank You Message')}
          </label>
          <input
            type="text"
            placeholder={tr('e.g. Thank you for shopping with us! Visit again. 🙏')}
            value={footerMessage}
            onChange={(e) => setFooterMessage(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <span className="text-[10.5px] font-bold text-slate-400">{tr('Quick Taglines:')}</span>
            {[
              'Thank You! Visit Again 🙏',
              'Goods once sold cannot be returned',
              'Sunday Closed • Open 9AM - 10PM',
              'Fixed Rate Shop • No Bargaining',
            ].map((tagline) => (
              <button
                key={tagline}
                type="button"
                onClick={() => setFooterMessage(tagline)}
                className="px-2 py-0.5 rounded-md text-[10.5px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100 hover:text-amber-900 border border-slate-200 dark:border-slate-700 cursor-pointer transition"
              >
                {tagline}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* 3. Printer Setup (per computer) */}
      <PrintSettingsCard />

      <LabelPrinterCard />

      <WhatsAppSettingsCard />
    </div>
  );
};
