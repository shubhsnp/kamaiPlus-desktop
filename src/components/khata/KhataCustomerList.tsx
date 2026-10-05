'use client';

import React from 'react';
import { BookOpen, Search, Phone, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import type { Customer } from '@/types';

export interface KhataCustomerListProps {
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setSelectedCustomerId: React.Dispatch<React.SetStateAction<string | null>>;
  setFilterMode: React.Dispatch<React.SetStateAction<"all" | "udhar" | "advance" | "settled">>;
  filterMode: "all" | "udhar" | "advance" | "settled";
  isMobileDetailOpen: boolean;
  setIsMobileDetailOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsAddCustomerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  allCustomers: Customer[];
  customers: Customer[];
  selectedCustomer: Customer | null;
}

/**
 * Khata, left column (v4.104.0, K-D23 — moved out of app/khata/page.tsx unchanged): search, the
 * Udhar / Advance / Settled filter and the customer cards.
 */
export function KhataCustomerList(props: KhataCustomerListProps) {
  const {
    searchQuery, setSearchQuery, setSelectedCustomerId, setFilterMode, filterMode, isMobileDetailOpen,
    setIsMobileDetailOpen, setIsAddCustomerOpen, allCustomers, customers, selectedCustomer,
  } = props;
  return (
    <div className={`space-y-3 lg:col-span-5 ${isMobileDetailOpen && selectedCustomer ? 'hidden lg:block' : 'block'}`}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs space-y-2.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={tr('Search by customer name or mobile number...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px] font-bold">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'all' 
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {tr('All (')}{allCustomers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('udhar')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'udhar' 
                ? 'bg-rose-600 text-white' 
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300'
            }`}
          >
            {tr('Udhar Due (')}{allCustomers.filter(c => (c.current_balance || 0) > 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('advance')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'advance' 
                ? 'bg-emerald-600 text-white' 
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300'
            }`}
          >
            {tr('Advance (')}{allCustomers.filter(c => (c.current_balance || 0) < 0).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('settled')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              filterMode === 'settled' 
                ? 'bg-slate-700 text-white dark:bg-slate-300 dark:text-slate-950' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {tr('Settled (₹0)')}
          </button>
        </div>
      </div>

      {/* Customer Scrollable Cards List */}
      <div className="space-y-2 max-h-[640px] overflow-y-auto pr-0.5">
        {customers.map((c) => {
          const isSelected = selectedCustomer?.id === c.id;
          const isDue = (c.current_balance || 0) > 0;
          const isAdv = (c.current_balance || 0) < 0;

          return (
            <button
              key={c.id}
              type="button"
              data-khata-customer={c.id}
              onClick={() => {
                setSelectedCustomerId(c.id);
                setIsMobileDetailOpen(true);
              }}
              className={`w-full text-left p-3 sm:p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 shadow-2xs ${
                isSelected
                  ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/60'
                  : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50/70'
              }`}
            >
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 border ${
                  isDue
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                    : isAdv
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100 truncate block leading-snug">
                    {c.name}
                  </span>
                  {c.phone ? (
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                      <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{c.phone}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 dark:text-slate-600 italic mt-0.5">{tr('No phone saved')}</div>
                  )}
                </div>
              </div>

              <div className="text-right flex-shrink-0 flex items-center gap-2">
                <div>
                  <div
                    className={`text-xs sm:text-sm font-black font-mono leading-none ${
                      isDue
                        ? 'text-rose-600 dark:text-rose-400'
                        : isAdv
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {isDue 
                      ? `₹${(c.current_balance / 100).toFixed(2)}` 
                      : isAdv 
                      ? `₹${(Math.abs(c.current_balance) / 100).toFixed(2)}` 
                      : '₹0.00'}
                  </div>
                  <div className="mt-1">
                    <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-tight ${
                      isDue
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : isAdv
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {isDue ? tr('Due (बाकी)') : isAdv ? tr('Advance') : tr('Cleared')}
                    </span>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 lg:hidden shrink-0" />
              </div>
            </button>
          );
        })}

        {customers.length === 0 && (
          <div className="p-8 text-center text-slate-400 text-xs space-y-2">
            <BookOpen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <div className="font-bold text-slate-600 dark:text-slate-300">{tr('No Khata accounts found')}</div>
            <p className="mt-1">{tr('Add a new customer to start recording Udhar and Jama.')}</p>
            <Button
              size="sm"
              onClick={() => setIsAddCustomerOpen(true)}
              className="mt-2 text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              {tr('+ Add First Customer')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
