'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Product } from '@/types';
import { useProSubscription, ProFeatureBadge } from '@/components/subscription/ProFeatureGate';
// The inward sheet bundles the Excel/CSV parser (xlsx, ~400 KB); load it on first open.
const PurchaseInwardOptionsSheet = dynamic(
  () => import('./PurchaseInwardOptionsSheet').then((m) => m.PurchaseInwardOptionsSheet),
  { ssr: false }
);

interface ScanBillButtonProps {
  businessId?: string;
  existingProducts: Product[];
  onScanSuccess?: (billId: string, updatedCount: number, createdCount: number) => void;
  className?: string;
}

export function ScanBillButton({
  businessId = 'biz_default',
  existingProducts,
  onScanSuccess,
  className = '',
}: ScanBillButtonProps) {
  const { isPro } = useProSubscription();
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        variant="outline"
        size="md"
        className={`relative group bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-amber-500/10 border-amber-400/40 hover:border-amber-400 text-slate-800 dark:text-amber-300 font-bold text-xs gap-1.5 shadow-xs ${className}`}
        title="Capture wholesale invoice or upload CSV/PDF"
      >
        <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
        <span>Inward Bill (AI / CSV / PDF)</span>
        {!isPro && <ProFeatureBadge className="ml-1" />}
      </Button>

      {/* 4-Way Inward Bottom Sheet */}
      {isSheetOpen && (
      <PurchaseInwardOptionsSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        businessId={businessId}
        existingProducts={existingProducts}
        onManualInwardClick={() => {
          setIsSheetOpen(false);
          window.location.href = '/products';
        }}
        onScanSuccess={onScanSuccess}
      />
      )}
    </>
  );
}
