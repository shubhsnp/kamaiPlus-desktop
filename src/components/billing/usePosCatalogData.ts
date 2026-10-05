import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Product } from '@/types';
import { warmInvoiceNumberCache } from '@/lib/invoices/invoiceNumberService';
import { useDebounce } from 'use-debounce';
import { searchProducts } from '@/lib/search/productSearch';
import { prewarmCloud } from '@/lib/firebase/lazyCloud';
import { favouritesFirst } from '@/lib/billing/posLayout';
import { warmBillPrinting } from '@/components/billing/BillPrintQueue';
import type { Business } from '@/types';

export interface UsePosCatalogDataDeps {
  searchQuery: string;
  selectedCategory: string;
  business: Business | undefined;
}

/**
 * What the counter shows to pick from (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged):
 * categories, customers, item count, category counts and variant "from ₹X" (worked out when the number
 * of items changes), the searched / filtered product list, and the variant picker state.
 */
export function usePosCatalogData(deps: UsePosCatalogDataDeps) {
  const {
    searchQuery, selectedCategory, business,
  } = deps;
  const categories = useLiveQuery(async () => db.categories.toArray()) || [];
  const customers = useLiveQuery(async () => db.customers.toArray()) || [];

  const totalProductCount = useLiveQuery(() => db.products.count()) || 0;

  // One indexed pass over the category column instead of one count() query per
  // category (a shop with 30 categories used to fire 30 serial IndexedDB reads
  // every time the counter screen opened). Category counts and each variant parent's
  // "from ₹X" are worked out when the NUMBER of items changes — not after every write
  // (v4.97.0): a sale only changes stock, and as live queries they re-read the whole
  // catalogue after every bill line (16 full passes for an 8-line bill, ~2 s on 5,000 items).
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [variantInfo, setVariantInfo] = useState<Record<string, { count: number; minPricePaise: number }>>({});
  useEffect(() => {
    let alive = true;
    void (async () => {
      const counts: Record<string, number> = {};
      await db.products.orderBy('category_id').eachKey((key) => {
        const id = String(key);
        counts[id] = (counts[id] || 0) + 1;
      });
      const children = await db.products.filter((p) => Boolean(p.parent_id) && p.is_active !== false).toArray();
      const map: Record<string, { count: number; minPricePaise: number }> = {};
      for (const c of children) {
        const cur = map[c.parent_id!];
        map[c.parent_id!] = cur
          ? { count: cur.count + 1, minPricePaise: Math.min(cur.minPricePaise, c.selling_price) }
          : { count: 1, minPricePaise: c.selling_price };
      }
      if (alive) {
        setCategoryCounts(counts);
        setVariantInfo(map);
      }
    })();
    return () => {
      alive = false;
    };
  }, [totalProductCount]);

  const [debouncedSearch] = useDebounce(searchQuery, 300);
  
  const [products, setProducts] = useState<any[]>([]);

  // Variant picker (products with sizes / colours); each parent's "from ₹X" is worked out above.
  const [variantPick, setVariantPick] = useState<{ parent: Product; qty: number } | null>(null);

  // Pull the cloud-sync bundle in while the cashier is still picking items, so
  // the first bill of the day does not wait for it.
  useEffect(() => {
    prewarmCloud();
    // Same idea for invoice numbering: scan the invoice-number index once now, so
    // the first "Complete Sale" of the session uses the cache.
    const warm = () => { void warmInvoiceNumberCache(); warmBillPrinting(business); };
    const ric = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    if (ric) ric(warm, { timeout: 3000 });
    else window.setTimeout(warm, 1000);
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchProducts() {
      try {
        // Variants live under their parent (picker on tap); a search finds them directly.
        const searching = Boolean(debouncedSearch.trim());
        let prods = db.products.filter(p => p.is_active !== false && (searching || !p.parent_id));

        // Filter by Category
        if (selectedCategory !== 'all') {
          prods = prods.filter(p => p.category_id === selectedCategory);
        }

        // No limit needed now that we are using Virtualization (Phase 1)
        const all = await prods.toArray();
        // Name, barcode or category — typed in English or हिंदी / मराठी (lib/search/productSearch.ts),
        // best matches first.
        const data = searching ? searchProducts(all, debouncedSearch, { category: true }) : favouritesFirst(all);
        if (isMounted) {
          setProducts(data);
        }
      } catch (err) {
        console.error('Error fetching POS products:', err);
      }
    }
    fetchProducts();
    return () => { isMounted = false; };
  }, [debouncedSearch, selectedCategory]);

  return { categories, customers, totalProductCount, categoryCounts, variantInfo, products, variantPick, setVariantPick };
}
