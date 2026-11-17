'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';
import { recordPayment } from '@/lib/stay/services/financialService';
import type { PaymentMethod, StayPayment } from '@/lib/stay/types';
import { RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { PaymentReceiptModal } from './PaymentReceiptModal';

interface IssueRefundDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folioId: string;
  bookingId: string;
  businessId: string;
  totalPaidPaise: number;
  onSuccess: () => void;
}

export const IssueRefundDialog: React.FC<IssueRefundDialogProps> = ({
  isOpen,
  onClose,
  folioId,
  bookingId,
  businessId,
  totalPaidPaise,
  onSuccess,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [refundAmountRupees, setRefundAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Post-refund receipt state
  const [completedRefundPayment, setCompletedRefundPayment] = useState<StayPayment | null>(null);

  const maxRefundRupees = totalPaidPaise / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const parsed = parseFloat(refundAmountRupees);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg(isMarathi ? 'कृपया वैध परतावा रक्कम प्रविष्ट करा' : 'Please enter a valid refund amount');
      return;
    }

    const amountPaise = Math.round(parsed * 100);
    if (amountPaise > totalPaidPaise) {
      setErrorMsg(
        isMarathi
          ? `परतावा रक्कम एकूण प्राप्त रक्कमेपेक्षा (₹${maxRefundRupees.toFixed(2)}) जास्त असू शकत नाही`
          : `Refund amount cannot exceed total paid amount (₹${maxRefundRupees.toFixed(2)})`
      );
      return;
    }

    if (!reason.trim()) {
      setErrorMsg(isMarathi ? 'कृपया परताव्याचे कारण प्रविष्ट करा' : 'Please specify a reason for this refund');
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
        isRefund: true,
        notes: `Refund: ${reason.trim()}`,
      });

      onSuccess();
      setCompletedRefundPayment(paymentRecord);
    } catch (err: unknown) {
      console.error('Failed to issue refund:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to issue refund');
    } finally {
      setIsSubmitting(false);
    }
  };

  // If refund successfully recorded, display receipt modal
  if (completedRefundPayment) {
    return (
      <PaymentReceiptModal
        isOpen={isOpen}
        onClose={() => {
          setCompletedRefundPayment(null);
          onClose();
        }}
        payment={completedRefundPayment}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-rose-700">
          <RotateCcw className="w-5 h-5" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {isMarathi ? 'रिफंड / परतावा नोंदवा' : 'Issue Refund'}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'पाहुण्याला परत केलेली रक्कम नोंदवा आणि हिशोबात दुरुस्ती करा'
          : 'Record a financial refund to the guest with mandatory reason and method'
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Max Refundable Banner */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex justify-between items-center text-xs">
          <span className="text-slate-600 dark:text-slate-300 font-medium">
            {isMarathi ? 'एकूण प्राप्त झालेली रक्कम (कमाल परतावा)' : 'Total Paid (Max Refundable)'}:
          </span>
          <span className="font-black text-slate-900 dark:text-slate-100 text-sm font-mono">
            ₹{maxRefundRupees.toFixed(2)}
          </span>
        </div>

        {/* Refund Amount Input */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isMarathi ? 'परतावा रक्कम (₹)' : 'Refund Amount (₹)'}
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={maxRefundRupees}
            value={refundAmountRupees}
            onChange={(e) => setRefundAmountRupees(e.target.value)}
            placeholder="e.g. 500"
            required
            className="font-mono text-sm"
          />
        </div>

        {/* Refund Method Selection */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isMarathi ? 'परतावा पद्धत' : 'Refund Method'}
          </label>
          <select
            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px] cursor-pointer"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          >
            <option value="cash">{isMarathi ? 'रोख (Cash)' : 'Cash'}</option>
            <option value="upi">{isMarathi ? 'UPI / QR कोड' : 'UPI / QR'}</option>
            <option value="card">{isMarathi ? 'कार्ड (Card)' : 'Card'}</option>
            <option value="bank_transfer">{isMarathi ? 'बँक ट्रान्सफर' : 'Bank Transfer'}</option>
          </select>
        </div>

        {/* Refund Reason */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isMarathi ? 'परताव्याचे कारण (अनिवार्य)' : 'Reason for Refund (Required)'}
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              isMarathi
                ? 'उदा. मुक्काम लवकर संपवला / जास्तीचे पेमेंट परत केले'
                : 'e.g. Guest departed early / Excess deposit returned'
            }
            required
          />
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {isMarathi ? 'रद्द करा' : 'Cancel'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isMarathi ? 'परतावा निश्चित करा' : 'Confirm Refund'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
