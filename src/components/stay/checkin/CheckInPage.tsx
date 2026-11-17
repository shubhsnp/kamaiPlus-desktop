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
import type { Booking, Guest, Room, RoomType } from '@/lib/stay/types';
import { CheckInWizard } from './CheckInWizard';
import { NewBookingDialog } from '../bookings/NewBookingDialog';
import { 
  DoorOpen, 
  Sparkles, 
  RefreshCw, 
  User, 
  Calendar, 
  BedDouble, 
  Clock, 
  CheckCircle2, 
  Plus
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export const CheckInPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';
  const searchParams = useSearchParams();

  const queryBookingId = searchParams.get('bookingId') || undefined;
  const queryRoomId = searchParams.get('roomId') || undefined;

  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [rooms, setRooms] = useState<Record<string, Room>>({});
  const [roomTypes, setRoomTypes] = useState<Record<string, RoomType>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Wizard state
  const [isWizardOpen, setIsWizardOpen] = useState(Boolean(queryBookingId || queryRoomId));
  const [activeBookingId, setActiveBookingId] = useState<string | undefined>(queryBookingId);
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(queryRoomId);

  // Walk-in Dialog state
  const [isWalkinOpen, setIsWalkinOpen] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allBookings, allGuests, allRooms, allTypes] = await Promise.all([
        bookingRepository.findByStatus(businessId, 'confirmed'),
        guestRepository.findAll(businessId),
        roomRepository.findAll(businessId, true),
        roomTypeRepository.findAll(businessId, true),
      ]);

      setConfirmedBookings(allBookings);

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
      console.error('Failed to load checkin data', err);
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

  // Bookings due today
  const todaysArrivals = useMemo(() => {
    return confirmedBookings.filter((b) => b.check_in_date === todayStr);
  }, [confirmedBookings, todayStr]);

  // Other upcoming confirmed bookings
  const otherArrivals = useMemo(() => {
    return confirmedBookings.filter((b) => b.check_in_date !== todayStr);
  }, [confirmedBookings, todayStr]);

  const handleOpenWizard = (bookingId?: string, roomId?: string) => {
    setActiveBookingId(bookingId);
    setActiveRoomId(roomId);
    setIsWizardOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {isMarathi ? 'चेक-इन डेस्क (Check-in Desk)' : 'Check-in Desk'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {isMarathi
              ? 'पाहुण्यांचे स्वागत, खोली वाटप आणि थेट वॉक-इन चेक-इन'
              : 'Guest arrivals, instant key allocation and walk-in check-in'}
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
            onClick={() => setIsWalkinOpen(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white min-h-[42px] px-4 font-black text-xs shadow-xs"
          >
            <DoorOpen className="w-4 h-4" />
            <span>+ {isMarathi ? 'थेट वॉक-इन चेक-इन' : 'Walk-in Check-in'}</span>
          </Button>
        </div>
      </div>

      {/* Due Today Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>{isMarathi ? 'आज अपेक्षित चेक-इन (Due Today)' : 'Expected Check-ins Today'} ({todaysArrivals.length})</span>
        </div>

        {todaysArrivals.length === 0 ? (
          <Card className="p-6 text-center border-dashed">
            <p className="text-xs text-slate-400 font-medium">
              {isMarathi ? 'आजचे कोणतेही आगाऊ बुकिंग प्रलंबित नाही' : 'No advance bookings scheduled for check-in today.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {todaysArrivals.map((b) => {
              const guest = guests[b.primary_guest_id];
              const room = b.room_id ? rooms[b.room_id] : null;
              const rt = roomTypes[b.room_type_id];

              return (
                <Card key={b.id} className="p-4 border-emerald-200 bg-emerald-50/20 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-black text-slate-900">{b.booking_reference}</span>
                        <h3 className="font-bold text-sm text-slate-900 mt-0.5">{guest?.name || 'Guest'}</h3>
                        <p className="text-xs text-slate-500 font-mono">{guest?.phone || ''}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {isMarathi ? 'आजचे चेक-इन' : 'Today'}
                      </span>
                    </div>

                    <div className="mt-3 pt-2 border-t border-emerald-100 text-xs space-y-1 text-slate-600">
                      <div className="flex justify-between">
                        <span>{isMarathi ? 'प्रकार' : 'Category'}:</span>
                        <span className="font-bold text-slate-800">{rt?.name || 'Standard'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{isMarathi ? 'खोली' : 'Room'}:</span>
                        <span className="font-bold text-slate-800">{room ? `Room ${room.number}` : (isMarathi ? 'वाटप बाकी' : 'Unassigned')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{isMarathi ? 'दर' : 'Tariff'}:</span>
                        <span className="font-bold font-mono text-slate-900">₹{(b.agreed_rate_paise / 100).toFixed(0)}/n</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleOpenWizard(b.id, b.room_id)}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white min-h-[36px] font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <DoorOpen className="w-3.5 h-3.5" />
                    <span>{isMarathi ? 'आता चेक-इन करा' : 'Check-in Guest Now'}</span>
                  </Button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Other Upcoming Arrivals Section */}
      {otherArrivals.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-600">
            <Calendar className="w-4 h-4 text-violet-600" />
            <span>{isMarathi ? 'इतर आरक्षित पाहुणे (Upcoming Arrivals)' : 'Upcoming Reservations'} ({otherArrivals.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {otherArrivals.map((b) => {
              const guest = guests[b.primary_guest_id];
              const room = b.room_id ? rooms[b.room_id] : null;
              const rt = roomTypes[b.room_type_id];

              return (
                <Card key={b.id} className="p-4 border-slate-200 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-500">{b.booking_reference}</span>
                        <h3 className="font-bold text-sm text-slate-900">{guest?.name || 'Guest'}</h3>
                        <p className="text-xs text-slate-400 font-mono">{b.check_in_date} → {b.check_out_date}</p>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-600">
                      <span>{rt?.name || 'Standard'}</span>
                      {room && <span className="ml-1 font-bold">· Room {room.number}</span>}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenWizard(b.id, b.room_id)}
                    className="w-full min-h-[34px] font-bold text-xs"
                  >
                    <span>{isMarathi ? 'लवकर चेक-इन करा (Early Check-in)' : 'Early Check-in'}</span>
                  </Button>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Check-In Wizard */}
      {isWizardOpen && (
        <CheckInWizard
          businessId={businessId}
          isOpen={isWizardOpen}
          onClose={() => {
            setIsWizardOpen(false);
            setActiveBookingId(undefined);
            setActiveRoomId(undefined);
          }}
          onSuccess={() => {
            setIsWizardOpen(false);
            loadData();
          }}
          initialBookingId={activeBookingId}
          initialRoomId={activeRoomId}
        />
      )}

      {/* New Walk-in Dialog */}
      {isWalkinOpen && (
        <NewBookingDialog
          businessId={businessId}
          isOpen={isWalkinOpen}
          initialMode="walkin"
          onClose={() => setIsWalkinOpen(false)}
          onSuccess={() => {
            setIsWalkinOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
};
