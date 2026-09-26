'use client';

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownRight, ArrowUpRight, Edit3, MessageCircle, Phone, Trash2, Truck, FileText } from 'lucide-react';
import { db } from '@/lib/db';
import { Supplier, LedgerTransaction } from '@/types';
import { formatINR } from '@/lib/utils';
import { ProfitMask } from '@/components/privacy/ProfitMask';
import { msg, paymentMethodLabel, tr } from '@/lib/i18n/core';

interface SupplierDetailPanelProps {
  supplier: Supplier;
  onPurchase: () => void;
  onPayment: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  CREDIT_PURCHASE: msg('Purchase on credit'),
  SUPPLIER_PAYMENT: msg('Payment made'),
  OPENING_BALANCE: msg('Opening balance'),
  ADJUSTMENT: msg('Adjustment'),
};

export function balanceLabel(balance: number): { text: string; className: string } {
  if (balance > 0) return { text: tr('You owe {v1}', { v1: formatINR(balance) }), className: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (balance < 0) return { text: tr('Advance {v1}', { v1: formatINR(-balance) }), className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  return { text: tr('Settled'), className: 'bg-slate-100 text-slate-600 border-slate-200' };
}

export function SupplierDetailPanel({ supplier, onPurchase, onPayment, onEdit, onDelete }: SupplierDetailPanelProps) {
  const entries =
    useLiveQuery(
      async () =>
        (await db.ledger_transactions.where('party_id').equals(supplier.id).toArray())
          .filter((t) => t.party_type === 'supplier')
          .sort((a, b) => b.created_at.localeCompare(a.created_at)),
      [supplier.id]
    ) || [];
  const bills = useLiveQuery(() => db.purchase_bills.where('supplier_id').equals(supplier.id).reverse().sortBy('created_at'), [supplier.id]) || [];

  const bal = balanceLabel(supplier.current_balance || 0);
  const waPhone = (supplier.phone || '').replace(/\D/g, '').slice(-10);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col min-h-0 h-full">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900 truncate">{supplier.name}</h2>
            <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {supplier.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{supplier.phone}</span>}
              {supplier.gstin && <span className="font-mono">GSTIN {supplier.gstin}</span>}
              {supplier.address && <span className="truncate">{supplier.address}</span>}
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-lg border text-xs font-black whitespace-nowrap ${bal.className}`}>
            <ProfitMask>{bal.text}</ProfitMask>
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onPurchase} className="h-9 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <ArrowUpRight className="w-3.5 h-3.5" /> {tr('Purchase on Credit')}
          </button>
          <button type="button" onClick={onPayment} className="h-9 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <ArrowDownRight className="w-3.5 h-3.5" /> {tr('Record Payment')}
          </button>
          {waPhone.length === 10 && (
            <a
              href={`https://wa.me/91${waPhone}`}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp
            </a>
          )}
          <button type="button" onClick={onEdit} className="h-9 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <Edit3 className="w-3.5 h-3.5" /> {tr('Edit')}
          </button>
          <button type="button" onClick={onDelete} className="h-9 w-9 rounded-lg border border-slate-300 hover:bg-rose-50 text-rose-600 flex items-center justify-center cursor-pointer" aria-label={tr('Delete supplier')}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ledger */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{tr('Account history')}</h3>
          {entries.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center">{tr('No entries yet. Record a purchase or a payment.')}</p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {entries.map((t: LedgerTransaction) => {
                const isPurchase = t.transaction_type === 'CREDIT_PURCHASE' || (t.transaction_type === 'OPENING_BALANCE' && t.balance_after > 0);
                return (
                  <div key={t.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900">
                        {TYPE_LABEL[t.transaction_type] ? tr(TYPE_LABEL[t.transaction_type]) : t.transaction_type}
                        {t.payment_method && <span className="ml-1.5 text-[10px] font-black uppercase text-slate-500">{paymentMethodLabel(t.payment_method)}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        {t.notes ? ` • ${t.notes}` : ''}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black font-mono ${isPurchase ? 'text-rose-700' : 'text-emerald-700'}`}>
                        <ProfitMask>{isPurchase ? '+' : '−'}{formatINR(t.amount)}</ProfitMask>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        <ProfitMask>{tr('Bal')} {formatINR(t.balance_after)}</ProfitMask>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {bills.length > 0 && (
          <div>
            <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{tr('Stock inward bills')}</h3>
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl">
              {bills.map((b) => (
                <div key={b.id} className="px-3 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">
                      {b.bill_number ? tr('Bill #{bill_number}', { bill_number: b.bill_number }) : tr('Bill')} • {b.line_items?.length || 0} {tr('items •')}{' '}
                      {new Date(b.created_at).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                  <span className="font-mono font-bold text-slate-800"><ProfitMask>{formatINR(b.total_amount || 0)}</ProfitMask></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SupplierEmptyPanel() {
  return (
    <div className="bg-white border border-dashed border-slate-300 rounded-2xl h-full flex flex-col items-center justify-center text-center p-8 text-slate-500">
      <Truck className="w-8 h-8 text-slate-300 mb-2" />
      <p className="text-sm font-bold text-slate-700">{tr('Select a supplier')}</p>
      <p className="text-xs">{tr('See what you owe, record purchases and payments.')}</p>
    </div>
  );
}
