'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { unitPriceFor } from '@/lib/billing/priceMode';
import { searchProducts } from '@/lib/search/productSearch';
import type { Category, Product } from '@/types';
import type { MenuPick } from '@/lib/restaurant/model';

/*
 * The menu of Restaurant mode = the shop's Products (v4.106.0): no second item list to keep. A dish
 * with Half / Full (a product with variants) shows once; tapping it asks which size. Dishes with no
 * price yet are shown but cannot be added (the waiter is told to set the price on Products).
 */

export interface MenuDish {
  product: Product;
  /** Half / Full… children of a parent product; empty for a plain dish. */
  sizes: Product[];
}

/**
 * v4.179.0: the menu order on every device — starred first, then A → Z by name (lower case, the same
 * compare as the phone's menu), so the PC and a waiter's phone list the dishes alike.
 */
export function menuOrder<T extends { name: string; is_favorite?: boolean }>(items: T[]): T[] {
  const key = (p: T) => p.name.trim().toLowerCase();
  return [...items].sort((a, b) => Number(Boolean(b.is_favorite)) - Number(Boolean(a.is_favorite)) || (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}

export const menuPick = (p: Product): MenuPick => ({ productId: p.id, name: p.name, unit: p.unit, basePaise: unitPriceFor(p, 'retail') });

export function useMenu(query: string, categoryId: string) {
  const products = useLiveQuery(() => db.products.toArray()) || [];
  const categories: Category[] = useLiveQuery(() => db.categories.toArray()) || [];

  const dishes = useMemo<MenuDish[]>(() => {
    const live = products.filter((p) => p.is_active !== false);
    const byParent = new Map<string, Product[]>();
    for (const p of live) if (p.parent_id) byParent.set(p.parent_id, [...(byParent.get(p.parent_id) || []), p]);
    const top = menuOrder(live.filter((p) => !p.parent_id));
    return top.map((p) => ({ product: p, sizes: (byParent.get(p.id) || []).sort((a, b) => a.selling_price - b.selling_price) }));
  }, [products]);

  const shown = useMemo<MenuDish[]>(() => {
    const inCategory = categoryId === 'all' ? dishes : dishes.filter((d) => d.product.category_id === categoryId);
    if (query.trim()) {
      const hits = searchProducts(inCategory.map((d) => d.product), query, { category: true });
      const byId = new Map(inCategory.map((d) => [d.product.id, d]));
      return hits.map((p) => byId.get(p.id)!).filter(Boolean);
    }
    return inCategory;
  }, [dishes, query, categoryId]);

  // Only categories that have a dish, in the order the shop made them.
  const usedCategories = useMemo(() => {
    const used = new Set(dishes.map((d) => d.product.category_id));
    return categories.filter((c) => used.has(c.id));
  }, [categories, dishes]);

  return { dishes: shown, categories: usedCategories, total: dishes.length };
}
