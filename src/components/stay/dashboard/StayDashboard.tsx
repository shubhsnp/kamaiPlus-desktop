'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import { checkIn } from '@/lib/stay/services/bookingService';
import type { Room, RoomType, Booking, Guest, Folio } from '@/lib/stay/types';
import {
  BedDouble,
  DoorOpen,
  CalendarCheck,
  CreditCard,
  Sparkles,
  Users,
  ArrowRight,
  RefreshCw,
  Plus,
  Clock,
  TrendingUp,
  AlertCircle,
  Building2,
  Calendar,
  Layers,
  Receipt,
  CheckCircle2,
  Phone
} from 'lucide-react';
import { formatINRCompact } from '@/lib/utils';
import { NewBookingDialog } from '../bookings/NewBookingDialog';
import { CheckOutWizard } from '../checkout/CheckOutWizard';
import { StayStatusBadge } from '../ui/StayStatusBadge';

export const StayDashboard: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [folios, setFolios] = useState<Folio[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Dialogs
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState<'walkin' | 'advance'>('walkin');
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allRooms, allTypes, allBookings, allGuests, openFolios] = await Promise.all([
        roomRepository.findAll(businessId, true),
        roomTypeRepository.findAll(businessId, true),
        bookingRepository.findAll(businessId),
        guestRepository.findAll(businessId),
        folioRepository.findByStatus(businessId, 'open'),
      ]);

      setRooms(allRooms);
      setRoomTypes(allTypes);
      setBookings(allBookings);

      const gMap: Record<string, Guest> = {};
      allGuests.forEach((g) => (gMap[g.id] = g));
      setGuests(gMap);

      setFolios(openFolios);
    } catch (err) {
      console.error('Failed to load stay dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  // Room metrics
  const roomMetrics = useMemo(() => {
    const total = rooms.length;
    let available = 0;
    let occupied = 0;
    let reserved = 0;
    let cleaning = 0;
    let maintenance = 0;

    rooms.forEach((r) => {
      switch (r.status) {
        case 'available':
          available++;
          break;
        case 'occupied':
          occupied++;
          break;
        case 'reserved':
          reserved++;
          break;
        case 'cleaning':
          cleaning++;
          break;
        case 'maintenance':
        case 'out_of_service':
          maintenance++;
          break;
      }
    });

    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return {
      total,
      available,
      occupied,
      reserved,
      cleaning,
      maintenance,
      occupancyRate,
    };
  }, [rooms]);

  // Today's arrivals and departures
  const todayArrivals = useMemo(() => {
    return bookings.filter(
      (b) => b.check_in_date === todayStr && (b.status === 'confirmed' || b.status === 'tentative')
    );
  }, [bookings, todayStr]);

  const todayDepartures = useMemo(() => {
    return bookings.filter(
      (b) => b.check_out_date === todayStr && b.status === 'checked_in'
    );
  }, [bookings, todayStr]);

  // Pending payments total in paise
  const pendingPaymentsPaise = useMemo(() => {
    return folios.reduce((sum, f) => sum + Math.max(0, f.balance_paise), 0);
  }, [folios]);

  // Quick Check-in action from Dashboard
  const handleQuickArrivalCheckIn = async (b: Booking) => {
    if (!b.room_id) {
      // Open booking in check-in page if unallocated
      window.location.href = `/stay/checkin?bookingId=${b.id}`;
      return;
    }
    try {
      await checkIn({
        bookingId: b.id,
        roomId: b.room_id,
        checkedInBy: 'Front Desk',
      });
      setToastMessage(isMarathi ? 'चेक-इन यशस्वीरित्या पूर्ण झाले!' : 'Check-in completed successfully!');
      setTimeout(() => setToastMessage(null), 3000);
      loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isMarathi ? 'लॉज डॅशबोर्ड (Lodge Dashboard)' : 'Lodge Dashboard'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isMarathi
              ? 'खोल्यांची सद्यस्थिती, आजचे चेक-इन, चेक-आउट आणि महसूल'
              : 'Real-time room occupancy, today check-ins, check-outs & front-desk operations'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            className="flex items-center gap-1.5 min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setBookingMode('walkin');
              setIsNewBookingOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 min-h-[38px] shadow-sm"
          >
            <DoorOpen className="w-4 h-4" />
            <span>{isMarathi ? '+ थेट वॉक-इन (Walk-in)' : '+ New Walk-in'}</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setBookingMode('advance');
              setIsNewBookingOpen(true);
            }}
            className="bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1.5 min-h-[38px] shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            <span>{isMarathi ? '+ अ‍ॅडव्हान्स बुकिंग' : '+ Advance Booking'}</span>
          </Button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="text-emerald-700 font-bold">×</button>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Rooms */}
        <Link href="/stay/rooms" className="block group">
          <Card className="p-3.5 border-slate-200 dark:border-slate-800 hover:border-violet-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'एकूण खोल्या' : 'Total'}</span>
              <BedDouble className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">
              {roomMetrics.total}
            </div>
            <div className="text-[10px] text-slate-400 font-medium mt-1">
              {roomTypes.length} {isMarathi ? 'प्रकार' : 'categories'}
            </div>
          </Card>
        </Link>

        {/* Available Rooms */}
        <Link href="/stay/rooms" className="block group">
          <Card className="p-3.5 border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'उपलब्ध (Free)' : 'Available'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-mono">
              {roomMetrics.available}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold mt-1">
              {roomMetrics.total > 0 ? `${Math.round((roomMetrics.available / roomMetrics.total) * 100)}% free` : '0%'}
            </div>
          </Card>
        </Link>

        {/* Occupied Rooms */}
        <Link href="/stay/bookings" className="block group">
          <Card className="p-3.5 border-rose-200 bg-rose-50/40 dark:bg-rose-950/20 hover:border-rose-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'व्यापलेल्या' : 'Occupied'}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            </div>
            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">
              {roomMetrics.occupied}
            </div>
            <div className="text-[10px] text-rose-600 font-bold mt-1">
              {roomMetrics.occupancyRate}% {isMarathi ? 'ऑक्युपन्सी' : 'Occupancy'}
            </div>
          </Card>
        </Link>

        {/* Reserved */}
        <Link href="/stay/bookings" className="block group">
          <Card className="p-3.5 border-amber-200 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'राखीव' : 'Reserved'}</span>
              <CalendarCheck className="w-4 h-4 text-amber-600" />
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400 font-mono">
              {roomMetrics.reserved}
            </div>
            <div className="text-[10px] text-amber-600 font-medium mt-1">
              {isMarathi ? 'पुढील चेक-इन' : 'Bookings'}
            </div>
          </Card>
        </Link>

        {/* Needs Cleaning */}
        <Link href="/stay/housekeeping" className="block group">
          <Card className="p-3.5 border-sky-200 bg-sky-50/40 dark:bg-sky-950/20 hover:border-sky-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-sky-800 dark:text-sky-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'स्वच्छता' : 'Cleaning'}</span>
              <Sparkles className="w-4 h-4 text-sky-600" />
            </div>
            <div className="text-2xl font-black text-sky-700 dark:text-sky-400 font-mono">
              {roomMetrics.cleaning}
            </div>
            <div className="text-[10px] text-sky-600 font-bold mt-1">
              {isMarathi ? 'हाउसकीपिंग बोर्ड →' : 'Housekeeping →'}
            </div>
          </Card>
        </Link>

        {/* Pending Dues */}
        <Link href="/stay/reports" className="block group">
          <Card className="p-3.5 border-violet-200 bg-violet-50/40 dark:bg-violet-950/20 hover:border-violet-500 transition shadow-2xs group-hover:shadow-md">
            <div className="flex items-center justify-between text-violet-800 dark:text-violet-300 text-[11px] font-bold uppercase tracking-wider mb-1">
              <span>{isMarathi ? 'बाकी देणी' : 'Pending Dues'}</span>
              <CreditCard className="w-4 h-4 text-violet-600" />
            </div>
            <div className="text-xl font-black text-violet-700 dark:text-violet-400 font-mono">
              ₹{(pendingPaymentsPaise / 100).toFixed(0)}
            </div>
            <div className="text-[10px] text-violet-600 font-medium mt-1">
              {folios.length} {isMarathi ? 'उघडी बिले' : 'open folios'}
            </div>
          </Card>
        </Link>
      </div>

      {/* Operational Today Rows: Arrivals & Departures */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Expected Arrivals */}
        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <DoorOpen className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                {isMarathi ? 'आजचे अपेक्षित चेक-इन' : "Today's Arrivals"} ({todayArrivals.length})
              </h2>
            </div>
            <Link href="/stay/checkin" className="text-xs text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1">
              <span>{isMarathi ? 'सर्व पहा' : 'View Desk'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
            {todayArrivals.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                {isMarathi ? 'आज कोणतेही चेक-इन प्रलंबित नाही' : 'No arrivals pending for today'}
              </div>
            ) : (
              todayArrivals.slice(0, 5).map((b) => {
                const guest = guests[b.primary_guest_id];
                const room = b.room_id ? rooms.find((r) => r.id === b.room_id) : null;
                return (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {guest?.name || 'Guest'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {b.booking_reference} · {room ? `Room ${room.number}` : 'Room unassigned'}
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleQuickArrivalCheckIn(b)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold min-h-[30px] px-2.5"
                    >
                      <DoorOpen className="w-3.5 h-3.5 mr-1" />
                      <span>{isMarathi ? 'चेक-इन' : 'Check-in'}</span>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Today's Expected Departures */}
        <Card className="p-4 border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-violet-600" />
              <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                {isMarathi ? 'आजचे अपेक्षित चेक-आउट' : "Today's Departures"} ({todayDepartures.length})
              </h2>
            </div>
            <Link href="/stay/checkout" className="text-xs text-violet-600 hover:text-violet-800 font-bold flex items-center gap-1">
              <span>{isMarathi ? 'सर्व पहा' : 'View Desk'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
            {todayDepartures.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">
                {isMarathi ? 'आज कोणतेही चेक-आउट बाकी नाही' : 'No departures scheduled for today'}
              </div>
            ) : (
              todayDepartures.slice(0, 5).map((b) => {
                const guest = guests[b.primary_guest_id];
                const room = b.room_id ? rooms.find((r) => r.id === b.room_id) : null;
                return (
                  <div key={b.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-xs text-slate-900 dark:text-slate-100">
                        {guest?.name || 'Guest'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {room ? `Room ${room.number}` : ''} · ₹{(b.agreed_rate_paise / 100).toFixed(0)}/n
                      </div>
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setCheckoutBooking(b)}
                      className="bg-violet-100 hover:bg-violet-200 text-violet-900 text-xs font-bold min-h-[30px] px-2.5"
                    >
                      <Receipt className="w-3.5 h-3.5 mr-1" />
                      <span>{isMarathi ? 'बिल व चेक-आउट' : 'Bill & Checkout'}</span>
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* New Booking Dialog */}
      <NewBookingDialog
        businessId={businessId}
        isOpen={isNewBookingOpen}
        initialMode={bookingMode}
        onClose={() => setIsNewBookingOpen(false)}
        onSuccess={() => {
          loadData();
          setToastMessage(isMarathi ? 'बुकिंग यशस्वीरित्या जतन झाले!' : 'Reservation saved successfully!');
          setTimeout(() => setToastMessage(null), 3000);
        }}
      />

      {/* Checkout Wizard */}
      {checkoutBooking && (
        <CheckOutWizard
          isOpen={Boolean(checkoutBooking)}
          onClose={() => setCheckoutBooking(null)}
          booking={checkoutBooking}
          businessId={businessId}
          onSuccess={() => {
            setCheckoutBooking(null);
            loadData();
            setToastMessage(isMarathi ? 'चेक-आउट पूर्ण झाले आणि खोली साफसफाईसाठी पाठवली!' : 'Checkout complete!');
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      )}
    </div>
  );
};
