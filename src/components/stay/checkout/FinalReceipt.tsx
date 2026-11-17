'use client';

import React, { useEffect, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { generateFinalBillSummary } from '@/lib/stay/services/financialService';
import { db } from '@/lib/db';
import type { FinalBillSummary, StayPayment } from '@/lib/stay/types';
import { Printer, ArrowLeft, CheckCircle2, MessageSquare } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';
import { WhatsAppShareDialog, type WhatsAppShareData } from '../payments/WhatsAppShareDialog';

interface FinalReceiptProps {
  folioId: string;
  businessId: string;
  onClose?: () => void;
}

export const FinalReceipt: React.FC<FinalReceiptProps> = ({
  folioId,
  businessId,
  onClose,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const [summary, setSummary] = useState<FinalBillSummary | null>(null);
  const [payments, setPayments] = useState<StayPayment[]>([]);
  const [lodgeName, setLodgeName] = useState('Kamai Plus Stay');
  const [guestPhone, setGuestPhone] = useState('');
  const [format, setFormat] = useState<'standard' | 'thermal'>('standard');
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [sum, settings, business, pList, folio] = await Promise.all([
          generateFinalBillSummary(folioId, businessId),
          db.stay_settings.where('business_id').equals(businessId).first(),
          db.businesses.get(businessId),
          db.stay_payments.where('folio_id').equals(folioId).toArray(),
          db.stay_folios.get(folioId),
        ]);

        setSummary(sum);
        setPayments(pList);

        if (folio?.booking_id) {
          const booking = await db.stay_bookings.get(folio.booking_id);
          if (booking?.primary_guest_id) {
            const guest = await db.stay_guests.get(booking.primary_guest_id);
            if (guest?.phone) {
              setGuestPhone(guest.phone);
            }
          }
        }

        const stored = getStoredUser();
        const name =
          settings?.property_name ||
          business?.name ||
          stored?.shop_name ||
          stored?.business_name ||
          'Kamai Plus Stay';
        setLodgeName(name);
      } catch (err) {
        console.error('Failed to load final receipt:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [folioId, businessId]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        {isMarathi ? 'अंतिम पावती लोड करत आहे...' : 'Loading final receipt...'}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        {isMarathi ? 'पावती तपशील लोड करता आले नाही.' : 'Unable to load receipt summary.'}
      </div>
    );
  }

  const whatsAppData: WhatsAppShareData = {
    guestPhone,
    guestName: summary.guest_name,
    lodgeName,
    roomNumber: summary.room_number,
    bookingRef: summary.booking_reference,
    amountRupees: summary.total_paid_paise / 100,
    balanceDueRupees: summary.balance_due_paise / 100,
    receiptNumber: `FIN-${summary.booking_reference}`,
    receiptType: 'final',
    stayDates: {
      checkIn: summary.check_in_date,
      checkOut: summary.check_out_date,
      nights: summary.nights,
    },
  };

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      {/* Top action bar - hidden during print */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800 print:hidden">
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" />
            <span>{isMarathi ? 'मागे' : 'Back'}</span>
          </Button>
        )}

        {/* Format Selector Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setFormat('standard')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              format === 'standard'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isMarathi ? 'मानक (A4)' : 'Standard (A4)'}
          </button>
          <button
            type="button"
            onClick={() => setFormat('thermal')}
            className={`px-3 py-1 rounded-md font-bold transition-all ${
              format === 'thermal'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isMarathi ? 'थर्मल (80mm)' : 'Thermal (80mm)'}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsWhatsAppOpen(true)}
            className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
          >
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            <span>{isMarathi ? 'व्हॉट्सअ‍ॅप' : 'WhatsApp'}</span>
          </Button>

          <Button
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

      {/* Printable Paper View */}
      <div
        className={`bg-white border border-slate-300 rounded-xl p-6 sm:p-8 shadow-sm print:border-none print:shadow-none print:p-0 mx-auto ${
          format === 'thermal' ? 'max-w-[340px] text-xs font-mono p-4' : 'text-xs'
        }`}
      >
        {/* Header */}
        <div className="text-center border-b border-slate-300 pb-4 mb-4">
          <h1 className="text-xl font-black text-slate-900 uppercase tracking-wide">
            {lodgeName}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi ? 'अंतिम बिल व चेक-आउट पावती' : 'Guest Check-out Receipt & Final Bill'}
          </p>
          <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'चेक-आउट पूर्ण' : 'Check-out Complete'}</span>
          </div>
        </div>

        {/* Bill Metadata Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-6 border-b border-slate-200 pb-4">
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">
              {isMarathi ? 'बुकिंग संदर्भ' : 'Booking Ref'}:
            </span>
            <span className="font-mono font-bold text-slate-900">{summary.booking_reference}</span>
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[10px] uppercase">
              {isMarathi ? 'तारीख व वेळ' : 'Date & Time'}:
            </span>
            <span className="font-semibold text-slate-800">
              {summary.generated_at.replace('T', ' ').slice(0, 16)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[10px] uppercase">
              {isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name'}:
            </span>
            <span className="font-bold text-slate-900 text-sm">{summary.guest_name}</span>
            {guestPhone && <span className="block text-[11px] font-mono text-slate-500">{guestPhone}</span>}
          </div>
          <div className="text-right">
            <span className="text-slate-500 block text-[10px] uppercase">
              {isMarathi ? 'खोली क्रमांक' : 'Room Number'}:
            </span>
            <span className="font-bold text-slate-900">Room {summary.room_number}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 block text-[10px] uppercase">
              {isMarathi ? 'मुक्काम कालावधी' : 'Stay Duration'}:
            </span>
            <span className="text-slate-800 font-medium">
              {summary.check_in_date} → {summary.check_out_date} ({summary.nights}{' '}
              {isMarathi ? 'रात्री' : 'Night(s)'})
            </span>
          </div>
        </div>

        {/* Itemized Charges Table */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            {isMarathi ? 'आकारणी तपशील' : 'Itemized Charges'}
          </h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-slate-600">
                <th className="py-2 text-left font-semibold">{isMarathi ? 'तपशील' : 'Description'}</th>
                <th className="py-2 text-right font-semibold">{isMarathi ? 'रक्कम (₹)' : 'Amount (₹)'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.lines.map((line, idx) => (
                <tr
                  key={idx}
                  className={`py-1.5 ${
                    line.is_total
                      ? 'font-black border-t border-slate-400 text-slate-900 text-sm'
                      : line.is_subtotal
                      ? 'font-bold border-t border-slate-200 text-slate-800'
                      : 'text-slate-700'
                  }`}
                >
                  <td className="py-1.5">{line.label}</td>
                  <td className="py-1.5 text-right font-mono">
                    {line.amount_paise < 0 ? '-' : ''}₹{(Math.abs(line.amount_paise) / 100).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payments Summary */}
        <div className="mb-6 border-t border-slate-200 pt-4">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            {isMarathi ? 'प्राप्त पेमेंट्सचा सारांश' : 'Payments Summary'}
          </h2>
          {payments.length === 0 ? (
            <p className="text-xs text-slate-400 italic">
              {isMarathi ? 'कोणतेही पेमेंट नोंदवले नाही.' : 'No payments recorded.'}
            </p>
          ) : (
            <div className="space-y-1.5 text-xs">
              {payments.map((p) => (
                <div key={p.id} className="flex justify-between text-slate-700">
                  <span>
                    {p.paid_at.slice(0, 10)} - <span className="uppercase font-semibold">{p.payment_method}</span>
                    {p.reference_number ? ` (${p.reference_number})` : ''}
                    {p.is_advance ? (isMarathi ? ' [अ‍ॅडव्हान्स]' : ' [Advance]') : ''}
                    {p.is_refund ? (isMarathi ? ' [रिफंड]' : ' [Refund]') : ''}
                  </span>
                  <span className={`font-semibold font-mono ${p.is_refund ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {p.is_refund ? '-' : ''}₹{(p.amount_paise / 100).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Final Financial Totals */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between font-bold text-slate-700">
            <span>{isMarathi ? 'एकूण देय रक्कम' : 'Total Charged'}:</span>
            <span className="font-mono">₹{(summary.grand_total_paise / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-emerald-700">
            <span>{isMarathi ? 'एकूण प्राप्त रक्कम' : 'Total Paid'}:</span>
            <span className="font-mono">₹{(summary.total_paid_paise / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-black text-slate-900 text-sm border-t border-slate-300 pt-2">
            <span>{isMarathi ? 'बाकी शिल्लक रक्कम' : 'Balance Due'}:</span>
            <span className={`font-mono ${summary.balance_due_paise > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              ₹{(summary.balance_due_paise / 100).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center text-[11px] text-slate-400 mt-8 border-t border-slate-200 pt-3">
          <p>{isMarathi ? 'मुक्कामासाठी धन्यवाद!' : 'Thank you for staying with us!'}</p>
          <p className="mt-0.5 font-mono text-[10px]">
            {isMarathi ? 'संगणकीय पावती. सहीची आवश्यकता नाही.' : 'Computer generated receipt. Valid without signature.'}
          </p>
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
    </div>
  );
};
