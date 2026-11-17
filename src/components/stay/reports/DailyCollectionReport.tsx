'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db } from '@/lib/db';
import type { StayPayment, Booking, Guest } from '@/lib/stay/types';
import { IndianRupee, RefreshCw } from 'lucide-react';

interface DailyCollectionReportProps {
  businessId: string;
  selectedDate: string; // YYYY-MM-DD
}

interface PaymentRow {
  payment: StayPayment;
  bookingRef?: string;
  guestName?: string;
}

export const DailyCollectionReport: React.FC<DailyCollectionReportProps> = ({
  businessId,
  selectedDate,
}) => {
  const { t } = useTranslation();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadPayments() {
      try {
        setIsLoading(true);
        // Payments on selectedDate
        const allPayments = await db.stay_payments
          .where('business_id')
          .equals(businessId)
          .toArray();

        const dayPayments = allPayments.filter((p) => p.paid_at.startsWith(selectedDate));

        const rows: PaymentRow[] = await Promise.all(
          dayPayments.map(async (p) => {
            const booking = await db.stay_bookings.get(p.booking_id);
            let guestName = 'Walk-in';
            if (booking) {
              const guest = await db.stay_guests.get(booking.primary_guest_id);
              if (guest) guestName = guest.name;
            }
            return {
              payment: p,
              bookingRef: booking?.booking_reference,
              guestName,
            };
          })
        );

        setPayments(rows);
      } catch (err) {
        console.error('Failed to load daily collection report:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPayments();
  }, [businessId, selectedDate]);

  // Group by payment method
  const methodTotals: Record<string, { count: number; totalPaise: number }> = {};
  let grandTotalPaise = 0;

  payments.forEach(({ payment }) => {
    const m = payment.payment_method.toLowerCase();
    if (!methodTotals[m]) {
      methodTotals[m] = { count: 0, totalPaise: 0 };
    }
    const signedAmount = payment.is_refund ? -payment.amount_paise : payment.amount_paise;
    methodTotals[m].count += 1;
    methodTotals[m].totalPaise += signedAmount;
    grandTotalPaise += signedAmount;
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
        {t('Loading collection data...')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Grouped by Method Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {['cash', 'upi', 'card', 'other'].map((method) => {
          const stats = methodTotals[method] || { count: 0, totalPaise: 0 };
          return (
            <Card key={method} className="bg-white border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                {t(method.toUpperCase())}
              </span>
              <span className="text-lg font-black text-slate-900 block mt-1">
                ₹{(stats.totalPaise / 100).toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                {stats.count} {t('transaction(s)')}
              </span>
            </Card>
          );
        })}
      </div>

      {/* Itemized Transactions Table */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-slate-900">
            {t('Daily Collection')} — {selectedDate}
          </CardTitle>
          <div className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">
            {t('Total')}: ₹{(grandTotalPaise / 100).toFixed(2)}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 border-y border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{t('Time')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Guest / Booking Ref')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Payment Method')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Reference / Note')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{t('Amount (₹)')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                    {t('No payments received on this date.')}
                  </td>
                </tr>
              ) : (
                payments.map(({ payment, bookingRef, guestName }) => (
                  <tr key={payment.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 text-slate-600">
                      {payment.paid_at.slice(11, 16)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="font-bold text-slate-900 block">{guestName}</span>
                      <span className="font-mono text-[10px] text-slate-400">{bookingRef}</span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold uppercase text-slate-700">
                      {payment.payment_method}
                      {payment.is_advance ? (
                        <span className="ml-1 text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded">
                          Advance
                        </span>
                      ) : null}
                      {payment.is_refund ? (
                        <span className="ml-1 text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          Refund
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {payment.reference_number || payment.notes || '-'}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        payment.is_refund ? 'text-rose-600' : 'text-emerald-700'
                      }`}
                    >
                      {payment.is_refund ? '-' : ''}₹{(payment.amount_paise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {payments.length > 0 && (
              <tfoot className="bg-slate-50 font-black text-slate-900 border-t border-slate-300">
                <tr>
                  <td colSpan={4} className="py-3 px-4 text-right uppercase text-[11px] tracking-wider">
                    {t('Grand Total Collected')}:
                  </td>
                  <td className="py-3 px-4 text-right text-sm text-emerald-700">
                    ₹{(grandTotalPaise / 100).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
