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

/** Compute today's order count & sales for a staff member. */
export async function getStaffTodayPerformance(staffName: string): Promise<StaffTodayPerformance> {
  const clean = staffName.trim().toLowerCase();
  if (!clean) return { orderCount: 0, totalSalesPaise: 0, activeTablesCount: 0, recentSales: [] };

  const startIso = getLocalDayStart();
  let sales: Sale[] = [];
  try {
    sales = await db.sales.where('created_at').aboveOrEqual(startIso).toArray();
  } catch {
    sales = [];
  }

  const staffSales = sales.filter((s) => {
    const creator = (s.created_by || '').trim().toLowerCase();
    if (creator === clean) return true;
    const staff = (s.staff_name || '').trim().toLowerCase();
    if (staff === clean) return true;
    const notes = (s.notes || '').toLowerCase();
    return notes.includes(clean);
  });

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
  netPayablePaise: number;
  expenses: CashExpense[];
}

/** Get advance payments & salary expenses for a staff member. */
export async function getStaffSalaryLedger(staffName: string, monthlySalaryPaise = 0): Promise<StaffSalaryLedger> {
  const clean = staffName.trim().toLowerCase();
  if (!clean) return { monthlySalaryPaise, totalAdvanceThisMonthPaise: 0, netPayablePaise: monthlySalaryPaise, expenses: [] };

  let allExpenses: CashExpense[] = [];
  try {
    allExpenses = await db.cash_expenses.where('category').equals('staff_salary').toArray();
  } catch {
    allExpenses = [];
  }

  const staffExpenses = allExpenses.filter((e) => (e.paid_to || '').trim().toLowerCase() === clean);
  staffExpenses.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const monthStartIso = getLocalMonthStart();
  const currentMonthExpenses = staffExpenses.filter((e) => e.created_at >= monthStartIso);
  const totalAdvanceThisMonthPaise = currentMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const netPayablePaise = Math.max(0, monthlySalaryPaise - totalAdvanceThisMonthPaise);

  return {
    monthlySalaryPaise,
    totalAdvanceThisMonthPaise,
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
