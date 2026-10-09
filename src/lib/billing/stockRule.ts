/**
 * Does the counter hold this item to its stock? (v4.119.0, AU-30)
 *
 * Not when the item is "Unlimited stock", and not when the shop does not count stock at all
 * (Stock counting off — e.g. a restaurant): there the stock number is hidden everywhere, so the
 * counter must never say "Out of stock" or refuse the item because of it. The sale still lowers
 * the hidden number, so switching counting on later starts from a true count of what was sold.
 */
export function countsStockAtCounter(product: { is_unlimited_stock?: boolean }, stockCountingOn: boolean): boolean {
  return stockCountingOn && !product.is_unlimited_stock;
}
