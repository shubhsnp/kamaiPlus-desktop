'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { cancelReservation, checkIn } from '@/lib/stay/services/bookingService';
import type { Booking, Guest, Room, RoomType, BookingStatus } from '@/lib/stay/types';
import { NewBookingDialog } from './NewBookingDialog';
import { CheckOutWizard } from '../checkout/CheckOutWizard';
import { StayStatusBadge } from '../ui/StayStatusBadge';
import { 
  CalendarCheck, 
  Plus, 
  Search, 
  RefreshCw, 
  User, 
  BedDouble, 
  Clock, 
  DoorOpen, 
  XCircle,
  CheckCircle,
  AlertCircle,
  Receipt,
  LogOut
} from 'lucide-react';
import { useRouter } from 'next/navigation';

export const BookingsPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';
  const router = useRouter();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [roomTypes, setRoomTypes] = useState<Record<string, RoomType>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedTab, setSelectedTab] = useState<'all' | 'today' | 'checked_in' | 'upcoming' | 'checked_out'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isNewBookingOpen, setIsNewBookingOpen] = useState(false);
  const [checkoutBooking, setCheckoutBooking] = useState<Booking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [allBookings, allGuests, allRooms, allTypes] = await Promise.all([
        bookingRepository.findAll(businessId),
        guestRepository.findAll(businessId),
        roomRepository.findAll(businessId, true),
        roomTypeRepository.findAll(businessId, true),
      ]);

      // Sort bookings by created_at descending
      allBookings.sort((a, b) => b.created_at.localeCompare(a.created_at));
      setBookings(allBookings);

      const gMap: Record<string, Guest> = {};
      allGuests.forEach((g) => (gMap[g.id] = g));
      setGuests(gMap);

      const rMap: Record<string, Room> = {};
      allRooms.forEach((r) => (rMap[r.id] = r));
      setRooms(rMap);

      const tMap: Record<string, RoomType> = {};
      allTypes.forEach((t) => (tMap[t.id] = t));
      setRoomTypes(tMap);
    } catch (err) {
      console.error('Failed to load bookings', err);
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

  // Filtered bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      // Tab filter
      if (selectedTab === 'today') {
        if (b.check_in_date !== todayStr && b.check_out_date !== todayStr) return false;
      } else if (selectedTab === 'checked_in') {
        if (b.status !== 'checked_in') return false;
      } else if (selectedTab === 'upcoming') {
        if (b.check_in_date <= todayStr || b.status === 'checked_out' || b.status === 'cancelled') return false;
      } else if (selectedTab === 'checked_out') {
        if (b.status !== 'checked_out') return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const guest = guests[b.primary_guest_id];
        const matchRef = b.booking_reference.toLowerCase().includes(q);
        const matchGuest = guest && (guest.name.toLowerCase().includes(q) || guest.phone.includes(q));
        const room = b.room_id ? rooms[b.room_id] : null;
        const matchRoom = room && room.number.toLowerCase().includes(q);
        if (!matchRef && !matchGuest && !matchRoom) return false;
      }

      return true;
    });
  }, [bookings, selectedTab, searchQuery, todayStr, guests, rooms]);

  // Quick 1-click Check-in
  const handleQuickCheckIn = async (booking: Booking) => {
    if (!booking.room_id) {
      // If room is unassigned, route to check-in wizard to assign room
      router.push(`/stay/checkin?bookingId=${booking.id}`);
      return;
    }

    try {
      await checkIn({
        bookingId: booking.id,
        roomId: booking.room_id,
        checkedInBy: 'Front Desk',
      });
      setActionSuccess(isMarathi ? 'चेक-इन यशस्वीरित्या पूर्ण झाले!' : 'Check-in completed successfully!');
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete check-in');
    }
  };

  const handleCancel = async (bookingId: string) => {
    if (!window.confirm(isMarathi ? 'तुम्हाला खात्री आहे की हे बुकिंग रद्द करायचे आहे?' : 'Are you sure you want to cancel this booking?')) return;
    try {
      await cancelReservation({
        bookingId,
        reason: 'Cancelled by guest request',
      });
      setActionSuccess(isMarathi ? 'बुकिंग रद्द झाले' : 'Booking cancelled');
      setTimeout(() => setActionSuccess(null), 3000);
      loadData();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel booking');
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-violet-600" />
            <span>{isMarathi ? 'खोली बुकिंग आणि आरक्षणे (Bookings)' : 'Room Bookings & Reservations'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'सर्व वॉक-इन पाहुणे, अ‍ॅडव्हान्स बुकिंग, चेक-इन आणि चेक-आउट व्यवस्थापित करा'
              : 'Manage walk-ins, advance reservations, check-ins and check-outs in one place'}
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={() => setIsNewBookingOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-2 min-h-[38px] shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isMarathi ? '+ नवीन बुकिंग / वॉक-इन' : '+ New Booking / Walk-in'}</span>
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {actionError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-600 font-bold">×</button>
        </div>
      )}
      {actionSuccess && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 font-bold">×</button>
        </div>
      )}

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setSelectedTab('all')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              selectedTab === 'all'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? 'सर्व (All)' : 'All'} ({bookings.length})
          </button>

          <button
            onClick={() => setSelectedTab('today')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              selectedTab === 'today'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? 'आजचे (Today)' : 'Today'}
          </button>

          <button
            onClick={() => setSelectedTab('checked_in')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              selectedTab === 'checked_in'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? 'सध्याचे मुक्काम (Checked-in)' : 'Checked-in'}
          </button>

          <button
            onClick={() => setSelectedTab('upcoming')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              selectedTab === 'upcoming'
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? 'आगामी (Upcoming)' : 'Upcoming'}
          </button>

          <button
            onClick={() => setSelectedTab('checked_out')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
              selectedTab === 'checked_out'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
            }`}
          >
            {isMarathi ? 'चेक-आउट झालेले' : 'Checked-out'}
          </button>
        </div>

        {/* Search Box */}
        <div className="relative w-full md:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isMarathi ? 'पाहुणे, फोन, खोली शोधा...' : 'Search guest, phone, room...'}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-violet-600 min-h-[36px]"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
        </div>
      </div>

      {/* Bookings Table */}
      {isLoading ? (
        <div className="p-12 text-center text-sm font-semibold text-slate-500">
          {isMarathi ? 'बुकिंग लोड करत आहे...' : 'Loading bookings...'}
        </div>
      ) : filteredBookings.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <CalendarCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isMarathi ? 'कोणतेही बुकिंग सापडले नाही' : 'No bookings found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {bookings.length === 0
              ? isMarathi
                ? 'तुमचे पहिले बुकिंग नोंदवण्यासाठी खालील बटण दाबा'
                : 'Create your first guest booking to get started'
              : isMarathi
              ? 'निवडलेल्या निकषांनुसार कोणतेही बुकिंग नाही'
              : 'No bookings match your filter criteria'}
          </p>
          <Button
            variant="primary"
            size="md"
            onClick={() => setIsNewBookingOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px] px-6 font-bold"
          >
            + {isMarathi ? 'नवीन वॉक-इन / बुकिंग' : 'New Booking'}
          </Button>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">{isMarathi ? 'संदर्भ क्र.' : 'Ref No.'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'खोली व प्रकार' : 'Room & Category'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'तारखा व रात्री' : 'Dates & Nights'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'दर' : 'Tariff'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'स्थिती' : 'Status'}</th>
                  <th className="py-3 px-4 text-right">{isMarathi ? 'कृती (Actions)' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {filteredBookings.map((b) => {
                  const guest = guests[b.primary_guest_id];
                  const room = b.room_id ? rooms[b.room_id] : null;
                  const roomType = roomTypes[b.room_type_id];

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        {b.booking_reference}
                        {b.is_provisional && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.2 bg-amber-100 text-amber-900 rounded font-sans font-bold">
                            Offline
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {guest ? guest.name : 'Unknown Guest'}
                        </div>
                        {guest && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            {guest.phone}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {roomType?.name || 'Standard'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {room ? `${isMarathi ? 'खोली' : 'Room'} ${room.number} (Floor ${room.floor})` : isMarathi ? 'खोली अद्याप नाही' : 'Unassigned'}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                          {b.check_in_date} → {b.check_out_date}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {b.adults} {isMarathi ? 'प्रौढ' : 'Adults'} {b.children > 0 ? `· ${b.children} ${isMarathi ? 'मुले' : 'Children'}` : ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{(b.agreed_rate_paise / 100).toFixed(0)}/n
                      </td>

                      <td className="py-3 px-4">
                        <StayStatusBadge status={b.status} type="booking" />
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Confirmed Booking: 1-click Check-in */}
                          {b.status === 'confirmed' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleQuickCheckIn(b)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[32px] px-2.5 py-1 text-xs font-bold"
                            >
                              <DoorOpen className="w-3.5 h-3.5 mr-1" />
                              <span>{isMarathi ? 'चेक-इन' : 'Check-in'}</span>
                            </Button>
                          )}

                          {/* Checked-in Booking: 1-click Check-out / Bill */}
                          {b.status === 'checked_in' && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setCheckoutBooking(b)}
                              className="bg-violet-100 hover:bg-violet-200 text-violet-900 min-h-[32px] px-2.5 py-1 text-xs font-bold flex items-center gap-1"
                            >
                              <Receipt className="w-3.5 h-3.5" />
                              <span>{isMarathi ? 'बिल व चेक-आउट' : 'Bill & Checkout'}</span>
                            </Button>
                          )}

                          {/* Cancel Option */}
                          {(b.status === 'confirmed' || b.status === 'tentative') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(b.id)}
                              className="text-rose-600 hover:text-rose-800 hover:bg-rose-50 min-h-[32px] p-1.5"
                              title={isMarathi ? 'बुकिंग रद्द करा' : 'Cancel booking'}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* New Booking / Walk-in Dialog */}
      <NewBookingDialog
        businessId={businessId}
        isOpen={isNewBookingOpen}
        onClose={() => setIsNewBookingOpen(false)}
        onSuccess={() => {
          loadData();
          setActionSuccess(isMarathi ? 'नवीन बुकिंग यशस्वीरित्या जतन झाले!' : 'New reservation saved successfully!');
          setTimeout(() => setActionSuccess(null), 3000);
        }}
      />

      {/* Direct Checkout Wizard */}
      {checkoutBooking && (
        <CheckOutWizard
          isOpen={Boolean(checkoutBooking)}
          onClose={() => setCheckoutBooking(null)}
          booking={checkoutBooking}
          businessId={businessId}
          onSuccess={() => {
            setCheckoutBooking(null);
            loadData();
            setActionSuccess(isMarathi ? 'चेक-आउट यशस्वीरित्या पूर्ण झाले!' : 'Check-out completed successfully!');
            setTimeout(() => setActionSuccess(null), 3000);
          }}
        />
      )}
    </div>
  );
};
