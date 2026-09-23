'use client';

import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { ShoppingCart, X, History, ArrowRight } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import { DashboardRecentSales } from '@/components/dashboard/DashboardRecentSales';
import { formatINR } from '@/lib/utils';
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);
import { Sale } from '@/types';

export const GlobalDrawers: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const [selectedSaleForInvoice, setSelectedSaleForInvoice] = useState<Sale | null>(null);

  // Close drawers when navigating
  useEffect(() => {
    setIsHistoryOpen(false);
    setIsCheckoutOpen(false);
  }, [pathname]);



  const business = useBusiness();
  
  const recentSales = useLiveQuery(async () => {
    if (!isHistoryOpen) return [];
    return await db.sales.orderBy('created_at').reverse().limit(50).toArray();
  }, [isHistoryOpen]) || [];

  // Quick Cart Preview State
  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const fetchCartPreview = useCallback(() => {
    try {
      const stored = localStorage.getItem('kamai_tabs_v2');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const activeTab = parsed.find((t: any) => t.isActive) || parsed[0];
          const count = activeTab.cart.reduce((sum: number, item: any) => sum + item.quantity, 0);
          const total = activeTab.cart.reduce((sum: number, item: any) => sum + item.total_amount, 0);
          setCartCount(count);
          setCartTotal(total);
          return;
        }
      }
      setCartCount(0);
      setCartTotal(0);
    } catch (e) {
      console.warn("Failed to parse cart for global preview", e);
    }
  }, []);

  useEffect(() => {
    fetchCartPreview();
    window.addEventListener('kamaiplus-cart-updated', fetchCartPreview);
    window.addEventListener('focus', fetchCartPreview);
    return () => {
      window.removeEventListener('kamaiplus-cart-updated', fetchCartPreview);
      window.removeEventListener('focus', fetchCartPreview);
    };
  }, [fetchCartPreview]);

  // Don't show these drawers on the Billing POS page itself
  if (pathname === '/billing') {
    return null;
  }

  return (
    <>
      {/* PULL TABS ON THE RIGHT EDGE */}
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3">
        
        {/* CHECKOUT TAB */}
        <div 
          onClick={() => setIsCheckoutOpen(true)}
          className="bg-slate-900 dark:bg-slate-800 text-white p-2 py-5 rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.1)] cursor-pointer hover:-translate-x-1 transition-transform flex items-center justify-center group"
        >
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </div>
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] font-black tracking-widest mt-1 group-hover:text-amber-400 transition-colors">
              CHECKOUT
            </span>
          </div>
        </div>

        {/* HISTORY TAB */}
        <div 
          onClick={() => setIsHistoryOpen(true)}
          className="bg-slate-900 dark:bg-slate-800 text-white p-2 py-5 rounded-l-2xl shadow-[-4px_0_15px_rgba(0,0,0,0.1)] cursor-pointer hover:-translate-x-1 transition-transform flex items-center justify-center group"
        >
          <div className="flex flex-col items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }} className="text-[10px] font-black tracking-widest mt-1 group-hover:text-cyan-400 transition-colors">
              HISTORY
            </span>
          </div>
        </div>
      </div>

      {/* --- HISTORY DRAWER --- */}
      {isHistoryOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity animate-in fade-in"
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
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">Recent Sales</h2>
            </div>
            <button 
              onClick={() => setIsHistoryOpen(false)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
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

      {/* --- CHECKOUT DRAWER --- */}
      {isCheckoutOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity animate-in fade-in"
          onClick={() => setIsCheckoutOpen(false)}
        />
      )}
      
      <div className={`fixed top-0 right-0 h-[100dvh] w-full sm:w-[380px] bg-white dark:bg-slate-950 shadow-2xl z-[101] transform transition-transform duration-300 ease-in-out ${isCheckoutOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100 tracking-tight">Quick Cart Preview</h2>
            </div>
            <button 
              onClick={() => setIsCheckoutOpen(false)}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center border-4 border-slate-100 mb-2 shadow-inner">
              <ShoppingCart className="w-8 h-8 text-slate-300" />
            </div>
            
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-slate-900 font-mono tracking-tight">{formatINR(cartTotal)}</h3>
              <p className="text-sm font-bold text-slate-500">{cartCount} items currently in cart</p>
            </div>
            
            <p className="text-xs text-slate-400 leading-relaxed max-w-[250px] mx-auto pt-2 pb-6">
              To add items, apply discounts, or process a payment, please go to the full POS screen.
            </p>

            <button
              onClick={() => {
                setIsCheckoutOpen(false);
                router.push('/billing');
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-sm transition-all active:scale-95 shadow-lg shadow-amber-400/25"
            >
              <span>Go to POS / Pay</span>
              <ArrowRight className="w-4 h-4" />
            </button>
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
