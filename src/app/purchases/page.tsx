'use client';

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import { 
  ShoppingBag, 
  Plus, 
  Truck, 
  Package, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  Layers,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Product, PurchaseBill } from '@/types';
import { InwardBillButton } from '@/components/purchases/InwardBillButton';
import { recordSupplierEntry } from '@/lib/suppliers/supplierLedger';
import { isVariantParent, tracksOwnStock } from '@/lib/products/variants';
import { CashierPrivacyToggleButton, ProfitMask } from '@/components/privacy/ProfitMask';

export default function PurchasesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [supplierName, setSupplierName] = useState('');
  // A saved supplier from /suppliers ('' = none, typed name only).
  const [supplierId, setSupplierId] = useState('');
  const [onCredit, setOnCredit] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // A variant parent holds no stock of its own — restock its sizes / colours instead.
  const products = (useLiveQuery(async () => db.products.toArray()) || []).filter((p) => !isVariantParent(p));
  const restockItems = products.filter((p) => tracksOwnStock(p) && p.current_stock <= p.min_stock_level);
  const suppliers = useLiveQuery(() => db.suppliers.orderBy('name').toArray()) || [];
  const business = useBusiness();
  const purchaseBills = useLiveQuery(async () => 
    db.purchase_bills.orderBy('created_at').reverse().limit(10).toArray()
  ) || [];
  const recentMovements = useLiveQuery(async () => 
    db.inventory_movements.where('movement_type').equals('PURCHASE').reverse().limit(10).toArray()
  ) || [];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleRecordPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!selectedProductId) {
      setModalError('Please select a product to restock.');
      return;
    }

    const qtyNum = parseFloat(quantity);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setModalError('Quantity received must be greater than 0.');
      return;
    }

    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) {
      setModalError('Selected product not found in catalog.');
      return;
    }

    const costPaise = costPrice ? parseRupeesToPaise(costPrice) : prod.purchase_price || 0;
    if (costPaise < 0) {
      setModalError('Cost price cannot be negative.');
      return;
    }

    const now = new Date().toISOString();
    const previousStock = prod.current_stock;
    const newStock = previousStock + qtyNum;
    const supplier = suppliers.find((s) => s.id === supplierId);
    const vendorName = supplier?.name || supplierName.trim();
    const movementId = `mov_pur_${Date.now()}`;

    // 1. Update product stock and purchase price
    await db.products.update(prod.id, {
      current_stock: newStock,
      purchase_price: costPaise,
      updated_at: now,
    });

    // 2. Add inventory movement record
    await db.inventory_movements.put({
      id: movementId,
      business_id: business?.id || 'biz_default',
      product_id: prod.id,
      product_name: prod.name,
      movement_type: 'PURCHASE',
      quantity: qtyNum,
      previous_stock: previousStock,
      new_stock: newStock,
      reason: `Vendor Restock: ${vendorName || 'General Supplier'}`,
      created_by: 'owner',
      created_at: now,
    });

    // 3. Bought on credit from a saved supplier: add the value to what the shop owes them.
    let creditNote = '';
    if (supplier && onCredit) {
      const valuePaise = Math.round(costPaise * qtyNum);
      if (valuePaise > 0) {
        const res = await recordSupplierEntry({
          supplierId: supplier.id,
          kind: 'purchase',
          amountPaise: valuePaise,
          note: `Stock inward: ${prod.name} × ${qtyNum}`,
          referenceId: movementId,
          date: now,
        });
        creditNote = res.ok ? ` • ${formatINR(valuePaise)} added to ${supplier.name}'s account` : ` • Could not update ${supplier.name}'s account: ${res.error}`;
      }
    }

    setIsModalOpen(false);
    setSelectedProductId('');
    setQuantity('');
    setCostPrice('');
    setSupplierName('');
    setSupplierId('');
    setOnCredit(false);
    setModalError(null);
    showToast(`Stock updated for ${prod.name} (+${qtyNum} ${prod.unit})${creditNote}`);
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <span>Purchase &amp; Restock Orders</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Record inbound inventory, capture wholesale invoices, and update cost prices.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <CashierPrivacyToggleButton />

          {/* Excel / CSV Bill Inward */}
          <InwardBillButton
            businessId={business?.id}
            existingProducts={products}
            onScanSuccess={(_billId, updated, created) => {
              showToast(`🎉 Bill inward complete! ${updated} items restocked, ${created} new products created.`);
            }}
          />

          <Button onClick={() => setIsModalOpen(true)} size="md" className="text-xs font-bold gap-1.5 cursor-pointer">
            <Plus className="w-4 h-4" />
            <span>Manual Inward</span>
          </Button>
        </div>
      </div>

      {/* Grid: Low Stock Alert & Scanned Bill History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Items Needing Restock */}
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-amber-500" />
              <span>Items Needing Restock</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {restockItems.length} items low
            </span>
          </h3>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {restockItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                All inventory stock levels are healthy! 👍
              </div>
            ) : (
              restockItems.map(p => (
                <div key={p.id} className="p-3 rounded-xl border border-amber-300 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{p.name}</div>
                    <div className="text-amber-900 dark:text-amber-400 font-bold text-[11px]">
                      Stock: {p.current_stock} {p.unit} (Min Alert: {p.min_stock_level})
                    </div>
                  </div>
                  <Button size="sm" className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 text-xs font-bold shrink-0" onClick={() => {
                    setSelectedProductId(p.id);
                    setCostPrice((p.purchase_price / 100).toString());
                    setIsModalOpen(true);
                  }}>
                    Restock
                  </Button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Card 2: Purchase Bills & Inward Log */}
        <Card className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" />
              <span>Recent Inward Orders &amp; Bills</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">
              {purchaseBills.length > 0 || recentMovements.length === 0
                ? `${purchaseBills.length} bills recorded`
                : `${recentMovements.length} stock inward${recentMovements.length === 1 ? '' : 's'}`}
            </span>
          </h3>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {purchaseBills.length === 0 && recentMovements.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 font-mono">
                No purchase bills recorded yet. Use &ldquo;Inward Bill&rdquo; or &ldquo;Manual Inward&rdquo; to add wholesale bills.
              </div>
            ) : purchaseBills.length > 0 ? (
              purchaseBills.map((bill) => (
                <div key={bill.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs gap-2 hover:border-slate-300 transition-colors">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">
                      {bill.supplier_name_raw || 'Wholesale Supplier'}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono">
                      {bill.bill_number ? `Bill #${bill.bill_number} • ` : ''}
                      {bill.line_items?.length || 0} items • {new Date(bill.created_at).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      <ProfitMask>{formatINR(bill.total_amount || 0)}</ProfitMask>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Confirmed
                    </span>
                  </div>
                </div>
              ))
            ) : (
              recentMovements.map((mov) => (
                <div key={mov.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{mov.product_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{mov.reason || 'Restock Inward'}</div>
                  </div>
                  <div className="text-right shrink-0 font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +{mov.quantity}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Modal: Manual Inbound Purchase */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Inbound Purchase (Manual)"
        description="Select product and enter received quantity to update stock."
      >
        <form onSubmit={handleRecordPurchase} className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-900 dark:text-slate-200 block mb-1">Select Product</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none min-h-[38px]"
              required
            >
              <option value="">-- Choose item to restock --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Current: {p.current_stock} {p.unit})</option>
              ))}
            </select>
          </div>

          <Input label="Quantity Received" placeholder="e.g. 50" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
          <Input label="Purchase Cost Price (₹ per unit)" placeholder="0.00" type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Supplier / Vendor</label>
            </div>
            {suppliers.length > 0 && (
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  if (!e.target.value) setOnCredit(false);
                }}
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl p-2.5 text-xs font-semibold focus:border-slate-900 focus:outline-none min-h-[38px]"
              >
                <option value="">-- Not a saved supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.phone ? ` (${s.phone})` : ''}</option>
                ))}
              </select>
            )}
            {!supplierId && (
              <Input
                placeholder="e.g. Metro Wholesale"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
              />
            )}
            {supplierId && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                <input type="checkbox" checked={onCredit} onChange={(e) => setOnCredit(e.target.checked)} className="w-4 h-4 accent-rose-600" />
                Bought on credit — add quantity × cost to what I owe this supplier
              </label>
            )}
          </div>

          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-in fade-in flex items-center gap-2">
              <span>⚠️</span>
              <span>{modalError}</span>
            </div>
          )}

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" size="sm">Save Stock Inward</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
