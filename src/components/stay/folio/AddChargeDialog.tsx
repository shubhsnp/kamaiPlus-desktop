'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';
import { postAdditionalCharge } from '@/lib/stay/services/financialService';
import { showAlert } from '@/lib/ui/dialogs';

interface AddChargeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  businessId: string;
  onSuccess: () => void;
}

const CHARGE_TYPES = [
  { id: 'Food & Beverage', label: 'Food & Beverage / Room Service' },
  { id: 'Laundry', label: 'Laundry Service' },
  { id: 'Additional Service', label: 'Additional / Extra Service' },
  { id: 'Extra Bed / Linen', label: 'Extra Bed / Linen' },
  { id: 'Damage / Penalty', label: 'Damage / Penalty' },
  { id: 'Other', label: 'Other' },
];

export const AddChargeDialog: React.FC<AddChargeDialogProps> = ({
  isOpen,
  onClose,
  folioId,
  businessId,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [chargeType, setChargeType] = useState('Food & Beverage');
  const [description, setDescription] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amountRupees);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await showAlert(t('Please enter a valid charge amount.'));
      return;
    }
    if (!description.trim()) {
      await showAlert(t('Please enter a description for this charge.'));
      return;
    }

    try {
      setIsSubmitting(true);
      const amountPaise = Math.round(parsedAmount * 100);
      const fullDescription = `[${chargeType}] ${description.trim()}`;

      await postAdditionalCharge({
        businessId,
        folioId,
        description: fullDescription,
        amountPaise,
      });

      setDescription('');
      setAmountRupees('');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Failed to add charge:', err);
      await showAlert(err?.message || t('Failed to post charge.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Add Charge')}
      description={t('Post an additional charge or service to the guest folio.')}
      size="md"
    >
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1">
            {t('Charge Type')}
          </label>
          <select
            value={chargeType}
            onChange={(e) => setChargeType(e.target.value)}
            className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 min-h-[38px]"
          >
            {CHARGE_TYPES.map((ct) => (
              <option key={ct.id} value={ct.id}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label={t('Description')}
          placeholder={t('e.g. Dinner room service, laundry, extra towel')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />

        <Input
          label={t('Amount (₹)')}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amountRupees}
          onChange={(e) => setAmountRupees(e.target.value)}
          required
        />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
          >
            {t('Save Charge')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
