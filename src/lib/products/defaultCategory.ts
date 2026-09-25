import { Category } from '@/types';

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
