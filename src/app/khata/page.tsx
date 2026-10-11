'use client';

import { useState, useEffect, Suspense } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { useTranslation } from '@/lib/i18n';
import { LedgerTransaction, Sale } from '@/types';
import { BookOpen, UserPlus, Users, FileText, Loader2, CheckCircle2 } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

// Modular Sub-components
import { KhataMetricsRibbon } from '@/components/khata/KhataMetricsRibbon';
import { KhataCustomerDetail } from '@/components/khata/KhataCustomerDetail';
import { KhataCustomerList } from '@/components/khata/KhataCustomerList';
import { KhataDialogs } from '@/components/khata/KhataDialogs';
import { createKhataActions } from '@/components/khata/khataActions';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';


function KhataContent() {
  const { t } = useTranslation();
  const customersOn = useFeatureSwitches().customers; // Settings → Features: no Customers links when switched off
  const searchParams = useSearchParams();
  const initialSearch = searchParams.get('search') || searchParams.get('customer') || '';

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'udhar' | 'advance' | 'settled'>('all');
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Manual Entry Modal (+ You Gave / - You Got)
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'CREDIT_SALE' | 'PAYMENT_RECEIVED'>('PAYMENT_RECEIVED');
  const [entryAmount, setEntryAmount] = useState('');
  const [entryNotes, setEntryNotes] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryPaymentMode, setEntryPaymentMode] = useState<'cash' | 'upi' | 'bank' | 'other'>('cash');

  // Quick Add Customer Modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustOpeningBalance, setNewCustOpeningBalance] = useState('');
  const [addCustomerError, setAddCustomerError] = useState('');

  // Edit Entry Modal
  const [editingTx, setEditingTx] = useState<LedgerTransaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxNotes, setEditTxNotes] = useState('');
  const [editTxType, setEditTxType] = useState<'PAYMENT_RECEIVED' | 'CREDIT_SALE'>('PAYMENT_RECEIVED');

  // Clear All Modal
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Customer Profile View Tabs: Timeline vs Pending Invoices
  const [profileTab, setProfileTab] = useState<'timeline' | 'invoices'>('timeline');

  // Multi-Bill Settle Modal
  const [settleModalSales, setSettleModalSales] = useState<Sale[]>([]);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);

  // Consolidated Multi-Bill Statement Modal
  const [consolidatedModalSales, setConsolidatedModalSales] = useState<Sale[]>([]);
  const [isConsolidatedModalOpen, setIsConsolidatedModalOpen] = useState(false);

  // Invoice Detailed Bill Viewer Modal
  const [viewingSale, setViewingSale] = useState<Sale | null>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const business = useBusiness();

  const allCustomers = useLiveQuery(async () => {
    return await db.customers.toArray();
  }) || [];

  const customers = useLiveQuery(async () => {
    let list = await db.customers.toArray();
    
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const cleanDigits = q.replace(/\D/g, '');
      list = list.filter((c) => {
        const cleanPhone = (c.phone || '').replace(/\D/g, '');
        const phoneDigitsMatch = cleanDigits && cleanPhone ? cleanPhone.includes(cleanDigits) : false;
        return (
          c.name.toLowerCase().includes(q) || 
          (c.phone && c.phone.toLowerCase().includes(q)) ||
          phoneDigitsMatch
        );
      });
    }

    // Balance category filter
    if (filterMode === 'udhar') {
      list = list.filter(c => (c.current_balance || 0) > 0);
    } else if (filterMode === 'advance') {
      list = list.filter(c => (c.current_balance || 0) < 0);
    } else if (filterMode === 'settled') {
      list = list.filter(c => (c.current_balance || 0) === 0);
    }

    // Sort by largest Udhar balance first, then name
    return list.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0));
  }, [searchQuery, filterMode]) || [];

  // Set default selected customer if none selected on desktop
  useEffect(() => {
    if (initialSearch && customers.length > 0) {
      const found = customers.find(c => 
        c.name.toLowerCase().includes(initialSearch.toLowerCase()) || 
        (c.phone && c.phone.includes(initialSearch))
      );
      if (found) {
        setSelectedCustomerId(found.id);
        setIsMobileDetailOpen(true);
        return;
      }
    }

    if (!selectedCustomerId && customers.length > 0 && typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId, initialSearch]);

  const selectedCustomer = allCustomers.find(c => c.id === selectedCustomerId) || (typeof window !== 'undefined' && window.innerWidth >= 1024 ? customers[0] : null);

  // Only the selected customer's bills (newest first). This page used to hold the
  // shop's entire sales history in memory just to show one customer's bills.
  const selectedCustomerIdKey = selectedCustomer?.id;
  const selectedCustomerPhone = selectedCustomer?.phone;
  const customerSales = useLiveQuery(async () => {
    if (!selectedCustomerIdKey) return [];
    if (!selectedCustomerPhone) {
      return await db.sales.where('customer_id').equals(selectedCustomerIdKey).reverse().sortBy('created_at');
    }
    return await db.sales
      .orderBy('created_at')
      .reverse()
      .filter((s) => s.customer_id === selectedCustomerIdKey || s.customer_phone === selectedCustomerPhone)
      .toArray();
  }, [selectedCustomerIdKey, selectedCustomerPhone]) || [];

  const transactions = useLiveQuery(async () => {
    if (!selectedCustomer) return [];
    return await db.ledger_transactions
      .where('party_id')
      .equals(selectedCustomer.id)
      .reverse()
      .toArray();
  }, [selectedCustomer]) || [];

  // Compute metrics across entire store
  const totalUdharReceivable = allCustomers.reduce(
    (acc, c) => acc + ((c.current_balance || 0) > 0 ? c.current_balance : 0), 
    0
  );
  const totalAdvancePayable = allCustomers.reduce(
    (acc, c) => acc + ((c.current_balance || 0) < 0 ? Math.abs(c.current_balance) : 0), 
    0
  );
  const totalUdharAccounts = allCustomers.filter(c => (c.current_balance || 0) > 0).length;

  const { handleOpenEntryModal, handleBulkMonthEndStatement, handleSaveEntry, handleCreateCustomer, handleSaveEditTx, handleDeleteTx, handleClearCustomerKhata, handleOpenSaleInvoice } = createKhataActions({
    setSelectedCustomerId, setIsMobileDetailOpen, setIsEntryModalOpen, setEntryType, entryType, setEntryAmount,
    entryAmount, setEntryNotes, entryNotes, setEntryDate, entryDate, setEntryPaymentMode,
    entryPaymentMode, setIsAddCustomerOpen, newCustName, setNewCustName, newCustPhone, setNewCustPhone,
    newCustAddress, setNewCustAddress, newCustOpeningBalance, setNewCustOpeningBalance, setAddCustomerError, editingTx,
    setEditingTx, editTxAmount, editTxNotes, editTxType, setIsClearAllModalOpen, clearConfirmationText,
    setClearConfirmationText, setViewingSale, setIsInvoiceModalOpen, showToast, business, allCustomers,
    selectedCustomer,
  });

  return (
    <div className="space-y-3.5 pb-24 lg:pb-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-16 sm:bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl border border-slate-800 shadow-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ---------------- TOP HEADER (Compact Space-Saving) ---------------- */}
      <div className="bg-white dark:bg-slate-900 px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <BookOpen className="w-4 h-4 text-amber-500 shrink-0" />
            <h1 className="text-sm xs:text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate">
              {tr('Khata Ledger')}
            </h1>
          </div>
          <p className="text-[10.5px] sm:text-xs text-slate-500 truncate">
            {allCustomers.length} {allCustomers.length === 1 ? tr('registered account •') : tr('registered accounts •')} {totalUdharAccounts} {tr('pending udhar')}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button 
            size="sm"
            variant="outline" 
            onClick={handleBulkMonthEndStatement}
            className="font-bold border-indigo-200 text-indigo-900 bg-indigo-50 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 text-xs px-2.5 py-1.5 shadow-2xs cursor-pointer gap-1.5"
            title={tr('Download consolidated month-end udhar ledger statement PDF for all customer accounts')}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-700 dark:text-indigo-400" />
            <span className="hidden sm:inline">{tr('Bulk Month-End Statement')}</span>
            <span className="sm:hidden">{tr('Statement')}</span>
          </Button>
          {customersOn && (
          <Link href="/customers">
            <Button
              size="sm"
              variant="outline"
              className="font-bold border-sky-300 text-sky-900 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300 text-xs px-2.5 py-1.5 shadow-2xs cursor-pointer"
            >
              <Users className="w-3.5 h-3.5 sm:mr-1 text-sky-700 dark:text-sky-400" />
              <span className="hidden sm:inline">{tr('Directory')}</span>
            </Button>
          </Link>
          )}
          <Button 
            size="sm"
            onClick={() => setIsAddCustomerOpen(true)}
            className="font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs px-2.5 py-1.5 shadow-2xs cursor-pointer gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tr('Add Customer')}</span>
            <span className="sm:hidden">{tr('Add')}</span>
          </Button>
        </div>
      </div>

      {/* ---------------- LIVE KHATA METRICS RIBBON ---------------- */}
      <KhataMetricsRibbon
        totalUdharReceivable={totalUdharReceivable}
        totalAdvancePayable={totalAdvancePayable}
        totalUdharAccounts={totalUdharAccounts}
        totalCustomersCount={allCustomers.length}
      />

      {/* ---------------- MAIN KHATA MASTER-DETAIL WORKSPACE ---------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        
        {/* ========================================================================= */}
        {/* LEFT COLUMN: CUSTOMER DIRECTORY (Always visible on desktop, hidden on mobile if detail active) */}
        {/* ========================================================================= */}
        <KhataCustomerList
          {...{
            searchQuery, setSearchQuery, setSelectedCustomerId, setFilterMode, filterMode, isMobileDetailOpen,
            setIsMobileDetailOpen, setIsAddCustomerOpen, allCustomers, customers, selectedCustomer,
          }}
        />

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: ACTIVE CUSTOMER DETAIL & STATEMENT */}
        {/* ========================================================================= */}
        <KhataCustomerDetail
          {...{
            customersOn, isMobileDetailOpen, setIsMobileDetailOpen, setEditingTx, setEditTxAmount, setEditTxNotes,
            setEditTxType, setIsClearAllModalOpen, setProfileTab, profileTab, setSettleModalSales, setIsSettleModalOpen,
            setConsolidatedModalSales, setIsConsolidatedModalOpen, setViewingSale, setIsInvoiceModalOpen, business, selectedCustomer,
            customerSales, transactions, handleOpenEntryModal, handleDeleteTx, handleOpenSaleInvoice,
          }}
        />
      </div>

      <KhataDialogs
        {...{
          isEntryModalOpen, setIsEntryModalOpen, entryType, entryAmount, setEntryAmount, entryNotes,
          setEntryNotes, entryDate, setEntryDate, entryPaymentMode, setEntryPaymentMode, isAddCustomerOpen,
          setIsAddCustomerOpen, newCustName, setNewCustName, newCustPhone, setNewCustPhone, newCustAddress,
          setNewCustAddress, newCustOpeningBalance, setNewCustOpeningBalance, addCustomerError, editingTx, setEditingTx,
          editTxAmount, setEditTxAmount, editTxNotes, setEditTxNotes, editTxType, setEditTxType,
          isClearAllModalOpen, setIsClearAllModalOpen, clearConfirmationText, setClearConfirmationText, setSettleModalSales, settleModalSales,
          isSettleModalOpen, setIsSettleModalOpen, setConsolidatedModalSales, consolidatedModalSales, isConsolidatedModalOpen, setIsConsolidatedModalOpen,
          viewingSale, setViewingSale, isInvoiceModalOpen, setIsInvoiceModalOpen, showToast, business,
          selectedCustomer, handleSaveEntry, handleCreateCustomer, handleSaveEditTx, handleClearCustomerKhata,
        }}
      />
    </div>
  );
}

export default function KhataPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-slate-400 text-xs">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-amber-500 mb-2" />
        <span>{tr('Loading Customer Khata...')}</span>
      </div>
    }>
      <KhataContent />
    </Suspense>
  );
}
