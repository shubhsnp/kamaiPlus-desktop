import { Category } from '@/types';
import { msg, tr } from '@/lib/i18n/core';

/*
 * Products saved without a category used the id 'cat_general', which no
 * category has (the starter "General" category gets a generated id). They then
 * showed as "ITEM" and were missing from the "General" filter and its count.
 * New products go into the shop's real "General" category instead.
 */
export const FALLBACK_CATEGORY_ID = 'cat_general';

export function generalCategoryId(categories: Pick<Category, 'id' | 'name'>[]): string {
  return categories.find((c) => c.name.trim().toLowerCase() === 'general')?.id || FALLBACK_CATEGORY_ID;
}

/**
 * v4.93.0: the five starter categories ("General", "FMCG", …) showed in English in Hindi / Marathi.
 * The name saved stays English (cloud, Android, Excel all use it); only the screen translates it.
 * A category the shop typed itself is shown as typed.
 */
const STARTER_CATEGORY_LABELS: Record<string, string> = {
  General: msg('General'),
  FMCG: msg('FMCG'),
  'Loose Items': msg('Loose Items'),
  Apparel: msg('Apparel'),
  Accessories: msg('Accessories'),
};

export function categoryLabel(name: string | undefined | null): string {
  const n = (name || '').trim();
  const id = STARTER_CATEGORY_LABELS[n];
  return id ? tr(id) : n;
}
