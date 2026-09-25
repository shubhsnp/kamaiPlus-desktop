'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Product } from '@/types';
// The inward sheet bundles the Excel/CSV parser (xlsx, ~400 KB); load it on first open.
const PurchaseInwardOptionsSheet = dynamic(
  () => import('./PurchaseInwardOptionsSheet').then((m) => m.PurchaseInwardOptionsSheet),
  { ssr: false }
);

interface InwardBillButtonProps {
  businessId?: string;
  existingProducts: Product[];
  onScanSuccess?: (billId: string, updatedCount: number, createdCount: number) => void;
  className?: string;
}

export function InwardBillButton({
  businessId = 'biz_default',
  existingProducts,
  onScanSuccess,
  className = '',
}: InwardBillButtonProps) {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setIsSheetOpen(true)}
        variant="outline"
        size="md"
        className={`border-emerald-400/60 hover:border-emerald-500 text-slate-800 font-bold text-xs gap-1.5 shadow-xs ${className}`}
        title="Upload a supplier bill as an Excel / CSV file"
      >
        <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
        <span>Inward Bill (Excel / CSV)</span>
      </Button>

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
