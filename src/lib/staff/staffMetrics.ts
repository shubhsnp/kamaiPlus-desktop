import { db } from '@/lib/db';
import { newId } from '@/lib/ids';
import { cloudSyncSoon } from '@/lib/firebase/lazyCloud';
import { loadRestState } from '@/lib/restaurant/store';
import type { CashExpense, Sale } from '@/types';

/** Performance data for a staff member today. */
export interface StaffTodayPerformance {
  orderCount: number;
  totalSalesPaise: number;
  activeTablesCount: number;
  recentSales: Sale[];
}

/** Returns the start of today in local ISO string. */
export function getLocalDayStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Returns the start of current month in local ISO string. */
export function getLocalMonthStart(): string {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * A staff member's own records — by staff id, or the WHOLE name (v4.171.0: "Raj" used to take
 * Rajesh's bills / salary too, and a bill note mentioning the name counted as the waiter's).
 */
const sameName = (a: string | undefined, clean: string) => (a || '').trim().toLowerCase() === clean;

/** Compute today's order count & sales for a staff member. */
export async function getStaffTodayPerformance(staffName: string, staffId?: string): Promise<StaffTodayPerformance> {
  const clean = staffName.trim().toLowerCase();
  if (!clean) return { orderCount: 0, totalSalesPaise: 0, activeTablesCount: 0, recentSales: [] };

  const startIso = getLocalDayStart();
  let sales: Sale[] = [];
  try {
    sales = await db.sales.where('created_at').aboveOrEqual(startIso).toArray();
  } catch {
    sales = [];
  }

  const staffSales = sales.filter((s) => (staffId && s.staff_id === staffId) || sameName(s.staff_name, clean) || sameName(s.created_by, clean));

  const totalSalesPaise = staffSales.reduce((sum, s) => sum + (s.grand_total || 0), 0);

  // Active running tables or orders taken by this waiter
  let activeTablesCount = 0;
  try {
    const rest = loadRestState();
    activeTablesCount = rest.orders.filter((o) => (o.takenBy || '').trim().toLowerCase() === clean).length;
  } catch {}

  // Sort newest first
  staffSales.sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    orderCount: staffSales.length,
    totalSalesPaise,
    activeTablesCount,
    recentSales: staffSales.slice(0, 20),
  };
}

/** Salary and advances summary for a staff member. */
export interface StaffSalaryLedger {
  monthlySalaryPaise: number;
  totalAdvanceThisMonthPaise: number;
  totalSalaryPaidThisMonthPaise: number;
  totalPaidThisMonthPaise: number;
  netPayablePaise: number;
  expenses: CashExpense[];
}

/** Get advance payments & salary expenses for a staff member. */
export async function getStaffSalaryLedger(staffName: string, monthlySalaryPaise = 0, staffId?: string): Promise<StaffSalaryLedger> {
  const clean = staffName.trim().toLowerCase();
  if (!clean) {
    return {
      monthlySalaryPaise,
      totalAdvanceThisMonthPaise: 0,
      totalSalaryPaidThisMonthPaise: 0,
      totalPaidThisMonthPaise: 0,
      netPayablePaise: monthlySalaryPaise,
      expenses: [],
    };
  }

  let allExpenses: CashExpense[] = [];
  try {
    allExpenses = await db.cash_expenses.toArray();
  } catch {
    allExpenses = [];
  }

  // This member's payouts: paid to them (this PC), "Advance: Name" / "Salary: Name" (both apps), or the
  // phone's "staff_id:…" note. Salary-type only — an expense that merely mentions the name is not one.
  const idTag = staffId ? `staff_id:${staffId.toLowerCase()}` : '';
  const staffExpenses = allExpenses.filter((e) => {
    const cat = (e.category || '').toLowerCase().trim();
    const title = (e.title || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const isSalaryType = cat === 'staff_salary' || cat === 'salary' || /^(advance|salary):/.test(title);
    const matchesPerson = sameName(e.paid_to, clean) || title === `advance: ${clean}` || title === `salary: ${clean}`
      || Boolean(idTag && (e.notes || '').toLowerCase().includes(idTag));
    return isSalaryType && matchesPerson;
  });

  staffExpenses.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const monthStartIso = getLocalMonthStart();
  const currentMonthExpenses = staffExpenses.filter((e) => e.created_at >= monthStartIso);

  let totalAdvanceThisMonthPaise = 0;
  let totalSalaryPaidThisMonthPaise = 0;

  for (const e of currentMonthExpenses) {
    // "Advance: Name" — a salary payout whose note says "advance cut" stays salary.
    const isAdvance = (e.title || '').trim().toLowerCase().startsWith('advance');
    if (isAdvance) {
      totalAdvanceThisMonthPaise += (e.amount || 0);
    } else {
      totalSalaryPaidThisMonthPaise += (e.amount || 0);
    }
  }

  const totalPaidThisMonthPaise = totalAdvanceThisMonthPaise + totalSalaryPaidThisMonthPaise;
  const netPayablePaise = Math.max(0, monthlySalaryPaise - totalPaidThisMonthPaise);

  return {
    monthlySalaryPaise,
    totalAdvanceThisMonthPaise,
    totalSalaryPaidThisMonthPaise,
    totalPaidThisMonthPaise,
    netPayablePaise,
    expenses: staffExpenses,
  };
}

export interface RecordStaffPaymentInput {
  businessId: string;
  staffName: string;
  type: 'advance' | 'salary';
  amountPaise: number;
  paymentMode: 'cash' | 'upi';
  dateIso?: string;
  note?: string;
}

/** Record an advance or salary payout for a staff member. */
export async function recordStaffPayment(input: RecordStaffPaymentInput): Promise<CashExpense> {
  const now = input.dateIso || new Date().toISOString();
  const exp: CashExpense = {
    id: newId('exp'),
    business_id: input.businessId || 'biz_default',
    category: 'staff_salary',
    title: input.type === 'advance' ? `Advance: ${input.staffName}` : `Salary: ${input.staffName}`,
    amount: Math.max(0, Math.round(input.amountPaise)),
    paid_to: input.staffName.trim(),
    payment_mode: input.paymentMode,
    created_by: 'owner',
    created_at: now,
    notes: (input.note || '').trim() || undefined,
  };

  await db.cash_expenses.put(exp);
  if (input.businessId && input.businessId !== 'biz_default') {
    void cloudSyncSoon(input.businessId);
  }
  return exp;
}

/** Delete a staff salary/advance record. */
export async function deleteStaffPayment(id: string, businessId?: string): Promise<void> {
  await db.cash_expenses.delete(id);
  if (businessId && businessId !== 'biz_default') {
    void cloudSyncSoon(businessId);
  }
}
