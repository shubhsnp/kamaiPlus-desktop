import type { CartItem, Customer, Product } from '@/types';

/**
 * Retail / wholesale price per bill (v4.87.0, Customer Change — first client).
 *
 * An item can carry a second selling price, `wholesale_price` (paise; 0 / missing = none).
 * A bill is "retail" (the normal price) or "wholesale": then every item that has a wholesale
 * price sells at it; an item without one keeps its retail price. Picking a customer marked
 * wholesale (`Customer.is_wholesale`) turns the bill to wholesale by itself.
 */

export type PriceMode = 'retail' | 'wholesale';

/** The unit price of an item on a bill of this mode (paise). */
export function unitPriceFor(product: Pick<Product, 'selling_price' | 'wholesale_price'>, mode: PriceMode): number {
  const wholesale = Number(product.wholesale_price) || 0;
  return mode === 'wholesale' && wholesale > 0 ? wholesale : product.selling_price;
}

/** Does the item have a wholesale price at all? */
export const hasWholesalePrice = (product: Pick<Product, 'wholesale_price'> | undefined | null) => (Number(product?.wholesale_price) || 0) > 0;

/** The mode a customer's bills start in (a wholesale customer → wholesale). */
export function modeForCustomer(customer: Pick<Customer, 'is_wholesale'> | undefined | null): PriceMode {
  return customer?.is_wholesale ? 'wholesale' : 'retail';
}

/**
 * The cart after switching the bill from one mode to the other. A line still at the old
 * mode's price moves to the new one (line total and GST worked out again, its own discount
 * kept); a rate the cashier typed by hand is left alone. Items no longer in the catalogue stay.
 * `taxOf` is the counter's own GST rule (inclusive / exclusive per the shop).
 */
export function repriceCart(
  cart: CartItem[],
  products: Pick<Product, 'id' | 'selling_price' | 'wholesale_price'>[],
  from: PriceMode,
  to: PriceMode,
  taxOf: (lineTotal: number, taxRate: number, inclusive?: boolean) => number
): CartItem[] {
  if (from === to) return cart;
  const byId = new Map(products.map((p) => [p.id, p]));
  return cart.map((line) => {
    const product = byId.get(line.product_id);
    if (!product || line.unit_price !== unitPriceFor(product, from)) return line;
    const price = unitPriceFor(product, to);
    if (price === line.unit_price) return line;
    const total = Math.max(0, Math.round(line.quantity * price) - (line.discount_amount || 0));
    return { ...line, unit_price: price, total_amount: total, tax_amount: taxOf(total, line.tax_rate || 0, line.is_tax_inclusive) };
  });
}
