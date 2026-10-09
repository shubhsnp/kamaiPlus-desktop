'use client';

import React from 'react';
import { 
  Store, 
  ShoppingBag, 
  UtensilsCrossed, 
  Shirt, 
  Smartphone, 
  Activity, 
  CheckCircle2 
} from 'lucide-react';
import { tr } from '@/lib/i18n/core';

export interface RetailCategoryOption {
  id: string;
  title: string;
  desc: string;
  badge: string;
  icon: React.ElementType;
  accentColor: string;
  borderColor: string;
  bgColor: string;
}

export const RETAIL_CATEGORIES: RetailCategoryOption[] = [
  {
    id: 'grocery',
    title: 'Grocery / Kirana',
    desc: 'Loose items, FMCG, Rice, Atta & Barcodes',
    badge: 'Kirana & FMCG',
    icon: Store,
    accentColor: 'text-amber-400',
    borderColor: 'border-amber-500/50',
    bgColor: 'bg-amber-500/10',
  },
  {
    id: 'pharmacy',
    title: 'Medical / Pharmacy',
    desc: 'Batch numbers, Expiry dates & Strips',
    badge: 'Chemist & Medical',
    icon: Activity,
    accentColor: 'text-rose-400',
    borderColor: 'border-rose-500/50',
    bgColor: 'bg-rose-500/10',
  },
  {
    id: 'clothing',
    title: 'Apparel / Clothing',
    desc: 'Sizes S/M/L/XL, Colors & Garments',
    badge: 'Garments & Wear',
    icon: Shirt,
    accentColor: 'text-purple-400',
    borderColor: 'border-purple-500/50',
    bgColor: 'bg-purple-500/10',
  },
  {
    id: 'hardware',
    title: 'Electronics & Mobile',
    desc: 'Serial numbers, Accessories & Gadgets',
    badge: 'Hardware & Mobile',
    icon: Smartphone,
    accentColor: 'text-blue-400',
    borderColor: 'border-blue-500/50',
    bgColor: 'bg-blue-500/10',
  },
  {
    id: 'restaurant',
    title: 'Cafe / Restaurant',
    desc: 'Table orders, Food items & KOT tokens',
    badge: 'Cafe & Dining',
    icon: UtensilsCrossed,
    accentColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/50',
    bgColor: 'bg-emerald-500/10',
  },
  {
    id: 'retail',
    title: 'General Retail Store',
    desc: 'Quick counter billing, barcode & khata',
    badge: 'Universal Retail',
    icon: ShoppingBag,
    accentColor: 'text-teal-400',
    borderColor: 'border-teal-500/50',
    bgColor: 'bg-teal-500/10',
  },
];

interface CategorySelectorProps {
  selectedId: string;
  onSelect: (categoryId: string) => void;
}

export function CategorySelector({ selectedId, onSelect }: CategorySelectorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {tr('Business Category / Vertical *')}
        </label>
        <span className="text-[10px] text-slate-500 font-semibold">
          {tr('Tailors features & sample catalog')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {RETAIL_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isSelected = selectedId === cat.id;

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelect(cat.id)}
              className={`relative text-left p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-full ${
                isSelected
                  ? `bg-slate-900 ${cat.borderColor} ring-2 ring-amber-400/30 shadow-lg shadow-black/40`
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2 w-full mb-2">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isSelected ? cat.bgColor : 'bg-slate-900 border border-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isSelected ? cat.accentColor : 'text-slate-400'}`} />
                </div>
                {isSelected && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                )}
              </div>

              <div>
                <div className="font-bold text-xs text-white leading-tight mb-1">
                  {tr(cat.title)}
                </div>
                <div className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                  {tr(cat.desc)}
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  {tr(cat.badge)}
                </span>
                <span className={`text-[10px] font-bold ${isSelected ? cat.accentColor : 'text-slate-600'}`}>
                  {isSelected ? tr('Selected') : tr('Choose')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
