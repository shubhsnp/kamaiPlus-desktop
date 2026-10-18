import { db } from '@/lib/db';
import { Business, Sale } from '@/types';
import { cloudSendActive } from '@/lib/cloud/cloudPush';

/**
 * v4.179.0: a PC and a phone billing the same shop (cloud sync on) each keep their own series — the
 * PC's bills D-001, D-002…, the phone's M-001… (Android LocalDatabase.getNextInvoiceNumber) — so two
 * bills made at the same moment can never get the same number. Only the default "INV-" changes; a
 * prefix the shop chose itself stays. Sync off = INV- exactly as before.
 */
export const PC_INVOICE_SERIES = 'D-';
export function devicePrefix(stored: string | undefined, synced: boolean): string {
  const prefix = (stored || 'INV-').trim().toUpperCase() || 'INV-';
  return synced && prefix === 'INV-' ? PC_INVOICE_SERIES : prefix;
}
/** The prefix this computer's next bill uses. */
export function effectiveInvoicePrefix(business: Pick<Business, 'invoice_prefix'> | undefined): string {
  let synced = false;
  try { synced = cloudSendActive(); } catch { /* no localStorage (tests) */ }
  return devicePrefix(business?.invoice_prefix, synced);
}

/**
 * Formats a prefix and integer sequence into a standardized, zero-padded invoice code.
 * e.g. ("INV-", 1) -> "INV-001"
 * e.g. ("INV-", 25) -> "INV-025"
 * e.g. ("BILL-", 100) -> "BILL-100"
 */
export function formatInvoiceNumber(
  prefix = 'INV-',
  sequenceNumber = 1,
  padDigits = 3
): string {
  const cleanPrefix = prefix ? prefix.trim().toUpperCase() : 'INV-';
  const seq = Math.max(1, Math.floor(sequenceNumber || 1));
  const paddedSeq = String(seq).padStart(padDigits, '0');
  return `${cleanPrefix}${paddedSeq}`;
}

/**
 * Extracts the trailing integer number from an invoice code.
 * e.g. "INV-002" -> 2
 * e.g. "BILL-1045" -> 1045
 */
export function parseInvoiceSequenceNumber(invoiceNumber: string): number | null {
  if (!invoiceNumber) return null;
  const match = invoiceNumber.match(/(\d+)$/);
  if (match && match[1]) {
    const num = parseInt(match[1], 10);
    return isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Highest invoice sequence already used, cached against the sales row count.
 *
 * Reading every sale on every bill made "Complete Sale" slower as a shop's history
 * grew. The max is now computed from the `invoice_number` index keys only (no sale
 * objects are deserialised) and reused while the row count is unchanged. Any write
 * that adds or removes sales (restore, cloud pull, clear history) changes the count
 * and forces a rescan.
 */
let maxSeqCache: { count: number; maxSeq: number; scope: string } | null = null;

/** `only` = count only that series (the PC's D- series ignores the phone's M- bills and the old INV- ones). */
async function getMaxUsedInvoiceSeq(only = ''): Promise<number> {
  const count = await db.sales.count();
  if (maxSeqCache && maxSeqCache.count === count && maxSeqCache.scope === only) return maxSeqCache.maxSeq;

  const keys = await db.sales.orderBy('invoice_number').uniqueKeys();
  let maxSeq = 0;
  for (const key of keys) {
    // Estimates (EST-007, v4.102.0) have their own series: they never push the bill number on.
    const parsed = typeof key === 'string' && !key.toUpperCase().startsWith('EST-') && (!only || key.toUpperCase().startsWith(only))
      ? parseInvoiceSequenceNumber(key) : null;
    if (parsed !== null && parsed > maxSeq) maxSeq = parsed;
  }
  maxSeqCache = { count, maxSeq, scope: only };
  return maxSeq;
}

/** Fills the cache ahead of time (called when the POS opens). Never throws. */
export async function warmInvoiceNumberCache(): Promise<void> {
  try {
    await getMaxUsedInvoiceSeq(seriesScope(effectiveInvoicePrefix(await db.businesses.toCollection().first())));
  } catch {
    // The next bill simply computes it itself.
  }
}

/** The series the max is read from: only the device series is counted on its own. */
const seriesScope = (prefix: string): string => (prefix === PC_INVOICE_SERIES ? PC_INVOICE_SERIES : '');

/** Resets the cached invoice sequence when sales history is wiped or restored. */
export function resetInvoiceNumberCache(): void {
  maxSeqCache = null;
}

/**
 * Computes the guaranteed next unique sequential invoice number for a business.
 * Inspects both the business's configured sequence counter and all existing recorded sales
 * to guarantee that no invoice number is ever duplicated or skipped.
 */
export async function getNextUniqueInvoiceNumber(businessId = 'biz_default'): Promise<{
  invoiceNumber: string;
  nextSeq: number;
  prefix: string;
}> {
  const business = await db.businesses.get(businessId);
  const prefix = effectiveInvoicePrefix(business);
  const scope = seriesScope(prefix);
  // The D- series starts at 001 and follows only its own bills (the shop's counter belongs to INV-).
  const configuredNext = scope ? 1 : business?.next_invoice_number || 1;

  // Next sequence must be strictly greater than any existing sale sequence
  let nextSeq = Math.max(configuredNext, (await getMaxUsedInvoiceSeq(scope)) + 1);
  let invoiceNumber = formatInvoiceNumber(prefix, nextSeq, 3);

  // Belt and braces: an indexed lookup guarantees the number is not already taken.
  while ((await db.sales.where('invoice_number').equals(invoiceNumber).count()) > 0) {
    nextSeq += 1;
    invoiceNumber = formatInvoiceNumber(prefix, nextSeq, 3);
  }

  return {
    invoiceNumber,
    nextSeq,
    prefix,
  };
}

/**
 * Atomically commits and advances the business invoice number counter after a sale is completed.
 */
export async function commitNextInvoiceNumber(
  businessId = 'biz_default',
  usedSequenceNumber: number
): Promise<number> {
  const nextNum = Math.max(1, usedSequenceNumber + 1);
  // The shop's counter is the INV- series; a D- bill (v4.179.0) follows its own bills only.
  if (!seriesScope(effectiveInvoicePrefix(await db.businesses.get(businessId)))) {
    await db.businesses.update(businessId, {
      next_invoice_number: nextNum,
      updated_at: new Date().toISOString(),
    });
  }
  // The sale carrying this number is already saved: keep the cache in step so the
  // next bill does not rescan the index.
  const count = await db.sales.count();
  if (maxSeqCache) maxSeqCache = { ...maxSeqCache, count, maxSeq: Math.max(maxSeqCache.maxSeq, usedSequenceNumber) };
  return nextNum;
}
