/**
 * Record ids (cloud data contract R8 / C12, v4.86.0).
 *
 * `sale_${Date.now()}` was unique on ONE computer; with the phone and a second counter
 * writing to the same cloud shop, two bills made in the same millisecond would share an
 * id and one would overwrite the other. The time stays first (lists sorted by id keep
 * their order, and the id still says when it was made), then 8 random characters.
 */
export function newId(prefix: string, stamp: number = Date.now()): string {
  let rand = '';
  try {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    rand = Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 8);
  } catch {
    rand = Math.random().toString(36).slice(2, 10);
  }
  return `${prefix}_${stamp}_${rand}`;
}
