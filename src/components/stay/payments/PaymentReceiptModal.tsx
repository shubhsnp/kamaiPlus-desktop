'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';
import { Printer, MessageSquare, Receipt, CheckCircle2, RotateCcw } from 'lucide-react';
import { db } from '@/lib/db';
import { getStoredUser } from '@/lib/auth';
import type { StayPayment, Booking, Guest, Room, Folio } from '@/lib/stay/types';
import { calculateNights } from '@/lib/stay/services/availabilityService';
import { WhatsAppShareDialog, type WhatsAppShareData } from './WhatsAppShareDialog';

export interface PaymentReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: StayPayment;
  booking?: Booking;
  guest?: Guest;
  room?: Room;
  folio?: Folio;
  totalChargesPaise?: number;
  totalPaidPaise?: number;
  balanceDuePaise?: number;
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  isOpen,
  onClose,
  payment,
  booking: initialBooking,
  guest: initialGuest,
  room: initialRoom,
  folio: initialFolio,
  totalChargesPaise = 0,
  totalPaidPaise = 0,
  balanceDuePaise = 0,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [booking, setBooking] = useState<Booking | null>(initialBooking || null);
  const [guest, setGuest] = useState<Guest | null>(initialGuest || null);
  const [room, setRoom] = useState<Room | null>(initialRoom || null);
  const [lodgeName, setLodgeName] = useState('Kamai Plus Stay');
  const [lodgeAddress, setLodgeAddress] = useState('');
  const [lodgePhone, setLodgePhone] = useState('');
  const [format, setFormat] = useState<'standard' | 'thermal'>('standard');
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load missing related records if not passed as props
  useEffect(() => {
    async function fetchMetadata() {
      if (!isOpen) return;
      try {
        setIsLoading(true);

        let curBooking = initialBooking;
        if (!curBooking && payment.booking_id) {
          curBooking = await db.stay_bookings.get(payment.booking_id);
          if (curBooking) setBooking(curBooking);
        }

        if (!initialGuest && curBooking?.primary_guest_id) {
          const g = await db.stay_guests.get(curBooking.primary_guest_id);
          if (g) setGuest(g);
        }

        if (!initialRoom && curBooking?.room_id) {
          const r = await db.rooms.get(curBooking.room_id);
          if (r) setRoom(r);
        }

        // Lodge metadata
        const [settings, business] = await Promise.all([
          db.stay_settings.where('business_id').equals(payment.business_id).first(),
          db.businesses.get(payment.business_id),
        ]);

        const stored = getStoredUser();
        const name =
          settings?.property_name ||
          business?.name ||
          stored?.shop_name ||
          stored?.business_name ||
          'Kamai Plus Stay';
        setLodgeName(name);

        const addr = business?.address || '';
        setLodgeAddress(addr);

        const ph = business?.phone || stored?.phone || '';
        setLodgePhone(ph);
      } catch (err) {
        console.error('Failed to load receipt details:', err);
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetadata();
  }, [isOpen, payment, initialBooking, initialGuest, initialRoom]);

  const handlePrint = () => {
    window.print();
  };

  const isRefund = Boolean(payment.is_refund || payment.notes?.toLowerCase().includes('refund'));
  const receiptNo = `REC-${payment.id.slice(0, 8).toUpperCase()}`;
  const amountRupees = payment.amount_paise / 100;
  const balanceDueRupees = balanceDuePaise / 100;

  const whatsAppData: WhatsAppShareData = {
    guestPhone: guest?.phone || '',
    guestName: guest?.name || 'Valued Guest',
    lodgeName,
    roomNumber: room?.number,
    bookingRef: booking?.booking_reference || payment.booking_id.slice(0, 8).toUpperCase(),
    amountRupees,
    balanceDueRupees,
    receiptNumber: receiptNo,
    receiptType: isRefund ? 'refund' : payment.is_advance ? 'advance' : 'partial',
    stayDates: booking
      ? {
          checkIn: booking.check_in_date,
          checkOut: booking.check_out_date,
          nights: calculateNights(booking.check_in_date, booking.check_out_date),
        }
      : undefined,
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-indigo-600" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {isRefund
              ? isMarathi ? 'रिफंड / परतावा पावती' : 'Refund Receipt'
              : payment.is_advance
              ? isMarathi ? 'अ‍ॅडव्हान्स पेमेंट पावती' : 'Advance Payment Receipt'
              : isMarathi ? 'पेमेंट पावती' : 'Payment Receipt'}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'पाहुण्यासाठी अधिकृत पेमेंट पावती प्रिंट करा किंवा व्हॉट्सअ‍ॅपवर पाठवा'
          : 'Print official payment receipt or share directly via WhatsApp'
      }
      size="lg"
    >
      <div className="space-y-4">
        {/* Controls bar: Format toggle & Action buttons (hidden on print) */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 print:hidden">
          {/* Format selector */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setFormat('standard')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                format === 'standard'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isMarathi ? 'मानक (A4)' : 'Standard (A4)'}
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                format === 'thermal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {isMarathi ? 'थर्मल (80mm)' : 'Thermal (80mm)'}
            </button>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsWhatsAppOpen(true)}
              className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>{isMarathi ? 'व्हॉट्सअ‍ॅप' : 'WhatsApp'}</span>
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 font-bold"
            >
              <Printer className="w-4 h-4" />
              <span>{isMarathi ? 'प्रिंट करा' : 'Print Receipt'}</span>
            </Button>
          </div>
        </div>

        {/* Printable View Container */}
        <div
          className={`mx-auto bg-white border border-slate-300 rounded-xl p-6 shadow-sm print:border-none print:shadow-none print:p-0 transition-all ${
            format === 'thermal' ? 'max-w-[340px] text-xs font-mono' : 'max-w-xl text-xs'
          }`}
        >
          {/* Header */}
          <div className="text-center border-b border-slate-300 pb-3 mb-3">
            <h1 className="text-lg font-black text-slate-900 uppercase tracking-wide">
              {lodgeName}
            </h1>
            {lodgeAddress && <p className="text-[11px] text-slate-500 mt-0.5">{lodgeAddress}</p>}
            {lodgePhone && <p className="text-[11px] text-slate-500">संपर्क / Phone: {lodgePhone}</p>}

            <div className="mt-2 inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 border border-indigo-200">
              {isRefund ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-700 font-black">{isMarathi ? 'रिफंड / परतावा पावती' : 'REFUND RECEIPT'}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {payment.is_advance
                      ? isMarathi ? 'अ‍ॅडव्हान्स पेमेंट पावती' : 'ADVANCE DEPOSIT RECEIPT'
                      : isMarathi ? 'पेमेंट पावती' : 'PAYMENT RECEIPT'}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 pb-3 mb-3 border-b border-slate-200 text-slate-700">
            <div>
              <span className="text-[10px] text-slate-400 block uppercase">
                {isMarathi ? 'पावती क्रमांक' : 'Receipt No'}
              </span>
              <span className="font-mono font-bold text-slate-900">{receiptNo}</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">
                {isMarathi ? 'तारीख व वेळ' : 'Date & Time'}
              </span>
              <span className="font-semibold text-slate-800">
                {payment.paid_at.replace('T', ' ').slice(0, 16)}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase">
                {isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name'}
              </span>
              <span className="font-bold text-slate-900 text-sm">{guest?.name || 'Guest'}</span>
              <span className="text-[11px] text-slate-500 block font-mono">{guest?.phone || ''}</span>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-slate-400 block uppercase">
                {isMarathi ? 'खोली क्रमांक / बुकिंग संदर्भ' : 'Room / Booking Ref'}
              </span>
              <span className="font-bold text-slate-900">
                {room ? `Room ${room.number}` : 'Unassigned'}
              </span>
              <span className="text-[11px] text-slate-500 block font-mono">
                {booking?.booking_reference || payment.booking_id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>

          {/* Payment Amount Display Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center my-3">
            <span className="text-[11px] font-bold uppercase text-slate-500 block tracking-wider">
              {isRefund
                ? isMarathi ? 'परतावा केलेली रक्कम (Refund Amount)' : 'Amount Refunded'
                : isMarathi ? 'प्राप्त रक्कम (Amount Received)' : 'Amount Received'}
            </span>
            <div className={`text-2xl font-black font-mono mt-1 ${isRefund ? 'text-rose-600' : 'text-emerald-700'}`}>
              ₹{amountRupees.toFixed(2)}
            </div>
            <div className="text-xs text-slate-600 mt-1 flex items-center justify-center gap-1.5 font-semibold">
              <span className="uppercase px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-bold">
                {payment.payment_method}
              </span>
              {payment.reference_number && (
                <span className="font-mono text-slate-500">
                  Ref: {payment.reference_number}
                </span>
              )}
            </div>
            {payment.notes && (
              <p className="text-[11px] text-slate-500 italic mt-1.5 border-t border-slate-200/60 pt-1.5">
                {payment.notes}
              </p>
            )}
          </div>

          {/* Account Balance Summary if applicable */}
          {totalChargesPaise > 0 && (
            <div className="border border-slate-200 rounded-lg p-2.5 my-3 space-y-1 text-slate-600 text-[11px]">
              <div className="flex justify-between">
                <span>{isMarathi ? 'अंदाजे एकूण शुल्क' : 'Total Charges'}:</span>
                <span className="font-mono font-semibold">₹{(totalChargesPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>{isMarathi ? 'एकूण जमा रक्कम' : 'Total Payments'}:</span>
                <span className="font-mono font-bold">₹{(totalPaidPaise / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1">
                <span>{isMarathi ? 'शिल्लक देय रक्कम' : 'Balance Due'}:</span>
                <span className={`font-mono ${balanceDuePaise > 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  ₹{balanceDueRupees.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center text-[10px] text-slate-400 mt-4 border-t border-slate-200 pt-2">
            <p>{isMarathi ? 'मुक्कामासाठी धन्यवाद!' : 'Thank you for your visit!'}</p>
            <p className="mt-0.5 font-mono">
              {isMarathi ? 'संगणकीय पावती. सहीची आवश्यकता नाही.' : 'Computer generated receipt. Valid without signature.'}
            </p>
          </div>
        </div>

        {/* Modal footer close button (hidden on print) */}
        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {isMarathi ? 'बंद करा' : 'Close'}
          </Button>
        </div>
      </div>

      {/* Embedded WhatsApp Share Dialog */}
      {isWhatsAppOpen && (
        <WhatsAppShareDialog
          isOpen={isWhatsAppOpen}
          onClose={() => setIsWhatsAppOpen(false)}
          data={whatsAppData}
        />
      )}
    </Modal>
  );
};
