'use client';

import React, { useMemo, useState } from 'react';
import { Copy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';
import { duplicateGroupKey, findDuplicateGroups, mergeDuplicateProducts } from '@/lib/products/duplicates';
import type { Product } from '@/types';

/** Groups the shop said are NOT duplicates (this computer only). */
const IGNORED_KEY = 'kamai_not_duplicates';

function readIgnored(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(IGNORED_KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Products → "N items look like duplicates — Review" (v4.103.0, K-D28, lib/products/duplicates.ts).
 * Each group: pick the item to keep, say the real stock, Merge — or "Not duplicates".
 */
export function DuplicateItemsReview({ products }: { products: Product[] }) {
  const [ignored, setIgnored] = useState<string[]>(readIgnored);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const groups = useMemo(
    () => findDuplicateGroups(products).filter((g) => !ignored.includes(duplicateGroupKey(g.map((p) => p.id)))),
    [products, ignored]
  );
  if (groups.length === 0) return null;

  const ignore = (g: Product[]) => {
    const next = [...ignored, duplicateGroupKey(g.map((p) => p.id))];
    setIgnored(next);
    try { localStorage.setItem(IGNORED_KEY, JSON.stringify(next)); } catch { /* only for this session then */ }
  };

  return (
    <>
      <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 flex flex-wrap items-center justify-between gap-2 text-xs" data-duplicate-items>
        <span className="flex items-center gap-2 font-bold text-amber-900">
          <Copy className="w-4 h-4" />
          {tr('{count} items look like duplicates (same barcode, or same name and unit).', { count: groups.reduce((n, g) => n + g.length, 0) })}
        </span>
        <Button size="sm" variant="outline" className="text-xs font-bold" onClick={() => setOpen(true)}>{tr('Review')}</Button>
      </div>
      {open && (
        <Modal isOpen onClose={() => setOpen(false)} size="lg" title={tr('Duplicate items')}
          description={tr('Keep one item of each group. Its bills, returns and stock history take the others\'; then they are removed.')}>
          {notice && <div className="mb-2 p-2 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-bold">{notice}</div>}
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            {groups.map((g) => (
              <DuplicateGroup key={duplicateGroupKey(g.map((p) => p.id))} group={g} onIgnore={() => ignore(g)} onMerged={(name) => setNotice(tr('Merged into "{name}".', { name }))} />
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

function DuplicateGroup({ group, onIgnore, onMerged }: { group: Product[]; onIgnore: () => void; onMerged: (name: string) => void }) {
  const [keepId, setKeepId] = useState(group[0].id);
  const keep = group.find((p) => p.id === keepId) || group[0];
  const [stockText, setStockText] = useState(String(keep.current_stock ?? 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (p: Product) => {
    setKeepId(p.id);
    setStockText(String(p.current_stock ?? 0));
  };
  const merge = async () => {
    const stock = parseFloat(stockText);
    if (!keep.is_unlimited_stock && !(stock >= 0)) return setError(tr('Enter the stock you really have (0 or more).'));
    setBusy(true);
    setError(null);
    try {
      const res = await mergeDuplicateProducts(keep.id, group.map((p) => p.id).filter((id) => id !== keep.id), stock || 0);
      if (res.ok) onMerged(keep.name);
      else setError(tr('Could not save. Please try again.'));
    } catch (e) {
      console.error('Merge failed:', e);
      setError(tr('Could not save. Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2 text-xs" data-duplicate-group>
      {group.map((p) => (
        <label key={p.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer ${p.id === keepId ? 'bg-emerald-50 border border-emerald-200' : 'border border-transparent'}`}>
          <input type="radio" checked={p.id === keepId} onChange={() => pick(p)} className="accent-emerald-600" />
          <span className="flex-1 min-w-0">
            <span className="font-bold text-slate-900 block truncate">{p.name}</span>
            <span className="text-[11px] text-slate-500 font-mono">
              {p.barcode || tr('no barcode')} • {formatINR(p.selling_price || 0)} • {tr('Stock:')} {p.is_unlimited_stock ? '∞' : p.current_stock} {p.unit}
              {p.created_at ? ` • ${new Date(p.created_at).toLocaleDateString('en-IN')}` : ''}
            </span>
          </span>
          {p.id === keepId && <span className="text-[10px] font-black uppercase text-emerald-700">{tr('Keep')}</span>}
        </label>
      ))}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!keep.is_unlimited_stock && (
          <label className="flex items-center gap-1.5 text-slate-600 font-semibold">
            {tr('Stock after merge')}
            <input type="number" min="0" step="any" value={stockText} onChange={(e) => setStockText(e.target.value)}
              className="w-24 border border-slate-300 rounded-lg px-2 py-1.5 font-mono text-slate-900" aria-label={tr('Stock after merge')} />
            <span>{keep.unit}</span>
          </label>
        )}
        <span className="flex-1" />
        <Button size="sm" variant="outline" className="text-xs" onClick={onIgnore}>{tr('Not duplicates')}</Button>
        <Button size="sm" className="text-xs font-bold" disabled={busy} onClick={merge}>{tr('Merge')}</Button>
      </div>
      {error && <div className="text-rose-700 font-bold">{error}</div>}
    </div>
  );
}
