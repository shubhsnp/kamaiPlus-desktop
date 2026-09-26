'use client';

import React, { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Supplier } from '@/types';
import { parseRupeesToPaise } from '@/lib/utils';
import { validateGstin, validateIndianPhone } from '@/lib/validation/validators';
import { createSupplier, updateSupplier } from '@/lib/suppliers/supplierLedger';
import { msg, tr } from '@/lib/i18n/core';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  /** null = add a new supplier. */
  existing: Supplier | null;
  onSaved: (supplier: Supplier | null) => void;
}

export function SupplierFormModal({ isOpen, onClose, businessId, existing, onSaved }: SupplierFormModalProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [opening, setOpening] = useState('');
  const [openingIsAdvance, setOpeningIsAdvance] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setName(existing?.name || '');
    setPhone(existing?.phone || '');
    setGstin(existing?.gstin || '');
    setAddress(existing?.address || '');
    setNotes(existing?.notes || '');
    setOpening('');
    setOpeningIsAdvance(false);
    setError(null);
    setSaving(false);
  }, [isOpen, existing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError(tr('Supplier name is required.'));
    const phoneCheck = validateIndianPhone(phone, false, msg('Phone number'));
    if (!phoneCheck.isValid) return setError(phoneCheck.error || tr('Invalid phone number.'));
    const gstCheck = validateGstin(gstin, false);
    if (!gstCheck.isValid) return setError(gstCheck.error || tr('Invalid GSTIN.'));
    const openingPaise = opening.trim() ? parseRupeesToPaise(opening) : 0;
    if (openingPaise < 0) return setError(tr('Opening balance cannot be negative.'));

    const input = {
      name,
      phone: (phoneCheck.cleanedValue as string) || phone.trim(),
      gstin: (gstCheck.cleanedValue as string) || gstin.trim(),
      address,
      notes,
    };
    setSaving(true);
    try {
      if (existing) {
        await updateSupplier(existing.id, input);
        onSaved(null);
      } else {
        const created = await createSupplier(businessId, input, openingIsAdvance ? -openingPaise : openingPaise);
        onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || tr('Could not save the supplier.'));
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={existing ? tr('Edit Supplier: {name}', { name: existing.name }) : tr('Add Supplier')}
      description={tr('Wholesalers and distributors you buy stock from.')}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input label={tr('Supplier / firm name *')} placeholder={tr('e.g. Metro Wholesale')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label={tr('Phone')} placeholder={tr('10-digit mobile')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label={tr('GSTIN (optional)')} placeholder={tr('27ABCDE1234F1Z5')} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} />
        </div>
        <Input label={tr('Address (optional)')} value={address} onChange={(e) => setAddress(e.target.value)} />
        <Input label={tr('Notes (optional)')} placeholder={tr('e.g. Delivers every Monday')} value={notes} onChange={(e) => setNotes(e.target.value)} />

        {!existing && (
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <Input
              label={tr('Opening balance (₹, optional)')}
              placeholder="0.00"
              type="number"
              step="0.01"
              min="0"
              value={opening}
              onChange={(e) => setOpening(e.target.value)}
            />
            <div className="flex gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => setOpeningIsAdvance(false)}
                className={`flex-1 py-1.5 rounded-lg border cursor-pointer ${!openingIsAdvance ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                {tr('I owe them')}
              </button>
              <button
                type="button"
                onClick={() => setOpeningIsAdvance(true)}
                className={`flex-1 py-1.5 rounded-lg border cursor-pointer ${openingIsAdvance ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700'}`}
              >
                {tr('I paid in advance')}
              </button>
            </div>
          </div>
        )}

        {error && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">{error}</div>}

        <div className="pt-3 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="submit" size="sm" disabled={saving}>{saving ? tr('Saving…') : existing ? tr('Save Changes') : tr('Add Supplier')}</Button>
        </div>
      </form>
    </Modal>
  );
}
