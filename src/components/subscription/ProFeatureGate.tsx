'use client';

import React from 'react';
import { SubscriptionState } from '@/lib/subscription/subscriptionService';

// Always return a fully unlocked Pro subscription
export function useProSubscription() {
  const isPro = true;

  const requirePro = (callback: () => void) => {
    callback();
  };

  const subscription: SubscriptionState = {
    tier: 'pro',
    billingCycle: 'annual',
    isLifetime: true,
  };

  return {
    subscription,
    isPro,
    tier: subscription.tier,
    isUpgradeModalOpen: false,
    setIsUpgradeModalOpen: (open: boolean) => {},
    openUpgradeModal: () => {},
    requirePro,
  };
}

// Remove the badge entirely
export const ProFeatureBadge: React.FC<{ className?: string; showWhenPro?: boolean }> = () => {
  return null;
};

interface ProFeatureLockedCardProps {
  title: string;
  description: string;
  features?: string[];
  onUnlock?: () => void;
  className?: string;
  children?: React.ReactNode;
}

// Always render the unlocked children
export const ProFeatureLockedCard: React.FC<ProFeatureLockedCardProps> = ({
  children,
}) => {
  return <>{children || null}</>;
};
