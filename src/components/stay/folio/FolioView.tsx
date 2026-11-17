'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { db } from '@/lib/db';
import type { Folio, FolioEntry, StayPayment, Booking, Guest, Room } from '@/lib/stay/types';
import { AddChargeDialog } from './AddChargeDialog';
import { RecordPaymentDialog } from './RecordPaymentDialog';
import { PlusCircle, CreditCard, Printer, RefreshCw, ArrowLeft, RotateCcw, MessageSquare } from 'lucide-react';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal';
import { WhatsAppShareDialog, type WhatsAppShareData } from '../payments/WhatsAppShareDialog';
import { IssueRefundDialog } from '../payments/IssueRefundDialog';

interface FolioViewProps {
  folioId: string;
  businessId: string;
  onBack?: () => void;
  onPrint?: () => void;
}

export const FolioView: React.FC<FolioViewProps> = ({
  folioId,
  businessId,
  onBack,
  onPrint,
}) => {
  const { t } = useTranslation();
  const [folio, setFolio] = useState<Folio | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [entries, setEntries] = useState<FolioEntry[]>([]);
  const [payments, setPayments] = useState<StayPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialog states
  const [isAddChargeOpen, setIsAddChargeOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<StayPayment | null>(null);
  const [selectedPaymentForWhatsApp, setSelectedPaymentForWhatsApp] = useState<StayPayment | null>(null);

  const loadFolioData = useCallback(async () => {
    try {
      setIsLoading(true);
      const f = await folioRepository.findById(folioId);
      if (!f) return;
      setFolio(f);

      const [entryList, b] = await Promise.all([
        folioRepository.getEntries(businessId, folioId),
        bookingRepository.findById(f.booking_id),
      ]);
      setEntries(entryList);

      if (b) {
        setBooking(b);
        const [g, r, pList] = await Promise.all([
          db.stay_guests.get(b.primary_guest_id),
          b.room_id ? db.rooms.get(b.room_id) : Promise.resolve(undefined),
          db.stay_payments.where('folio_id').equals(folioId).toArray(),
        ]);
        if (g) setGuest(g);
        if (r) setRoom(r);
        setPayments(pList);
      }
    } catch (err) {
      console.error('Failed to load folio:', err);
    } finally {
      setIsLoading(false);
    }
  }, [folioId, businessId]);

  useEffect(() => {
    loadFolioData();
  }, [loadFolioData]);

  // Filter entries by type
  const roomCharges = entries.filter((e) => e.entry_type === 'room_charge');
  const additionalCharges = entries.filter((e) => e.entry_type === 'additional_charge');
  const discounts = entries.filter((e) => e.entry_type === 'discount');
  const taxes = entries.filter((e) => e.entry_type === 'tax');

  const totalChargedPaise = folio?.total_charges_paise ?? 0;
  const totalPaidPaise = folio?.total_paid_paise ?? 0;
  const balanceDuePaise = folio?.balance_paise ?? (totalChargedPaise - totalPaidPaise);

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        {t('Loading folio...')}
      </div>
    );
  }

  if (!folio) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>{t('Folio not found.')}</p>
        {onBack && (
          <Button variant="outline" size="sm" onClick={onBack} className="mt-4">
            {t('Go Back')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 print:p-0">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t('Guest Bill')} ({t('Folio')})</h1>
            <p className="text-xs text-slate-500">
              Ref: <span className="font-mono font-bold text-slate-700">{booking?.booking_reference || 'N/A'}</span> | 
              Status: <span className="capitalize font-semibold text-slate-800">{folio.status}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            {t('Print Receipt')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAddChargeOpen(true)}
            className="flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4 text-sky-600" />
            {t('Add Charge')}
          </Button>
          {totalPaidPaise > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRefundOpen(true)}
              className="flex items-center gap-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              {t('Issue Refund')}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsRecordPaymentOpen(true)}
            className="flex items-center gap-1.5"
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            {t('Record Payment')}
          </Button>
        </div>
      </div>

      {/* Guest & Stay Overview Card */}
      <Card className="bg-slate-50 border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">{t('Guest Name')}</span>
            <span className="font-bold text-slate-900 text-sm">{guest?.name || 'Walk-in Guest'}</span>
            <span className="text-slate-500 block">{guest?.phone || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('Room Number')}</span>
            <span className="font-bold text-slate-900 text-sm">{room ? `Room ${room.number}` : 'Unassigned'}</span>
            <span className="text-slate-500 block">{room?.floor ? `Floor ${room.floor}` : ''}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('Check-in Date')}</span>
            <span className="font-semibold text-slate-800">{booking?.check_in_date || '-'}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{t('Check-out Date')}</span>
            <span className="font-semibold text-slate-800">{booking?.check_out_date || '-'}</span>
          </div>
        </div>
      </Card>

      {/* Itemized Table Sections */}
      <div className="space-y-4">
        {/* Room Charges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">{t('Room Charges')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{t('Date')}</th>
                  <th className="py-2.5 px-4 font-semibold">{t('Description')}</th>
                  <th className="py-2.5 px-4 font-semibold text-center">{t('Nights / Qty')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{t('Rate (₹)')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{t('Amount (₹)')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roomCharges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-center text-slate-400 italic">
                      {t('No room charges posted yet.')}
                    </td>
                  </tr>
                ) : (
                  roomCharges.map((rc) => (
                    <tr key={rc.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-600">{rc.entry_date}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{rc.description}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600">{rc.quantity}</td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        ₹{(rc.unit_price_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{(rc.amount_paise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Additional Charges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">{t('Additional Charges')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{t('Date')}</th>
                  <th className="py-2.5 px-4 font-semibold">{t('Description')}</th>
                  <th className="py-2.5 px-4 font-semibold text-center">{t('Qty')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{t('Rate (₹)')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{t('Amount (₹)')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {additionalCharges.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-center text-slate-400 italic">
                      {t('No additional charges posted.')}
                    </td>
                  </tr>
                ) : (
                  additionalCharges.map((ac) => (
                    <tr key={ac.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-600">{ac.entry_date}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{ac.description}</td>
                      <td className="py-2.5 px-4 text-center text-slate-600">{ac.quantity}</td>
                      <td className="py-2.5 px-4 text-right text-slate-600">
                        ₹{(ac.unit_price_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{(ac.amount_paise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Discounts & Taxes (if any) */}
        {(discounts.length > 0 || taxes.length > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-900">{t('Discounts & Taxes')}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 border-y border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">{t('Type')}</th>
                    <th className="py-2.5 px-4 font-semibold">{t('Description')}</th>
                    <th className="py-2.5 px-4 font-semibold text-right">{t('Amount (₹)')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {discounts.map((d) => (
                    <tr key={d.id} className="text-emerald-700 bg-emerald-50/30">
                      <td className="py-2.5 px-4 font-semibold">{t('Discount')}</td>
                      <td className="py-2.5 px-4">{d.description}</td>
                      <td className="py-2.5 px-4 text-right font-bold">
                        -₹{(d.amount_paise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  {taxes.map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2.5 px-4 font-semibold text-slate-700">{t('Tax')}</td>
                      <td className="py-2.5 px-4 text-slate-700">{tx.description}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        ₹{(tx.amount_paise / 100).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Payments Received */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-slate-900">{t('Payments Received')}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-600 border-y border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">{t('Date & Time')}</th>
                  <th className="py-2.5 px-4 font-semibold">{t('Method')}</th>
                  <th className="py-2.5 px-4 font-semibold">{t('Reference / Note')}</th>
                  <th className="py-2.5 px-4 font-semibold text-right">{t('Amount (₹)')}</th>
                  <th className="py-2.5 px-4 font-semibold text-center">{t('Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 px-4 text-center text-slate-400 italic">
                      {t('No payments recorded yet.')}
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.paid_at.replace('T', ' ').slice(0, 16)}
                      </td>
                      <td className="py-2.5 px-4 font-semibold uppercase text-slate-800">
                        {p.payment_method}
                        {p.is_refund ? (
                          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800">
                            Refund
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {p.reference_number ? `Ref: ${p.reference_number}` : p.notes || '-'}
                      </td>
                      <td className={`py-2.5 px-4 text-right font-bold ${p.is_refund ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {p.is_refund ? '-' : ''}₹{(p.amount_paise / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForReceipt(p)}
                            title={t('Print Receipt')}
                            className="p-1 rounded text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedPaymentForWhatsApp(p)}
                            title={t('Share on WhatsApp')}
                            className="p-1 rounded text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Summary Box */}
      <Card className="bg-white border-2 border-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
          <div className="p-4 text-center">
            <span className="text-xs uppercase font-bold text-slate-500 block mb-1">
              {t('Total Charged')}
            </span>
            <span className="text-xl font-black text-slate-900">
              ₹{(totalChargedPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="p-4 text-center">
            <span className="text-xs uppercase font-bold text-slate-500 block mb-1">
              {t('Total Paid')}
            </span>
            <span className="text-xl font-black text-emerald-600">
              ₹{(totalPaidPaise / 100).toFixed(2)}
            </span>
          </div>

          <div className="p-4 text-center">
            <span className="text-xs uppercase font-bold text-slate-500 block mb-1">
              {t('Balance Due')}
            </span>
            <span
              className={`text-xl font-black ${
                balanceDuePaise > 0 ? 'text-rose-600' : 'text-slate-900'
              }`}
            >
              ₹{(balanceDuePaise / 100).toFixed(2)}
            </span>
          </div>
        </div>
      </Card>

      {/* Dialogs */}
      {isAddChargeOpen && (
        <AddChargeDialog
          isOpen={isAddChargeOpen}
          onClose={() => setIsAddChargeOpen(false)}
          folioId={folioId}
          businessId={businessId}
          onSuccess={loadFolioData}
        />
      )}

      {isRecordPaymentOpen && (
        <RecordPaymentDialog
          isOpen={isRecordPaymentOpen}
          onClose={() => setIsRecordPaymentOpen(false)}
          folioId={folioId}
          bookingId={folio.booking_id}
          businessId={businessId}
          balanceDuePaise={balanceDuePaise}
          onSuccess={loadFolioData}
        />
      )}

      {isRefundOpen && (
        <IssueRefundDialog
          isOpen={isRefundOpen}
          onClose={() => setIsRefundOpen(false)}
          folioId={folioId}
          bookingId={folio.booking_id}
          businessId={businessId}
          totalPaidPaise={totalPaidPaise}
          onSuccess={loadFolioData}
        />
      )}

      {selectedPaymentForReceipt && (
        <PaymentReceiptModal
          isOpen={Boolean(selectedPaymentForReceipt)}
          onClose={() => setSelectedPaymentForReceipt(null)}
          payment={selectedPaymentForReceipt}
          booking={booking || undefined}
          guest={guest || undefined}
          room={room || undefined}
          folio={folio}
          totalChargesPaise={totalChargedPaise}
          totalPaidPaise={totalPaidPaise}
          balanceDuePaise={balanceDuePaise}
        />
      )}

      {selectedPaymentForWhatsApp && (
        <WhatsAppShareDialog
          isOpen={Boolean(selectedPaymentForWhatsApp)}
          onClose={() => setSelectedPaymentForWhatsApp(null)}
          data={{
            guestPhone: guest?.phone || '',
            guestName: guest?.name || 'Guest',
            lodgeName: 'Kamai Plus Stay',
            roomNumber: room?.number,
            bookingRef: booking?.booking_reference || folio.booking_id.slice(0, 8).toUpperCase(),
            amountRupees: selectedPaymentForWhatsApp.amount_paise / 100,
            balanceDueRupees: balanceDuePaise / 100,
            receiptNumber: `REC-${selectedPaymentForWhatsApp.id.slice(0, 8).toUpperCase()}`,
            receiptType: selectedPaymentForWhatsApp.is_refund ? 'refund' : selectedPaymentForWhatsApp.is_advance ? 'advance' : 'partial',
          }}
        />
      )}
    </div>
  );
};
