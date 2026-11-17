'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';
import { recordPayment } from '@/lib/stay/services/financialService';
import type { PaymentMethod, StayPayment } from '@/lib/stay/types';
import { showAlert } from '@/lib/ui/dialogs';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal';

interface RecordPaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  bookingId: string;
  businessId: string;
  balanceDuePaise: number;
  onSuccess: () => void;
}

export const RecordPaymentDialog: React.FC<RecordPaymentDialogProps> = ({
  isOpen,
  onClose,
  folioId,
  bookingId,
  businessId,
  balanceDuePaise,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [amountRupees, setAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedPayment, setCompletedPayment] = useState<StayPayment | null>(null);

  // Auto-fill with balance due if positive
  useEffect(() => {
    if (isOpen) {
      if (balanceDuePaise > 0) {
        setAmountRupees((balanceDuePaise / 100).toFixed(2));
      } else {
        setAmountRupees('');
      }
      setPaymentMethod('cash');
      setReferenceNumber('');
      setNotes('');
    }
  }, [isOpen, balanceDuePaise]);

  const parsedAmount = parseFloat(amountRupees || '0');
  const amountPaise = Math.round(parsedAmount * 100);
  const remainingAfterPaymentPaise = balanceDuePaise - amountPaise;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      await showAlert(t('Please enter a valid payment amount.'));
      return;
    }

    if (paymentMethod === 'upi' && !referenceNumber.trim()) {
      await showAlert(t('Please enter the UPI Reference ID or Transaction ID.'));
      return;
    }

    try {
      setIsSubmitting(true);
      const paymentRecord = await recordPayment({
        businessId,
        folioId,
        bookingId,
        amountPaise,
        paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      setCompletedPayment(paymentRecord);
    } catch (err: any) {
      console.error('Failed to record payment:', err);
      await showAlert(err?.message || t('Failed to record payment.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (completedPayment) {
    return (
      <PaymentReceiptModal
        isOpen={isOpen}
        onClose={() => {
          setCompletedPayment(null);
          onClose();
        }}
        payment={completedPayment}
        balanceDuePaise={Math.max(0, balanceDuePaise - completedPayment.amount_paise)}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('Record Payment')}
      description={t('Record a payment transaction against the guest bill.')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Balance Overview */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs">
          <span className="text-slate-600 font-medium">{t('Current Balance Due')}:</span>
          <span className="font-bold text-slate-900 text-sm">
            ₹{(balanceDuePaise / 100).toFixed(2)}
          </span>
        </div>

        <Input
          label={t('Payment Amount (₹)')}
          type="number"
          step="0.01"
          min="0.01"
          placeholder="0.00"
          value={amountRupees}
          onChange={(e) => setAmountRupees(e.target.value)}
          required
        />

        <div>
          <label className="block text-xs font-bold text-slate-900 mb-1">
            {t('Payment Method')}
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: 'cash', label: 'Cash' },
                { id: 'upi', label: 'UPI / QR' },
                { id: 'card', label: 'Credit / Debit Card' },
                { id: 'other', label: 'Other' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id)}
                className={`py-2 px-3 text-xs font-bold rounded-lg border text-center transition-all ${
                  paymentMethod === m.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t(m.label)}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod === 'upi' && (
          <Input
            label={t('UPI Reference Number / UTR')}
            placeholder={t('12-digit transaction ID')}
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
            required
          />
        )}

        {paymentMethod === 'card' && (
          <Input
            label={t('Card Last 4 Digits / Auth Code (Optional)')}
            placeholder="e.g. 4321"
            value={referenceNumber}
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        )}

        <Input
          label={t('Notes (Optional)')}
          placeholder={t('e.g. Paid at reception counter')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* Confirmation Summary */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs space-y-1">
          <div className="font-bold text-amber-900 mb-1">{t('Payment Summary')}</div>
          <div className="flex justify-between text-amber-800">
            <span>{t('Amount to Pay')}:</span>
            <span className="font-bold">₹{isNaN(parsedAmount) ? '0.00' : parsedAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-amber-800">
            <span>{t('Remaining Balance')}:</span>
            <span className="font-bold">
              ₹{isNaN(parsedAmount) ? (balanceDuePaise / 100).toFixed(2) : (remainingAfterPaymentPaise / 100).toFixed(2)}
            </span>
          </div>
        </div>

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
            {t('Record Payment')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
