'use client';

import React from 'react';
import { tr } from '@/lib/i18n/core';
import { FIELD_MAX, typeDigits } from '@/lib/validation/validators';

/** Day / month / optional year of a birthday or anniversary (v4.150.0) — no free text, so no "31-02". */
export interface DayMonthValue { day: string; month: string; year: string }

export const EMPTY_DAY_MONTH: DayMonthValue = { day: '', month: '', year: '' };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const box = 'h-[38px] px-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-semibold focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900';

export function DayMonthField({ label, value, onChange, testId }: {
  label: string;
  value: DayMonthValue;
  onChange: (v: DayMonthValue) => void;
  testId?: string;
}) {
  return (
    <div className="w-full flex flex-col gap-1 text-left" data-day-month={testId}>
      <span className="text-xs font-bold text-slate-900">{label}</span>
      <div className="flex gap-1.5">
        <select aria-label={tr('Day')} value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} className={`${box} w-16`}>
          <option value="">{tr('Day')}</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
        </select>
        <select aria-label={tr('Month')} value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })} className={`${box} flex-1 min-w-0`}>
          <option value="">{tr('Month')}</option>
          {MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{tr(m)}</option>)}
        </select>
        <input
          aria-label={tr('Year (optional)')}
          placeholder={tr('Year')}
          inputMode="numeric"
          maxLength={FIELD_MAX.year}
          value={value.year}
          onChange={(e) => onChange({ ...value, year: typeDigits(e.target.value, FIELD_MAX.year) })}
          className={`${box} w-20`}
        />
      </div>
    </div>
  );
}
