import { db } from '@/lib/db';
import { Category } from '@/types';

/*
 * Categories created while entering stock (v4.78.0): typing a name that already exists
 * (any case / spacing) picks that category instead of adding a second one.
 */

export const categoryKey = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();

/** The saved category with this name, if any. */
export function findCategoryByName(categories: Pick<Category, 'id' | 'name'>[], name: string) {
  const key = categoryKey(name);
  return key ? categories.find((c) => categoryKey(c.name) === key) : undefined;
}

/** The category called `name` — the saved one, or a new one saved now. */
export async function findOrCreateCategory(name: string, businessId: string): Promise<{ category: Category; created: boolean }> {
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!clean) throw new Error('Category name is empty');
  return db.transaction('rw', db.categories, async () => {
    const existing = findCategoryByName(await db.categories.toArray(), clean) as Category | undefined;
    if (existing) return { category: existing, created: false };
    const category: Category = { id: `cat_${Date.now()}`, business_id: businessId, name: clean, created_at: new Date().toISOString() };
    await db.categories.put(category);
    return { category, created: true };
  });
}
