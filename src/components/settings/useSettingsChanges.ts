import { useMemo } from 'react';
import { UpiAccount } from '@/types';
import { ChangedField } from '@/components/settings/SettingsChangeDialogue';
import { tr } from '@/lib/i18n/core';
import type { Business } from '@/types';

export interface UseSettingsChangesDeps {
  business: Business | undefined;
  name: string;
  tagline: string;
  logoUrl: string;
  ownerName: string;
  phone: string;
  phone2: string;
  email: string;
  address: string;
  pincode: string;
  gstin: string;
  upiList: UpiAccount[];
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankAccountName: string;
  invoicePrefix: string;
  nextInvoiceNumber: string;
  gstPricingMode: "exclusive" | "inclusive";
  terms: string;
  footerMessage: string;
  initial: { name: string; tagline: string; logoUrl: string; ownerName: string; phone: string; phone2: string; email: string; address: string; pincode: string; gstin: string; upiList: UpiAccount[]; bankName: string; bankAccountNo: string; bankIfsc: string; bankAccountName: string; invoicePrefix: string; nextInvoiceNumber: string; gstPricingMode: "exclusive" | "inclusive"; terms: string; footerMessage: string; } | null;
}

/**
 * What changed on Settings since the last save (v4.104.0, K-D23 — moved out of app/settings/page.tsx
 * unchanged): one row per field, old → new, grouped by section, for the bar and the review.
 */
export function useSettingsChanges(deps: UseSettingsChangesDeps) {
  const {
    business, name, tagline, logoUrl, ownerName, phone,
    phone2, email, address, pincode, gstin, upiList,
    bankName, bankAccountNo, bankIfsc, bankAccountName, invoicePrefix, nextInvoiceNumber,
    gstPricingMode, terms, footerMessage, initial,
  } = deps;
  const changedFields = useMemo<ChangedField[]>(() => {
    if (!business) return [];
    const changes: ChangedField[] = [];

    if (name.trim() !== (business.name || '').trim()) {
      changes.push({ key: 'name', label: tr('Store Name'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: business.name || '', newValue: name.trim() });
    }

    if (ownerName.trim() !== (business.owner_name || '').trim()) {
      changes.push({ key: 'owner_name', label: tr('Owner Name'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: business.owner_name || '', newValue: ownerName.trim() });
    }
    if (phone.trim() !== (business.phone || '').trim()) {
      changes.push({ key: 'phone', label: tr('Store Mobile Phone'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: business.phone || '', newValue: phone.trim() });
    }
    if (address.trim() !== (business.address || '').trim()) {
      changes.push({ key: 'address', label: tr('Address'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: business.address || '', newValue: address.trim() });
    }
    if (gstin.trim() !== (business.gstin || '').trim()) {
      changes.push({ key: 'gstin', label: tr('GSTIN Number'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: business.gstin || '', newValue: gstin.trim() });
    }
    if (invoicePrefix.trim() !== (business.invoice_prefix || 'INV-').trim()) {
      changes.push({ key: 'invoice_prefix', label: tr('Invoice Prefix'), category: 'invoicing', categoryLabel: tr('Invoices'), oldValue: business.invoice_prefix || 'INV-', newValue: invoicePrefix.trim() });
    }
    if (gstPricingMode !== (business.gst_pricing_mode || 'inclusive')) {
      changes.push({ key: 'gst_pricing_mode', label: tr('GST Pricing Mode'), category: 'invoicing', categoryLabel: tr('Invoices'), oldValue: business.gst_pricing_mode || 'inclusive', newValue: gstPricingMode });
    }

    if (initial) {
      const simple: ChangedField[] = [
        { key: 'tagline', label: tr('Tagline'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: initial.tagline, newValue: tagline.trim() },
        { key: 'phone2', label: tr('Second Contact Number'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: initial.phone2, newValue: phone2.trim() },
        { key: 'email', label: tr('Email'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: initial.email, newValue: email.trim() },
        { key: 'pincode', label: tr('Pincode'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: initial.pincode, newValue: pincode.trim() },
        { key: 'bank_name', label: tr('Bank Name'), category: 'upi', categoryLabel: tr('UPI & Banking'), oldValue: initial.bankName, newValue: bankName.trim() },
        { key: 'bank_account_no', label: tr('Bank Account No'), category: 'upi', categoryLabel: tr('UPI & Banking'), oldValue: initial.bankAccountNo, newValue: bankAccountNo.trim() },
        { key: 'bank_ifsc', label: tr('Bank IFSC'), category: 'upi', categoryLabel: tr('UPI & Banking'), oldValue: initial.bankIfsc, newValue: bankIfsc.trim().toUpperCase() },
        { key: 'bank_account_name', label: tr('Account Holder Name'), category: 'upi', categoryLabel: tr('UPI & Banking'), oldValue: initial.bankAccountName, newValue: bankAccountName.trim() },
        { key: 'next_invoice_number', label: tr('Next Invoice Number'), category: 'invoicing', categoryLabel: tr('Invoices'), oldValue: initial.nextInvoiceNumber, newValue: String(parseInt(nextInvoiceNumber, 10) || 1) },
        { key: 'terms_conditions', label: tr('Bill Terms & Conditions'), category: 'invoicing', categoryLabel: tr('Invoices'), oldValue: initial.terms, newValue: terms.trim() },
        { key: 'footer_message', label: tr('Bill Footer Note'), category: 'invoicing', categoryLabel: tr('Invoices'), oldValue: initial.footerMessage, newValue: footerMessage.trim() },
      ];
      simple.forEach((f) => {
        if (String(f.oldValue).trim() !== f.newValue) changes.push(f);
      });
      if (logoUrl !== initial.logoUrl) {
        changes.push({ key: 'logo_url', label: tr('Store Logo'), category: 'profile', categoryLabel: tr('Store Profile'), oldValue: initial.logoUrl ? 'Logo set' : 'No logo', newValue: logoUrl ? 'New logo' : 'Logo removed' });
      }
      const upiKey = (list: UpiAccount[]) => JSON.stringify(list.map((u) => [u.upi_id, u.label, Boolean(u.is_default)]));
      if (upiKey(upiList) !== upiKey(initial.upiList)) {
        changes.push({ key: 'upi_ids', label: tr('UPI IDs'), category: 'upi', categoryLabel: tr('UPI & Banking'), oldValue: `${initial.upiList.length} UPI ID(s)`, newValue: `${upiList.length} UPI ID(s)` });
      }
    }

    return changes;
  }, [business, initial, name, ownerName, phone, phone2, address, gstin, invoicePrefix, gstPricingMode, tagline, email, pincode, bankName, bankAccountNo, bankIfsc, bankAccountName, nextInvoiceNumber, terms, footerMessage, logoUrl, upiList]);

  return { changedFields };
}
