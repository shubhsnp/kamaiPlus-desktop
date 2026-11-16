import React from 'react';
import { showAlert, showConfirm } from '@/lib/ui/dialogs';
import { checkCreditLimit, udharOfBill } from '@/lib/billing/creditLimit';
import { db, ensureStarterBusinessIfEmpty } from '@/lib/db';
import { formatINR } from '@/lib/utils';
import { playBeepSound } from '@/lib/voice/speechParser';
import { getNextUniqueInvoiceNumber, commitNextInvoiceNumber } from '@/lib/invoices/invoiceNumberService';
import { focusPosCustomerName } from '@/components/billing/PosCustomerRow';
import { buildBillCustomer, isDraftEmpty, resolveBillCustomer } from '@/lib/billing/billCustomer';
import { cloudMerge, cloudSyncSoon, cloudTrackInvoice } from '@/lib/firebase/lazyCloud';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { newId } from '@/lib/ids';
import { staffOfBill, tabsAfterClosing, tabsAfterSale } from '@/lib/billing/billTabs';
import { isFeatureOn } from '@/lib/features/featureSwitches';
import { tr } from '@/lib/i18n/core';
import { createEstimateAction } from '@/components/billing/posEstimateAction';
import type { useBackgroundBillPrint } from '@/components/billing/BillPrintQueue';
import type { CustomerDraft } from '@/lib/billing/billCustomer';
import type { BillTab } from '@/lib/billing/billTabs';
import type { PriceMode } from '@/lib/billing/priceMode';
import { isUnsavedCustomItem } from '@/lib/billing/customItem';
import type { Business, CartItem, Customer, LedgerTransaction, PaymentMethod, Product, Sale } from '@/types';

export interface CreateSaleActionsDeps {
  searchInputRef: React.RefObject<HTMLInputElement>;
  completingSaleRef: React.MutableRefObject<boolean>;
  showBillingToast: (message: string, type?: "success" | "info" | "error") => void;
  billPrint: ReturnType<typeof useBackgroundBillPrint>;
  silentPrint: boolean;
  tabs: BillTab[];
  setTabs: React.Dispatch<React.SetStateAction<BillTab[]>>;
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  cart: CartItem[];
  selectedCustomerId: string;
  paymentMethod: PaymentMethod;
  amountReceivedInput: string;
  splitCash: string;
  splitUpi: string;
  splitCard: string;
  splitCredit: string;
  priceMode: PriceMode;
  activeTabIdRef: React.MutableRefObject<string>;
  customerDraft: CustomerDraft;
  setIsMobileCartOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsInvoiceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSaleForInvoice: React.Dispatch<React.SetStateAction<Sale | null>>;
  setCompletedSaleDetails: React.Dispatch<any>;
  business: Business | undefined;
  selectedCustomer: Customer | undefined;
  retotalLine: (line: CartItem, quantity: number) => CartItem;
  handleOpenEditItem: (item: CartItem) => void;
  focusProductSearch: () => number;
  billLines: CartItem[];
  discountTotalPaise: number;
  subtotalPaise: number;
  taxTotalPaise: number;
  grandTotalPaise: number;
}

/**
 * Saving a bill and an estimate from the counter (v4.104.0, K-D23 — moved out of app/billing/page.tsx
 * unchanged; the order of the steps is the Bible's sale-completion sequence). The page calls this
 * every render with its current values, exactly as the functions used to read them in place.
 */
export function createSaleActions(deps: CreateSaleActionsDeps) {
  const {
    searchInputRef, completingSaleRef, showBillingToast, billPrint, silentPrint, tabs,
    setTabs, activeTabId, setActiveTabId, cart, selectedCustomerId, paymentMethod,
    amountReceivedInput, splitCash, splitUpi, splitCard, splitCredit, priceMode,
    activeTabIdRef, customerDraft, setIsMobileCartOpen, setIsInvoiceModalOpen, setActiveSaleForInvoice, setCompletedSaleDetails,
    business, selectedCustomer, retotalLine, handleOpenEditItem, focusProductSearch, billLines,
    discountTotalPaise, subtotalPaise, taxTotalPaise, grandTotalPaise,
  } = deps;
  const completeSale = async () => {
    // What this bill is at the moment Enter was pressed — scans after this are the next customer's.
    const soldTabId = activeTabId;
    const soldCart = cart;
    // Resolve target customer reliably from state or Dexie
    let targetCustomer = selectedCustomer;
    if (!targetCustomer && selectedCustomerId) {
      targetCustomer = await db.customers.get(selectedCustomerId);
    }

    // Nobody picked from the list: the name / mobile typed on the counter row is a saved
    // customer (same mobile / only one with that name) or someone new, saved with the bill.
    const typed = targetCustomer || isDraftEmpty(customerDraft) ? null : resolveBillCustomer(await db.customers.toArray(), customerDraft);
    if (typed?.kind === 'error') {
      playBeepSound('alert');
      showBillingToast(typed.message, 'error');
      focusPosCustomerName(typed.field);
      return;
    }
    if (typed?.kind === 'existing') targetCustomer = typed.customer;
    const newCustomer = typed?.kind === 'new' ? typed : null;
    const hasCustomer = Boolean(targetCustomer || newCustomer);

    // MANDATORY CUSTOMER VALIDATION FOR CREDIT / UDHAR PAYMENT MODE
    const isCreditMode = paymentMethod === 'credit' || (paymentMethod === 'split' && parseFloat(splitCredit || '0') > 0);
    // Khata switched off (shop category / KamaiPlus support): no udhar at all — read now, not from the render.
    const udharAllowed = isFeatureOn('khata');
    if (isCreditMode && !udharAllowed) {
      playBeepSound('alert');
      showBillingToast(tr('Khata (Udhar) is not switched on for this shop. Take the full payment.'), 'error');
      return;
    }
    if (isCreditMode && !hasCustomer) {
      playBeepSound('alert');
      showBillingToast(tr('Customer name is mandatory for Credit (Udhar) sale. Type the customer name or mobile number.'), 'error');
      focusPosCustomerName();
      return;
    }

    // Cash "received" is typed only in cash mode; in UPI / card / credit a value left
    // over from cash mode is not on screen and must not change what is recorded.
    const typedCashPaise = paymentMethod === 'cash' && amountReceivedInput
      ? Math.round((parseFloat(amountReceivedInput) || 0) * 100)
      : null;
    if (typedCashPaise !== null && typedCashPaise < grandTotalPaise && (!hasCustomer || !udharAllowed)) {
      playBeepSound('alert');
      showBillingToast(udharAllowed
        ? tr('Cash received is {v1} short. Correct the amount, or select a customer to put the rest on udhar.', { v1: formatINR(grandTotalPaise - typedCashPaise) })
        : tr('Cash received is {v1} short. Correct the amount.', { v1: formatINR(grandTotalPaise - typedCashPaise) }), 'error');
      return;
    }

    // Split: more than the bill is only possible as change from the cash part.
    if (paymentMethod === 'split') {
      const parts = [splitCash, splitUpi, splitCard, splitCredit].map((v) => (v ? Math.round((parseFloat(v) || 0) * 100) : 0));
      const excess = parts.reduce((a, b) => a + b, 0) - grandTotalPaise;
      if (excess > parts[0]) {
        playBeepSound('alert');
        showBillingToast(tr('Split amounts are {v1} more than the bill. Only the cash part can include change — please correct the split.', { v1: formatINR(excess) }), 'error');
        return;
      }
    }

    // Udhar limit of a saved customer (v4.102.0, K-D03): a warning — the shop decides.
    if (targetCustomer && udharAllowed) {
      const p = (v: string) => (v ? Math.round((parseFloat(v) || 0) * 100) : 0);
      const udhar = udharOfBill({
        method: paymentMethod, grandTotalPaise, typedCashPaise,
        splitPaise: paymentMethod === 'split' ? { cash: p(splitCash), upi: p(splitUpi), card: p(splitCard), credit: p(splitCredit) } : undefined,
      });
      const limit = checkCreditLimit(targetCustomer, udhar);
      if (limit.over) {
        playBeepSound('alert');
        const go = await showConfirm(
          tr('{name} has an udhar limit of {limit}. After this bill they will owe {after}. Give the udhar anyway?', { name: targetCustomer.name, limit: formatINR(limit.limit), after: formatINR(limit.after) }),
          { title: tr('Udhar limit'), confirmLabel: tr('Give udhar'), cancelLabel: tr('Cancel') }
        );
        if (!go) return;
      }
    }

    try {
      const currentBiz = business || (await ensureStarterBusinessIfEmpty());
      const businessId = currentBiz?.id || 'biz_default';

      // 0. Save the customer typed on the counter row (someone new, or a missing mobile filled in).
      const custNow = new Date().toISOString();
      if (newCustomer) {
        targetCustomer = buildBillCustomer(newId('cust'), businessId, newCustomer.name, newCustomer.phone, custNow);
        await db.customers.put(targetCustomer);
      } else if (targetCustomer && typed?.kind === 'existing' && typed.addPhone) {
        await db.customers.update(targetCustomer.id, { phone: typed.addPhone, updated_at: custNow });
        targetCustomer = { ...targetCustomer, phone: typed.addPhone };
      }

      const { invoiceNumber, nextSeq } = await getNextUniqueInvoiceNumber(businessId);
      const now = new Date().toISOString();

      const finalInvoiceNumber = invoiceNumber;

      const finalMethod: PaymentMethod = paymentMethod;
      let receivedPaise = 0;
      let balanceDuePaise = 0;
      let changeReturnedPaise = 0;
      let paymentSplitData: any = undefined;

      if (paymentMethod === 'split') {
        const cashP = splitCash ? Math.round(parseFloat(splitCash) * 100) : 0;
        const upiP = splitUpi ? Math.round(parseFloat(splitUpi) * 100) : 0;
        const cardP = splitCard ? Math.round(parseFloat(splitCard) * 100) : 0;
        const creditP = splitCredit ? Math.round(parseFloat(splitCredit) * 100) : 0;
        
        const allocatedP = cashP + upiP + cardP + creditP;
        const unassigned = Math.max(0, grandTotalPaise - allocatedP);
        // Overpaid (checked above to fit inside the cash part) = change handed back.
        const excessP = Math.max(0, allocatedP - grandTotalPaise);
        // What is not split goes on the customer's khata — or is taken as cash (no customer, or Khata off).
        const udharTarget = Boolean(targetCustomer) && udharAllowed;
        const finalCreditP = creditP + (udharTarget ? unassigned : 0);
        const finalCashP = cashP - excessP + (!udharTarget ? unassigned : 0);

        receivedPaise = finalCashP + upiP + cardP;
        balanceDuePaise = finalCreditP;
        changeReturnedPaise = excessP;
        paymentSplitData = {
          cash_amount: finalCashP,
          upi_amount: upiP,
          card_amount: cardP,
          credit_amount: finalCreditP,
        };
      } else {
        receivedPaise = typedCashPaise ?? (paymentMethod === 'credit' ? 0 : grandTotalPaise);
        const isCredit = paymentMethod === 'credit' || receivedPaise < grandTotalPaise;
        balanceDuePaise = isCredit ? Math.max(0, grandTotalPaise - receivedPaise) : 0;
        changeReturnedPaise = !isCredit && receivedPaise > grandTotalPaise ? receivedPaise - grandTotalPaise : 0;
      }

      const saleId = newId('sale');

      const newSale: Sale = {
        id: saleId,
        business_id: businessId,
        invoice_number: finalInvoiceNumber,
        customer_id: targetCustomer?.id,
        customer_name: targetCustomer?.name || 'Cash Customer',
        customer_phone: targetCustomer?.phone,
        customer_address: targetCustomer?.address,
        customer_gstin: targetCustomer?.gstin,
        doctor_name: (customerDraft.doctor || '').trim() || undefined,
        patient_name: (customerDraft.patient || '').trim() || undefined,
        items: billLines,
        subtotal: subtotalPaise,
        discount_total: discountTotalPaise,
        tax_total: taxTotalPaise,
        grand_total: grandTotalPaise,
        payment_method: finalMethod,
        payment_split: paymentSplitData,
        amount_received: receivedPaise,
        balance_due: balanceDuePaise,
        change_returned: changeReturnedPaise,
        payment_status: balanceDuePaise === 0 ? 'paid' : balanceDuePaise < grandTotalPaise ? 'partial' : 'unpaid',
        status: 'completed',
        // A wholesale bill says so (Transactions, the cloud) — v4.87.0.
        ...(isFeatureOn('wholesale_price') && priceMode === 'wholesale' ? { price_mode: 'wholesale' as const } : {}),
        created_by: 'owner', ...staffOfBill(tabs, soldTabId), // a staff phone's cart: their bill (v4.177.0)
        created_at: now,
        updated_at: now,
        sync_status: 'synced',
      };

      // 1. Save Sale in Dexie DB
      await db.sales.put(newSale);

      // Track sale creation in Firebase Analytics for Platform Owner (safe non-blocking)
      void cloudTrackInvoice({
        invoiceNumber: newSale.invoice_number,
        totalAmountPaise: newSale.grand_total,
        paymentMode: newSale.payment_method,
        itemCount: newSale.items.length,
        businessId: newSale.business_id,
        isGstBill: (newSale.tax_total || 0) > 0,
      });

      // Trigger instant background sync to Firestore for WhatsApp Bot & Cloud backup
      if (newSale.business_id) {
        void cloudSyncSoon(newSale.business_id);
      }

      // 2. Increment business invoice number counter reliably
      if (currentBiz?.id) {
        await commitNextInvoiceNumber(currentBiz.id, nextSeq);
      }

      // 3. Deduct product inventory stock — every line in ONE transaction (v4.97.0). Each separate
      // write made the counter's live queries re-read the whole catalogue: an 8-line bill on a
      // 5,000-item shop took ~2 s. One commit = one refresh, and a bill never leaves half its
      // stock deducted. Cloud copies go after the commit (never inside a Dexie transaction).
      const stockForCloud: Product[] = [];
      await db.transaction('rw', db.products, db.inventory_movements, async () => {
        for (const item of cart) {
        let prod = await db.products.get(item.product_id);
        if (!prod && item.barcode) {
          prod = await db.products.where('barcode').equals(item.barcode).first();
        }
        if (!prod && item.product_name && !isUnsavedCustomItem(item.product_id)) { // v4.159.0: never a Custom Item's namesake
          prod = await db.products.where('name').equalsIgnoreCase(item.product_name).first();
        }

        if (prod && !prod.is_unlimited_stock) {
          const prevStock = Number(prod.current_stock ?? 0);
          const newStock = Math.max(0, prevStock - item.quantity);
          const updatedProd: Product = {
            ...prod,
            current_stock: newStock,
            updated_at: now,
          };
          // Persist using put to guarantee index rewrite and reactive LiveQuery updates
          await db.products.put(updatedProd);

          await db.inventory_movements.put({
            id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${prod.id}`,
            business_id: businessId,
            product_id: prod.id,
            product_name: prod.name,
            movement_type: 'SALE',
            quantity: item.quantity,
            previous_stock: prevStock,
            new_stock: newStock,
            reference_id: saleId,
            reason: `Sold on Invoice #${invoiceNumber}`,
            created_by: 'owner',
            created_at: now,
          });
          stockForCloud.push(updatedProd);
        }
      }
      });
      // Direct cloud sync to prevent stale overwrite from cloud background sync
      if (businessId && businessId !== 'biz_default') {
        for (const p of stockForCloud) void cloudMerge(`businesses/${businessId}/products/${p.id}`, p);
      }

      // Trigger background sync debounce for full backup
      void cloudSyncSoon(businessId);

      // 4. If Udhar / Credit, update customer balance & write ledger entry (Skip for quotations)
      if (targetCustomer && balanceDuePaise > 0) {
        const freshCust = (await db.customers.get(targetCustomer.id)) || targetCustomer;
        const updatedBalance = (freshCust.current_balance || 0) + balanceDuePaise;
        
        await db.customers.update(targetCustomer.id, {
          current_balance: updatedBalance,
          updated_at: now,
        });

        const itemsSummary = cart.map((i) => `${i.quantity}x ${i.product_name}`).join(', ');

        const ledgerTxId = newId('ledg');
        const newLedgerTx: LedgerTransaction = {
          id: ledgerTxId,
          business_id: businessId,
          party_type: 'customer',
          party_id: targetCustomer.id,
          party_name: targetCustomer.name,
          transaction_type: 'CREDIT_SALE',
          amount: balanceDuePaise,
          balance_after: updatedBalance,
          reference_id: saleId,
          notes: `Invoice #${invoiceNumber} • ${itemsSummary}`,
          created_at: now,
          sync_status: 'synced',
        };

        await db.ledger_transactions.put(newLedgerTx);

        // Direct cloud sync to Firestore for multi-device realtime Khata
        if (businessId && businessId !== 'biz_default') {
          void cloudMerge(`businesses/${businessId}/customers/${targetCustomer.id}`, {
            ...freshCust,
            current_balance: updatedBalance,
            updated_at: now,
          });
          void cloudMerge(`businesses/${businessId}/ledger_transactions/${ledgerTxId}`, newLedgerTx);
        }
      }

      // 5. The counter moves on to the next bill now — it never waits for the printer — and
      // anything scanned for the next customer while this bill was being saved goes with it.
      const newTabId = `tab_${Date.now()}`;
      const nextTabId = tabsAfterClosing(tabs, soldTabId, newTabId).activeTabId;
      setTabs((prev) => tabsAfterSale(prev, soldTabId, soldCart, newTabId, retotalLine).tabs);
      setActiveTabId(nextTabId);
      activeTabIdRef.current = nextTabId;
      setIsMobileCartOpen(false);

      // 6. "Sale completed", or straight to the bill printer in the background (BillPrintQueue).
      setActiveSaleForInvoice(newSale);
      void import('@/lib/whatsapp/autoSendBill').then((m) => m.autoSendBill(newSale, currentBiz)); // v4.185.0: the linked WhatsApp sends it by itself — never awaited
      setCompletedSaleDetails({
        invoiceNumber,
        customerName: targetCustomer?.name,
        customerPhone: targetCustomer?.phone,
        grandTotalPaise,
        balanceDuePaise,
        items: [...soldCart],
      });
      if (silentPrint && getDesktopApi() && currentBiz) {
        billPrint.print({ sale: newSale, business: currentBiz, customer: targetCustomer });
        focusProductSearch();
      } else {
        // Focus leaves the search box so the next scan reaches the scanner listener,
        // which closes this window and starts the next bill.
        searchInputRef.current?.blur();
        setIsInvoiceModalOpen(true);
      }
    } catch (saleErr) {
      console.error('Sale completion encountered an error:', saleErr);
      showAlert(tr('Encountered an unexpected error completing the sale. Please verify inventory.'));
    }
  };

  // Same values, so the estimate is saved from exactly what is on the counter.
  const { handleSaveEstimate } = createEstimateAction(deps);

  return { completeSale, handleSaveEstimate };
}
