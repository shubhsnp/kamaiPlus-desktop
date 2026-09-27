'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { COLUMN_ROLES, ColumnRole } from '@/lib/import/catalogImport';
import { tr } from '@/lib/i18n/core';

interface ImportColumnMapperProps {
  headers: string[];
  /** First few data values of every column (shown as examples). */
  samples: string[][];
  roles: ColumnRole[];
  onChange: (roles: ColumnRole[]) => void;
}

/** Step 2 of the Excel import: "this column is the item name / price / …" — guessed, correctable. */
export function ImportColumnMapper({ headers, samples, roles, onChange }: ImportColumnMapperProps) {
  const setRole = (index: number, role: ColumnRole) => {
    // A role belongs to one column: picking it here frees it elsewhere.
    onChange(roles.map((r, i) => (i === index ? role : role !== 'ignore' && r === role ? 'ignore' : r)));
  };
  const missing = [
    !roles.includes('name') && tr('Item name'),
    !roles.includes('price') && tr('Price'),
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-slate-600">
        {tr('Check what each column of your sheet is. The app guessed it from the headings — change any that are wrong.')}
      </p>
      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[46vh] overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold sticky top-0">
            <tr>
              <th className="p-2.5">{tr('Column in your sheet')}</th>
              <th className="p-2.5">{tr('Example values')}</th>
              <th className="p-2.5 w-52">{tr('Use as')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {headers.map((h, i) => (
              <tr key={i} className={roles[i] === 'ignore' ? 'text-slate-400' : ''}>
                <td className="p-2.5 font-bold text-slate-900">{h || tr('Column {n}', { n: i + 1 })}</td>
                <td className="p-2.5 text-slate-600 truncate max-w-[260px]" title={samples[i]?.join(' · ')}>
                  {samples[i]?.filter(Boolean).slice(0, 3).join(' · ') || '—'}
                </td>
                <td className="p-2">
                  <select
                    value={roles[i]}
                    onChange={(e) => setRole(i, e.target.value as ColumnRole)}
                    data-column-role={i}
                    className="w-full h-9 px-2 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    {COLUMN_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>{tr(r.label)}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {missing.length > 0 && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{tr('Choose the column for: {fields}', { fields: missing.join(', ') })}</span>
        </div>
      )}
    </div>
  );
}
