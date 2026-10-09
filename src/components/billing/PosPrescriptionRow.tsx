'use client';

import React from 'react';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import type { CustomerDraft } from '@/lib/billing/billCustomer';

/**
 * Pharmacy (v4.126.0, AU-22): patient and doctor for a medicine sold on prescription — kept on this
 * bill only and printed on it. Shown when the shop's category uses it (bill_prescription).
 */
export function PosPrescriptionRow({ draft, onDraftChange }: { draft: CustomerDraft; onDraftChange: (d: CustomerDraft) => void }) {
  const on = useFeatureSwitches().bill_prescription;
  if (!on) return null;
  const box = 'h-9 w-full px-3 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-sky-500';
  return (
    <div className="grid grid-cols-2 gap-2 mt-1.5" data-pos-prescription>
      <input value={draft.patient || ''} onChange={(e) => onDraftChange({ ...draft, patient: e.target.value.slice(0, 60) })} placeholder={tr('Patient name (optional)')} className={box} data-pos-patient />
      <input value={draft.doctor || ''} onChange={(e) => onDraftChange({ ...draft, doctor: e.target.value.slice(0, 60) })} placeholder={tr('Doctor name (optional)')} className={box} data-pos-doctor />
    </div>
  );
}
