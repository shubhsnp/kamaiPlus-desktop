'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { History } from 'lucide-react';
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
import { pagePath } from '@/lib/ui/globalShortcuts';
import { DraggablePullTab } from './DraggablePullTab';

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

  // Don't show these drawers on the Billing POS page itself, nor on Tables & Orders / Fast POS (v4.161.0:
  // the pull tab covered the order's amounts; that screen has its own Today's bills strip).
  if (pagePath(pathname) === '/billing' || pagePath(pathname) === '/restaurant') {
    return null;
  }

  return (
    <>
      {/* PULL TAB ON THE RIGHT EDGE: TRANSACTIONS (recent bills) — drag it up / down (v4.78.0) */}
      <DraggablePullTab
        onOpen={() => setIsHistoryOpen(true)}
        title={tr('Transactions — drag up or down to move it (right-click: back to the middle)')}
        className="bg-slate-900 dark:bg-slate-800 text-white p-2 py-5 rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.1)] hover:-translate-x-1 transition-transform flex items-center justify-center group"
      >
        <div className="flex flex-col items-center gap-2 pointer-events-none">
          <History className="w-4 h-4 text-cyan-400" />
          <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] font-black tracking-widest uppercase mt-1 group-hover:text-cyan-400 transition-colors">
            {tr('Transactions')}
          </span>
        </div>
      </DraggablePullTab>

      {/* --- HISTORY DRAWER --- */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[100]"
          onClick={() => setIsHistoryOpen(false)}
        />
      )}
      
      <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[420px] bg-slate-50 dark:bg-slate-950 shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out ${isHistoryOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* No drawer title: the list's own header ("Recent Transactions") has the close button. */}
          <div className="flex-1 overflow-y-auto">
            <DashboardRecentSales
              sales={recentSales}
              onSelectSaleForInvoice={(sale) => setSelectedSaleForInvoice(sale)}
              business={business}
              onClose={() => setIsHistoryOpen(false)}
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

