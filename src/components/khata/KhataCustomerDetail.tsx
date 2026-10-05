'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Phone, ArrowDownLeft, Plus, Users, ChevronLeft, FileText, Receipt, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { CustomerLedgerTimelineTab } from '@/components/khata/CustomerLedgerTimelineTab';
import { tr } from '@/lib/i18n/core';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import type { Business, Customer, LedgerTransaction, Sale } from '@/types';

const CustomerPendingInvoicesTab = dynamic(
  () => import('@/components/khata/CustomerPendingInvoicesTab').then((m) => m.CustomerPendingInvoicesTab),
  { ssr: false }
);

export interface KhataCustomerDetailProps {
  customersOn: boolean;
  isMobileDetailOpen: boolean;
  setIsMobileDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingTx: React.Dispatch<React.SetStateAction<LedgerTransaction | null>>;
  setEditTxAmount: React.Dispatch<React.SetStateAction<string>>;
  setEditTxNotes: React.Dispatch<React.SetStateAction<string>>;
  setEditTxType: React.Dispatch<React.SetStateAction<"CREDIT_SALE" | "PAYMENT_RECEIVED">>;
  setIsClearAllModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileTab: React.Dispatch<React.SetStateAction<"timeline" | "invoices">>;
  profileTab: "timeline" | "invoices";
  setSettleModalSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  setIsSettleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConsolidatedModalSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  setIsConsolidatedModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setViewingSale: React.Dispatch<React.SetStateAction<Sale | null>>;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  business: Business | undefined;
  selectedCustomer: Customer | null;
  customerSales: Sale[];
  transactions: LedgerTransaction[];
  handleOpenEntryModal: (type: "CREDIT_SALE" | "PAYMENT_RECEIVED") => void;
  handleDeleteTx: (txId: string) => Promise<void>;
  handleOpenSaleInvoice: (referenceId?: string | undefined, notes?: string | undefined) => Promise<void>;
}

/**
 * Khata, right column (v4.104.0, K-D23 — moved out of app/khata/page.tsx unchanged): the selected
 * customer's header (balance, reminder, actions), Timeline / Pending bills tabs and the mobile action bar.
 */
export function KhataCustomerDetail(props: KhataCustomerDetailProps) {
  const {
    customersOn, isMobileDetailOpen, setIsMobileDetailOpen, setEditingTx, setEditTxAmount, setEditTxNotes,
    setEditTxType, setIsClearAllModalOpen, setProfileTab, profileTab, setSettleModalSales, setIsSettleModalOpen,
    setConsolidatedModalSales, setIsConsolidatedModalOpen, setViewingSale, setIsInvoiceModalOpen, business, selectedCustomer,
    customerSales, transactions, handleOpenEntryModal, handleDeleteTx, handleOpenSaleInvoice,
  } = props;
  return (
    <div className={`space-y-3 lg:col-span-7 ${!isMobileDetailOpen && !selectedCustomer ? 'hidden lg:block' : 'block'}`}>
      {selectedCustomer ? (
        <div className="space-y-3.5">

          {/* Active Customer Profile & Quick Action Header */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 sm:p-4 shadow-xs space-y-3">
            {/* Mobile Back Navigation Bar */}
            <div className="lg:hidden flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setIsMobileDetailOpen(false);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 font-bold text-xs border border-amber-200 dark:border-amber-800/60 cursor-pointer active:scale-95 transition-transform"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{tr('Back to List')}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {selectedCustomer.phone && (
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    className="p-1.5 px-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold flex items-center gap-1 active:scale-95 shadow-2xs"
                    title={tr('Call Customer')}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{tr('Call')}</span>
                  </a>
                )}
                <WhatsAppButton request={{ kind: 'khata', customerId: selectedCustomer.id }} label={(selectedCustomer.current_balance || 0) > 0 ? tr('Remind') : tr('WhatsApp')} />

              </div>
            </div>

            {/* Profile Info Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="w-9 h-9 rounded-2xl bg-slate-900 text-amber-400 flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate leading-tight">
                        {selectedCustomer.name}
                      </h2>
                      {customersOn && (
                      <Link href={`/customers?search=${encodeURIComponent(selectedCustomer.phone || selectedCustomer.name)}`}>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-50 dark:bg-sky-950/60 dark:text-sky-400 px-2 py-0.5 rounded-md hover:underline cursor-pointer border border-sky-200/60 dark:border-sky-800">
                          {tr('360° Profile')}
                        </span>
                      </Link>
                      )}
                      {/* v4.79.0: udhar reminder (friendly / formal, pay link) like the Android khata */}
                      <WhatsAppButton
                        request={{ kind: 'khata', customerId: selectedCustomer.id }}
                        label={(selectedCustomer.current_balance || 0) > 0 ? tr('Udhar reminder') : tr('WhatsApp')}
                        className="hidden lg:inline-flex"
                      />
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                      {selectedCustomer.phone && (
                        <a
                          href={`tel:${selectedCustomer.phone}`}
                          className="flex items-center gap-1 font-mono text-[11.5px] hover:text-slate-900 dark:hover:text-slate-100 transition"
                          title={tr('Click to call customer')}
                        >
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{selectedCustomer.phone}</span>
                        </a>
                      )}
                      {selectedCustomer.phone && selectedCustomer.address && <span className="text-slate-300 dark:text-slate-700">•</span>}
                      {selectedCustomer.address && (
                        <span className="truncate max-w-[200px] text-[11px] text-slate-400">
                          {selectedCustomer.address}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Integrated Balance Due Banner */}
              <div className={`p-3 rounded-2xl border flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto shrink-0 shadow-2xs ${
                (selectedCustomer.current_balance || 0) > 0
                  ? 'bg-rose-50/90 border-rose-200 text-rose-950 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                  : (selectedCustomer.current_balance || 0) < 0
                  ? 'bg-emerald-50/90 border-emerald-200 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                  : 'bg-slate-50 border-slate-200 text-slate-900 dark:bg-slate-800/80 dark:border-slate-700 dark:text-slate-200'
              }`}>
                <div className="text-left sm:text-right">
                  <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none mb-1">
                    {tr('Current Outstanding Balance')}
                  </div>
                  <div className={`text-lg sm:text-xl font-black font-mono leading-none ${
                    (selectedCustomer.current_balance || 0) > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : (selectedCustomer.current_balance || 0) < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {(selectedCustomer.current_balance || 0) > 0
                      ? `₹${(selectedCustomer.current_balance / 100).toFixed(2)}`
                      : (selectedCustomer.current_balance || 0) < 0
                      ? `₹${(Math.abs(selectedCustomer.current_balance) / 100).toFixed(2)}`
                      : '₹0.00'}
                  </div>
                </div>
                <div className="border-l border-slate-200 dark:border-slate-700 pl-3">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight block ${
                    (selectedCustomer.current_balance || 0) > 0
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-300'
                      : (selectedCustomer.current_balance || 0) < 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-slate-200/80 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                  }`}>
                    {(selectedCustomer.current_balance || 0) > 0
                      ? tr('Udhar (बाकी)')
                      : (selectedCustomer.current_balance || 0) < 0
                      ? tr('Advance (जमा)')
                      : tr('Settled (₹0)')}
                  </span>
                </div>
              </div>
            </div>

            {/* Desktop Action Buttons Row */}
            <div className="hidden lg:flex items-center justify-between gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleOpenEntryModal('CREDIT_SALE')}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title={tr('Record goods given on credit (Udhar)')}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{tr('+ You Gave ₹ (Udhar)')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEntryModal('PAYMENT_RECEIVED')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                  title={tr('Record cash or UPI payment received (Jama)')}
                >
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>{tr('↙ You Got ₹ (Jama)')}</span>
                </button>


              </div>

              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(true)}
                className="p-1.5 px-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-[11px] font-bold flex items-center gap-1 transition cursor-pointer"
                title={tr('Wipe transaction statement history')}
              >
                <Trash2 className="w-3 h-3" />
                <span>{tr('Wipe History')}</span>
              </button>
            </div>
          </div>

          {/* Customer Profile Navigation Tabs: Timeline vs Pending Invoices */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => setProfileTab('timeline')}
              className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                profileTab === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-amber-500" />
              <span>{tr('📜 Ledger Timeline')}</span>
              <span className="text-[10px] text-slate-400 font-mono">({transactions.length})</span>
            </button>

            {(() => {
              const custSales = customerSales;
              const pendingCount = custSales.filter(
                (s) => (s.balance_due && s.balance_due > 0) || s.payment_status === 'unpaid' || s.payment_status === 'partial'
              ).length;

              return (
                <button
                  type="button"
                  onClick={() => setProfileTab('invoices')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    profileTab === 'invoices'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Receipt className="w-3.5 h-3.5 text-rose-500" />
                  <span>{tr('🧾 Pending Bills')}</span>
                  {pendingCount > 0 ? (
                    <span className="px-1.5 py-0.2 bg-rose-600 text-white rounded-full text-[10px] font-mono font-black">
                      {pendingCount}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-mono">({custSales.length})</span>
                  )}
                </button>
              );
            })()}
          </div>

          {/* Tab 1 Content: Transactions Timeline */}
          {profileTab === 'timeline' && (
            <CustomerLedgerTimelineTab
              transactions={transactions}
              onOpenSaleInvoice={handleOpenSaleInvoice}
              onEditEntry={(tx) => {
                setEditingTx(tx);
                setEditTxAmount((tx.amount / 100).toFixed(2));
                setEditTxNotes(tx.notes || '');
                setEditTxType(
                  tx.transaction_type === 'CREDIT_SALE' || tx.transaction_type === 'OPENING_BALANCE'
                    ? 'CREDIT_SALE'
                    : 'PAYMENT_RECEIVED'
                );
              }}
              onDeleteEntry={handleDeleteTx}
              onOpenEntryModal={handleOpenEntryModal}
            />
          )}

          {/* Tab 2 Content: Pending Invoices / Bill-by-Bill Settlement */}
          {profileTab === 'invoices' && (
            <CustomerPendingInvoicesTab
              customer={selectedCustomer}
              business={business}
              sales={customerSales}
              onOpenInvoiceModal={(sale) => {
                setViewingSale(sale);
                setIsInvoiceModalOpen(true);
              }}
              onOpenSettleModal={(salesToSettle) => {
                setSettleModalSales(salesToSettle);
                setIsSettleModalOpen(true);
              }}
              onOpenConsolidatedModal={(salesForConsolidated) => {
                setConsolidatedModalSales(salesForConsolidated);
                setIsConsolidatedModalOpen(true);
              }}
            />
          )}

          {/* STICKY BOTTOM ACTION BAR ON MOBILE FOR ACTIVE CUSTOMER */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-40 flex items-center gap-2 shadow-xl">
            <button
              type="button"
              onClick={() => handleOpenEntryModal('CREDIT_SALE')}
              className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{tr('+ You Gave (उधार)')}</span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenEntryModal('PAYMENT_RECEIVED')}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>{tr('↙ You Got (जमा)')}</span>
            </button>
          </div>

        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-400">
          <Users className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
          <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm">{tr('Select a Customer')}</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {tr('Choose a customer from the left list or create a new Khata customer to view their statement.')}
          </p>
        </div>
      )}
    </div>
  );
}
