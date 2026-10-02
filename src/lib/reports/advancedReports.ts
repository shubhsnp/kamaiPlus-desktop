import { Category, Product, Sale, SalesReturn } from '@/types';
import {
  getLineGrossPaise,
  getNetPaymentBreakdown,
  getReturnedQtyByLine,
  getSaleNetTotal,
  isRevenueSale,
} from '@/lib/sales/saleMath';
import { msg, tr } from '@/lib/i18n/core';

/**
 * Advanced Sales Analytics — port of the Android ReportsRepository.
 *
 * Rules every figure follows (same as Android, and as Home's profit tile):
 *  - Fully returned bills and estimates are excluded; partially returned bills
 *    count only what the customer kept (returned quantity is taken off each line).
 *  - Line revenue is the GST-inclusive line amount, prorated for returns.
 *  - Profit covers ONLY lines whose buying price was frozen on the sale
 *    (`cost_price`); other lines are counted as "uncosted", never as 100% margin.
 *  - Periods are half-open: start <= created_at < end, in local time.
 */

export const WALK_IN_ID = 'walkin';
export const DEAD_STOCK_PREFIX = 'dead_';

export interface ProfitCoverage {
  totalProfitPaise: number;
  costedRevenuePaise: number;
  uncostedRevenuePaise: number;
  uncostedLineCount: number;
}

export function isProfitPartial(p: ProfitCoverage): boolean {
  return p.uncostedLineCount > 0;
}

/** Margin over the revenue it actually covers (costed lines only). */
export function marginPercent(p: ProfitCoverage): number {
  return p.costedRevenuePaise > 0 ? (p.totalProfitPaise * 100) / p.costedRevenuePaise : 0;
}

export interface PartySalesSummary extends ProfitCoverage {
  partyId: string;
  partyName: string;
  partyPhone: string;
  totalSalesPaise: number;
  totalCostPaise: number;
  invoiceCount: number;
  creditPaise: number;
}

export interface CategorySalesSummary extends ProfitCoverage {
  categoryName: string;
  totalSalesPaise: number;
  totalCostPaise: number;
  quantitySold: number;
}

export interface ItemSalesSummary extends ProfitCoverage {
  itemId: string;
  itemName: string;
  categoryName: string;
  totalSalesPaise: number;
  totalCostPaise: number;
  quantitySold: number;
  stockQuantity: number;
  unit: string;
}

export interface PaymentModeSummary {
  totalCashPaise: number;
  totalUpiPaise: number;
  totalCardPaise: number;
  totalCreditPaise: number;
  totalPaise: number;
}

export interface AdvancedReportsData extends ProfitCoverage {
  partyData: PartySalesSummary[];
  categoryData: CategorySalesSummary[];
  itemData: ItemSalesSummary[];
  paymentSummary: PaymentModeSummary;
  invoiceCount: number;
}

export function isDeadStock(item: ItemSalesSummary): boolean {
  return item.itemId.startsWith(DEAD_STOCK_PREFIX);
}

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

export const REPORT_PERIOD_LABELS = [msg('Today'), msg('Yesterday'), msg('7 Days'), msg('This Month'), msg('Last Month')] as const;
export type ReportPeriodLabel = (typeof REPORT_PERIOD_LABELS)[number];

export interface ReportPeriod {
  label: string;
  start: Date;
  end: Date;
}

export function resolveReportPeriod(label: string, now: Date = new Date()): ReportPeriod {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const today = new Date(y, m, d);
  const tomorrow = new Date(y, m, d + 1);
  switch (label) {
    case 'Today':
      return { label, start: today, end: tomorrow };
    case 'Yesterday':
      return { label, start: new Date(y, m, d - 1), end: today };
    case '7 Days':
      // Today plus the six days before it.
      return { label, start: new Date(y, m, d - 6), end: tomorrow };
    case 'Last Month':
      return { label, start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
    case 'This Month':
    default:
      return { label: tr('This Month'), start: new Date(y, m, 1), end: new Date(y, m + 1, 1) };
  }
}

/** "1 Sep 2026 - 19 Sep 2026" — the last day shown is capped at today. */
export function periodSpanText(start: Date, end: Date, now: Date = new Date()): string {
  let last = new Date(end.getTime() - 1);
  if (last > now) last = now;
  const fmt = (x: Date) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const a = fmt(start);
  const b = fmt(last);
  return a === b ? a : `${a} - ${b}`;
}

/** "12", "2.5", "0.25" — whole numbers without decimals, loose quantities kept. */
export function formatReportQty(q: number): string {
  if (Number.isInteger(q)) return String(q);
  return q.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

// ---------------------------------------------------------------------------
// Aggregation (pure — no database access, so tests drive it directly)
// ---------------------------------------------------------------------------

interface Line {
  key: string;
  productId?: string;
  name: string;
  qty: number;
  revenue: number;
  cost: number | null;
}

class Acc {
  name = '';
  qty = 0;
  revenue = 0;
  cost = 0;
  costedRevenue = 0;
  uncostedRevenue = 0;
  uncostedLines = 0;

  constructor(public id: string) {}

  get profit(): number {
    return this.costedRevenue - this.cost;
  }

  add(l: Line) {
    this.qty += l.qty;
    this.revenue += l.revenue;
    if (l.cost === null) {
      this.uncostedRevenue += l.revenue;
      this.uncostedLines++;
    } else {
      this.cost += l.cost;
      this.costedRevenue += l.revenue;
    }
  }
}

export function partyIdOf(sale: Sale): string {
  return sale.customer_id ? sale.customer_id : WALK_IN_ID;
}

function returnsBySale(returns: SalesReturn[]): Map<string, SalesReturn[]> {
  const map = new Map<string, SalesReturn[]>();
  for (const r of returns) {
    const list = map.get(r.original_sale_id) || [];
    list.push(r);
    map.set(r.original_sale_id, list);
  }
  return map;
}

/**
 * A bill's lines net of returned quantity. Line amounts are scaled so they add
 * up to the bill total — bills saved before bill-level discounts were spread
 * over the lines otherwise show more item revenue than was billed.
 */
export function linesOf(sale: Sale, saleReturns: SalesReturn[] = []): Line[] {
  const items = sale.items || [];
  const returned = getReturnedQtyByLine(sale, saleReturns);
  const grossSum = items.reduce((acc, i) => acc + getLineGrossPaise(i), 0);
  const scale = grossSum > 0 && sale.grand_total < grossSum ? sale.grand_total / grossSum : 1;

  const lines: Line[] = [];
  items.forEach((item, idx) => {
    const sold = Number(item.quantity) || 0;
    const kept = Math.max(0, Math.min(sold, sold - (returned[idx] || 0)));
    if (sold <= 0 || kept <= 0) return;
    const gross = getLineGrossPaise(item) * scale;
    const revenue = Math.round(kept === sold ? gross : (gross * kept) / sold);
    const unitCost = Number(item.cost_price) || 0;
    const name = (item.product_name || '').trim() || 'Unknown Item';
    lines.push({
      key: item.product_id || `name:${name.toLowerCase()}`,
      productId: item.product_id || undefined,
      name,
      qty: kept,
      revenue,
      cost: unitCost > 0 ? Math.round(unitCost * kept) : null,
    });
  });
  return lines;
}

/** One party's totals from its bills (also used by the party detail view). */
export function summarizeParty(
  partyId: string,
  sales: Sale[],
  returns: SalesReturn[] = [],
  fallback: { name?: string; phone?: string } = {}
): PartySalesSummary {
  const isWalkIn = partyId === WALK_IN_ID;
  const byId = returnsBySale(returns);
  let name: string | undefined;
  let phone: string | undefined;
  let billed = 0;
  let credit = 0;
  let count = 0;
  const acc = new Acc(partyId);

  // Oldest first, so the most recent name / phone on record wins.
  const ordered = [...sales].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const sale of ordered) {
    if (!isRevenueSale(sale)) continue;
    const saleReturns = byId.get(sale.id) || [];
    count++;
    billed += getSaleNetTotal(sale, saleReturns);
    credit += getNetPaymentBreakdown(sale, saleReturns).credit;
    if (!isWalkIn) {
      if ((sale.customer_name || '').trim()) name = sale.customer_name!.trim();
      if ((sale.customer_phone || '').trim()) phone = sale.customer_phone!.trim();
    }
    linesOf(sale, saleReturns).forEach((l) => acc.add(l));
  }

  return {
    partyId,
    partyName: isWalkIn ? tr('Cash Customer') : name || fallback.name || tr('Customer'),
    partyPhone: isWalkIn ? '' : phone || fallback.phone || '',
    totalSalesPaise: billed,
    totalCostPaise: acc.cost,
    totalProfitPaise: acc.profit,
    invoiceCount: count,
    creditPaise: credit,
    costedRevenuePaise: acc.costedRevenue,
    uncostedRevenuePaise: acc.uncostedRevenue,
    uncostedLineCount: acc.uncostedLines,
  };
}

export function buildAdvancedReport(params: {
  sales: Sale[];
  returns: SalesReturn[];
  products: Product[];
  categories: Category[];
}): AdvancedReportsData {
  const { sales, returns, products, categories } = params;
  const productsById = new Map(products.map((p) => [p.id, p]));
  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const categoryOf = (productId?: string): string => {
    const product = productId ? productsById.get(productId) : undefined;
    if (!product) return 'General';
    return categoryNames.get(product.category_id) || product.category_name || 'General';
  };
  const byId = returnsBySale(returns);

  let cash = 0;
  let upi = 0;
  let card = 0;
  let credit = 0;
  let invoiceCount = 0;
  const salesByParty = new Map<string, Sale[]>();
  const items = new Map<string, Acc>();
  const cats = new Map<string, Acc>();

  for (const sale of sales) {
    if (!isRevenueSale(sale)) continue;
    const saleReturns = byId.get(sale.id) || [];
    invoiceCount++;
    const pay = getNetPaymentBreakdown(sale, saleReturns);
    cash += pay.cash;
    upi += pay.upi;
    card += pay.card;
    credit += pay.credit;
    const pid = partyIdOf(sale);
    salesByParty.set(pid, [...(salesByParty.get(pid) || []), sale]);

    for (const line of linesOf(sale, saleReturns)) {
      const product = line.productId ? productsById.get(line.productId) : undefined;
      const itemAcc = items.get(line.key) || new Acc(line.productId || line.key);
      itemAcc.name = product?.name || line.name;
      itemAcc.add(line);
      items.set(line.key, itemAcc);
      const cat = categoryOf(line.productId);
      const catAcc = cats.get(cat) || new Acc(cat);
      catAcc.add(line);
      cats.set(cat, catAcc);
    }
  }

  const itemData: ItemSalesSummary[] = Array.from(items.values()).map((a) => ({
    itemId: a.id,
    itemName: a.name,
    categoryName: categoryOf(a.id),
    totalSalesPaise: a.revenue,
    totalCostPaise: a.cost,
    totalProfitPaise: a.profit,
    quantitySold: a.qty,
    costedRevenuePaise: a.costedRevenue,
    uncostedRevenuePaise: a.uncostedRevenue,
    uncostedLineCount: a.uncostedLines,
    stockQuantity: Number(productsById.get(a.id)?.current_stock ?? 0),
    unit: productsById.get(a.id)?.unit || '',
  }));

  // Dead stock: active, stock-tracked products with stock on hand and no sale in the period.
  for (const p of products) {
    if (p.is_active === false || p.is_unlimited_stock) continue;
    const stock = Number(p.current_stock ?? 0);
    if (stock <= 0 || items.has(p.id)) continue;
    itemData.push({
      itemId: `${DEAD_STOCK_PREFIX}${p.id}`,
      itemName: p.name,
      categoryName: categoryOf(p.id),
      totalSalesPaise: 0,
      totalCostPaise: 0,
      totalProfitPaise: 0,
      quantitySold: 0,
      costedRevenuePaise: 0,
      uncostedRevenuePaise: 0,
      uncostedLineCount: 0,
      stockQuantity: stock,
      unit: p.unit || '',
    });
  }

  const categoryData: CategorySalesSummary[] = Array.from(cats.entries()).map(([name, a]) => ({
    categoryName: name,
    totalSalesPaise: a.revenue,
    totalCostPaise: a.cost,
    totalProfitPaise: a.profit,
    quantitySold: a.qty,
    costedRevenuePaise: a.costedRevenue,
    uncostedRevenuePaise: a.uncostedRevenue,
    uncostedLineCount: a.uncostedLines,
  }));

  const partyData = Array.from(salesByParty.entries()).map(([pid, list]) => summarizeParty(pid, list, returns));

  const coverage = categoryData.reduce(
    (acc, c) => ({
      totalProfitPaise: acc.totalProfitPaise + c.totalProfitPaise,
      costedRevenuePaise: acc.costedRevenuePaise + c.costedRevenuePaise,
      uncostedRevenuePaise: acc.uncostedRevenuePaise + c.uncostedRevenuePaise,
      uncostedLineCount: acc.uncostedLineCount + c.uncostedLineCount,
    }),
    { totalProfitPaise: 0, costedRevenuePaise: 0, uncostedRevenuePaise: 0, uncostedLineCount: 0 }
  );

  return {
    ...coverage,
    partyData,
    categoryData,
    itemData,
    invoiceCount,
    paymentSummary: {
      totalCashPaise: cash,
      totalUpiPaise: upi,
      totalCardPaise: card,
      totalCreditPaise: credit,
      totalPaise: cash + upi + card + credit,
    },
  };
}

export type ReportSort = 'sales' | 'profit' | 'qty';

export function sortReport(data: AdvancedReportsData, sort: ReportSort): AdvancedReportsData {
  const bySales = <T extends { totalSalesPaise: number }>(a: T, b: T) => b.totalSalesPaise - a.totalSalesPaise;
  const byProfit = <T extends { totalProfitPaise: number }>(a: T, b: T) => b.totalProfitPaise - a.totalProfitPaise;
  if (sort === 'profit') {
    return { ...data, partyData: [...data.partyData].sort(byProfit), categoryData: [...data.categoryData].sort(byProfit), itemData: [...data.itemData].sort(byProfit) };
  }
  if (sort === 'qty') {
    return {
      ...data,
      partyData: [...data.partyData].sort((a, b) => b.invoiceCount - a.invoiceCount),
      categoryData: [...data.categoryData].sort((a, b) => b.quantitySold - a.quantitySold),
      itemData: [...data.itemData].sort((a, b) => b.quantitySold - a.quantitySold),
    };
  }
  return { ...data, partyData: [...data.partyData].sort(bySales), categoryData: [...data.categoryData].sort(bySales), itemData: [...data.itemData].sort(bySales) };
}
