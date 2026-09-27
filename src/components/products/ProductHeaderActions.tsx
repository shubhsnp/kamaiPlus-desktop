'use client';

import React from 'react';
import { 
  Package, 
  Plus,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CashierPrivacyToggleButton } from '@/components/privacy/ProfitMask';
import { tr } from '@/lib/i18n/core';

interface ProductHeaderActionsProps {
  totalProducts: number;
  businessType?: string;
  onOpenAddModal: () => void;
  onOpenExcelImporter?: () => void;
  onOpenInwardSheet?: () => void;
  onOpenRapidInward?: () => void;
}

export const ProductHeaderActions: React.FC<ProductHeaderActionsProps> = ({
  totalProducts,
  businessType,
  onOpenAddModal,
  onOpenExcelImporter,
  onOpenInwardSheet,
  onOpenRapidInward,
}) => {
  const handleInwardClick = onOpenInwardSheet || onOpenRapidInward || onOpenAddModal;

  return (
    <div className="bg-white dark:bg-slate-900 p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 flex items-center justify-center font-bold shrink-0">
          <Package className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {tr('Products Master & Items')}
            </h1>
            <CashierPrivacyToggleButton />
          </div>
          <p className="text-[10.5px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
            {tr('{totalProducts} registered products with barcodes, pricing & instant stock tracking', { totalProducts: totalProducts })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0 flex-wrap">
        {/* Bulk Inward (Excel / CSV) Button — part of Purchases (hidden when that is switched off) */}
        {(onOpenInwardSheet || onOpenRapidInward) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInwardClick}
            className="text-xs font-black gap-1.5 rounded-xl border-emerald-400/60 text-slate-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 cursor-pointer shadow-2xs"
            title={tr('Upload a distributor bill as an Excel / CSV file')}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{tr('Bulk Inward (Excel)')}</span>
          </Button>
        )}

        {/* Excel / CSV price list: new items and price updates in one go */}
        {onOpenExcelImporter && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenExcelImporter}
            className="text-xs font-black gap-1.5 rounded-xl border-slate-300 bg-white hover:bg-slate-50 cursor-pointer shadow-2xs"
            title={tr('Add or update many items from an Excel / CSV price list')}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>{tr('Import Excel')}</span>
          </Button>
        )}

        <Button
          size="sm"
          onClick={onOpenAddModal}
          className="font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 text-xs px-3.5 py-1.5 shadow-2xs cursor-pointer gap-1.5 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{tr('Add Product')}</span>
        </Button>
      </div>
    </div>
  );
};
