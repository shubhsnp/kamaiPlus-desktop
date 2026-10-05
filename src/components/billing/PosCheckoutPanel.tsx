'use client';

import React from 'react';
import { PaymentMethod } from '@/types';
import { formatINR, cn } from '@/lib/utils';
import { Plus, Printer, BookOpen, X, Settings2, PauseCircle } from 'lucide-react';
import { focusPosCustomerName, PosCustomerRow } from '@/components/billing/PosCustomerRow';
import { PosPriceModeToggle } from '@/components/billing/PosPriceModeToggle';
import { isDraftEmpty } from '@/lib/billing/billCustomer';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { PosCartLines } from '@/components/billing/PosCartLines';
import { PosUndoBar } from '@/components/billing/PosUndoBar';
import { PosBillDiscount } from '@/components/billing/PosBillDiscount';
import { CashTenderPanel, SplitPaymentPanel, UpiQrCard } from '@/components/billing/PosPaymentPanels';
import { PrintFailureBar } from '@/components/billing/BillPrintQueue';
import { tr } from '@/lib/i18n/core';
import { PosCheckoutFooter } from '@/components/billing/PosCheckoutFooter';
import type { useBackgroundBillPrint } from '@/components/billing/BillPrintQueue';
import type { CustomerDraft } from '@/lib/billing/billCustomer';
import type { BillTab, DiscardedBill } from '@/lib/billing/billTabs';
import type { PriceMode } from '@/lib/billing/priceMode';
import type { Business, CartItem, Customer, Sale } from '@/types';

export interface PosCheckoutPanelProps {
  searchInputRef: React.RefObject<HTMLInputElement>;
  billPrint: ReturnType<typeof useBackgroundBillPrint>;
  silentPrint: boolean;
  setAutoPrint: (next: boolean) => void;
  setIsBillPrinterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  tabs: BillTab[];
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  activeTab: BillTab;
  cart: CartItem[];
  selectedCustomerId: string;
  paymentMethod: PaymentMethod;
  amountReceivedInput: string;
  splitCash: string;
  splitUpi: string;
  splitCard: string;
  splitCredit: string;
  billDiscountType: "flat" | "percentage";
  billDiscountValue: string;
  priceMode: PriceMode;
  setSelectedCustomerId: (id: string) => void;
  setPriceMode: (mode: PriceMode) => Promise<void>;
  customerDraft: CustomerDraft;
  setCustomerDraft: (draft: CustomerDraft) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setAmountReceivedInput: (val: string) => void;
  setSplitCash: (val: string | ((p: string) => string)) => void;
  setSplitUpi: (val: string | ((p: string) => string)) => void;
  setSplitCard: (val: string | ((p: string) => string)) => void;
  setSplitCredit: (val: string | ((p: string) => string)) => void;
  setBillDiscountType: (val: "flat" | "percentage") => void;
  setBillDiscountValue: (val: string) => void;
  handleCreateNewTab: () => void;
  handleHoldActiveTab: () => void;
  discardedBill: DiscardedBill | null;
  setDiscardedBill: React.Dispatch<React.SetStateAction<DiscardedBill | null>>;
  handleUndoDiscard: () => void;
  handleClearCart: () => void;
  billScrollRef: React.RefObject<HTMLDivElement>;
  handleCloseTab: (tabId: string, e: React.MouseEvent) => void;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  posQrDataUrl: string;
  setIsEnlargeQrModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  business: Business | undefined;
  khataOn: boolean;
  paymentKeysOn: boolean;
  wholesaleOn: boolean;
  customers: Customer[];
  selectedCustomer: Customer | undefined;
  updateQuantity: (productId: string, delta: number) => Promise<void>;
  removeFromCart: (productId: string) => void;
  handleOpenEditItem: (item: CartItem) => void;
  totalItemCount: number;
  totalUnits: number;
  billDiscountPaise: number;
  itemsValuePaise: number;
  discountTotalPaise: number;
  grandTotalPaise: number;
  addedGstPaise: number;
  includedGstPaise: number;
  handleCompleteSale: () => Promise<void>;
  handleSaveEstimate: () => Promise<void>;
}

/**
 * The bill side of the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx unchanged):
 * bill tabs, customer, cart lines, discount, payment mode and details, totals, Complete Sale
 * and Save as Estimate. Used for the desktop side panel and the mobile bottom drawer.
 * Every value comes from the page; this file only draws.
 */
export function PosCheckoutPanel(props: PosCheckoutPanelProps) {
  const {
    searchInputRef, billPrint, silentPrint, setAutoPrint, setIsBillPrinterOpen, tabs,
    activeTabId, setActiveTabId, activeTab, cart, selectedCustomerId, paymentMethod,
    amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, billDiscountType,
    billDiscountValue, priceMode, setSelectedCustomerId, setPriceMode, customerDraft, setCustomerDraft,
    setPaymentMethod, setAmountReceivedInput, setSplitCash, setSplitUpi, setSplitCard, setSplitCredit,
    setBillDiscountType, setBillDiscountValue, handleCreateNewTab, handleHoldActiveTab, discardedBill, setDiscardedBill,
    handleUndoDiscard, handleClearCart, billScrollRef, handleCloseTab, setIsInvoiceModalOpen, setActiveSaleForInvoice,
    posQrDataUrl, setIsEnlargeQrModalOpen, business, khataOn, paymentKeysOn, wholesaleOn,
    customers, selectedCustomer, updateQuantity, removeFromCart, handleOpenEditItem, totalItemCount,
    totalUnits, billDiscountPaise, itemsValuePaise, discountTotalPaise, grandTotalPaise, addedGstPaise,
    includedGstPaise, handleCompleteSale, handleSaveEstimate,
  } = props;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* v4.93.0 — the bill tabs, the customer and the cart header stay put; only the bill's
          lines and the payment details below them scroll; the payment mode, grand total and
          Complete Sale are pinned at the bottom. A scan scrolls its line into view. */}
      <div className="flex-shrink-0 space-y-2 pb-2">
        {/* Multi-Bill Tab Bar */}
        <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1 overflow-x-auto border border-slate-200">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const count = tab.cart.reduce((s, i) => s + i.quantity, 0);
            const cust = customers.find((c) => c.id === tab.selectedCustomerId);
            const typedName = (tab.customerName || '').trim() || (tab.customerPhone || '').trim();
            const tabTitle = cust ? cust.name.split(' ')[0] : typedName ? typedName.split(' ')[0] : tr('Bill #{tabNumber}', { tabNumber: tab.tabNumber });

            return (
              <div
                key={tab.id}
                data-bill-tab={tab.id}
                data-active-bill={isActive ? 'true' : undefined}
                onClick={() => setActiveTabId(tab.id)}
                className={cn(
                  'px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer select-none transition-all flex-shrink-0',
                  isActive
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-300'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                )}
              >
                <span>{tabTitle}</span>
                {count > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.2 rounded-full text-[10px] font-extrabold',
                    isActive ? 'bg-amber-400 text-slate-950' : 'bg-slate-200 text-slate-700'
                  )}>
                    {count}
                  </span>
                )}
                {tab.isHeld && (
                  <span className="text-[10px] text-amber-600" title={tr('Bill is on hold')}>
                    ⏸️
                  </span>
                )}
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="hover:text-rose-600 text-slate-400 p-0.5 rounded-full"
                    title={tr('Close this bill tab')}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Tab Button */}
          <button
            type="button"
            onClick={handleCreateNewTab}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-950 hover:bg-slate-200 text-xs font-bold flex items-center gap-1 flex-shrink-0 transition-colors cursor-pointer"
            title={tr('Open New Parallel Bill Cart')}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">{tr('New')}</span>
          </button>

          {/* Silent Instant Print Quick Toggle */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = !silentPrint;
                // First time on with no bill printer chosen: pick it first (else it prints to the Windows default).
                const ps = getPrintSettings();
                if (next && !printerForFormat(ps, ps.defaultFormat)) {
                  setIsBillPrinterOpen(true);
                  return;
                }
                setAutoPrint(next);
              }}
              className={cn(
                "px-2 py-1 rounded-lg text-[10.5px] font-bold flex items-center gap-1 transition-all cursor-pointer border",
                silentPrint
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
              )}
              title={tr('Toggle Instant Silent Print (Direct Thermal Print without preview dialog)')}
            >
              <Printer className="w-3 h-3" />
              <span>{silentPrint ? tr('⚡ Silent: ON') : tr('Silent: OFF')}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsBillPrinterOpen(true)}
              className="p-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 cursor-pointer"
              title={tr('Bill printer')}
              aria-label={tr('Bill printer')}
              data-bill-printer-open
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <PrintFailureBar
          failed={billPrint.failed}
          onRetry={(job) => billPrint.print(job)}
          onOpen={(job) => {
            setActiveSaleForInvoice(job.sale);
            searchInputRef.current?.blur();
            setIsInvoiceModalOpen(true);
          }}
          onDismiss={billPrint.dismiss}
        />

        <PosUndoBar discarded={discardedBill} onUndo={handleUndoDiscard} onDismiss={() => setDiscardedBill(null)} />

        {/* Customer: one row, no pop-up — name / mobile, saved customers show underneath */}
        {selectedCustomer && (selectedCustomer.current_balance || 0) > 0 && (
          <span className="inline-flex px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300 text-rose-700 text-[10.5px] font-black items-center gap-1 shadow-2xs">
            <span>{tr('⚠️ Old Khata:')}</span>
            <span className="font-mono">{formatINR(selectedCustomer.current_balance)}</span>
          </span>
        )}
        <PosCustomerRow
          customers={customers}
          selectedCustomer={selectedCustomer}
          draft={customerDraft}
          onDraftChange={setCustomerDraft}
          onSelect={setSelectedCustomerId}
        />

        {/* Credit Mode Mandatory Customer Alert Banner */}
        {paymentMethod === 'credit' && !selectedCustomerId && isDraftEmpty(customerDraft) && (
          <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-950 flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span className="font-bold truncate">{tr('Customer Name is compulsory for Credit (Udhar)')}</span>
            </div>
            <button
              type="button"
              onClick={() => focusPosCustomerName()}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] cursor-pointer flex-shrink-0 transition shadow-xs"
            >
              {tr('+ Add Customer')}
            </button>
          </div>
        )}

        {/* Cart Header: count, Retail / Wholesale, Hold, Clear */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
            <span>{tr('Cart Items (')}{totalItemCount})</span>
            {activeTab.isHeld && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                {tr('⏸️ On Hold')}
              </span>
            )}
          </span>

          <div className="flex items-center gap-2">
            {wholesaleOn && <PosPriceModeToggle compact mode={priceMode} onChange={(m) => void setPriceMode(m)} />}
            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleHoldActiveTab}
                className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1 cursor-pointer transition-colors"
                title={tr('Park / Hold this bill and start a new one')}
              >
                <PauseCircle className="w-3 h-3" />
                <span>{tr('Hold Bill')}</span>
              </button>
            )}

            {cart.length > 0 && (
              <button
                type="button"
                onClick={handleClearCart}
                className="text-[11px] font-bold text-rose-600 hover:text-rose-700 cursor-pointer transition-colors"
                data-pos-clear
              >
                {tr('Clear')}
              </button>
            )}
          </div>
        </div>

        {cart.length > 0 && (
          <div className="grid grid-cols-12 text-[10px] uppercase font-extrabold tracking-wider text-slate-400 px-2.5 py-0.5 bg-slate-100/90 rounded-lg select-none">
            <span className="col-span-6">{tr('Item & Details')}</span>
            <span className="col-span-3 text-center">{tr('Qty')}</span>
            <span className="col-span-3 text-right">{tr('Total (₹)')}</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 -mr-1" data-pos-bill-scroll ref={billScrollRef}>
        <PosCartLines cart={cart} billId={activeTab.id} onQuantity={updateQuantity} onEdit={handleOpenEditItem} onRemove={removeFromCart} />

        <div className="space-y-3" data-pos-pay-details>
          {/* Credit Mode Live Customer Balance Insight */}
          {paymentMethod === 'credit' && selectedCustomer && (
            <div className="p-2.5 bg-amber-50/90 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between font-bold">
                <span className="flex items-center gap-1 text-amber-900">
                  <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                  <span>{tr('Khata Credit Preview (')}{selectedCustomer.name}):</span>
                </span>
                <span className="font-mono text-[11px] text-slate-500">{tr('Udhar Sale')}</span>
              </div>
              <div className="grid grid-cols-3 gap-1 pt-1 border-t border-amber-200/80 text-center font-mono">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('Old Balance')}</span>
                  <span className="font-bold text-slate-800">
                    {formatINR(selectedCustomer.current_balance || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('This Bill')}</span>
                  <span className="font-bold text-rose-600">
                    +{formatINR(grandTotalPaise)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">{tr('New Balance')}</span>
                  <span className="font-black text-rose-700">
                    ={formatINR((selectedCustomer.current_balance || 0) + grandTotalPaise)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* If Split / Multi-Mode Payment: Render Breakdown Inputs */}
          {paymentMethod === 'split' && cart.length > 0 && (
            <SplitPaymentPanel
              grandTotalPaise={grandTotalPaise}
              splitCash={splitCash} setSplitCash={setSplitCash}
              splitUpi={splitUpi} setSplitUpi={setSplitUpi}
              splitCard={splitCard} setSplitCard={setSplitCard}
              splitCredit={splitCredit} setSplitCredit={setSplitCredit}
              creditAllowed={khataOn}
            />
          )}

          {/* If Cash: Amount Received Input for Change calculation with Quick Tender Chips */}
          {paymentMethod === 'cash' && cart.length > 0 && (
            <CashTenderPanel
              grandTotalPaise={grandTotalPaise}
              amountReceivedInput={amountReceivedInput}
              setAmountReceivedInput={setAmountReceivedInput}
            />
          )}

          {/* If UPI (or Split with UPI): Real-Time Dynamic Amount QR Code Card */}
          {((paymentMethod === 'upi') || (paymentMethod === 'split' && parseFloat(splitUpi || '0') > 0)) && cart.length > 0 && (
            <UpiQrCard
              paymentMethod={paymentMethod}
              splitUpi={splitUpi}
              grandTotalPaise={grandTotalPaise}
              posQrDataUrl={posQrDataUrl}
              business={business}
              setIsEnlargeQrModalOpen={setIsEnlargeQrModalOpen}
            />
          )}

          {cart.length > 0 && (
            <PosBillDiscount type={billDiscountType} value={billDiscountValue} onTypeChange={setBillDiscountType} onValueChange={setBillDiscountValue} />
          )}
        </div>
      </div>

      {/* Bottom Total & Checkout Button (always visible) */}
      <PosCheckoutFooter
        {...{
          paymentMethod, selectedCustomerId, cart, splitCash, splitUpi, amountReceivedInput,
          customerDraft, setPaymentMethod, setSplitCash, setSplitUpi, khataOn, paymentKeysOn,
          totalItemCount, selectedCustomer, grandTotalPaise, discountTotalPaise, addedGstPaise, itemsValuePaise,
          billDiscountPaise, totalUnits, includedGstPaise, handleCompleteSale, handleSaveEstimate,
        }}
      />
    </div>
  );
}
