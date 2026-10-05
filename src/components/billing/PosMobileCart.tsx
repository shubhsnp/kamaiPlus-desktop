'use client';

import React from 'react';
import { formatINR } from '@/lib/utils';
import { ArrowRight, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PosCheckoutPanel, PosCheckoutPanelProps } from '@/components/billing/PosCheckoutPanel';
import { tr } from '@/lib/i18n/core';
import type { BillTab } from '@/lib/billing/billTabs';
import type { CartItem } from '@/types';

export interface PosMobileCartProps {
  tabs: BillTab[];
  activeTab: BillTab;
  cart: CartItem[];
  setIsMobileCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isMobileCartOpen: boolean;
  totalItemCount: number;
  grandTotalPaise: number;
  posCheckoutPanelProps: PosCheckoutPanelProps;
}

/**
 * Phones / narrow windows (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged): the sticky
 * bar with the item count and total, and the bottom drawer that holds the bill panel.
 */
export function PosMobileCart(props: PosMobileCartProps) {
  const {
    tabs, activeTab, cart, setIsMobileCartOpen, isMobileCartOpen, totalItemCount,
    grandTotalPaise, posCheckoutPanelProps,
  } = props;
  return (
    <>
      <div className="lg:hidden fixed bottom-[88px] left-3 right-3 sm:left-6 sm:right-6 max-w-md mx-auto p-3 bg-white/95 backdrop-blur-md border border-slate-300 rounded-2xl z-30 shadow-2xl shadow-slate-900/15 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black relative flex-shrink-0 shadow-xs">
            <ShoppingCart className="w-5 h-5" />
            {totalItemCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {totalItemCount}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] text-slate-500 font-bold truncate">
              {tabs.length > 1 ? tr('Bill #{tabNumber} • ', { tabNumber: activeTab.tabNumber }) : ''}{totalItemCount} {totalItemCount === 1 ? tr('item') : tr('items')}
            </div>
            <div className="text-base font-black text-slate-900 font-mono leading-tight">
              {formatINR(grandTotalPaise)}
            </div>
          </div>
        </div>

        <Button
          size="md"
          disabled={cart.length === 0}
          onClick={() => setIsMobileCartOpen(true)}
          className="bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl border-none shadow-md shadow-amber-400/25 flex-shrink-0 cursor-pointer"
        >
          <span>{tr('View Cart & Pay')}</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>

      {/* Mobile Checkout Drawer Modal */}
      <Modal
        isOpen={isMobileCartOpen}
        onClose={() => setIsMobileCartOpen(false)}
        title={tr('POS Checkout — Bill #{tabNumber}', { tabNumber: activeTab.tabNumber })}
        size="lg"
      >
        <div className="p-1 h-full flex flex-col">
          <PosCheckoutPanel {...posCheckoutPanelProps} />
        </div>
      </Modal>
    </>
  );
}
