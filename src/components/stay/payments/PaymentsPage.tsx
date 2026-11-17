'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { db } from '@/lib/db';
import type { Booking, Guest, Room, Folio, StayPayment } from '@/lib/stay/types';
import { CheckOutWizard } from '../checkout/CheckOutWizard';
import { PaymentReceiptModal } from './PaymentReceiptModal';
import { WhatsAppShareDialog, type WhatsAppShareData } from './WhatsAppShareDialog';
import { 
  Receipt, 
  CreditCard, 
  User, 
  BedDouble, 
  Search, 
  Printer, 
  MessageSquare, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Phone
} from 'lucide-react';

interface PendingPaymentItem {
  booking: Booking;
  guest?: Guest;
  room?: Room;
  folio: Folio;
  totalChargesPaise: number;
  totalPaidPaise: number;
  balanceDuePaise: number;
}

interface PaymentHistoryItem {
  payment: StayPayment;
  booking?: Booking;
  guest?: Guest;
  room?: Room;
}

export const PaymentsPage: React.FC = () => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'received'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  const [pendingItems, setPendingItems] = useState<PendingPaymentItem[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistoryItem[]>([]);

  // Modals
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<PaymentHistoryItem | null>(null);
  const [whatsAppShareData, setWhatsAppShareData] = useState<WhatsAppShareData | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [allFolios, allBookings, allGuests, allRooms, allPayments] = await Promise.all([
        db.stay_folios.where('business_id').equals(businessId).toArray(),
        db.stay_bookings.where('business_id').equals(businessId).toArray(),
        db.stay_guests.where('business_id').equals(businessId).toArray(),
        db.rooms.where('business_id').equals(businessId).toArray(),
        db.stay_payments.where('business_id').equals(businessId).reverse().sortBy('paid_at'),
      ]);

      const bookingMap: Record<string, Booking> = {};
      allBookings.forEach((b) => (bookingMap[b.id] = b));

      const guestMap: Record<string, Guest> = {};
      allGuests.forEach((g) => (guestMap[g.id] = g));

      const roomMap: Record<string, Room> = {};
      allRooms.forEach((r) => (roomMap[r.id] = r));

      // 1. Pending Payments (Folios with balance > 0)
      const pending: PendingPaymentItem[] = [];
      allFolios.forEach((f) => {
        if (f.balance_paise > 0) {
          const b = bookingMap[f.booking_id];
          if (b && (b.status === 'checked_in' || b.status === 'confirmed' || f.status === 'credit_ledger')) {
            pending.push({
              booking: b,
              folio: f,
              guest: guestMap[b.primary_guest_id],
              room: b.room_id ? roomMap[b.room_id] : undefined,
              totalChargesPaise: f.total_charges_paise,
              totalPaidPaise: f.total_paid_paise,
              balanceDuePaise: f.balance_paise,
            });
          }
        }
      });
      // Sort pending: largest balance first
      pending.sort((a, b) => b.balanceDuePaise - a.balanceDuePaise);
      setPendingItems(pending);

      // 2. Payments History
      const history: PaymentHistoryItem[] = allPayments.map((p) => {
        const b = bookingMap[p.booking_id];
        return {
          payment: p,
          booking: b,
          guest: b ? guestMap[b.primary_guest_id] : undefined,
          room: b && b.room_id ? roomMap[b.room_id] : undefined,
        };
      });
      setPaymentHistory(history);
    } catch (err) {
      console.error('Failed to load payments data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Today's total received
  const todayStr = new Date().toISOString().slice(0, 10);
  const totalReceivedTodayPaise = useMemo(() => {
    return paymentHistory
      .filter((item) => (item.payment.paid_at || '').slice(0, 10) === todayStr && !item.payment.is_refund)
      .reduce((sum, item) => sum + item.payment.amount_paise, 0);
  }, [paymentHistory, todayStr]);

  // Total pending balance
  const totalPendingPaise = useMemo(() => {
    return pendingItems.reduce((sum, item) => sum + item.balanceDuePaise, 0);
  }, [pendingItems]);

  // Filtered pending items by search
  const filteredPending = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return pendingItems;
    return pendingItems.filter((item) => {
      const gName = (item.guest?.name || '').toLowerCase();
      const gPhone = (item.guest?.phone || '').toLowerCase();
      const rNum = (item.room?.number || '').toLowerCase();
      return gName.includes(q) || gPhone.includes(q) || rNum.includes(q);
    });
  }, [pendingItems, searchQuery]);

  // Filtered history items by search
  const filteredHistory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return paymentHistory;
    return paymentHistory.filter((item) => {
      const gName = (item.guest?.name || '').toLowerCase();
      const gPhone = (item.guest?.phone || '').toLowerCase();
      const rNum = (item.room?.number || '').toLowerCase();
      const ref = (item.payment.reference_number || '').toLowerCase();
      return gName.includes(q) || gPhone.includes(q) || rNum.includes(q) || ref.includes(q);
    });
  }, [paymentHistory, searchQuery]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-600" />
            <span>{isMarathi ? 'पेमेंट्स व हिशोब (Payments)' : 'Payments & Billing'}</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {isMarathi
              ? 'जमा झालेले पैसे, बाकी देणी, पेमेंट घ्या आणि पावती प्रिंट करा'
              : 'Track money received, view pending balance dues, collect payments & print receipts'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          isLoading={isLoading}
          className="flex items-center gap-1.5 self-start sm:self-auto min-h-[38px]"
        >
          <RefreshCw className="w-4 h-4" />
          <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
        </Button>
      </div>

      {/* 2 Big Pastel Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Money Received Today */}
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
              {isMarathi ? 'आज जमा झालेले पेमेंट (Received Today)' : 'Total Received Today'}
            </span>
            <div className="text-3xl font-black text-emerald-950 font-mono mt-1">
              ₹{(totalReceivedTodayPaise / 100).toFixed(2)}
            </div>
            <span className="text-[11px] text-emerald-700 font-medium mt-0.5 block">
              {isMarathi ? 'आजची रोख व UPI जमा' : 'Cash, UPI & Card collections today'}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Total Pending Balance */}
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">
              {isMarathi ? 'एकूण बाकी देय रक्कम (Pending Balance)' : 'Total Outstanding Dues'}
            </span>
            <div className="text-3xl font-black text-amber-950 font-mono mt-1">
              ₹{(totalPendingPaise / 100).toFixed(2)}
            </div>
            <span className="text-[11px] text-amber-700 font-medium mt-0.5 block">
              {isMarathi 
                ? `${pendingItems.length} खोल्या / पाहुण्यांकडून येणे बाकी` 
                : `${pendingItems.length} stays with pending payments`}
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Simple Search & Tab Switcher */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* 2 Simple Tabs */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="w-4 h-4 text-amber-600" />
              <span>{isMarathi ? `१. बाकी देणी (${pendingItems.length})` : `1. Remaining Payments (${pendingItems.length})`}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('received')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs font-black rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'received'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{isMarathi ? `२. जमा पावत्या (${paymentHistory.length})` : `2. Money Received (${paymentHistory.length})`}</span>
            </button>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isMarathi ? 'पाहुण्याचे नाव / फोन / खोली नंबर...' : 'Search by name, phone or room...'}
              className="w-full pl-9 pr-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>

        {/* TAB 1: Remaining Payments (Need to collect) */}
        {activeTab === 'pending' && (
          <div className="space-y-3 pt-2">
            {filteredPending.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-xs font-bold">
                {isMarathi ? 'कोणतीही बाकी देणी शिल्लक नाहीत. सर्व पेमेंट्स पूर्ण आहेत!' : 'No pending balances. All stays are fully settled!'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredPending.map((item) => (
                  <div
                    key={item.folio.id}
                    className="p-4 bg-amber-50/40 border border-amber-200 rounded-xl flex flex-col justify-between hover:border-amber-300 transition"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-lg bg-white border border-amber-200 text-amber-900 font-black font-mono flex items-center justify-center text-sm">
                            {item.room?.number || '-'}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">
                              {item.guest?.name || 'Guest'}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono block">
                              {item.guest?.phone || ''}
                            </span>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                          {item.folio.status === 'credit_ledger'
                            ? isMarathi ? 'खात्यावर नोंद' : 'Credit Ledger'
                            : isMarathi ? 'सक्रिय मुक्काम' : 'Active Stay'}
                        </span>
                      </div>

                      {/* Amounts Breakdown */}
                      <div className="grid grid-cols-3 gap-2 p-2 bg-white rounded-lg border border-amber-100 text-xs mb-3">
                        <div>
                          <span className="text-[10px] text-slate-400 block">{isMarathi ? 'एकूण बिल' : 'Total Bill'}</span>
                          <span className="font-bold font-mono text-slate-800">
                            ₹{(item.totalChargesPaise / 100).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-emerald-600 block">{isMarathi ? 'भरलेली रक्कम' : 'Paid'}</span>
                          <span className="font-bold font-mono text-emerald-700">
                            ₹{(item.totalPaidPaise / 100).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-600 font-bold block">{isMarathi ? 'बाकी रक्कम' : 'Remaining'}</span>
                          <span className="font-black font-mono text-rose-700 text-sm">
                            ₹{(item.balanceDuePaise / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action Button: Collect Payment */}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setSelectedBookingForPayment(item.booking)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 min-h-[38px] text-xs shadow-xs"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span>{isMarathi ? 'पेमेंट जमा करा / चेक-आउट' : 'Collect Payment / Check-out'}</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Money Received Today (Receipts & Collected payments) */}
        {activeTab === 'received' && (
          <div className="space-y-3 pt-2">
            {filteredHistory.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl text-slate-500 text-xs font-bold">
                {isMarathi ? 'कोणत्याही पावत्या आढळल्या नाहीत.' : 'No payment records found.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredHistory.map((item) => (
                  <div
                    key={item.payment.id}
                    className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">
                            {item.guest?.name || 'Guest'}
                          </span>
                          {item.room && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              खोली {item.room.number}
                            </span>
                          )}
                          <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            {item.payment.payment_method}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(item.payment.paid_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                          {item.payment.reference_number ? ` • UTR: ${item.payment.reference_number}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span className="font-mono font-black text-sm text-slate-900">
                        ₹{(item.payment.amount_paise / 100).toFixed(2)}
                      </span>

                      <div className="flex items-center gap-1">
                        {/* Print Receipt */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPaymentForReceipt(item)}
                          className="text-xs min-h-[32px] px-2.5 flex items-center gap-1"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isMarathi ? 'पावती' : 'Receipt'}</span>
                        </Button>

                        {/* WhatsApp Share */}
                        {item.guest?.phone && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setWhatsAppShareData({
                                guestPhone: item.guest?.phone || '',
                                guestName: item.guest?.name || 'Guest',
                                lodgeName: 'Kamai Plus Stay',
                                roomNumber: item.room?.number || '',
                                bookingRef: item.booking?.booking_reference || '',
                                amountRupees: item.payment.amount_paise / 100,
                                balanceDueRupees: 0,
                                receiptNumber: item.payment.id.slice(0, 8).toUpperCase(),
                                receiptType: item.payment.is_advance ? 'advance' : 'partial',
                                stayDates: item.booking ? {
                                  checkIn: item.booking.check_in_date,
                                  checkOut: item.booking.check_out_date,
                                  nights: 1,
                                } : undefined,
                              });
                            }}
                            className="text-xs min-h-[32px] px-2 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border-emerald-200"
                            title="WhatsApp Receipt"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Collect Payment / Checkout Wizard Dialog */}
      {selectedBookingForPayment && (
        <CheckOutWizard
          isOpen={Boolean(selectedBookingForPayment)}
          onClose={() => setSelectedBookingForPayment(null)}
          booking={selectedBookingForPayment}
          businessId={businessId}
          onSuccess={() => {
            setSelectedBookingForPayment(null);
            loadData();
          }}
        />
      )}

      {/* View & Print Payment Receipt Modal */}
      {selectedPaymentForReceipt && (
        <PaymentReceiptModal
          isOpen={Boolean(selectedPaymentForReceipt)}
          onClose={() => setSelectedPaymentForReceipt(null)}
          payment={selectedPaymentForReceipt.payment}
          booking={selectedPaymentForReceipt.booking}
          guest={selectedPaymentForReceipt.guest}
          room={selectedPaymentForReceipt.room}
          totalChargesPaise={selectedPaymentForReceipt.payment.amount_paise}
          totalPaidPaise={selectedPaymentForReceipt.payment.amount_paise}
          balanceDuePaise={0}
        />
      )}

      {/* WhatsApp Share Dialog */}
      {whatsAppShareData && (
        <WhatsAppShareDialog
          isOpen={Boolean(whatsAppShareData)}
          onClose={() => setWhatsAppShareData(null)}
          data={whatsAppShareData}
        />
      )}
    </div>
  );
};