'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StayDatePicker } from '../ui/StayDatePicker';
import { RoomCategorySelector } from '../ui/RoomCategorySelector';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { checkIn, createReservation, generateBookingReference } from '@/lib/stay/services/bookingService';
import { recordPayment } from '@/lib/stay/services/financialService';
import { calculateNights, hasOverlappingBooking } from '@/lib/stay/services/availabilityService';
import { getStayMessage } from '@/lib/stay/validationMessages';
import type { Booking, Guest, Room, RoomType, PaymentMethod, StayRecord } from '@/lib/stay/types';
import { 
  DoorOpen, 
  User, 
  BedDouble, 
  CreditCard, 
  CheckCircle, 
  ArrowRight, 
  ArrowLeft,
  Calendar,
  Sparkles,
  Search,
  AlertCircle
} from 'lucide-react';

interface CheckInWizardProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (stayRecord: StayRecord) => void;
  initialBookingId?: string;
  initialRoomId?: string;
}

export const CheckInWizard: React.FC<CheckInWizardProps> = ({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  initialBookingId,
  initialRoomId,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  // Mode: existing confirmed booking vs walk-in
  const [mode, setMode] = useState<'existing' | 'walkin'>('existing');

  // Existing booking selection
  const [confirmedBookings, setConfirmedBookings] = useState<Booking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Guest details
  const [guest, setGuest] = useState<Guest | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  // Room & category selection
  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');

  // Dates & Occupancy
  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const [checkInDate, setCheckInDate] = useState<string>(todayStr);
  const [checkOutDate, setCheckOutDate] = useState<string>(tomorrowStr);
  const [tariffRupees, setTariffRupees] = useState<string>('1200');

  // Payment
  const [advanceRupees, setAdvanceRupees] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState<string>('');

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const initData = useCallback(async () => {
    if (!isOpen) return;
    try {
      const [allRooms, allTypes, bookings, allGuests] = await Promise.all([
        roomRepository.findAll(businessId, true),
        roomTypeRepository.findAll(businessId, true),
        bookingRepository.findByStatus(businessId, 'confirmed'),
        guestRepository.findAll(businessId),
      ]);

      setRooms(allRooms);
      setRoomTypes(allTypes);
      setConfirmedBookings(bookings);

      if (initialBookingId) {
        const match = bookings.find((b) => b.id === initialBookingId);
        if (match) {
          setSelectedBooking(match);
          setMode('existing');
          if (match.room_id) setSelectedRoomId(match.room_id);
          setSelectedRoomTypeId(match.room_type_id);
          const foundGuest = allGuests.find((g) => g.id === match.primary_guest_id);
          if (foundGuest) {
            setGuest(foundGuest);
            setGuestName(foundGuest.name);
            setGuestPhone(foundGuest.phone);
          }
          setCheckInDate(match.check_in_date);
          setCheckOutDate(match.check_out_date);
          setTariffRupees((match.agreed_rate_paise / 100).toString());
          return;
        }
      }

      // Default room or category selection
      if (initialRoomId) {
        const r = allRooms.find((rm) => rm.id === initialRoomId);
        if (r) {
          setSelectedRoomId(r.id);
          setSelectedRoomTypeId(r.room_type_id);
          const rt = allTypes.find((t) => t.id === r.room_type_id);
          if (rt) setTariffRupees((rt.base_rate_paise / 100).toString());
        }
      } else if (allTypes.length > 0) {
        setSelectedRoomTypeId(allTypes[0].id);
        setTariffRupees((allTypes[0].base_rate_paise / 100).toString());
      }
    } catch (err) {
      console.error('Failed to load check-in data', err);
    }
  }, [businessId, isOpen, initialBookingId, initialRoomId]);

  useEffect(() => {
    initData();
  }, [initData]);

  // When existing booking is selected from dropdown
  const handleSelectBooking = async (bId: string) => {
    const match = confirmedBookings.find((b) => b.id === bId);
    if (!match) return;
    setSelectedBooking(match);
    setSelectedRoomTypeId(match.room_type_id);
    if (match.room_id) setSelectedRoomId(match.room_id);
    setCheckInDate(match.check_in_date);
    setCheckOutDate(match.check_out_date);
    setTariffRupees((match.agreed_rate_paise / 100).toString());

    const g = await guestRepository.findById(match.primary_guest_id);
    if (g) {
      setGuest(g);
      setGuestName(g.name);
      setGuestPhone(g.phone);
    }
  };

  const nights = useMemo(() => {
    try {
      return calculateNights(checkInDate, checkOutDate);
    } catch {
      return 1;
    }
  }, [checkInDate, checkOutDate]);

  const totalAmountRupees = useMemo(() => {
    const rate = parseFloat(tariffRupees) || 0;
    return rate * Math.max(1, nights);
  }, [tariffRupees, nights]);

  // Available rooms for selected category
  const availableRoomsForType = useMemo(() => {
    if (!selectedRoomTypeId) return [];
    return rooms.filter((r) => r.room_type_id === selectedRoomTypeId);
  }, [rooms, selectedRoomTypeId]);

  // Complete Check-in submission
  const handleCompleteCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!selectedRoomId) {
      setErrors([isMarathi ? 'कृपया चेक-इनसाठी खोली निवडा' : 'Please select an available room']);
      return;
    }

    setIsSubmitting(true);
    try {
      let targetBookingId = selectedBooking?.id;

      // If walk-in mode, create booking first
      if (mode === 'walkin' || !targetBookingId) {
        if (!guestName.trim() || !guestPhone.trim()) {
          setErrors([isMarathi ? 'पाहुण्याचे नाव आणि फोन नंबर आवश्यक आहे' : 'Guest name and phone number are required']);
          setIsSubmitting(false);
          return;
        }

        const now = new Date().toISOString();
        const newGuestRecord: Guest = {
          id: crypto.randomUUID(),
          business_id: businessId,
          name: guestName.trim(),
          phone: guestPhone.trim(),
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        };
        await guestRepository.create(newGuestRecord);

        const seq = Math.floor(1000 + Math.random() * 9000);
        const ref = generateBookingReference('STY', seq);
        const ratePaise = Math.round((parseFloat(tariffRupees) || 0) * 100);

        const newBooking = await createReservation({
          businessId,
          roomTypeId: selectedRoomTypeId,
          roomId: selectedRoomId,
          primaryGuestId: newGuestRecord.id,
          checkInDate,
          checkOutDate,
          adults: 2,
          agreedRatePaise: ratePaise,
          bookingReference: ref,
          source: 'walk_in',
          status: 'confirmed',
        });
        targetBookingId = newBooking.id;
      }

      // Check room conflict
      const conflict = await hasOverlappingBooking(businessId, selectedRoomId, checkInDate, checkOutDate, targetBookingId);
      if (conflict) {
        setErrors([isMarathi ? 'ही खोली या तारखांसाठी आधीच बुक आहे' : 'This room is already booked for these dates']);
        setIsSubmitting(false);
        return;
      }

      // Perform check-in
      const stayRecord = await checkIn({
        bookingId: targetBookingId,
        roomId: selectedRoomId,
        checkedInBy: 'Front Desk',
      });

      // Record any payment received at check-in
      const advPaise = Math.round((parseFloat(advanceRupees) || 0) * 100);
      if (advPaise > 0) {
        const folio = await folioRepository.findOpenFolio(businessId, targetBookingId);
        if (folio) {
          await recordPayment({
            businessId,
            folioId: folio.id,
            bookingId: targetBookingId,
            amountPaise: advPaise,
            paymentMethod,
            referenceNumber: paymentRef.trim() || undefined,
            isAdvance: true,
            notes: 'Payment collected at check-in',
          });
        }
      }

      onSuccess(stayRecord);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setErrors([err instanceof Error ? err.message : 'Check-in failed. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <DoorOpen className="w-5 h-5 text-emerald-600" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {isMarathi ? 'पाहुणे चेक-इन (Guest Check-in)' : 'Guest Check-in'}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'आरक्षित किंवा वॉक-इन पाहुण्याला खोली द्या आणि चेक-इन पूर्ण करा'
          : 'Assign room, confirm stay details and hand over key to guest'
      }
      size="lg"
    >
      <form onSubmit={handleCompleteCheckIn} className="space-y-4">
        {/* Mode Switcher */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('existing')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'existing'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{isMarathi ? '१. आरक्षित पाहुणे (Existing Booking)' : '1. Existing Booking'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('walkin')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'walkin'
                ? 'bg-emerald-600 text-white shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <DoorOpen className="w-4 h-4" />
            <span>{isMarathi ? '२. वॉक-इन पाहुणे (Walk-in Desk)' : '2. Walk-in Desk'}</span>
          </button>
        </div>

        {/* Errors list */}
        {errors.length > 0 && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 space-y-1">
            {errors.map((err, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{err}</span>
              </div>
            ))}
          </div>
        )}

        {/* Existing booking selection */}
        {mode === 'existing' && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
              {isMarathi ? 'आरक्षित बुकिंग निवडा' : 'Select Confirmed Booking'} *
            </label>
            {confirmedBookings.length === 0 ? (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 font-semibold">
                {isMarathi
                  ? 'सध्या कोणतेही आरक्षित बुकिंग उपलब्ध नाही. वॉक-इन टॅब निवडा.'
                  : 'No confirmed bookings waiting for check-in. Use Walk-in tab.'}
              </p>
            ) : (
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px] cursor-pointer"
                value={selectedBooking?.id || ''}
                onChange={(e) => handleSelectBooking(e.target.value)}
                required
              >
                <option value="">{isMarathi ? '-- यादीतून बुकिंग निवडा --' : '-- Choose from confirmed arrivals --'}</option>
                {confirmedBookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.booking_reference} — {b.check_in_date} to {b.check_out_date} (₹{(b.agreed_rate_paise / 100).toFixed(0)}/n)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Guest Details */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-violet-600" />
            <span>{isMarathi ? 'पाहुण्याची माहिती' : 'Guest Details'}</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={(isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name') + ' *'}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="e.g. Rahul Patil"
              required
            />
            <Input
              label={(isMarathi ? 'मोबाईल नंबर' : 'Phone Number') + ' *'}
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="e.g. 9822012345"
              required
            />
          </div>
        </div>

        {/* Room & Category Assignment */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-violet-600" />
            <span>{isMarathi ? 'खोली वाटप' : 'Room Assignment'}</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                {isMarathi ? 'खोलीचा प्रकार' : 'Room Category'} *
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px] cursor-pointer"
                value={selectedRoomTypeId}
                onChange={(e) => {
                  setSelectedRoomTypeId(e.target.value);
                  setSelectedRoomId('');
                  const rt = roomTypes.find((t) => t.id === e.target.value);
                  if (rt) setTariffRupees((rt.base_rate_paise / 100).toString());
                }}
                required
              >
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} ({rt.code}) — ₹{(rt.base_rate_paise / 100).toFixed(0)}/n
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                {isMarathi ? 'खोली क्रमांक (Room Number)' : 'Room Number'} *
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px] cursor-pointer"
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                required
              >
                <option value="">{isMarathi ? '-- खोली निवडा --' : '-- Choose room to check-in --'}</option>
                {availableRoomsForType.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isMarathi ? `खोली ${r.number} (मजला ${r.floor}) · ${r.status}` : `Room ${r.number} (Floor ${r.floor}) · ${r.status}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Dates & Payment */}
        <div className="p-3.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/80 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isMarathi ? 'दर प्रति रात्र (₹)' : 'Rate / Night (₹)'}
              type="number"
              value={tariffRupees}
              onChange={(e) => setTariffRupees(e.target.value)}
              required
            />

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1">
                {isMarathi ? 'एकूण रक्कम' : 'Estimated Total'} ({nights} {isMarathi ? 'रात्री' : 'Nights'})
              </label>
              <div className="w-full bg-white border border-violet-300 rounded-lg px-3 py-2 text-xs font-black font-mono min-h-[38px] flex items-center">
                ₹{totalAmountRupees.toFixed(2)}
              </div>
            </div>

            <Input
              label={isMarathi ? 'आगाऊ भरलेली रक्कम (₹)' : 'Payment Received (₹)'}
              type="number"
              value={advanceRupees}
              onChange={(e) => setAdvanceRupees(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {isMarathi ? 'रद्द करा' : 'Cancel'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[42px] px-6 font-bold flex items-center gap-2"
          >
            <DoorOpen className="w-4 h-4" />
            <span>{isMarathi ? 'चेक-इन पूर्ण करा आणि चावी द्या' : 'Complete Check-in & Hand Key'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
};
