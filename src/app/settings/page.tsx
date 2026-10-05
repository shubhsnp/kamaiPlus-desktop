'use client';


import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SETTINGS_TAB_EVENT, settingsTabFromQuery } from '@/lib/ui/settingsLinks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import QRCode from 'qrcode';
import { generateUPILink } from '@/lib/utils';
import { UpiAccount } from '@/types';
import { compressImageFile } from '@/lib/utils/imageCompressor';
import { resolveInvoiceConfig } from '@/lib/invoices/themeDefaults';
import { validateUpiId } from '@/lib/validation/validators';

// Modular Tab Components
import { SettingsNavTabs, SettingsTabType } from '@/components/settings/SettingsNavTabs';
import { StoreProfileTab } from '@/components/settings/StoreProfileTab';
import { UpiBankingTab } from '@/components/settings/UpiBankingTab';
import { InvoiceSettingsTab } from '@/components/settings/InvoiceSettingsTab';
import { DataMaintenanceTab } from '@/components/settings/DataMaintenanceTab';
import { HelpSupportTab } from '@/components/settings/HelpSupportTab';
import { FeaturesTab } from '@/components/settings/FeaturesTab';
import { tr } from '@/lib/i18n/core';
import { createSettingsSave } from '@/components/settings/settingsSave';
import { SettingsReviewDialogs } from '@/components/settings/SettingsReviewDialogs';
import { useSettingsChanges } from '@/components/settings/useSettingsChanges';


export default function SettingsPage() {
  const business = useBusiness();

  // Form State
  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [ownerName, setOwnerName] = useState('');
  const [phone, setPhone] = useState('');
  const [phone2, setPhone2] = useState('');
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
      phone2: business.phone2 || '',
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
    setPhone2(initial.phone2);
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

  // Deep link: /settings?tab=invoice opens that tab (lib/ui/settingsLinks.ts); ?tab=upi
  // opens Store Profile at its UPI / bank section.
  useEffect(() => {
    try {
      const query = new URLSearchParams(window.location.search).get('tab');
      const tab = settingsTabFromQuery(query);
      if (tab) setActiveTab(tab);
      if (query === 'upi') window.setTimeout(() => document.getElementById('settings-upi-banking')?.scrollIntoView({ block: 'start' }), 300);
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
  const { changedFields } = useSettingsChanges({
    business, name, tagline, logoUrl, ownerName, phone,
    phone2, email, address, pincode, gstin, upiList,
    bankName, bankAccountNo, bankIfsc, bankAccountName, invoicePrefix, nextInvoiceNumber,
    gstPricingMode, terms, footerMessage, initial,
  });

  // UPI & bank changes keep their own group in the review, but belong to the Store Profile tab.
  const tabOfChange = (category: string) => (category === 'upi' ? 'profile' : category);
  const changedCategories = useMemo(() => Array.from(new Set(changedFields.map((c) => tabOfChange(c.category)))), [changedFields]);

  const handleTabChangeAttempt = (newTab: SettingsTabType) => {
    if (newTab === activeTab) return;
    const currentTabHasChanges = changedFields.some((c) => tabOfChange(c.category) === activeTab);
    if (currentTabHasChanges) {
      setPendingTab(newTab);
      setIsUnsavedTabModalOpen(true);
    } else {
      setActiveTab(newTab);
    }
  };

  // Status bar "Bill rules" / "Help" while Settings is already open: same switch (asks about unsaved changes).
  const tabChangeRef = useRef(handleTabChangeAttempt);
  tabChangeRef.current = handleTabChangeAttempt;
  useEffect(() => {
    const onTab = (e: Event) => {
      const tab = settingsTabFromQuery((e as CustomEvent<string>).detail);
      if (tab) tabChangeRef.current(tab);
    };
    window.addEventListener(SETTINGS_TAB_EVENT, onTab);
    return () => window.removeEventListener(SETTINGS_TAB_EVENT, onTab);
  }, []);

  const { handleSaveAll, handleDiscardAll } = createSettingsSave({
    business, name, tagline, logoUrl, ownerName, phone,
    phone2, email, address, pincode, gstin, upiList,
    bankName, bankAccountNo, bankIfsc, bankAccountName, invoicePrefix, nextInvoiceNumber,
    gstPricingMode, terms, footerMessage, setSettingsError, setIsSaved, setIsSaving,
    setIsReviewModalOpen, setActiveTab, applyInitial,
  });

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
          phone2={phone2}
          setPhone2={setPhone2}
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

      {/* UPI QR accounts & bank details are part of the store profile (v4.78.0). */}
      {activeTab === 'profile' && (
        <div id="settings-upi-banking" className="scroll-mt-4">
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
        </div>
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
      <SettingsReviewDialogs
        {...{
          business, isSaving, setIsReviewModalOpen, isReviewModalOpen, isUnsavedTabModalOpen, setIsUnsavedTabModalOpen,
          setPendingTab, pendingTab, setActiveTab, isStandeeModalOpen, setIsStandeeModalOpen, changedFields,
          handleSaveAll, handleDiscardAll,
        }}
      />


    </div>
  );
}
