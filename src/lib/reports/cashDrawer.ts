import { CashExpense, LedgerTransaction, Sale } from '@/types';
import { getSaleNetTotal, getSalePaymentBreakdown, isEstimate, isRevenueSale } from '@/lib/sales/saleMath';

/** "2026-09-21" in the shop's local time (never the UTC date of an ISO string). */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface DaySummary extends DrawerSummary {
  dateKey: string;
  /** Bills that count as sales that day (estimates, cancelled and fully returned bills excluded). */
  sales: Sale[];
  netSalesPaise: number;
  itemsCount: number;
  topItems: { name: string; qty: number; totalPaise: number }[];
  totalExpensePaise: number;
  netCashInTillPaise: number;
}

/** Day-End / Z-report figures for one local calendar day, from the same drawer rules as the Cash Register. */
export function summarizeDay(params: {
  sales: Sale[];
  expenses: CashExpense[];
  ledger?: LedgerTransaction[];
  dateKey?: string;
}): DaySummary {
  const dateKey = params.dateKey || localDateKey(new Date());
  const onDay = (iso: string) => localDateKey(new Date(iso)) === dateKey;
  const daySalesAll = params.sales.filter((s) => onDay(s.created_at));
  const dayExpenses = params.expenses.filter((e) => onDay(e.created_at));
  const dayLedger = (params.ledger || []).filter((t) => onDay(t.created_at));
  const drawer = computeDrawerSummary({ sales: daySalesAll, expenses: dayExpenses, ledger: dayLedger });

  const sales = daySalesAll.filter(isRevenueSale);
  const freq = new Map<string, { qty: number; totalPaise: number }>();
  let itemsCount = 0;
  for (const s of sales) {
    for (const item of s.items || []) {
      const kept = Math.max(0, (item.quantity || 0) - (item.returned_quantity || 0));
      itemsCount += kept;
      const entry = freq.get(item.product_name) || { qty: 0, totalPaise: 0 };
      entry.qty += kept;
      entry.totalPaise += item.total_amount || 0;
      freq.set(item.product_name, entry);
    }
  }

  return {
    ...drawer,
    dateKey,
    sales,
    netSalesPaise: sales.reduce((acc, s) => acc + getSaleNetTotal(s), 0),
    itemsCount,
    topItems: Array.from(freq.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.qty - a.qty),
    totalExpensePaise: dayExpenses.reduce((acc, e) => acc + Math.max(0, e.amount || 0), 0),
    netCashInTillPaise: Math.max(0, drawer.expectedCash),
  };
}

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
