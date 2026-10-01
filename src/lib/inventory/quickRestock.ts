import { db } from '@/lib/db';
import { cloudMerge } from '@/lib/firebase/lazyCloud';
import type { Product } from '@/types';

/**
 * POS quick restock (moved out of app/billing/page.tsx in v4.87.0, unchanged): the item's stock
 * goes up by `restockQty` with a PURCHASE line in the stock history, and the saved item comes back
 * so the counter can add it to the bill.
 */
export async function quickRestockProduct(product: Product, restockQty: number, businessId?: string): Promise<Product> {
  const now = new Date().toISOString();
  const current = Number(product.current_stock ?? 0);
  const newStock = current + restockQty;
  const updatedProduct: Product = { ...product, current_stock: newStock, updated_at: now };

  await db.products.put(updatedProduct);
  await db.inventory_movements.put({
    id: `mov_pos_restock_${Date.now()}_${product.id}`,
    business_id: product.business_id || businessId || 'biz_default',
    product_id: product.id,
    product_name: product.name,
    movement_type: 'PURCHASE',
    quantity: restockQty,
    previous_stock: current,
    new_stock: newStock,
    reason: `POS Quick Restock (+${restockQty} ${product.unit || 'units'}) during billing`,
    created_by: 'cashier',
    created_at: now,
  });

  // Direct cloud sync to prevent stale overwrite (never blocks the cart)
  const bizId = product.business_id || businessId;
  if (bizId && bizId !== 'biz_default') {
    void cloudMerge(`businesses/${bizId}/products/${product.id}`, updatedProduct);
  }
  return updatedProduct;
}
