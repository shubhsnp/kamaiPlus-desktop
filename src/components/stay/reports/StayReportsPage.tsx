'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StayDatePicker } from '../ui/StayDatePicker';
import { DailyCollectionReport } from './DailyCollectionReport';
import { OccupancyReport } from './OccupancyReport';
import { db } from '@/lib/db';
import type { Booking, StayPayment } from '@/lib/stay/types';
import { BarChart3, Printer, Calendar, RefreshCw, FileText } from 'lucide-react';

export const StayReportsPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [activeTab, setActiveTab] = useState<'collection' | 'occupancy' | 'bookings' | 'payments'>('collection');
  
  // Date filter: defaults to today YYYY-MM-DD
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Data for Bookings / Payments tabs
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<StayPayment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadTabData = useCallback(async () => {
    if (activeTab === 'bookings') {
      setIsLoading(true);
      try {
        const list = await db.stay_bookings
          .where('business_id')
          .equals(businessId)
          .and((b) => b.check_in_date <= selectedDate && b.check_out_date >= selectedDate)
          .toArray();
        setBookings(list);
      } finally {
        setIsLoading(false);
      }
    } else if (activeTab === 'payments') {
      setIsLoading(true);
      try {
        const list = await db.stay_payments
          .where('business_id')
          .equals(businessId)
          .toArray();
        setPayments(list.filter((p) => p.paid_at.startsWith(selectedDate)));
      } finally {
        setIsLoading(false);
      }
    }
  }, [activeTab, selectedDate, businessId]);

  useEffect(() => {
    loadTabData();
  }, [loadTabData]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-600" />
            <span>{isMarathi ? 'लॉज अहवाल आणि जमा हिशेब (Reports)' : 'Stay & Lodge Reports'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'दैनिक जमा, खोली वापर दर (Occupancy), बुकिंग आणि पेमेंट संग्रह'
              : 'Daily collections, occupancy rates, bookings overview and payment receipts'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTabData}
            isLoading={isLoading}
            className="flex items-center gap-1.5 min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-1.5 min-h-[38px] font-bold"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'प्रिंट करा (Print)' : 'Print Report'}</span>
          </Button>
        </div>
      </div>

      {/* Date Filter & Tab Switcher Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('collection')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'collection'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? '१. दैनिक जमा (Collection)' : 'Daily Collection'}
          </button>

          <button
            onClick={() => setActiveTab('occupancy')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'occupancy'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? '२. खोली वापर (Occupancy)' : 'Occupancy'}
          </button>

          <button
            onClick={() => setActiveTab('bookings')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'bookings'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? '३. सर्व बुकिंग (Bookings)' : 'Bookings List'}
          </button>

          <button
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              activeTab === 'payments'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? '४. पेमेंट नोंदी (Payments)' : 'Payment Logs'}
          </button>
        </div>

        {/* Date Filter with StayDatePicker */}
        <div className="w-full sm:w-56">
          <StayDatePicker
            value={selectedDate}
            onChange={setSelectedDate}
            showPresets={true}
          />
        </div>
      </div>

      {/* Report Content Panels */}
      <div>
        {activeTab === 'collection' && (
          <DailyCollectionReport businessId={businessId} selectedDate={selectedDate} />
        )}

        {activeTab === 'occupancy' && (
          <OccupancyReport businessId={businessId} selectedDate={selectedDate} />
        )}

        {activeTab === 'bookings' && (
          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              {isMarathi ? `तारीख ${selectedDate} चे सक्रिय बुकिंग` : `Active Bookings on ${selectedDate}`} ({bookings.length})
            </h2>
            {isLoading ? (
              <p className="text-xs text-slate-400 py-6 text-center">{isMarathi ? 'लोड करत आहे...' : 'Loading...'}</p>
            ) : bookings.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">{isMarathi ? 'या तारखेसाठी कोणतेही बुकिंग नाही' : 'No bookings for this date.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-400 text-[11px] font-bold">
                      <th className="py-2 px-3">Ref</th>
                      <th className="py-2 px-3">Dates</th>
                      <th className="py-2 px-3">Rate</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {bookings.map((b) => (
                      <tr key={b.id}>
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">{b.booking_reference}</td>
                        <td className="py-2 px-3">{b.check_in_date} → {b.check_out_date}</td>
                        <td className="py-2 px-3 font-mono">₹{(b.agreed_rate_paise / 100).toFixed(0)}</td>
                        <td className="py-2 px-3 uppercase text-[10px] font-bold">{b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'payments' && (
          <Card className="p-4 border-slate-200 dark:border-slate-800">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">
              {isMarathi ? `तारीख ${selectedDate} च्या पेमेंट नोंदी` : `Payment Receipts on ${selectedDate}`} ({payments.length})
            </h2>
            {isLoading ? (
              <p className="text-xs text-slate-400 py-6 text-center">{isMarathi ? 'लोड करत आहे...' : 'Loading...'}</p>
            ) : payments.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">{isMarathi ? 'या तारखेसाठी कोणत्याही पेमेंट नोंदी नाहीत' : 'No payments recorded for this date.'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b text-slate-400 text-[11px] font-bold">
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Mode</th>
                      <th className="py-2 px-3">Reference</th>
                      <th className="py-2 px-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-mono text-slate-500">{p.paid_at.slice(11, 16)}</td>
                        <td className="py-2 px-3 font-mono font-black text-emerald-700">₹{(p.amount_paise / 100).toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold uppercase text-[10px]">{p.payment_method}</td>
                        <td className="py-2 px-3 font-mono text-slate-400">{p.reference_number || '-'}</td>
                        <td className="py-2 px-3 text-slate-500">{p.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
