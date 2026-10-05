'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ChangedField, SettingsChangeBar, SettingsReviewModal, SettingsUnsavedTabModal } from '@/components/settings/SettingsChangeDialogue';
import type { SettingsTabType } from '@/components/settings/SettingsNavTabs';
import type { Business } from '@/types';

const MerchantQRModal = dynamic(
  () => import('@/components/paytm/MerchantQRModal').then((m) => m.MerchantQRModal),
  { ssr: false }
);

export interface SettingsReviewDialogsProps {
  business: Business | undefined;
  isSaving: boolean;
  setIsReviewModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isReviewModalOpen: boolean;
  isUnsavedTabModalOpen: boolean;
  setIsUnsavedTabModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingTab: React.Dispatch<React.SetStateAction<SettingsTabType | null>>;
  pendingTab: SettingsTabType | null;
  setActiveTab: React.Dispatch<React.SetStateAction<SettingsTabType>>;
  isStandeeModalOpen: boolean;
  setIsStandeeModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  changedFields: ChangedField[];
  handleSaveAll: () => Promise<void>;
  handleDiscardAll: () => void;
}

/**
 * The bottom of Settings (v4.104.0, K-D23 — moved out of app/settings/page.tsx unchanged): the sticky
 * "unsaved changes" bar, Review & Confirm, the leave-this-tab question and the QR standee window.
 */
export function SettingsReviewDialogs(props: SettingsReviewDialogsProps) {
  const {
    business, isSaving, setIsReviewModalOpen, isReviewModalOpen, isUnsavedTabModalOpen, setIsUnsavedTabModalOpen,
    setPendingTab, pendingTab, setActiveTab, isStandeeModalOpen, setIsStandeeModalOpen, changedFields,
    handleSaveAll, handleDiscardAll,
  } = props;
  return (
    <>
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
    </>
  );
}
