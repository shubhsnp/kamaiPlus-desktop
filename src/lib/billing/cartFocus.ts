import type { CartItem } from '@/types';

/**
 * Which bill line the cashier should be looking at (v4.93.0): the line just added or whose
 * quantity just went up — the bill scrolls to it and it flashes; Scan mode shows it big.
 * A removal or a lower quantity changes nothing.
 */
export function lastChangedLine(prev: Map<string, number>, cart: CartItem[]): CartItem | null {
  for (let i = cart.length - 1; i >= 0; i--) {
    const line = cart[i];
    const before = prev.get(line.product_id);
    if (before === undefined || line.quantity > before) return line;
  }
  return null;
}

/** The quantities of a cart, to compare the next cart against. */
export function cartQuantities(cart: CartItem[]): Map<string, number> {
  return new Map(cart.map((l) => [l.product_id, l.quantity]));
}

/**
 * How far `container` must scroll so `el` is fully in view (0 = already in view). Only this
 * box moves — Element.scrollIntoView would also scroll the page around it.
 */
export function scrollDeltaToShow(
  container: { top: number; bottom: number },
  el: { top: number; bottom: number },
  margin = 8
): number {
  if (el.bottom > container.bottom) return Math.min(el.bottom - container.bottom + margin, el.top - container.top - margin);
  if (el.top < container.top) return el.top - container.top - margin;
  return 0;
}

export function scrollIntoContainer(container: HTMLElement | null, el: HTMLElement | null, margin = 8): void {
  if (!container || !el) return;
  const delta = scrollDeltaToShow(container.getBoundingClientRect(), el.getBoundingClientRect(), margin);
  if (delta) container.scrollTop += delta;
}
