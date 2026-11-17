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
  Building2,
  ShieldAlert,
  ArrowRight
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

  // Settlement Mode: 'settle' = Collect Payment, 'credit' = Authorized Credit (Khaata)
  const [settlementMode, setSettlementMode] = useState<'settle' | 'credit'>('settle');

  // Settlement Payment Inputs
  const [paymentAmountRupees, setPaymentAmountRupees] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState('');

  // Authorized Credit Inputs
  const [debtorName, setDebtorName] = useState('');
  const [debtorPhone, setDebtorPhone] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [creditAuthorizedBy, setCreditAuthorizedBy] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      setFieldErrors({});

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
      if (g) {
        setGuest(g);
        setDebtorName(g.name || '');
        setDebtorPhone(g.phone || '');
      }
      if (r) setRoom(r);
    } catch (err) {
      console.error('Failed to load checkout data:', err);
      setErrorMsg(isMarathi ? 'बिलाची माहिती लोड करताना त्रुटी आली.' : 'Failed to load guest bill information');
    } finally {
      setIsLoading(false);
    }
  }, [booking, businessId, isMarathi]);

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

  // Record a partial payment and refresh bill summary
  const handleRecordPartialPayment = async () => {
    if (!folio || !billSummary) return;
    setErrorMsg(null);
    setFieldErrors({});

    const paymentAmount = parseFloat(paymentAmountRupees);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      setErrorMsg(isMarathi ? 'कृपया वैध पेमेंट रक्कम टाका.' : 'Please enter a valid payment amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      const amountPaise = Math.round(paymentAmount * 100);
      await recordPayment({
        businessId,
        folioId: folio.id,
        bookingId: booking.id,
        amountPaise,
        paymentMethod,
        referenceNumber: paymentRef.trim() || undefined,
        notes: 'Mid-checkout partial payment',
      });

      // Reload summary
      const updatedSummary = await generateFinalBillSummary(folio.id, businessId);
      setBillSummary(updatedSummary);
      const remaining = updatedSummary.balance_due_paise / 100;
      setPaymentAmountRupees(remaining > 0 ? remaining.toFixed(2) : '0.00');
      setPaymentRef('');
    } catch (err: unknown) {
      console.error('Partial payment failed:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Payment recording failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Complete Settlement & Checkout
  const handleSettleAndCheckout = async () => {
    if (!folio || !billSummary) return;
    setErrorMsg(null);
    setFieldErrors({});

    const currentBalanceDue = billSummary.balance_due_paise / 100;

    // SCENARIO 1: Balance is Due and Settling via Payment
    if (currentBalanceDue > 0 && settlementMode === 'settle') {
      const paymentAmount = parseFloat(paymentAmountRupees);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        setErrorMsg(
          isMarathi
            ? `बाकी रक्कम ₹${currentBalanceDue.toFixed(2)} जमा करणे आवश्यक आहे किंवा 'खात्यावर नोंद' निवडा.`
            : `Please enter the required payment of ₹${currentBalanceDue.toFixed(2)} or select Authorized Credit.`
        );
        return;
      }

      if (paymentAmount < currentBalanceDue) {
        setErrorMsg(
          isMarathi
            ? `टाकलेली रक्कम (₹${paymentAmount.toFixed(2)}) बाकी रकमेपेक्षा (₹${currentBalanceDue.toFixed(2)}) कमी आहे. कृपया पूर्ण रक्कम टाका किंवा आधी 'अर्धवट पेमेंट नोंदवा' वर क्लिक करा.`
            : `Amount entered (₹${paymentAmount.toFixed(2)}) is less than total balance (₹${currentBalanceDue.toFixed(2)}). Collect full balance or click Record Partial Payment first.`
        );
        return;
      }

      setIsSubmitting(true);
      try {
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

        // Perform Checkout
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
      return;
    }

    // SCENARIO 2: Balance is Due and Authorizing Credit (Khaata / City Ledger)
    if (currentBalanceDue > 0 && settlementMode === 'credit') {
      const errors: Record<string, string> = {};
      if (!debtorName.trim()) {
        errors.debtorName = isMarathi ? 'खातेदाराचे नाव आवश्यक आहे' : 'Debtor name is required';
      }
      if (!debtorPhone.trim()) {
        errors.debtorPhone = isMarathi ? 'संपर्क नंबर आवश्यक आहे' : 'Contact phone is required';
      }

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }

      setIsSubmitting(true);
      try {
        await checkOut({
          bookingId: booking.id,
          allowCredit: true,
          creditDetails: {
            debtorName: debtorName.trim(),
            debtorPhone: debtorPhone.trim(),
            dueDate: creditDueDate.trim() || undefined,
            notes: creditNotes.trim() || undefined,
            authorizedBy: creditAuthorizedBy.trim() || undefined,
          },
        });

        setIsCompleted(true);
        onSuccess();
      } catch (err: unknown) {
        console.error('Credit checkout failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Authorized credit check-out failed.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // SCENARIO 3: Balance is Negative (Refund owed to guest)
    if (currentBalanceDue < 0) {
      setIsSubmitting(true);
      try {
        const refundPaise = Math.abs(Math.round(currentBalanceDue * 100));
        await recordPayment({
          businessId,
          folioId: folio.id,
          bookingId: booking.id,
          amountPaise: refundPaise,
          paymentMethod: 'cash',
          isRefund: true,
          notes: 'Refund of excess deposit at checkout',
        });

        await checkOut({
          bookingId: booking.id,
        });

        setIsCompleted(true);
        onSuccess();
      } catch (err: unknown) {
        console.error('Refund checkout failed:', err);
        setErrorMsg(err instanceof Error ? err.message : 'Check-out failed.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // SCENARIO 4: Balance is Exactly Zero (Nil Balance)
    setIsSubmitting(true);
    try {
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
          ? 'पाहुण्याचे बिल तपासा, उर्वरित देणी पूर्ण करा आणि खोली साफसफाईसाठी पाठवा'
          : 'Review final bill, settle balance dues and complete room turnover'
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
                  {booking.check_in_date} → {booking.check_out_date} ({billSummary?.nights || 1} {isMarathi ? 'रात्री' : 'nights'})
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

            {/* Bill Summary Breakdown */}
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
                    <span>{isMarathi ? 'आगाऊ / भरलेली रक्कम (Paid)' : 'Total Payments Received'}:</span>
                    <span className="font-mono">
                      -₹{(billSummary.total_paid_paise / 100).toFixed(2)}
                    </span>
                  </div>

                  {/* Net Balance Highlight Box */}
                  <div className={`p-3 rounded-xl border flex items-center justify-between text-sm mt-2 ${
                    balanceDueRupees > 0
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : balanceDueRupees < 0
                      ? 'bg-sky-50 border-sky-300 text-sky-900'
                      : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}>
                    <div>
                      <span className="font-black block">
                        {balanceDueRupees > 0
                          ? isMarathi ? 'बाकी देय रक्कम (Balance Due):' : 'Balance Due:'
                          : balanceDueRupees < 0
                          ? isMarathi ? 'पाहुण्यांना रिफंड देय (Refund Due):' : 'Refund Due to Guest:'
                          : isMarathi ? 'सर्व देणी पूर्ण भरली आहेत (Fully Settled)' : 'Fully Settled (Nil Balance)'}
                      </span>
                      {balanceDueRupees > 0 && (
                        <span className="text-[11px] text-rose-700 font-normal">
                          {isMarathi 
                            ? 'खोली मोकळी करण्यापूर्वी ही रक्कम जमा करा किंवा खात्यावर नोंद करा.' 
                            : 'This amount must be collected or authorized as credit prior to checkout.'}
                        </span>
                      )}
                    </div>
                    <span className="font-mono font-black text-xl">
                      ₹{Math.abs(balanceDueRupees).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Zero-Escape Settlement Gate if Balance > 0 */}
            {balanceDueRupees > 0 && (
              <div className="space-y-3 p-3.5 bg-violet-50/70 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl">
                {/* Mode Selector: Collect Payment vs Authorized Credit */}
                <div className="flex items-center gap-2 p-1 bg-white dark:bg-slate-900 border border-violet-200 dark:border-violet-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setSettlementMode('settle');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      settlementMode === 'settle'
                        ? 'bg-violet-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>{isMarathi ? '१. पेमेंट जमा करा (Collect Payment)' : '1. Collect Payment'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSettlementMode('credit');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer ${
                      settlementMode === 'credit'
                        ? 'bg-amber-600 text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{isMarathi ? '२. खात्यावर शिल्लक (Authorized Credit)' : '2. Authorized Credit'}</span>
                  </button>
                </div>

                {/* TAB 1: Collect Payment */}
                {settlementMode === 'settle' && (
                  <div className="space-y-3 pt-1">
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
                          <span>{isMarathi ? 'पावती व लेजरमध्ये नोंद होईल' : 'Recorded on receipt & ledger'}</span>
                        </div>
                      )}
                    </div>

                    {/* Quick Partial Payment Helper */}
                    {parseFloat(paymentAmountRupees) < balanceDueRupees && parseFloat(paymentAmountRupees) > 0 && (
                      <div className="flex items-center justify-between p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs">
                        <span className="text-amber-800 font-medium">
                          {isMarathi
                            ? `तुम्ही अर्धवट रक्कम (₹${parseFloat(paymentAmountRupees).toFixed(2)}) जमा करत आहात. उर्वरित ₹${(balanceDueRupees - parseFloat(paymentAmountRupees)).toFixed(2)} नंतर शिल्लक राहील.`
                            : `Collecting partial amount of ₹${parseFloat(paymentAmountRupees).toFixed(2)}. ₹${(balanceDueRupees - parseFloat(paymentAmountRupees)).toFixed(2)} will remain.`}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={isSubmitting}
                          onClick={handleRecordPartialPayment}
                          className="text-xs shrink-0"
                        >
                          {isMarathi ? 'अर्धवट पेमेंट नोंदवा' : 'Record Partial Payment'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: Authorized Credit / Khaata */}
                {settlementMode === 'credit' && (
                  <div className="space-y-3 pt-1">
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <span>
                        {isMarathi
                          ? 'ही रक्कम खातेदाराच्या नावे (Accounts Receivable) वर्ग केली जाईल. पाहुण्यांचे नाव आणि मोबाईल नंबर अनिवार्य आहे.'
                          : 'This balance will be transferred to the debtor ledger. Debtor name and phone number are mandatory.'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label={(isMarathi ? 'खातेदार / कंपनीचे नाव' : 'Debtor / Company Name') + ' *'}
                        value={debtorName}
                        onChange={(e) => setDebtorName(e.target.value)}
                        placeholder="e.g. Ramesh Patil / ABC Infra Ltd."
                        error={fieldErrors.debtorName}
                      />

                      <Input
                        label={(isMarathi ? 'खातेदार मोबाईल नंबर' : 'Debtor Mobile Phone') + ' *'}
                        value={debtorPhone}
                        onChange={(e) => setDebtorPhone(e.target.value)}
                        placeholder="e.g. 9876543210"
                        error={fieldErrors.debtorPhone}
                      />

                      <Input
                        label={isMarathi ? 'पेमेंटची अपेक्षित तारीख' : 'Expected Payment Due Date'}
                        type="date"
                        value={creditDueDate}
                        onChange={(e) => setCreditDueDate(e.target.value)}
                      />

                      <Input
                        label={isMarathi ? 'व्यवस्थापक / कर्मचारी मान्यता' : 'Authorized By / Staff PIN'}
                        value={creditAuthorizedBy}
                        onChange={(e) => setCreditAuthorizedBy(e.target.value)}
                        placeholder="e.g. Manager Suresh"
                      />
                    </div>

                    <Input
                      label={isMarathi ? 'खात्यावर टाकण्याचे कारण / शेरा' : 'Reason / Credit Notes'}
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      placeholder="e.g. Regular corporate guest, monthly billing"
                    />
                  </div>
                )}
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
            className={`min-h-[44px] px-6 text-sm font-black flex items-center gap-2 shadow-sm text-white ${
              balanceDueRupees > 0 && settlementMode === 'credit'
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {balanceDueRupees > 0
                ? settlementMode === 'credit'
                  ? isMarathi ? 'खात्यावर नोंद करून चेक-आउट करा' : 'Authorize Credit & Check-out'
                  : isMarathi ? `₹${parseFloat(paymentAmountRupees || '0').toFixed(2)} जमा करा व चेक-आउट करा` : `Collect ₹${parseFloat(paymentAmountRupees || '0').toFixed(2)} & Check-out`
                : balanceDueRupees < 0
                ? isMarathi ? `₹${Math.abs(balanceDueRupees).toFixed(2)} रिफंड करा व चेक-आउट` : `Refund ₹${Math.abs(balanceDueRupees).toFixed(2)} & Check-out`
                : isMarathi ? 'चेक-आउट पूर्ण करा (Complete Check-out)' : 'Complete Check-out'}
            </span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};