/**
 * Udhar (credit) limit per customer (v4.102.0, tracker K-D03) — the same field as the Android
 * app (`credit_limit_paise` in the cloud). 0 or unset = no limit. The counter only warns: the
 * shop decides whether to give more udhar.
 */
export interface CreditLimitCheck {
  /** True when this bill takes the customer past the limit. */
  over: boolean;
  /** What the customer will owe after this bill, paise. */
  after: number;
  /** The limit, paise (0 = none). */
  limit: number;
}

export function checkCreditLimit(customer: { credit_limit?: number; current_balance?: number } | null | undefined, udharThisBillPaise: number): CreditLimitCheck {
  const limit = Math.max(0, Math.round(customer?.credit_limit || 0));
  const after = Math.round((customer?.current_balance || 0) + Math.max(0, udharThisBillPaise));
  return { over: limit > 0 && udharThisBillPaise > 0 && after > limit, after, limit };
}

/**
 * The udhar a bill will add, as the counter will save it: the whole bill on Credit; the credit part
 * of a split plus what is not split (a customer is on the bill); the shortfall of cash typed below
 * the bill total.
 */
export function udharOfBill(p: {
  method: string;
  grandTotalPaise: number;
  splitPaise?: { cash: number; upi: number; card: number; credit: number };
  typedCashPaise?: number | null;
}): number {
  if (p.method === 'credit') return p.grandTotalPaise;
  if (p.method === 'split' && p.splitPaise) {
    const s = p.splitPaise;
    const unassigned = Math.max(0, p.grandTotalPaise - (s.cash + s.upi + s.card + s.credit));
    return s.credit + unassigned;
  }
  if (p.method === 'cash' && p.typedCashPaise != null) return Math.max(0, p.grandTotalPaise - p.typedCashPaise);
  return 0;
}
