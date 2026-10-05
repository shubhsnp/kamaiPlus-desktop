'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { formatINR } from '@/lib/utils';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ManualEntryModal } from '@/components/khata/ManualEntryModal';
import { EditLedgerEntryModal } from '@/components/khata/EditLedgerEntryModal';
import { QuickAddKhataCustomerModal } from '@/components/khata/QuickAddKhataCustomerModal';
import { tr } from '@/lib/i18n/core';
import type { Business, Customer, LedgerTransaction, Sale } from '@/types';

const ConsolidatedStatementModal = dynamic(
  () => import('@/components/khata/ConsolidatedStatementModal').then((m) => m.ConsolidatedStatementModal),
  { ssr: false }
);
const InvoiceModal = dynamic(
  () => import('@/components/invoices/InvoiceModal').then((m) => m.InvoiceModal),
  { ssr: false }
);
const SettleInvoicesModal = dynamic(
  () => import('@/components/khata/SettleInvoicesModal').then((m) => m.SettleInvoicesModal),
  { ssr: false }
);

export interface KhataDialogsProps {
  isEntryModalOpen: boolean;
  setIsEntryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  entryType: "CREDIT_SALE" | "PAYMENT_RECEIVED";
  entryAmount: string;
  setEntryAmount: React.Dispatch<React.SetStateAction<string>>;
  entryNotes: string;
  setEntryNotes: React.Dispatch<React.SetStateAction<string>>;
  entryDate: string;
  setEntryDate: React.Dispatch<React.SetStateAction<string>>;
  entryPaymentMode: "cash" | "upi" | "bank" | "other";
  setEntryPaymentMode: React.Dispatch<React.SetStateAction<"cash" | "upi" | "bank" | "other">>;
  isAddCustomerOpen: boolean;
  setIsAddCustomerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  newCustName: string;
  setNewCustName: React.Dispatch<React.SetStateAction<string>>;
  newCustPhone: string;
  setNewCustPhone: React.Dispatch<React.SetStateAction<string>>;
  newCustAddress: string;
  setNewCustAddress: React.Dispatch<React.SetStateAction<string>>;
  newCustOpeningBalance: string;
  setNewCustOpeningBalance: React.Dispatch<React.SetStateAction<string>>;
  addCustomerError: string;
  editingTx: LedgerTransaction | null;
  setEditingTx: React.Dispatch<React.SetStateAction<LedgerTransaction | null>>;
  editTxAmount: string;
  setEditTxAmount: React.Dispatch<React.SetStateAction<string>>;
  editTxNotes: string;
  setEditTxNotes: React.Dispatch<React.SetStateAction<string>>;
  editTxType: "CREDIT_SALE" | "PAYMENT_RECEIVED";
  setEditTxType: React.Dispatch<React.SetStateAction<"CREDIT_SALE" | "PAYMENT_RECEIVED">>;
  isClearAllModalOpen: boolean;
  setIsClearAllModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  clearConfirmationText: string;
  setClearConfirmationText: React.Dispatch<React.SetStateAction<string>>;
  setSettleModalSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  settleModalSales: Sale[];
  isSettleModalOpen: boolean;
  setIsSettleModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConsolidatedModalSales: React.Dispatch<React.SetStateAction<Sale[]>>;
  consolidatedModalSales: Sale[];
  isConsolidatedModalOpen: boolean;
  setIsConsolidatedModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  viewingSale: Sale | null;
  setViewingSale: React.Dispatch<React.SetStateAction<Sale | null>>;
  isInvoiceModalOpen: boolean;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  showToast: (msg: string) => void;
  business: Business | undefined;
  selectedCustomer: Customer | null;
  handleSaveEntry: (e: React.FormEvent) => Promise<void>;
  handleCreateCustomer: (e: React.FormEvent) => Promise<void>;
  handleSaveEditTx: (e: React.FormEvent) => Promise<void>;
  handleClearCustomerKhata: () => Promise<void>;
}

/**
 * The windows of the Khata page (v4.104.0, K-D23 — moved out of app/khata/page.tsx unchanged):
 * manual entry, add customer, edit entry, clear history, the bill viewer, settle bills and the
 * consolidated statement.
 */
export function KhataDialogs(props: KhataDialogsProps) {
  const {
    isEntryModalOpen, setIsEntryModalOpen, entryType, entryAmount, setEntryAmount, entryNotes,
    setEntryNotes, entryDate, setEntryDate, entryPaymentMode, setEntryPaymentMode, isAddCustomerOpen,
    setIsAddCustomerOpen, newCustName, setNewCustName, newCustPhone, setNewCustPhone, newCustAddress,
    setNewCustAddress, newCustOpeningBalance, setNewCustOpeningBalance, addCustomerError, editingTx, setEditingTx,
    editTxAmount, setEditTxAmount, editTxNotes, setEditTxNotes, editTxType, setEditTxType,
    isClearAllModalOpen, setIsClearAllModalOpen, clearConfirmationText, setClearConfirmationText, setSettleModalSales, settleModalSales,
    isSettleModalOpen, setIsSettleModalOpen, setConsolidatedModalSales, consolidatedModalSales, isConsolidatedModalOpen, setIsConsolidatedModalOpen,
    viewingSale, setViewingSale, isInvoiceModalOpen, setIsInvoiceModalOpen, showToast, business,
    selectedCustomer, handleSaveEntry, handleCreateCustomer, handleSaveEditTx, handleClearCustomerKhata,
  } = props;
  return (
    <>
      {/* ========================================================================= */}
      {/* MANUAL KHATA ENTRY MODAL (+ You Gave / - You Got) */}
      {/* ========================================================================= */}
      <ManualEntryModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        customer={selectedCustomer}
        entryType={entryType}
        entryAmount={entryAmount}
        setEntryAmount={setEntryAmount}
        entryDate={entryDate}
        setEntryDate={setEntryDate}
        entryPaymentMode={entryPaymentMode}
        setEntryPaymentMode={setEntryPaymentMode}
        entryNotes={entryNotes}
        setEntryNotes={setEntryNotes}
        onSubmit={handleSaveEntry}
      />

      {/* ========================================================================= */}
      {/* QUICK ADD CUSTOMER MODAL */}
      {/* ========================================================================= */}
      <QuickAddKhataCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        newCustName={newCustName}
        setNewCustName={setNewCustName}
        newCustPhone={newCustPhone}
        setNewCustPhone={setNewCustPhone}
        newCustAddress={newCustAddress}
        setNewCustAddress={setNewCustAddress}
        newCustOpeningBalance={newCustOpeningBalance}
        setNewCustOpeningBalance={setNewCustOpeningBalance}
        onSubmit={handleCreateCustomer}
        formError={addCustomerError}
      />

      {/* ========================================================================= */}
      {/* EDIT TRANSACTION MODAL */}
      {/* ========================================================================= */}
      <EditLedgerEntryModal
        isOpen={!!editingTx}
        onClose={() => setEditingTx(null)}
        editingTx={editingTx}
        editTxType={editTxType}
        setEditTxType={setEditTxType}
        editTxAmount={editTxAmount}
        setEditTxAmount={setEditTxAmount}
        editTxNotes={editTxNotes}
        setEditTxNotes={setEditTxNotes}
        onSubmit={handleSaveEditTx}
      />

      {/* ========================================================================= */}
      {/* CLEAR ALL STATEMENT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isClearAllModalOpen}
        onClose={() => setIsClearAllModalOpen(false)}
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <Trash2 className="w-5 h-5" />
            <span>{tr('Wipe Statement History for')} {selectedCustomer?.name}?</span>
          </div>
        }
        description={tr('This will permanently delete all recorded ledger transactions for this customer and reset balance to ₹0.')}
        size="sm"
      >
        <div className="space-y-3 p-1">
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            {tr('Please type')} <b className="text-rose-600 font-mono">DELETE</b> {tr('to confirm:')}
          </p>
          <input
            type="text"
            placeholder={tr('Type DELETE')}
            value={clearConfirmationText}
            onChange={(e) => setClearConfirmationText(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 uppercase focus:outline-none focus:ring-2 focus:ring-rose-500"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsClearAllModalOpen(false)}
            >
              {tr('Cancel')}
            </Button>
            <Button
              size="sm"
              disabled={clearConfirmationText.toUpperCase() !== 'DELETE'}
              onClick={handleClearCustomerKhata}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
            >
              {tr('Wipe Statement History')}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* TAX INVOICE BILL VIEWER MODAL */}
      {/* ========================================================================= */}
      {viewingSale && (
        <InvoiceModal
          isOpen={isInvoiceModalOpen}
          onClose={() => {
            setIsInvoiceModalOpen(false);
            setViewingSale(null);
          }}
          sale={viewingSale}
          business={business || null}
          initialPhone={viewingSale.customer_phone || ''}
        />
      )}

      {/* ========================================================================= */}
      {/* MULTI-INVOICE SETTLEMENT MODAL */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <SettleInvoicesModal
          isOpen={isSettleModalOpen}
          onClose={() => {
            setIsSettleModalOpen(false);
            setSettleModalSales([]);
          }}
          selectedSales={settleModalSales}
          customer={selectedCustomer}
          business={business}
          onSuccess={(newBal, count) => {
            showToast(tr('✅ Successfully settled {count} bill(s)! New balance: {v2}', { count: count, v2: formatINR(newBal) }));
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* CONSOLIDATED STATEMENT / MULTI-BILL MODAL */}
      {/* ========================================================================= */}
      {selectedCustomer && (
        <ConsolidatedStatementModal
          isOpen={isConsolidatedModalOpen}
          onClose={() => {
            setIsConsolidatedModalOpen(false);
            setConsolidatedModalSales([]);
          }}
          selectedSales={consolidatedModalSales}
          customer={selectedCustomer}
          business={business}
        />
      )}
    </>
  );
}
