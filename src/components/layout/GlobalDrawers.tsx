'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { X, History } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import { DashboardRecentSales } from '@/components/dashboard/DashboardRecentSales';
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);
import { Sale } from '@/types';
import { tr } from '@/lib/i18n/core';

export const GlobalDrawers: React.FC = () => {
  const pathname = usePathname();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);

  // Close drawer when navigating
  useEffect(() => {
    setIsHistoryOpen(false);
  }, [pathname]);

  // Esc closes the history drawer (an open bill preview handles Esc itself).
  useEffect(() => {
    if (!isHistoryOpen || selectedSaleForInvoice) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsHistoryOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHistoryOpen, selectedSaleForInvoice]);

  const business = useBusiness();
  
  const recentSales = useLiveQuery(async () => {
    if (!isHistoryOpen) return [];
    return await db.sales.orderBy('created_at').reverse().limit(50).toArray();
  }, [isHistoryOpen]) || [];

  // Don't show these drawers on the Billing POS page itself
  if (pathname === '/billing') {
    return null;
  }

  return (
    <>
      {/* PULL TAB ON THE RIGHT EDGE: HISTORY ONLY */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
        {/* HISTORY TAB */}
        <div 
          onClick={() => setIsHistoryOpen(true)}
          className="bg-slate-900 dark:bg-slate-800 text-white p-2 py-5 rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.1)] cursor-pointer hover:-translate-x-1 transition-transform flex items-center justify-center group"
          title={tr('Open Recent Sales History')}
        >
          <div className="flex flex-col items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] font-black tracking-widest mt-1 group-hover:text-cyan-400 transition-colors">
              {tr('HISTORY')}
            </span>
          </div>
        </div>
      </div>

      {/* --- HISTORY DRAWER --- */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[100]"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-slate-50 dark:bg-slate-950 shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <History className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">{tr('Recent Sales')}</h2>
            </div>
            <button 
              onClick={() => setIsHistoryOpen(false)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <DashboardRecentSales
              sales={recentSales}
              onSelectSaleForInvoice={(sale) => setSelectedSaleForInvoice(sale)}
              business={business}
            />
          </div>
        </div>
      </div>

      {/* Invoice Modal for History Viewer */}
      {selectedSaleForInvoice && (
        <InvoiceModal
          isOpen={!!selectedSaleForInvoice}
          onClose={() => setSelectedSaleForInvoice(null)}
          sale={selectedSaleForInvoice}
          business={business || null}
        />
      )}
    </>
  );
};

