'use client';

import React, { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Category } from '@/types';
import { findOrCreateCategory } from '@/lib/products/categories';
import { showAlert } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';
import { categoryLabel } from '@/lib/products/defaultCategory';

interface CategoryPickerProps {
  categories: Category[];
  value: string;
  onChange: (id: string) => void;
  businessId: string;
  /** First choice when nothing is picked (e.g. "General", or "Keep as it is"). */
  emptyLabel?: string;
  className?: string;
}

/**
 * A category list with "+ New" right next to it (v4.78.0): type a name, Enter — it is
 * saved and chosen (a name that already exists picks that category).
 */
export function CategoryPicker({ categories, value, onChange, businessId, emptyLabel, className = '' }: CategoryPickerProps) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const { category } = await findOrCreateCategory(name, businessId);
      onChange(category.id);
      setAdding(false);
      setName('');
    } catch (err: any) {
      showAlert(tr('Could not save: {error}', { error: err?.message || '' }));
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void create(); }
            if (e.key === 'Escape') { e.stopPropagation(); setAdding(false); setName(''); }
          }}
          placeholder={tr('New category name')}
          className="h-8 w-40 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
          data-category-new-name
        />
        <button type="button" disabled={busy || !name.trim()} onClick={() => void create()} className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-slate-900 text-white disabled:opacity-40 cursor-pointer" aria-label={tr('Add')} data-category-new-save>
          <Check className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => { setAdding(false); setName(''); }} className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 cursor-pointer" aria-label={tr('Cancel')}>
          <X className="w-3.5 h-3.5" />
        </button>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-8 px-2 rounded-lg border border-slate-300 bg-white text-xs font-bold max-w-[14rem]" data-category-select>
        {emptyLabel !== undefined && <option value="">{emptyLabel}</option>}
        {categories.map((c) => <option key={c.id} value={c.id}>{categoryLabel(c.name)}</option>)}
      </select>
      <button type="button" onClick={() => setAdding(true)} className="h-8 px-2 inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold cursor-pointer" title={tr('New category')} data-category-new>
        <Plus className="w-3.5 h-3.5" /> {tr('New')}
      </button>
    </span>
  );
}
