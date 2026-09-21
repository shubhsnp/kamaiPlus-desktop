import { CashExpense, LedgerTransaction, Sale } from '@/types';
import { getSalePaymentBreakdown, isEstimate } from '@/lib/sales/saleMath';

export interface DrawerSummary {
  openingCash: number;
  cashSales: number;
  upiSales: number;
  cardSales: number;
  creditSales: number;
  khataCashCollected: number;
  cashExpenses: number;
  cashRefunds: number;
  /** opening + cash sales + khata cash − cash expenses (refunds are cash expenses) */
  expectedCash: number;
  billCount: number;
}

/**
 * Cash drawer arithmetic for one day (the caller passes that day's rows).
 *
 * - Cash sales count only the money kept: change handed back is excluded and
 *   the cash leg of a split bill is included.
 * - Estimates never touch the drawer.
 * - Khata payments received in cash are drawer money even though they are not sales.
 * - Cash refunds are recorded as `refund` cash expenses by Sales Return, so they
 *   leave the drawer through `cashExpenses`.
 */
export function computeDrawerSummary(params: {
  sales: Sale[];
  expenses: CashExpense[];
  ledger?: LedgerTransaction[];
  openingCash?: number;
}): DrawerSummary {
  const { sales, expenses, ledger = [], openingCash = 0 } = params;

  let cashSales = 0;
  let upiSales = 0;
  let cardSales = 0;
  let creditSales = 0;
  let billCount = 0;

  for (const sale of sales) {
    if (isEstimate(sale) || sale.status === 'cancelled') continue;
    billCount++;
    const p = getSalePaymentBreakdown(sale);
    cashSales += p.cash;
    upiSales += p.upi;
    cardSales += p.card;
    creditSales += p.credit;
  }

  const khataCashCollected = ledger
    .filter(
      (tx) =>
        tx.party_type === 'customer' &&
        tx.transaction_type === 'PAYMENT_RECEIVED' &&
        (tx.payment_method || '').toLowerCase() === 'cash'
    )
    .reduce((acc, tx) => acc + Math.max(0, tx.amount || 0), 0);

  const cashOnly = expenses.filter((e) => (e.payment_mode || 'cash') === 'cash');
  const cashExpenses = cashOnly.reduce((acc, e) => acc + Math.max(0, e.amount || 0), 0);
  const cashRefunds = cashOnly
    .filter((e) => e.category === 'refund')
    .reduce((acc, e) => acc + Math.max(0, e.amount || 0), 0);

  return {
    openingCash,
    cashSales,
    upiSales,
    cardSales,
    creditSales,
    khataCashCollected,
    cashExpenses,
    cashRefunds,
    expectedCash: openingCash + cashSales + khataCashCollected - cashExpenses,
    billCount,
  };
}
