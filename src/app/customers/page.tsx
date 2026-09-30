'use client';
import { showConfirm } from '@/lib/ui/dialogs';

import React, { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useTranslation } from '@/lib/i18n';
import { Customer, CustomerType } from '@/types';
import { Users, CheckCircle2, Sparkles } from 'lucide-react';

// Modular Sub-components
import { CustomerHeaderActions } from '@/components/customers/CustomerHeaderActions';
import { CustomerMetricsRibbon } from '@/components/customers/CustomerMetricsRibbon';
import { CustomerFilterToolbar, CustomerCategoryFilter } from '@/components/customers/CustomerFilterToolbar';
import { CustomerCard } from '@/components/customers/CustomerCard';
import { AddEditCustomerModal } from '@/components/customers/AddEditCustomerModal';
import { CustomerTableView } from '@/components/customers/CustomerTableView';
import { CustomerListControls } from '@/components/customers/CustomerListControls';
import { CUSTOMER_VIEW_KEY, CustomerSort, CustomerView, sortCustomers } from '@/lib/customers/customerDirectory';
import { tr } from '@/lib/i18n/core';
import { newId } from '@/lib/ids';

// Printed on the PDF list, which stays English like every saved document.
const FILTER_LABEL: Record<CustomerCategoryFilter, string> = { all: 'All customers', credit: 'Udhar due', vip: 'VIP', regular: 'Regular' };

export default function CustomersPage() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<CustomerCategoryFilter>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [custToast, setCustToast] = useState<{ message: string; type?: 'success' | 'info' | 'error' } | null>(null);
  // Grid or list — remembered on this computer (v4.78.0); the list order is chosen here too.
  const [view, setView] = useState<CustomerView>('grid');
  const [sort, setSort] = useState<CustomerSort>('due');
  useEffect(() => {
    try {
      if (localStorage.getItem(CUSTOMER_VIEW_KEY) === 'list') setView('list');
    } catch {}
  }, []);
  const changeView = (v: CustomerView) => {
    setView(v);
    try {
      localStorage.setItem(CUSTOMER_VIEW_KEY, v);
    } catch {}
  };

  const business = useBusiness();

  const showCustToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setCustToast({ message, type });
    setTimeout(() => setCustToast(null), 4000);
  };

  const rawCustomers = useLiveQuery(async () => db.customers.toArray()) || [];

  // Filtered customers
  const filteredCustomers = rawCustomers.filter((c) => {
    // 1. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanDigits = q.replace(/\D/g, '');
      const cleanPhone = (c.phone || '').replace(/\D/g, '');
      const phoneDigitsMatch = cleanDigits && cleanPhone ? cleanPhone.includes(cleanDigits) : false;

      const matchName = c.name.toLowerCase().includes(q);
      const matchPhone = Boolean(c.phone && c.phone.toLowerCase().includes(q));
      const matchAddress = Boolean(c.address && c.address.toLowerCase().includes(q));
      const matchGstin = Boolean(c.gstin && c.gstin.toLowerCase().includes(q));

      if (!matchName && !matchPhone && !phoneDigitsMatch && !matchAddress && !matchGstin) {
        return false;
      }
    }

    // 2. Category Filter
    if (selectedFilter === 'credit' && c.current_balance <= 0) return false;
    if (selectedFilter === 'vip' && c.customer_type !== 'vip') return false;
    if (selectedFilter === 'regular' && c.customer_type !== 'regular') return false;

    return true;
  });
  const shownCustomers = sortCustomers(filteredCustomers, sort);

  const totalCreditDue = rawCustomers.reduce((acc, c) => acc + (c.current_balance > 0 ? c.current_balance : 0), 0);
  const totalVIPCount = rawCustomers.filter((c) => c.customer_type === 'vip').length;
  const creditCustomersCount = rawCustomers.filter((c) => c.current_balance > 0).length;


  const handleSaveCustomer = async (data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    gstin?: string;
    customer_type: CustomerType;
    date_of_birth?: string;
    anniversary_date?: string;
    loyalty_points: number;
    opening_balance: number;
    current_balance: number;
    notes?: string;
  }) => {
    const now = new Date().toISOString();

    if (editingCustomer) {
      // A balance typed into this form is applied as a change on top of the saved
      // balance (bills may have been added meanwhile) and written to the khata
      // ledger, so the statement and the balance never disagree.
      const fresh = (await db.customers.get(editingCustomer.id)) || editingCustomer;
      const deltaPaise = data.current_balance - (editingCustomer.current_balance || 0);
      const newBalance = (fresh.current_balance || 0) + deltaPaise;
      const updated: Customer = {
        ...fresh,
        ...data,
        current_balance: newBalance,
        updated_at: now,
      };
      await db.customers.put(updated);
      if (deltaPaise !== 0) {
        await db.ledger_transactions.put({
          id: `ledg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          business_id: fresh.business_id || business?.id || 'biz_default',
          party_type: 'customer',
          party_id: fresh.id,
          party_name: updated.name,
          transaction_type: deltaPaise > 0 ? 'CREDIT_SALE' : 'PAYMENT_RECEIVED',
          amount: Math.abs(deltaPaise),
          balance_after: newBalance,
          notes: 'Balance corrected in customer details',
          created_at: now,
          sync_status: 'synced',
        });
      }
      showCustToast(tr('✅ Updated customer: {name}', { name: updated.name }), 'success');
    } else {
      const custId = newId('cust');
      const newCustomer: Customer = {
        id: custId,
        business_id: business?.id || 'biz_default',
        ...data,
        total_spent: 0,
        total_visits: 0,
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
      };

      await db.customers.put(newCustomer);

      if (data.opening_balance > 0) {
        await db.ledger_transactions.put({
          id: newId('ledg'),
          business_id: business?.id || 'biz_default',
          party_type: 'customer',
          party_id: custId,
          party_name: data.name,
          transaction_type: 'OPENING_BALANCE',
          amount: data.opening_balance,
          balance_after: data.opening_balance,
          notes: 'Initial opening balance',
          created_at: now,
        });
      }

      showCustToast(tr('✅ Added customer: {name}', { name: newCustomer.name }), 'success');
    }
  };

  const handleDeleteCustomer = async (id: string, customerName: string) => {
    if (!await showConfirm(tr('Are you sure you want to delete customer "{customerName}"?', { customerName: customerName }), { danger: true, confirmLabel: tr('Delete') })) {
      return;
    }
    await db.customers.delete(id);
    setIsModalOpen(false);
    showCustToast(tr('🗑️ Deleted customer "{customerName}"', { customerName: customerName }), 'info');
  };

  return (
    <div className="space-y-3.5 pb-20 sm:pb-8 animate-in fade-in duration-150">
      {/* 1. Top Header & Action Buttons */}
      <CustomerHeaderActions
        totalCustomers={rawCustomers.length}
        vipCount={totalVIPCount}
        totalCreditDuePaise={totalCreditDue}
        onOpenAddModal={() => {
          setEditingCustomer(null);
          setIsModalOpen(true);
        }}
      />

      {/* 2. Customer Directory Metrics Ribbon */}
      <CustomerMetricsRibbon
        totalCustomers={rawCustomers.length}
        vipCount={totalVIPCount}
        totalCreditDuePaise={totalCreditDue}
        creditAccountsCount={creditCustomersCount}
      />

      {/* 3. Search & 1-Tap Category Filters */}
      <CustomerFilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedFilter={selectedFilter}
        onFilterChange={setSelectedFilter}
        totalCustomers={rawCustomers.length}
        creditCustomersCount={creditCustomersCount}
        vipCustomersCount={totalVIPCount}
      />

      {/* 4. View (grid / list), order and export of exactly this list */}
      <CustomerListControls
        customers={shownCustomers}
        view={view}
        onViewChange={changeView}
        sort={sort}
        onSortChange={setSort}
        shopName={business?.name || ''}
        filterLabel={`${FILTER_LABEL[selectedFilter]}${searchQuery.trim() ? ` • "${searchQuery.trim()}"` : ''}`}
      />

      {view === 'list' && shownCustomers.length > 0 && (
        <CustomerTableView
          customers={shownCustomers}
          onEditCustomer={(cust) => {
            setEditingCustomer(cust);
            setIsModalOpen(true);
          }}
        />
      )}

      {/* 5. Customer Directory Grid Cards */}
      <div className={view === 'list' && shownCustomers.length > 0 ? 'hidden' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'}>
        {view === 'grid' && shownCustomers.map((c) => (
          <CustomerCard
            key={c.id}
            customer={c}
            onEditCustomer={(cust) => {
              setEditingCustomer(cust);
              setIsModalOpen(true);
            }}
          />
        ))}

        {filteredCustomers.length === 0 && (
          <div className="col-span-full p-10 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-500 shadow-2xs">
            <Users className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
            <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tr('No customers found')}</div>
            <p className="text-xs text-slate-400 mt-1">{tr('Try adjusting your search query or add a new customer.')}</p>
          </div>
        )}
      </div>

      {/* ---------------- MODALS ---------------- */}
      <AddEditCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingCustomer={editingCustomer}
        onSaveCustomer={handleSaveCustomer}
        onDeleteCustomer={handleDeleteCustomer}
      />

      {/* Floating In-App Toast Notification */}
      {custToast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl shadow-2xl border text-xs font-bold flex items-center gap-2 animate-in slide-in-from-bottom-3 duration-200 ${
          custToast.type === 'success'
            ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40'
            : custToast.type === 'info'
            ? 'bg-slate-900/95 border-slate-700 text-slate-100 shadow-slate-950/40'
            : 'bg-rose-950/95 border-rose-500/50 text-rose-100 shadow-rose-950/40'
        }`}>
          {custToast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {custToast.type === 'info' && <Sparkles className="w-4 h-4 text-sky-400 shrink-0 animate-pulse" />}
          {custToast.type === 'error' && <span className="text-sm shrink-0">⚠️</span>}
          <span>{custToast.message}</span>
        </div>
      )}
    </div>
  );
}
