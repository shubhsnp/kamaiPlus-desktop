'use client';

import { useMemo, useState } from 'react';
import { useDebounce } from 'use-debounce';
import { Customer, Sale } from '@/types';
import { getNetPaymentBreakdown, getSaleNetTotal, getSalePaymentBreakdown, isRevenueSale } from '@/lib/sales/saleMath';

// Local calendar-day helpers (created_at is UTC; the shop's day is local).
const dayStart = (offsetDays = 0) => {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate() + offsetDays);
};

export type DatePreset = 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export type PaymentFilter = 'all' | 'cash' | 'upi' | 'credit';
export type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export function useTransactionFilters(allSales: Sale[], customers?: Customer[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [datePreset, setDatePreset] = useState<DatePreset>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('all');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  // Filtering walks every bill, so it waits for the cashier to stop typing.
  const [debouncedSearch] = useDebounce(searchQuery, 250);

  // Recomputed only when the bills or a filter change — not on every render
  // (opening a modal or showing a toast used to re-filter the whole history).
  // v4.97.0: the date limits are worked out once (not per bill), each bill's date is read once,
  // and "newest first" needs no sorting — `allSales` arrives newest first (transactions page).
  // On a year of bills the old sort parsed ~900,000 dates.
  const filteredSales = useMemo(() => {
    const now = new Date();
    let from = -Infinity;
    let to = Infinity;
    if (datePreset === 'today') { from = dayStart(0).getTime(); to = dayStart(1).getTime(); }
    else if (datePreset === 'yesterday') { from = dayStart(-1).getTime(); to = dayStart(0).getTime(); }
    else if (datePreset === 'week') { from = dayStart(-6).getTime(); } // today plus the six days before it
    else if (datePreset === 'month') { from = new Date(now.getFullYear(), now.getMonth(), 1).getTime(); }
    else if (datePreset === 'custom') {
      if (startDate) { const start = new Date(startDate); start.setHours(0, 0, 0, 0); from = start.getTime(); }
      // inclusive end of the chosen day
      if (endDate) { const end = new Date(endDate); end.setHours(23, 59, 59, 999); to = end.getTime() + 1; }
    }
    const datesOn = from !== -Infinity || to !== Infinity;
    const targetCust = selectedCustomerId !== 'all' && selectedCustomerId !== 'walk-in' ? customers?.find((c) => c.id === selectedCustomerId) : undefined;
    const targetName = targetCust?.name.toLowerCase().trim();
    const cleanPhone = targetCust?.phone?.replace(/\D/g, '').slice(-10);
    const q = debouncedSearch.trim() ? debouncedSearch.toLowerCase() : '';

    const out = allSales.filter((sale) => {
      // 1. Date Range Filter
      if (datesOn) {
        const t = new Date(sale.created_at).getTime();
        if (t < from || t >= to) return false;
      }

      // 2. Transaction Type (Cash vs Credit vs UPI)
      if (paymentFilter !== 'all') {
        const pay = getSalePaymentBreakdown(sale);
        if (paymentFilter === 'cash' && pay.cash <= 0) return false;
        if (paymentFilter === 'upi' && pay.upi <= 0) return false;
        if (paymentFilter === 'credit' && sale.payment_method !== 'credit' && (sale.balance_due || 0) <= 0) return false;
      }

      // 3. Customer Filter
      if (selectedCustomerId === 'walk-in') {
        if (sale.customer_id) return false;
      } else if (selectedCustomerId !== 'all') {
        const matchId = sale.customer_id === selectedCustomerId;
        const matchName = Boolean(targetName && sale.customer_name && sale.customer_name.toLowerCase().trim() === targetName);
        const matchPhone = Boolean(cleanPhone && sale.customer_phone && sale.customer_phone.includes(cleanPhone));
        if (!matchId && !matchName && !matchPhone) return false;
      }

      // 4. Search Query
      if (q) {
        const matchInv = sale.invoice_number.toLowerCase().includes(q);
        const matchCust = (sale.customer_name && sale.customer_name.toLowerCase().includes(q)) ||
                          (sale.customer_phone && sale.customer_phone.includes(q));
        const matchItems = sale.items && sale.items.some((i) => i.product_name.toLowerCase().includes(q));

        if (!matchInv && !matchCust && !matchItems) return false;
      }

      return true;
    });

    if (sortBy === 'date-desc') return out; // already newest first
    if (sortBy === 'date-asc') return out.reverse();
    if (sortBy === 'amount-desc') return out.sort((a, b) => b.grand_total - a.grand_total);
    return out.sort((a, b) => a.grand_total - b.grand_total);
  }, [allSales, customers, datePreset, startDate, endDate, paymentFilter, selectedCustomerId, debouncedSearch, sortBy]);

  // KPI Calculations on filtered subset. Estimates and fully returned bills are not
  // revenue; cash counts only money kept (no change handed back), splits by their parts.
  const { revenueBillCount, totalRevenuePaise, totalCashPaise, totalUpiPaise, totalCreditPaise } = useMemo(() => {
    const revenueSales = filteredSales.filter(isRevenueSale);
    // Net of refunds, like the revenue figure (a cash refund comes out of cash).
    const breakdowns = revenueSales.map((s) => getNetPaymentBreakdown(s));
    return {
      revenueBillCount: revenueSales.length,
      totalRevenuePaise: revenueSales.reduce((acc, s) => acc + getSaleNetTotal(s), 0),
      totalCashPaise: breakdowns.reduce((acc, p) => acc + p.cash, 0),
      totalUpiPaise: breakdowns.reduce((acc, p) => acc + p.upi + p.card, 0),
      totalCreditPaise: breakdowns.reduce((acc, p) => acc + p.credit, 0),
    };
  }, [filteredSales]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setDatePreset('all');
    setStartDate('');
    setEndDate('');
    setPaymentFilter('all');
    setSelectedCustomerId('all');
    setSortBy('date-desc');
  };

  return {
    searchQuery,
    setSearchQuery,
    datePreset,
    setDatePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    paymentFilter,
    setPaymentFilter,
    selectedCustomerId,
    setSelectedCustomerId,
    sortBy,
    setSortBy,
    filteredSales,
    totalRevenuePaise,
    totalCashPaise,
    totalUpiPaise,
    totalCreditPaise,
    revenueBillCount,
    clearAllFilters,
  };
}
