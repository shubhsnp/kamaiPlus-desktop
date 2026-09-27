'use client';

import dynamic from 'next/dynamic';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import QRCode from 'qrcode';
import { generateUPILink } from '@/lib/utils';
import { UpiAccount, BusinessType } from '@/types';
import { compressImageFile } from '@/lib/utils/imageCompressor';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
const MerchantQRModal = dynamic(
  () => import('@/components/paytm/MerchantQRModal').then((m) => m.MerchantQRModal),
  { ssr: false }
);
import { 
  SettingsChangeBar, 
  SettingsReviewModal, 
  SettingsUnsavedTabModal,
  ChangedField 
} from '@/components/settings/SettingsChangeDialogue';
import { 
  validateIndianPhone, 
  validateEmail, 
  validateGstin, 
  validateUpiId, 
  validatePincode, 
  validateFssaiLicense 
} from '@/lib/validation/validators';

// Modular Tab Components
import { SettingsNavTabs, SettingsTabType } from '@/components/settings/SettingsNavTabs';
import { StoreProfileTab } from '@/components/settings/StoreProfileTab';
import { UpiBankingTab } from '@/components/settings/UpiBankingTab';
import { InvoiceSettingsTab } from '@/components/settings/InvoiceSettingsTab';
import { DataMaintenanceTab } from '@/components/settings/DataMaintenanceTab';
import { HelpSupportTab } from '@/components/settings/HelpSupportTab';
import { FeaturesTab } from '@/components/settings/FeaturesTab';
import { msg, tr } from '@/lib/i18n/core';


export default function SettingsPage() {
  const business = useBusiness();

  // Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [gstin, setGstin] = useState('');

  
  // Multi-UPI State
  const [upiList, setUpiList] = useState<UpiAccount[]>([]);
  const [selectedPreviewUpiIndex, setSelectedPreviewUpiIndex] = useState<number>(0);
  const [newUpiLabel, setNewUpiLabel] = useState('');
  const [newUpiId, setNewUpiId] = useState('');

  // Banking
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankAccountName, setBankAccountName] = useState('');

  // Invoicing Preferences
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('1');
  const [gstPricingMode, setGstPricingMode] = useState<'exclusive' | 'inclusive'>('inclusive');
  const [terms, setTerms] = useState('');
  const [footerMessage, setFooterMessage] = useState('');
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // UI & Dialogue states
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isUnsavedTabModalOpen, setIsUnsavedTabModalOpen] = useState(false);
  const [pendingTab, setPendingTab] = useState<SettingsTabType | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsTabType>('profile');
  const [isStandeeModalOpen, setIsStandeeModalOpen] = useState(false);
  const [liveQrDataUrl, setLiveQrDataUrl] = useState<string>('');



  // The saved values every form field starts from (and is compared against).
  const initial = useMemo(() => {
    if (!business) return null;
    const invoiceConfig = resolveInvoiceConfig(business);
    const upis: UpiAccount[] = business.upi_ids && business.upi_ids.length > 0
      ? business.upi_ids
      : business.upi_id
      ? [{ id: 'upi_def', label: tr('Shop Primary QR'), upi_id: business.upi_id, is_default: true }]
      : [];
    return {
      name: business.name || '',
      tagline: business.tagline || '',
      logoUrl: business.logo_url || '',
      ownerName: business.owner_name || '',
      phone: business.phone || '',
      email: business.email || '',
      address: business.address || '',
      pincode: business.pincode || '',
      gstin: business.gstin || '',
      upiList: upis,
      bankName: business.bank_name || '',
      bankAccountNo: business.bank_account_no || '',
      bankIfsc: business.bank_ifsc || '',
      bankAccountName: business.bank_account_name || '',
      invoicePrefix: business.invoice_prefix || 'INV-',
      nextInvoiceNumber: (business.next_invoice_number || 1).toString(),
      gstPricingMode: (business.gst_pricing_mode || 'inclusive') as 'exclusive' | 'inclusive',
      terms: invoiceConfig.custom_terms || '',
      footerMessage: invoiceConfig.custom_footer || '',
    };
  }, [business]);

  const applyInitial = useCallback(() => {
    if (!initial) return;
    setName(initial.name);
    setTagline(initial.tagline);
    setLogoUrl(initial.logoUrl);
    setOwnerName(initial.ownerName);
    setPhone(initial.phone);
    setEmail(initial.email);
    setAddress(initial.address);
    setPincode(initial.pincode);
    setGstin(initial.gstin);
    setUpiList(initial.upiList);
    setBankName(initial.bankName);
    setBankAccountNo(initial.bankAccountNo);
    setBankIfsc(initial.bankIfsc);
    setBankAccountName(initial.bankAccountName);
    setInvoicePrefix(initial.invoicePrefix);
    setNextInvoiceNumber(initial.nextInvoiceNumber);
    setGstPricingMode(initial.gstPricingMode);
    setTerms(initial.terms);
    setFooterMessage(initial.footerMessage);
  }, [initial]);

  // Load business data into form
  useEffect(() => {
    applyInitial();
  }, [applyInitial]);

  // Deep link: /settings?tab=invoice opens the invoice & printer tab.
  useEffect(() => {
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      if (tab === 'invoice' || tab === 'invoicing') setActiveTab('invoicing');
      else if (tab === 'upi') setActiveTab('upi');
      else if (tab === 'features') setActiveTab('features');
    } catch {}
  }, []);

  // Generate dynamic QR Code for preview
  const generateQrPreview = useCallback(async () => {
    const activeUpi = upiList[selectedPreviewUpiIndex]?.upi_id || upiList[0]?.upi_id;
    if (!activeUpi) {
      setLiveQrDataUrl('');
      return;
    }

    try {
      const upiUrl = generateUPILink(activeUpi, name || 'Our Store', 0);
      const dataUrl = await QRCode.toDataURL(upiUrl, {
        width: 300,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setLiveQrDataUrl(dataUrl);
    } catch (err) {
      console.error('QR code preview generation failed:', err);
    }
  }, [upiList, selectedPreviewUpiIndex, name]);

  useEffect(() => {
    generateQrPreview();
  }, [generateQrPreview]);

  // Logo Upload Handler
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    try {
      // Stored with the store profile as a compressed data URL, so it works
      // offline and prints on every invoice without any cloud storage.
      const { dataUrl } = await compressImageFile(file, { maxWidth: 400, maxHeight: 400, quality: 0.85, mimeType: 'image/png' });
      setLogoUrl(dataUrl);
    } catch (err) {
      console.error('Logo upload error:', err);
      setSettingsError(tr('Could not read that image. Please choose a PNG or JPG logo.'));
    }
  };

  // Add UPI Account
  const handleAddUpi = () => {
    setSettingsError(null);
    if (!newUpiId.trim()) return;

    const upiRes = validateUpiId(newUpiId, true);
    if (!upiRes.isValid) {
      setSettingsError(upiRes.error || tr('Invalid UPI ID'));
      return;
    }

    const isFirst = upiList.length === 0;
    const newItem: UpiAccount = {
      id: `upi_${Date.now()}`,
      label: newUpiLabel.trim() || `QR Account ${upiList.length + 1}`,
      upi_id: upiRes.cleanedValue || newUpiId.trim(),
      is_default: isFirst,
    };
    setUpiList([...upiList, newItem]);
    setNewUpiLabel('');
    setNewUpiId('');
  };

  const handleSetDefaultUpi = (id: string) => {
    setUpiList(upiList.map((u) => ({ ...u, is_default: u.id === id })));
  };

  const handleRemoveUpi = (id: string) => {
    const filtered = upiList.filter((u) => u.id !== id);
    if (filtered.length > 0 && !filtered.some((u) => u.is_default)) {
      filtered[0].is_default = true;
    }
    setUpiList(filtered);
    if (selectedPreviewUpiIndex >= filtered.length) {
      setSelectedPreviewUpiIndex(Math.max(0, filtered.length - 1));
    }
  };



  // ---------------- CHANGE DETECTION ----------------
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
  }, [business, initial, name, ownerName, phone, address, gstin, invoicePrefix, gstPricingMode, tagline, email, pincode, bankName, bankAccountNo, bankIfsc, bankAccountName, nextInvoiceNumber, terms, footerMessage, logoUrl, upiList]);

  const changedCategories = useMemo(() => Array.from(new Set(changedFields.map((c) => c.category))), [changedFields]);

  const handleTabChangeAttempt = (newTab: SettingsTabType) => {
    if (newTab === activeTab) return;
    const currentTabHasChanges = changedFields.some((c) => c.category === activeTab);
    if (currentTabHasChanges) {
      setPendingTab(newTab);
      setIsUnsavedTabModalOpen(true);
    } else {
      setActiveTab(newTab);
    }
  };

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

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-150">
      {/* Validation Error Alert */}
      {settingsError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold animate-in fade-in flex items-center justify-between gap-2 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-sm">⚠️</span>
            <span>{settingsError}</span>
          </div>
          <button
            type="button"
            onClick={() => setSettingsError(null)}
            className="text-rose-400 hover:text-rose-600 dark:hover:text-rose-200 text-sm font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* 1. Category Nav Tabs */}
      <SettingsNavTabs
        activeTab={activeTab}
        onTabChange={handleTabChangeAttempt}
        changedCategories={changedCategories}
      />

      {/* 2. Active Tab Content Panels */}
      {activeTab === 'profile' && (
        <StoreProfileTab
          name={name}
          setName={setName}
          tagline={tagline}
          setTagline={setTagline}
          ownerName={ownerName}
          setOwnerName={setOwnerName}
          phone={phone}
          setPhone={setPhone}
          email={email}
          setEmail={setEmail}
          address={address}
          setAddress={setAddress}
          pincode={pincode}
          setPincode={setPincode}
          gstin={gstin}
          setGstin={setGstin}
          logoUrl={logoUrl}
          onLogoUpload={handleLogoUpload}
          onRemoveLogo={() => setLogoUrl('')}
          onSwitchToDataTab={() => setActiveTab('data')}
        />
      )}

      {activeTab === 'upi' && (
        <UpiBankingTab
          upiList={upiList}
          newUpiLabel={newUpiLabel}
          setNewUpiLabel={setNewUpiLabel}
          newUpiId={newUpiId}
          setNewUpiId={setNewUpiId}
          onAddUpi={handleAddUpi}
          onSetDefaultUpi={handleSetDefaultUpi}
          onRemoveUpi={handleRemoveUpi}
          liveQrDataUrl={liveQrDataUrl}
          selectedPreviewUpiIndex={selectedPreviewUpiIndex}
          setSelectedPreviewUpiIndex={setSelectedPreviewUpiIndex}
          onOpenStandeeModal={() => setIsStandeeModalOpen(true)}
          bankName={bankName}
          setBankName={setBankName}
          bankAccountName={bankAccountName}
          setBankAccountName={setBankAccountName}
          bankAccountNo={bankAccountNo}
          setBankAccountNo={setBankAccountNo}
          bankIfsc={bankIfsc}
          setBankIfsc={setBankIfsc}
        />
      )}

      {activeTab === 'invoicing' && (
        <InvoiceSettingsTab
          invoicePrefix={invoicePrefix}
          setInvoicePrefix={setInvoicePrefix}
          nextInvoiceNumber={nextInvoiceNumber}
          setNextInvoiceNumber={setNextInvoiceNumber}
          gstPricingMode={gstPricingMode}
          setGstPricingMode={setGstPricingMode}
          terms={terms}
          setTerms={setTerms}
          footerMessage={footerMessage}
          setFooterMessage={setFooterMessage}
        />
      )}

      {activeTab === 'data' && (
        <DataMaintenanceTab business={business} />
      )}

      {activeTab === 'features' && <FeaturesTab />}

      {activeTab === 'help' && <HelpSupportTab />}



      {/* 3. Sticky Bottom Changes Detection Dialogue Bar */}
      <SettingsChangeBar
        changedFields={changedFields}
        onOpenReview={() => setIsReviewModalOpen(true)}
        onSave={handleSaveAll}
        onDiscard={handleDiscardAll}
        isSaving={isSaving}
      />

      {/* 4. Review & Confirm Changes Modal */}
      <SettingsReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        changedFields={changedFields}
        onSave={handleSaveAll}
        onDiscard={handleDiscardAll}
        isSaving={isSaving}
      />

      {/* 5. Unsaved Tab Transition Modal */}
      <SettingsUnsavedTabModal
        isOpen={isUnsavedTabModalOpen}
        onClose={() => {
          setIsUnsavedTabModalOpen(false);
          setPendingTab(null);
        }}
        targetTabName={pendingTab || ''}
        onDiscardAndSwitch={() => {
          handleDiscardAll();
          setIsUnsavedTabModalOpen(false);
          if (pendingTab) setActiveTab(pendingTab);
          setPendingTab(null);
        }}
        onSaveAndSwitch={async () => {
          await handleSaveAll();
          setIsUnsavedTabModalOpen(false);
          if (pendingTab) setActiveTab(pendingTab);
          setPendingTab(null);
        }}
        changedCount={changedFields.length}
      />

      {/* 6. Merchant QR Standee Printable Modal */}
      {isStandeeModalOpen && (
        <MerchantQRModal
          isOpen={isStandeeModalOpen}
          onClose={() => setIsStandeeModalOpen(false)}
          business={business || null}
        />
      )}


    </div>
  );
}
