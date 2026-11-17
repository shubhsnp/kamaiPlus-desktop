'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import type { Room, Booking, Folio, StaySettings } from '@/lib/stay/types';
import { NewBookingDialog } from '../bookings/NewBookingDialog';
import { 
  DoorOpen, 
  BedDouble, 
  CalendarCheck, 
  Receipt,
  ArrowRight
} from 'lucide-react';

export const StayDashboard: React.FC = () => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';
  const router = useRouter();
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [folios, setFolios] = useState<Folio[]>([]);
  const [propertyName, setPropertyName] = useState('Kamai Stay');
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);

  // Load real-time counts for badges
  const loadDashboardData = useCallback(async () => {
    try {
      const [allRooms, allBookings, allFolios, settings] = await Promise.all([
        db.rooms.where('business_id').equals(businessId).toArray(),
        db.stay_bookings.where('business_id').equals(businessId).toArray(),
        db.stay_folios.where('business_id').equals(businessId).toArray(),
        db.stay_settings.where('business_id').equals(businessId).first(),
      ]);

      setRooms(allRooms);
      setBookings(allBookings);
      setFolios(allFolios);

      if (settings?.property_name) {
        setPropertyName(settings.property_name);
      } else if (business?.name) {
        setPropertyName(business.name);
      }
    } catch (err) {
      console.error('Failed to load dashboard counts:', err);
    }
  }, [businessId, business]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Calculations for simple tile badges
  const availableRoomsCount = useMemo(() => {
    return rooms.filter((r) => r.status === 'available').length;
  }, [rooms]);

  const occupiedRoomsCount = useMemo(() => {
    return rooms.filter((r) => r.status === 'occupied').length;
  }, [rooms]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const todayGuestsCount = useMemo(() => {
    return bookings.filter(
      (b) => (b.check_in_date === todayStr || b.status === 'checked_in') && b.status !== 'cancelled'
    ).length;
  }, [bookings, todayStr]);

  const pendingPaymentsCount = useMemo(() => {
    return folios.filter((f) => f.balance_paise > 0).length;
  }, [folios]);

  const todayFormatted = useMemo(() => {
    return new Date().toLocaleDateString(isMarathi ? 'mr-IN' : 'en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [isMarathi]);

  return (
    <div className="min-h-[85vh] bg-white p-5 sm:p-10 flex flex-col justify-center max-w-5xl mx-auto">
      {/* Ultra Clean Header */}
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {propertyName}
          </h1>
          <p className="text-sm font-bold text-slate-500 mt-1">
            {isMarathi ? 'हॉटेल व लॉज व्यवस्थापन' : 'Lodge Management'}
          </p>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            {isMarathi ? 'आजची तारीख' : "Today's Date"}
          </span>
          <span className="text-sm sm:text-base font-bold text-slate-700">
            {todayFormatted}
          </span>
        </div>
      </div>

      {/* ONLY 4 MAIN OPTIONS: LARGE, PASTEL, NO-CLUTTER TILES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {/* TILE 1: NEW BOOKING */}
        <button
          type="button"
          onClick={() => setIsNewBookingOpen(true)}
          className="text-left p-6 sm:p-8 rounded-3xl border-2 border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70 hover:border-emerald-300 transition-all cursor-pointer flex flex-col justify-between min-h-[190px] group shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 text-emerald-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <DoorOpen className="w-7 h-7" />
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-emerald-200 text-emerald-800">
              {availableRoomsCount} {isMarathi ? 'खोल्या उपलब्ध' : 'vacant'}
            </span>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black text-emerald-950 flex items-center gap-2">
              <span>{isMarathi ? 'नवीन बुकिंग' : 'New Booking'}</span>
              <ArrowRight className="w-5 h-5 text-emerald-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-emerald-800/80 mt-1">
              {isMarathi 
                ? 'पाहुणा जोडा, उपलब्ध खोली निवडा आणि बुकिंग सेव्ह करा' 
                : 'Add a guest, select an available room & save booking'}
            </p>
          </div>
        </button>

        {/* TILE 2: ROOMS */}
        <button
          type="button"
          onClick={() => router.push('/stay/rooms')}
          className="text-left p-6 sm:p-8 rounded-3xl border-2 border-sky-200 bg-sky-50/80 hover:bg-sky-100/70 hover:border-sky-300 transition-all cursor-pointer flex flex-col justify-between min-h-[190px] group shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white border border-sky-200 text-sky-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <BedDouble className="w-7 h-7" />
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-sky-200 text-sky-800">
              {occupiedRoomsCount} {isMarathi ? 'व्यापलेल्या' : 'occupied'} • {availableRoomsCount} {isMarathi ? 'मोकळ्या' : 'vacant'}
            </span>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black text-sky-950 flex items-center gap-2">
              <span>{isMarathi ? 'खोल्या' : 'Rooms'}</span>
              <ArrowRight className="w-5 h-5 text-sky-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-sky-800/80 mt-1">
              {isMarathi 
                ? 'सर्व खोल्यांची स्थिती पाहा (मोकळी / व्यापलेली) व चेक-इन/आउट करा' 
                : 'View all rooms (available or occupied) & manage stays'}
            </p>
          </div>
        </button>

        {/* TILE 3: BOOKINGS */}
        <button
          type="button"
          onClick={() => router.push('/stay/bookings')}
          className="text-left p-6 sm:p-8 rounded-3xl border-2 border-violet-200 bg-violet-50/80 hover:bg-violet-100/70 hover:border-violet-300 transition-all cursor-pointer flex flex-col justify-between min-h-[190px] group shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white border border-violet-200 text-violet-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <CalendarCheck className="w-7 h-7" />
            </div>

            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white border border-violet-200 text-violet-800">
              {todayGuestsCount} {isMarathi ? 'आजचे पाहुणे' : 'guests today'}
            </span>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black text-violet-950 flex items-center gap-2">
              <span>{isMarathi ? 'बुकिंग्स' : 'Bookings'}</span>
              <ArrowRight className="w-5 h-5 text-violet-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-violet-800/80 mt-1">
              {isMarathi 
                ? 'आजचे पाहुणे, पुढील बुकिंग्स आणि नावाने किंवा फोनने शोधा' 
                : "Today's guests, upcoming bookings & search by name or phone"}
            </p>
          </div>
        </button>

        {/* TILE 4: PAYMENTS */}
        <button
          type="button"
          onClick={() => router.push('/stay/payments')}
          className="text-left p-6 sm:p-8 rounded-3xl border-2 border-amber-200 bg-amber-50/80 hover:bg-amber-100/70 hover:border-amber-300 transition-all cursor-pointer flex flex-col justify-between min-h-[190px] group shadow-2xs hover:shadow-sm"
        >
          <div className="flex items-start justify-between">
            <div className="w-14 h-14 rounded-2xl bg-white border border-amber-200 text-amber-700 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <Receipt className="w-7 h-7" />
            </div>

            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
              pendingPaymentsCount > 0 
                ? 'bg-amber-100 border-amber-300 text-amber-900' 
                : 'bg-white border-amber-200 text-amber-800'
            }`}>
              {pendingPaymentsCount > 0 
                ? isMarathi ? `${pendingPaymentsCount} बाकी देणी` : `${pendingPaymentsCount} pending dues`
                : isMarathi ? 'सर्व देणी पूर्ण' : 'All clear'}
            </span>
          </div>

          <div className="mt-4">
            <h2 className="text-2xl sm:text-3xl font-black text-amber-950 flex items-center gap-2">
              <span>{isMarathi ? 'पेमेंट्स' : 'Payments'}</span>
              <ArrowRight className="w-5 h-5 text-amber-600 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </h2>
            <p className="text-xs sm:text-sm font-semibold text-amber-800/80 mt-1">
              {isMarathi 
                ? 'जमा रक्कम, बाकी देणी पाहा, पेमेंट घ्या आणि पावती प्रिंट करा' 
                : 'Money received, remaining payments, collect dues & print receipts'}
            </p>
          </div>
        </button>
      </div>

      {/* 1-Click New Booking Modal */}
      <NewBookingDialog
        businessId={businessId}
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        onSuccess={() => {
          setIsNewBookingOpen(false);
          loadDashboardData();
        }}
        initialMode="walkin"
      />
    </div>
  );
};