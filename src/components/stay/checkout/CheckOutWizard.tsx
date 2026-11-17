'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';
import { db } from '@/lib/db';
import { checkOut } from '@/lib/stay/services/bookingService';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { generateFinalBillSummary, recordPayment } from '@/lib/stay/services/financialService';
import type { Booking, Guest, Room, Folio, FinalBillSummary, PaymentMethod } from '@/lib/stay/types';
import { FinalReceipt } from './FinalReceipt';
import { 
  CheckCircle2, 
  Sparkles, 
  AlertCircle, 
  CreditCard, 
  Receipt, 
  User, 
  BedDouble, 
  Calendar,
  Clock,
  Printer
} from 'lucide-react';

interface CheckOutWizardProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking;
  businessId: string;
  onSuccess: () => void;
}

export const CheckOutWizard: React.FC<CheckOutWizardProps> = ({
  isOpen,
  onClose,
  booking,
  businessId,
  onSuccess,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [folio, setFolio] = useState<Folio | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [billSummary, setBillSummary] = useState<FinalBillSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Settlement Inputs
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const [f, g, r] = await Promise.all([
        folioRepository.findOpenFolio(businessId, booking.id),
        db.stay_guests.get(booking.primary_guest_id),
        booking.room_id ? db.rooms.get(booking.room_id) : Promise.resolve(undefined),
      ]);

      if (f) {
        setFolio(f);
        const sum = await generateFinalBillSummary(f.id, businessId);
        setBillSummary(sum);
        if (sum.balance_due_paise > 0) {
          setPaymentAmountRupees((sum.balance_due_paise / 100).toFixed(2));
        } else {
          setPaymentAmountRupees('0.00');
        }
      }
      if (g) setGuest(g);
      if (r) setRoom(r);
    } catch (err) {
      console.error('Failed to load checkout data:', err);
      setErrorMsg('Failed to load guest bill information');
    } finally {
      setIsLoading(false);
    }
  }, [booking, businessId]);

  useEffect(() => {
    if (isOpen) {
      setIsCompleted(false);
      loadData();
    }
  }, [isOpen, loadData]);

  const balanceDueRupees = useMemo(() => {
    if (!billSummary) return 0;
    return billSummary.balance_due_paise / 100;
  }, [billSummary]);

  // Handle Complete Settlement & Checkout
  const handleSettleAndCheckout = async () => {
    if (!folio || !billSummary) return;
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      // 1. If balance due, record settlement payment
      const paymentAmount = parseFloat(paymentAmountRupees);
      if (balanceDueRupees > 0 && !isNaN(paymentAmount) && paymentAmount > 0) {
        const amountPaise = Math.round(paymentAmount * 100);
        await recordPayment({
          businessId,
          folioId: folio.id,
          bookingId: booking.id,
          amountPaise,
          paymentMethod,
          referenceNumber: paymentRef.trim() || undefined,
          notes: 'Final settlement payment at checkout',
        });
      }

      // 2. Perform Checkout
      await checkOut({
        bookingId: booking.id,
      });

      setIsCompleted(true);
      onSuccess();
    } catch (err: unknown) {
      console.error('Checkout failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Check-out failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Show final receipt after checkout complete
  if (isCompleted && folio) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <FinalReceipt folioId={folio.id} businessId={businessId} onClose={onClose} />
      </Modal>
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-violet-600" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {isMarathi
              ? `खोली ${room?.number || booking.room_id || ''} — बिल व चेक-आउट`
              : `Room ${room?.number || booking.room_id || ''} — Final Bill & Check-out`}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'पाहुण्याचे बिल तपासा, उर्वरित रक्कम जमा करा आणि खोली साफसफाईसाठी पाठवा'
          : 'Review final bill, collect remaining dues and complete checkout'
      }
      size="lg"
    >
      <div className="space-y-4">
        {errorMsg && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center text-sm font-semibold text-slate-500">
            {isMarathi ? 'बिल लोड करत आहे...' : 'Loading bill details...'}
          </div>
        ) : (
          <>
            {/* Stay & Guest Summary Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  {isMarathi ? 'पाहुण्याचे नाव' : 'Guest'}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {guest?.name || 'Guest'}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  {guest?.phone || ''}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  {isMarathi ? 'खोली व मुक्काम' : 'Room & Stay'}
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {isMarathi ? 'खोली' : 'Room'} {room?.number || '-'}
                </span>
                <span className="text-[11px] text-slate-500 block font-mono">
                  {booking.check_in_date} → {booking.check_out_date}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  {isMarathi ? 'बुकिंग संदर्भ' : 'Booking Ref'}
                </span>
                <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                  {booking.booking_reference}
                </span>
                <span className="text-[11px] text-emerald-600 font-bold block">
                  {isMarathi ? 'सक्रिय मुक्काम (Active)' : 'Active Stay'}
                </span>
              </div>
            </div>

            {/* Bill Summary Table */}
            {billSummary && (
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  {isMarathi ? 'अंतिम बिलाचा तपशील (Bill Breakdown)' : 'Final Bill Breakdown'}
                </span>

                <div className="space-y-1.5 text-xs">
                  {billSummary.lines && billSummary.lines.map((line, idx) => (
                    <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>{line.label}:</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{(line.amount_paise / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-100 dark:border-slate-800">
                    <span>{isMarathi ? 'एकूण आकारलेले शुल्क (Total Charges)' : 'Total Charges'}:</span>
                    <span className="font-mono font-black text-sm">
                      ₹{(billSummary.grand_total_paise / 100).toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                    <span>{isMarathi ? 'आगाऊ / आधी भरलेली रक्कम (Paid)' : 'Total Payments Received'}:</span>
                    <span className="font-mono">
                      -₹{(billSummary.total_paid_paise / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Net Balance Highlight Box */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-sm mt-2 ${
                    balanceDueRupees > 0
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}>
                    <span className="font-black">
                      {balanceDueRupees > 0
                        ? isMarathi ? 'बाकी रक्कम (Balance Due):' : 'Balance Due:'
                        : isMarathi ? 'सर्व देणी पूर्ण भरली आहेत (Fully Settled)' : 'Fully Settled (Nil Balance)'}
                    </span>
                    <span className="font-mono font-black text-lg">
                      ₹{balanceDueRupees.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment Settlement Section if balance > 0 */}
            {balanceDueRupees > 0 && (
              <div className="p-3.5 bg-violet-50/60 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl space-y-3">
                <span className="text-xs font-black uppercase tracking-wider text-violet-900 dark:text-violet-200 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-violet-600" />
                  <span>{isMarathi ? 'उर्वरित पेमेंट नोंदवा (Settle Balance)' : 'Settle Balance Payment'}</span>
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input
                    label={isMarathi ? 'जमा रक्कम (₹)' : 'Amount to Collect (₹)'}
                    type="number"
                    step="0.01"
                    min="0"
                    value={paymentAmountRupees}
                    onChange={(e) => setPaymentAmountRupees(e.target.value)}
                    required
                  />

                  <div>
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                      {isMarathi ? 'पेमेंट पद्धत' : 'Payment Mode'}
                    </label>
                    <select
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px] cursor-pointer"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    >
                      <option value="cash">{isMarathi ? 'रोख (Cash)' : 'Cash'}</option>
                      <option value="upi">{isMarathi ? 'UPI / QR कोड' : 'UPI / QR'}</option>
                      <option value="card">{isMarathi ? 'कार्ड (Card)' : 'Card'}</option>
                      <option value="bank_transfer">{isMarathi ? 'बँक ट्रान्सफर' : 'Bank Transfer'}</option>
                    </select>
                  </div>

                  {paymentMethod === 'upi' ? (
                    <Input
                      label="UPI UTR / Ref No."
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="e.g. 439201928312"
                    />
                  ) : (
                    <div className="flex flex-col justify-end text-[11px] text-slate-500 pb-2">
                      <span>{isMarathi ? 'पेमेंट पावतीत नोंदवले जाईल' : 'Will be recorded on receipt'}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Room housekeeping notice */}
            <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg text-xs font-semibold text-sky-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-sky-600 flex-shrink-0" />
              <span>
                {isMarathi
                  ? 'चेक-आऊटनंतर ही खोली आपोआप "स्वच्छता आवश्यक" (Cleaning Required) स्थितीत जाईल.'
                  : 'After checkout, this room will automatically be sent to Housekeeping for cleaning.'}
              </span>
            </div>
          </>
        )}

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="outline" size="md" onClick={onClose} className="min-h-[42px]">
            {isMarathi ? 'मागे / बंद करा' : 'Cancel'}
          </Button>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            onClick={handleSettleAndCheckout}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] px-6 text-sm font-black flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {balanceDueRupees > 0
                ? isMarathi ? 'पेमेंट जमा करा आणि चेक-आउट पूर्ण करा' : 'Collect Payment & Check-out'
                : isMarathi ? 'चेक-आउट पूर्ण करा (Complete Check-out)' : 'Complete Check-out'}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
