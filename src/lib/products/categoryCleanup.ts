import { db } from '@/lib/db';
import { shopVertical } from '@/lib/products/shopVertical';
import { foreignStarterCategoryIds } from '@/lib/products/verticalCatalog';

/**
 * v4.175.0: removes the generic starter categories this shop's vertical does not use (FMCG / Apparel…
 * in a restaurant) while no item points to them — rule in verticalCatalog.ts. Runs once a session
 * (AppShell, 20 s after unlock), so they cannot creep back from an old seed or the cloud. The delete
 * goes to the cloud as a tombstone (cloudOutbox), so the shop's phone drops them too.
 */
export async function removeForeignStarterCategories(): Promise<number> {
  const vertical = shopVertical();
  if (!vertical) return 0;
  const [categories, products] = await Promise.all([db.categories.toArray(), db.products.toArray()]);
  const ids = foreignStarterCategoryIds(vertical, categories, products);
  if (ids.length) await db.categories.bulkDelete(ids);
  return ids.length;
}
