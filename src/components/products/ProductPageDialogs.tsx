'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QuickBarcodePrintModal } from '@/components/products/QuickBarcodePrintModal';
import { FastBarcodeInwardModal } from '@/components/inward/FastBarcodeInwardModal';
import { AddEditProductModal } from '@/components/products/AddEditProductModal';
import { tr } from '@/lib/i18n/core';
import type { VariantRow } from '@/components/products/VariantMatrixEditor';
import type { FeatureSwitches } from '@/lib/features/featureSwitches';
import type { Business, Category, Product, ProductUnit } from '@/types';

const CatalogImportModal = dynamic(
  () => import('@/components/import/CatalogImportModal').then((m) => m.CatalogImportModal),
  { ssr: false }
);
const PurchaseInwardOptionsSheet = dynamic(
  () => import('@/components/purchases/PurchaseInwardOptionsSheet').then((m) => m.PurchaseInwardOptionsSheet),
  { ssr: false }
);
const VariantsManagerModal = dynamic(
  () => import('@/components/products/VariantsManagerModal').then((m) => m.VariantsManagerModal),
  { ssr: false }
);

export interface ProductPageDialogsProps {
  isModalOpen: boolean;
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsPurchaseSheetOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isPurchaseSheetOpen: boolean;
  isExcelImporterOpen: boolean;
  setIsExcelImporterOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingProduct: Product | null;
  isBarcodePrintOpen: boolean;
  setIsBarcodePrintOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isFastInwardOpen: boolean;
  setIsFastInwardOpen: React.Dispatch<React.SetStateAction<boolean>>;
  barcodePrintProduct: Product | null;
  barcodePrintCopies: number | undefined;
  setIsAddCategoryModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isAddCategoryModalOpen: boolean;
  newCatName: string;
  setNewCatName: React.Dispatch<React.SetStateAction<string>>;
  formName: string;
  setFormName: React.Dispatch<React.SetStateAction<string>>;
  formCategory: string;
  setFormCategory: React.Dispatch<React.SetStateAction<string>>;
  formUnit: ProductUnit;
  setFormUnit: React.Dispatch<React.SetStateAction<ProductUnit>>;
  formPurchasePrice: string;
  setFormPurchasePrice: React.Dispatch<React.SetStateAction<string>>;
  formSellingPrice: string;
  setFormSellingPrice: React.Dispatch<React.SetStateAction<string>>;
  formIsLooseItem: boolean;
  setFormIsLooseItem: React.Dispatch<React.SetStateAction<boolean>>;
  formIsUnlimitedStock: boolean;
  setFormIsUnlimitedStock: React.Dispatch<React.SetStateAction<boolean>>;
  formMrp: string;
  setFormMrp: React.Dispatch<React.SetStateAction<string>>;
  formWholesalePrice: string;
  setFormWholesalePrice: React.Dispatch<React.SetStateAction<string>>;
  formTaxRate: number;
  setFormTaxRate: React.Dispatch<React.SetStateAction<number>>;
  formStock: string;
  setFormStock: React.Dispatch<React.SetStateAction<string>>;
  formMinStock: string;
  setFormMinStock: React.Dispatch<React.SetStateAction<string>>;
  formBarcode: string;
  setFormBarcode: React.Dispatch<React.SetStateAction<string>>;
  formHsn: string;
  setFormHsn: React.Dispatch<React.SetStateAction<string>>;
  formSize: string;
  setFormSize: React.Dispatch<React.SetStateAction<string>>;
  formColor: string;
  setFormColor: React.Dispatch<React.SetStateAction<string>>;
  formError: string;
  variantsEnabled: boolean;
  setVariantsEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  variantRows: VariantRow[];
  setVariantRows: React.Dispatch<React.SetStateAction<VariantRow[]>>;
  variantsParent: Product | null;
  setVariantsParent: React.Dispatch<React.SetStateAction<Product | null>>;
  allProducts: Product[];
  categories: Category[];
  business: Business | undefined;
  switches: FeatureSwitches;
  handleBarcodeScanned: (code: string) => Promise<void>;
  handleSaveProduct: (e: React.FormEvent) => Promise<void>;
  handleDeleteProduct: (id: string, name: string) => Promise<void>;
  handleOpenEditModal: (p: Product) => void;
  handleCreateCategory: (e: React.FormEvent) => Promise<void>;
  handleOpenAddModal: () => void;
}

/**
 * The windows of the Products page (v4.104.0, K-D23 — moved out of app/products/page.tsx unchanged):
 * add / edit item, new category, Excel import, purchase inward sheet and the 1-click label print.
 */
export function ProductPageDialogs(props: ProductPageDialogsProps) {
  const {
    isModalOpen, setIsModalOpen, setIsPurchaseSheetOpen, isPurchaseSheetOpen, isExcelImporterOpen, setIsExcelImporterOpen,
    editingProduct, isBarcodePrintOpen, setIsBarcodePrintOpen, isFastInwardOpen, setIsFastInwardOpen, barcodePrintProduct,
    barcodePrintCopies, setIsAddCategoryModalOpen, isAddCategoryModalOpen, newCatName, setNewCatName, formName,
    setFormName, formCategory, setFormCategory, formUnit, setFormUnit, formPurchasePrice,
    setFormPurchasePrice, formSellingPrice, setFormSellingPrice, formIsLooseItem, setFormIsLooseItem, formIsUnlimitedStock,
    setFormIsUnlimitedStock, formMrp, setFormMrp, formWholesalePrice, setFormWholesalePrice, formTaxRate,
    setFormTaxRate, formStock, setFormStock, formMinStock, setFormMinStock, formBarcode,
    setFormBarcode, formHsn, setFormHsn, formSize, setFormSize, formColor,
    setFormColor, formError, variantsEnabled, setVariantsEnabled, variantRows, setVariantRows,
    variantsParent, setVariantsParent, allProducts, categories, business, switches,
    handleBarcodeScanned, handleSaveProduct, handleDeleteProduct, handleOpenEditModal, handleCreateCategory, handleOpenAddModal,
  } = props;
  return (
    <>
      <AddEditProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        categories={categories}
        formName={formName}
        setFormName={setFormName}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        formUnit={formUnit}
        setFormUnit={setFormUnit}
        formPurchasePrice={formPurchasePrice}
        setFormPurchasePrice={setFormPurchasePrice}
        formSellingPrice={formSellingPrice}
        setFormSellingPrice={setFormSellingPrice}
        formIsLooseItem={formIsLooseItem}
        setFormIsLooseItem={setFormIsLooseItem}
        formIsUnlimitedStock={formIsUnlimitedStock}
        setFormIsUnlimitedStock={setFormIsUnlimitedStock}
        formMrp={formMrp}
        setFormMrp={setFormMrp}
        formWholesalePrice={formWholesalePrice}
        setFormWholesalePrice={setFormWholesalePrice}
        formTaxRate={formTaxRate}
        setFormTaxRate={setFormTaxRate}
        formStock={formStock}
        setFormStock={setFormStock}
        formMinStock={formMinStock}
        setFormMinStock={setFormMinStock}
        formBarcode={formBarcode}
        setFormBarcode={setFormBarcode}
        formHsn={formHsn}
        setFormHsn={setFormHsn}

        formSize={formSize}
        setFormSize={setFormSize}
        formColor={formColor}
        setFormColor={setFormColor}
        onBarcodeScanned={handleBarcodeScanned}
        onOpenAddCategoryModal={() => setIsAddCategoryModalOpen(true)}
        onOpenInwardSheet={switches.purchases ? () => setIsPurchaseSheetOpen(true) : undefined}
        onSubmit={handleSaveProduct}
        onDeleteProduct={handleDeleteProduct}
        formError={formError}
        variantsEnabled={variantsEnabled}
        setVariantsEnabled={setVariantsEnabled}
        variantRows={variantRows}
        setVariantRows={setVariantRows}
      />

      {variantsParent && (
        <VariantsManagerModal
          parent={variantsParent}
          onClose={() => setVariantsParent(null)}
          onEditVariant={(v) => {
            setVariantsParent(null);
            handleOpenEditModal(v);
          }}
        />
      )}

      {/* Quick Add Category Modal */}
      <Modal
        isOpen={isAddCategoryModalOpen}
        onClose={() => setIsAddCategoryModalOpen(false)}
        title={tr('Add New Category')}
        description={tr('Create a product category to organize your catalog.')}
      >
        <form onSubmit={handleCreateCategory} className="space-y-3.5">
          <Input
            label={tr('Category Name *')}
            placeholder={tr('e.g. Edible Oils, Dairy, Spices')}
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            required
            autoFocus
          />
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsAddCategoryModalOpen(false)}>
              {tr('Cancel')}
            </Button>
            <Button type="submit" className="font-black bg-slate-900 text-white">
              {tr('Create Category')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Excel / CSV price-list import (mounted only while open — xlsx is heavy) */}
      {isExcelImporterOpen && (
        <CatalogImportModal
          onClose={() => setIsExcelImporterOpen(false)}
          businessId={business?.id || 'biz_default'}
        />
      )}

      {/* Purchase Inward Sheet */}
      <PurchaseInwardOptionsSheet
        isOpen={isPurchaseSheetOpen}
        onClose={() => setIsPurchaseSheetOpen(false)}
        businessId={business?.id || 'biz_default'}
        existingProducts={allProducts}
        onManualInwardClick={() => {
          setIsPurchaseSheetOpen(false);
          handleOpenAddModal();
        }}
      />

      {isFastInwardOpen && <FastBarcodeInwardModal onClose={() => setIsFastInwardOpen(false)} />}

      {/* 1-Click Barcode Print Modal */}
      <QuickBarcodePrintModal
        isOpen={isBarcodePrintOpen}
        onClose={() => setIsBarcodePrintOpen(false)}
        product={barcodePrintProduct}
        initialCopies={barcodePrintCopies}
        storeName={business?.name}
      />
    </>
  );
}
