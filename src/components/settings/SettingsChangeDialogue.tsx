'use client';

import { useState } from 'react';
import { Check, RotateCcw, Eye, Save, ArrowRight, Sparkles, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';

export interface ChangedField {
  key: string;
  label: string;
  category: 'profile' | 'upi' | 'invoicing';
  categoryLabel: string;
  oldValue: string;
  newValue: string;
}

interface SettingsChangeBarProps {
  changedFields: ChangedField[];
  isSaving: boolean;
  onSave: () => Promise<void> | void;
  onDiscard: () => void;
  onOpenReview: () => void;
}

/**
 * ⚡ Floating Interactive Dialogue Bar
 * Appears smoothly at the bottom of the screen when any setting is modified.
 */
export function SettingsChangeBar({
  changedFields,
  isSaving,
  onSave,
  onDiscard,
  onOpenReview,
}: SettingsChangeBarProps) {
  const count = changedFields.length;
  if (count === 0) return null;

  // Collect unique category labels modified
  const modifiedCategories = Array.from(
    new Set(changedFields.map((f) => f.categoryLabel))
  );

  return (
    <div 
      className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[94vw] sm:w-auto animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
      role="region"
      aria-label={tr('Unsaved settings changes toolbar')}
    >
      <div className="bg-slate-950/95 backdrop-blur-xl border-2 border-amber-500/70 text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl shadow-slate-950/90 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Status indicator & Summary */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4 animate-spin text-amber-300" style={{ animationDuration: '4s' }} />
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-slate-950 animate-ping" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-black tracking-tight text-white flex items-center gap-1">
                <span>{tr('Unsaved Changes')}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
                  {count} {count === 1 ? 'field' : 'fields'}
                </span>
              </span>
              <span className="hidden md:inline-block text-[10px] text-slate-400 font-mono">
                {tr('(Press')} <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-bold">Ctrl+S</kbd> {tr('to save)')}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 truncate max-w-[280px] sm:max-w-xs">
              {tr('Modified in:')} <span className="text-amber-200 font-semibold">{modifiedCategories.join(', ')}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0 justify-end">
          {/* Review Changes Button */}
          <button
            type="button"
            onClick={onOpenReview}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer active:scale-95"
            title={tr('Review all modified settings before saving')}
          >
            <Eye className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden xs:inline">{tr('Review')}</span>
          </button>

          {/* Discard Changes Button */}
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 transition cursor-pointer active:scale-95 disabled:opacity-50"
            title={tr('Revert all changes back to saved database state')}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{tr('Discard')}</span>
          </button>

          {/* Save All Changes Button */}
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>{tr('Saving...')}</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-slate-950" />
                <span>{tr('Save Changes')}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { SettingsReviewModal } from '@/components/settings/SettingsReviewModal';

interface SettingsUnsavedTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetTabName: string;
  onSaveAndSwitch: () => Promise<void> | void;
  onDiscardAndSwitch: () => void;
  changedCount: number;
}

/**
 * 🛡️ Interactive Navigation & Tab Switch Guard Dialogue
 * Prompts user when attempting to switch tabs with unsaved edits.
 */
export function SettingsUnsavedTabModal({
  isOpen,
  onClose,
  targetTabName,
  onSaveAndSwitch,
  onDiscardAndSwitch,
  changedCount,
}: SettingsUnsavedTabModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 bg-amber-500/10 border-b border-amber-200 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400 flex items-center justify-center text-amber-700 shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">{tr('Unsaved Changes Detected')}</h3>
            <p className="text-xs text-slate-600 mt-0.5">
              {tr('You have')} <span className="font-bold text-amber-700">{changedCount} {tr('unsaved')} {changedCount === 1 ? tr('change') : tr('changes')}</span>{tr('. Do you want to save them before switching to')} <b>{targetTabName}</b>?
            </p>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {/* Option 1: Save & Switch */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={async () => {
              setIsProcessing(true);
              await onSaveAndSwitch();
              setIsProcessing(false);
            }}
            className="w-full p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 border-2 border-emerald-500/60 text-emerald-950 flex items-center justify-between transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <Check className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-950">{tr('Save & Continue')}</div>
                <div className="text-[10.5px] text-emerald-700">{tr('Save all changes to database and switch tab')}</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-700 group-hover:translate-x-1 transition-transform" />
          </button>

          {/* Option 2: Discard & Switch */}
          <button
            type="button"
            disabled={isProcessing}
            onClick={() => {
              onDiscardAndSwitch();
            }}
            className="w-full p-3 rounded-xl bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 text-rose-950 flex items-center justify-between transition cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 text-left">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
                <RotateCcw className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-rose-950">{tr('Discard & Switch')}</div>
                <div className="text-[10.5px] text-rose-700">{tr('Revert changes and switch tab without saving')}</div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-rose-700 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            {tr('Stay on Current Tab')}
          </Button>
        </div>
      </div>
    </div>
  );
}
