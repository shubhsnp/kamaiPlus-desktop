'use client';

import { showConfirm } from '@/lib/ui/dialogs';
import { useState } from 'react';
import { Check, RotateCcw, Eye, X, Sparkles, Store, QrCode, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import type { ChangedField } from '@/components/settings/SettingsChangeDialogue';

// Own file since v4.104.0 (K-D23); SettingsChangeDialogue re-exports it, so imports stay the same.
interface SettingsReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  changedFields: ChangedField[];
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onDiscard: () => void;
}

/**
 * 🔍 Interactive Dialogue Modal: Review & Compare Changes
 * Displays detailed side-by-side diff of every modified setting before committing to database.
 */
export function SettingsReviewModal({
  isOpen,
  onClose,
  changedFields,
  isSaving,
  onSave,
  onDiscard,
}: SettingsReviewModalProps) {
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('all');

  if (!isOpen) return null;

  const categories = [
    { id: 'all', label: tr('All ({length})', { length: changedFields.length }) },
    ...Array.from(new Set(changedFields.map((f) => f.category))).map((cat) => {
      const field = changedFields.find((f) => f.category === cat);
      const catCount = changedFields.filter((f) => f.category === cat).length;
      return { id: cat, label: `${field?.categoryLabel || cat} (${catCount})` };
    }),
  ];

  const filteredFields = activeCategoryFilter === 'all'
    ? changedFields
    : changedFields.filter((f) => f.category === activeCategoryFilter);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'profile': return <Store className="w-3.5 h-3.5 text-blue-500" />;
      case 'upi': return <QrCode className="w-3.5 h-3.5 text-amber-500" />;
      case 'invoicing': return <Receipt className="w-3.5 h-3.5 text-purple-500" />;

      default: return <Sparkles className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">{tr('Review Settings Changes')}</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                  {changedFields.length} {tr('Modified')}
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                {tr('Compare your changes before saving to local database and syncing POS counters.')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label={tr('Close modal')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Filter Chips */}
        {categories.length > 2 && (
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-1.5 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCategoryFilter(c.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  activeCategoryFilter === c.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Body: Modified Fields List */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filteredFields.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Check className="w-8 h-8 mx-auto mb-1 text-emerald-500" />
              <p className="text-xs font-bold text-slate-600">{tr('No modifications in this category')}</p>
            </div>
          ) : (
            filteredFields.map((field) => (
              <div 
                key={field.key} 
                className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-300 transition space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {getCategoryIcon(field.category)}
                    <span className="text-xs font-black text-slate-900 truncate">
                      {field.label}
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700 uppercase tracking-wider">
                    {field.categoryLabel}
                  </span>
                </div>

                {/* Diff View */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {/* Previous Value */}
                  <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 space-y-0.5">
                    <span className="text-[10.5px] uppercase font-bold text-rose-600 block tracking-wider font-sans">
                      {tr('Previous Value')}
                    </span>
                    <div className="truncate font-semibold line-through opacity-80" title={field.oldValue || tr('(Empty)')}>
                      {field.oldValue ? field.oldValue : <span className="italic font-normal text-rose-400">{tr('(Empty / Unset)')}</span>}
                    </div>
                  </div>

                  {/* New Value */}
                  <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-0.5">
                    <span className="text-[10.5px] uppercase font-bold text-emerald-700 block tracking-wider font-sans">
                      {tr('New Value (Pending)')}
                    </span>
                    <div className="truncate font-bold text-emerald-800" title={field.newValue || tr('(Empty)')}>
                      {field.newValue ? field.newValue : <span className="italic font-normal text-emerald-600">{tr('(Empty / Removed)')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={async () => {
              if (await showConfirm(tr('Discard all pending changes and restore previous settings?'), { danger: true, confirmLabel: tr('Discard') })) {
                onDiscard();
                onClose();
              }
            }}
            disabled={isSaving}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition flex items-center justify-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{tr('Discard All Changes')}</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full sm:w-auto text-xs font-bold cursor-pointer"
            >
              {tr('Keep Editing')}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={async () => {
                await onSave();
                onClose();
              }}
              disabled={isSaving}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{tr('Saving...')}</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{tr('Apply & Save All Changes')}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
