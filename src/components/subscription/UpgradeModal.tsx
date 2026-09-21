'use client';

import React from 'react';

export interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTier?: string;
  businessName?: string;
  onUpgradeSuccess?: (tier: string) => void;
}

export function UpgradeModal(props: UpgradeModalProps) {
  return null;
}
