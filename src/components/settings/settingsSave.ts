import React from 'react';
import { db } from '@/lib/db';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { validateIndianPhone, validateEmail, validateGstin, validatePincode } from '@/lib/validation/validators';
import { msg, tr } from '@/lib/i18n/core';
import type { Business, UpiAccount } from '@/types';
import type { SettingsTabType } from '@/components/settings/SettingsNavTabs';

export interface CreateSettingsSaveDeps {
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
  setSettingsError: React.Dispatch<React.SetStateAction<string | null>>;
  setIsSaved: React.Dispatch<React.SetStateAction<boolean>>;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setIsReviewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveTab: React.Dispatch<React.SetStateAction<SettingsTabType>>;
  applyInitial: () => void;
}

/**
 * Saving Settings (v4.104.0, K-D23 — moved out of app/settings/page.tsx unchanged): every field is
 * checked (GSTIN, UPI, phone…), the shop row is saved once, the cloud copy follows, and Discard goes
 * back to the saved values.
 */
export function createSettingsSave(deps: CreateSettingsSaveDeps) {
  const {
    business, name, tagline, logoUrl, ownerName, phone,
    phone2, email, address, pincode, gstin, upiList,
    bankName, bankAccountNo, bankIfsc, bankAccountName, invoicePrefix, nextInvoiceNumber,
    gstPricingMode, terms, footerMessage, setSettingsError, setIsSaved, setIsSaving,
    setIsReviewModalOpen, setActiveTab, applyInitial,
  } = deps;
  const handleSaveAll = async () => {
    if (!business) return;
    setSettingsError(null);

    // 1. Validate Store Name
    if (!name.trim() || name.trim().length < 2) {
      setSettingsError(tr('Store Name must be at least 2 characters long.'));
      setActiveTab('profile');
      setIsReviewModalOpen(false);
      return;
    }

    // 2. Validate Phone
    const phoneRes = validateIndianPhone(phone, true, msg('Store Mobile Phone'));
    if (!phoneRes.isValid) {
      setSettingsError(phoneRes.error || tr('Invalid store mobile phone number.'));
      setActiveTab('profile');
      setIsReviewModalOpen(false);
      return;
    }

    // 2b. Second contact number (optional, printed on bills next to the first — v4.91.0)
    const phone2Res = validateIndianPhone(phone2, false, msg('Second Contact Number'));
    if (!phone2Res.isValid) {
      setSettingsError(phone2Res.error || tr('Invalid second contact number.'));
      setActiveTab('profile');
      setIsReviewModalOpen(false);
      return;
    }

    // 3. Validate Email (if provided)
    if (email && email.trim()) {
      const emailRes = validateEmail(email, false);
      if (!emailRes.isValid) {
        setSettingsError(emailRes.error || tr('Invalid email address format.'));
        setActiveTab('profile');
        setIsReviewModalOpen(false);
        return;
      }
    }

    // 4. Validate GSTIN (if provided)
    if (gstin && gstin.trim()) {
      const gstinRes = validateGstin(gstin, false);
      if (!gstinRes.isValid) {
        setSettingsError(gstinRes.error || tr('Invalid GSTIN structure.'));
        setActiveTab('profile');
        setIsReviewModalOpen(false);
        return;
      }
    }

    // 5. Validate Pincode (if provided)
    if (pincode && pincode.trim()) {
      const pinRes = validatePincode(pincode, false);
      if (!pinRes.isValid) {
        setSettingsError(pinRes.error || tr('Invalid 6-digit postal pincode.'));
        setActiveTab('profile');
        setIsReviewModalOpen(false);
        return;
      }
    }



    setIsSaving(true);

    try {
      const defaultUpi = upiList.find((u) => u.is_default)?.upi_id || upiList[0]?.upi_id || '';
      const nextInvNum = parseInt(nextInvoiceNumber, 10) || 1;

      await db.businesses.update(business.id, {
        name: name.trim(),
        tagline: tagline.trim() || undefined,
        business_type: 'retail',
        logo_url: logoUrl || undefined,
        owner_name: ownerName.trim(),
        phone: phoneRes.cleanedValue || phone.trim(),
        phone2: phone2.trim() ? phone2Res.cleanedValue || phone2.trim() : '',
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        pincode: pincode.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        upi_id: defaultUpi,
        upi_ids: upiList,
        bank_name: bankName.trim() || undefined,
        bank_account_no: bankAccountNo.trim() || undefined,
        bank_ifsc: bankIfsc.trim().toUpperCase() || undefined,
        bank_account_name: bankAccountName.trim() || undefined,
        invoice_prefix: invoicePrefix.trim().toUpperCase() || 'INV-',
        next_invoice_number: nextInvNum,
        gst_pricing_mode: gstPricingMode,
        terms_conditions: terms.trim() || undefined,
        footer_message: footerMessage.trim() || undefined,
        // Invoice Themes reads terms / footer from its own config first, so both are kept in step.
        invoice_theme_config: {
          ...resolveInvoiceConfig(business),
          custom_terms: terms.trim(),
          custom_footer: footerMessage.trim(),
        },
        updated_at: new Date().toISOString(),
      });

      // Keep session and cloud synchronized
      try {
        const { getStoredUser, setStoredUser } = await import('@/lib/auth');
        const stored = getStoredUser();
        if (stored) {
          setStoredUser({
            ...stored,
            phone: phone.trim() || stored.phone,
            name: ownerName.trim() || stored.name,
            business_name: name.trim() || stored.business_name,
            shop_name: name.trim() || stored.shop_name,
          });
        }
        const { syncProfileToCloud } = await import('@/lib/sync/syncEngine');
        await syncProfileToCloud(business.id);
      } catch (syncErr) {
        console.warn('Settings cloud sync notice:', syncErr);
      }

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setIsSaving(false);
      setIsReviewModalOpen(false);
    }
  };

  const handleDiscardAll = () => {
    applyInitial();
  };

  return { handleSaveAll, handleDiscardAll };
}
