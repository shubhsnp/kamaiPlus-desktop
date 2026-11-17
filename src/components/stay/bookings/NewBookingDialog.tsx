'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StayDatePicker } from '../ui/StayDatePicker';
import { StayTimePicker } from '../ui/StayTimePicker';
import { RoomCategorySelector } from '../ui/RoomCategorySelector';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { calculateNights, hasOverlappingBooking } from '@/lib/stay/services/availabilityService';
import { createReservation, checkIn, generateBookingReference } from '@/lib/stay/services/bookingService';
import { recordPayment } from '@/lib/stay/services/financialService';
import { getStayMessage } from '@/lib/stay/validationMessages';
import type { Room, RoomType, Guest, Booking, PaymentMethod, StayPayment } from '@/lib/stay/types';
import { PaymentReceiptModal } from '../payments/PaymentReceiptModal';
import { 
  User, 
  Calendar, 
  CreditCard, 
  Check, 
  AlertCircle, 
  BedDouble, 
  Clock, 
  DoorOpen, 
  Sparkles, 
  Phone, 
  Search 
} from 'lucide-react';

interface NewBookingDialogProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
  initialRoomId?: string;
  initialMode?: 'walkin' | 'advance';
}

export const NewBookingDialog: React.FC<NewBookingDialogProps> = ({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  initialRoomId,
  initialMode = 'walkin',
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  // Mode: walk-in (immediate check-in) vs advance reservation
  const [mode, setMode] = useState<'walkin' | 'advance'>(initialMode);

  // Form State
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [existingGuest, setExistingGuest] = useState<Guest | null>(null);
  const [guestSearchResults, setGuestSearchResults] = useState<Guest[]>([]);
  const [isSearchingGuest, setIsSearchingGuest] = useState(false);

  // Room & Category
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>(initialRoomId || '');

  // Dates & Times
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
  const [checkInTime, setCheckInTime] = useState<string>('12:00');
  const [checkOutDate, setCheckOutDate] = useState<string>(tomorrowStr);
  const [checkOutTime, setCheckOutTime] = useState<string>('11:00');

  // Occupancy & Tariff
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [tariffRupees, setTariffRupees] = useState<string>('1200');

  // Advance Payment
  const [advancePaymentRupees, setAdvancePaymentRupees] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');

  // UI state & validation
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [advanceReceiptPayment, setAdvanceReceiptPayment] = useState<StayPayment | null>(null);
  const [completedBooking, setCompletedBooking] = useState<Booking | null>(null);

  // Load room types and rooms
  const loadRoomsData = useCallback(async () => {
    if (!isOpen) return;
    setIsLoadingRooms(true);
    try {
      const [fetchedTypes, fetchedRooms] = await Promise.all([
        roomTypeRepository.findAll(businessId),
        roomRepository.findAll(businessId, true),
      ]);

      setRoomTypes(fetchedTypes);
      setRooms(fetchedRooms);

      // Auto-select category if not selected or invalid
      if (fetchedTypes.length > 0) {
        if (!selectedRoomTypeId || !fetchedTypes.some((rt) => rt.id === selectedRoomTypeId)) {
          const first = fetchedTypes[0];
          setSelectedRoomTypeId(first.id);
          setTariffRupees((first.base_rate_paise / 100).toString());
        }
      }

      // If initialRoomId provided, select it and its category
      if (initialRoomId) {
        const found = fetchedRooms.find((r) => r.id === initialRoomId);
        if (found) {
          setSelectedRoomId(found.id);
          setSelectedRoomTypeId(found.room_type_id);
          const rType = fetchedTypes.find((rt) => rt.id === found.room_type_id);
          if (rType) {
            setTariffRupees((rType.base_rate_paise / 100).toString());
          }
        }
      }
    } catch (err) {
      console.error('Failed to load room data', err);
    } finally {
      setIsLoadingRooms(false);
    }
  }, [businessId, isOpen, initialRoomId, selectedRoomTypeId]);

  useEffect(() => {
    loadRoomsData();
  }, [isOpen]);

  // When checkInDate changes, ensure checkOutDate is after it
  useEffect(() => {
    if (checkInDate && checkOutDate <= checkInDate) {
      const inDate = new Date(checkInDate);
      inDate.setDate(inDate.getDate() + 1);
      const y = inDate.getFullYear();
      const m = String(inDate.getMonth() + 1).padStart(2, '0');
      const d = String(inDate.getDate()).padStart(2, '0');
      setCheckOutDate(`${y}-${m}-${d}`);
    }
  }, [checkInDate]);

  // Handle category selection
  const handleCategoryChange = (typeId: string, typeObj?: RoomType) => {
    setSelectedRoomTypeId(typeId);
    setSelectedRoomId(''); // Reset room allocation to let user choose from this category
    const rt = typeObj || roomTypes.find((t) => t.id === typeId);
    if (rt) {
      setTariffRupees((rt.base_rate_paise / 100).toString());
    }
    // Clear category error immediately
    if (fieldErrors.category) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.category;
        return next;
      });
    }
  };

  // Calculate nights
  const nights = useMemo(() => {
    try {
      return calculateNights(checkInDate, checkOutDate);
    } catch {
      return 1;
    }
  }, [checkInDate, checkOutDate]);

  // Total rate calculation
  const totalAmountRupees = useMemo(() => {
    const rate = parseFloat(tariffRupees) || 0;
    return rate * Math.max(1, nights);
  }, [tariffRupees, nights]);

  // Available rooms for selected category & dates
  const availableRoomsForType = useMemo(() => {
    if (!selectedRoomTypeId) return [];
    return rooms.filter((r) => r.room_type_id === selectedRoomTypeId);
  }, [rooms, selectedRoomTypeId]);

  // Quick guest phone lookup
  const handlePhoneChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setGuestPhone(val);
    setExistingGuest(null);

    const clean = val.trim();
    if (clean.length >= 4) {
      setIsSearchingGuest(true);
      try {
        const matched = await guestRepository.search(businessId, clean);
        setGuestSearchResults(matched);
        if (matched.length === 1 && matched[0].phone === clean) {
          // Exact phone match found
          setExistingGuest(matched[0]);
          setGuestName(matched[0].name);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearchingGuest(false);
      }
    } else {
      setGuestSearchResults([]);
    }
  };

  const selectExistingGuest = (g: Guest) => {
    setExistingGuest(g);
    setGuestName(g.name);
    setGuestPhone(g.phone);
    setGuestSearchResults([]);
  };

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!selectedRoomTypeId) {
      errors.category = getStayMessage('CATEGORY_REQUIRED', isMarathi ? 'mr' : 'en');
    }
    if (!checkInDate) {
      errors.checkInDate = getStayMessage('CHECK_IN_DATE_REQUIRED', isMarathi ? 'mr' : 'en');
    }
    if (!checkOutDate) {
      errors.checkOutDate = getStayMessage('CHECK_OUT_DATE_REQUIRED', isMarathi ? 'mr' : 'en');
    }
    if (nights <= 0) {
      errors.checkOutDate = getStayMessage('CHECK_OUT_MUST_BE_AFTER_CHECK_IN', isMarathi ? 'mr' : 'en');
    }
    if (!guestName.trim()) {
      errors.guestName = getStayMessage('GUEST_NAME_REQUIRED', isMarathi ? 'mr' : 'en');
    }
    if (!guestPhone.trim()) {
      errors.guestPhone = getStayMessage('GUEST_PHONE_REQUIRED', isMarathi ? 'mr' : 'en');
    }
    if (mode === 'walkin' && !selectedRoomId) {
      errors.room = isMarathi
        ? 'कृपया वॉक-इन चेक-इनसाठी विशिष्ट खोली निवडा'
        : 'Please select a specific room for walk-in check-in';
    }

    const rateParsed = parseFloat(tariffRupees);
    if (isNaN(rateParsed) || rateParsed < 0) {
      errors.tariff = getStayMessage('TARIFF_INVALID', isMarathi ? 'mr' : 'en');
    }

    const advanceParsed = parseFloat(advancePaymentRupees) || 0;
    if (advanceParsed > totalAmountRupees) {
      errors.advance = getStayMessage('ADVANCE_EXCEEDS_TOTAL', isMarathi ? 'mr' : 'en');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      // 1. Resolve or Create Guest
      let guestId = existingGuest?.id;
      if (!guestId) {
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
        guestId = newGuestRecord.id;
      }

      const ratePaise = Math.round(rateParsed * 100);
      const advancePaise = Math.round(advanceParsed * 100);

      // Generate Reference
      const seq = Math.floor(1000 + Math.random() * 9000);
      const bookingRef = generateBookingReference('STY', seq);

      // 2. Check Overlap if room assigned
      if (selectedRoomId) {
        const overlap = await hasOverlappingBooking(businessId, selectedRoomId, checkInDate, checkOutDate);
        if (overlap) {
          setFieldErrors({
            room: getStayMessage('ROOM_NOT_AVAILABLE', isMarathi ? 'mr' : 'en'),
          });
          setIsSubmitting(false);
          return;
        }
      }

      // 3. Create Booking
      const booking = await createReservation({
        businessId,
        roomTypeId: selectedRoomTypeId,
        roomId: selectedRoomId || undefined,
        primaryGuestId: guestId,
        checkInDate,
        checkOutDate,
        adults,
        children,
        agreedRatePaise: ratePaise,
        source: mode === 'walkin' ? 'walk_in' : 'phone',
        specialRequests: specialRequests.trim() || undefined,
        bookingReference: bookingRef,
        status: 'confirmed',
      });

      // 4. Record advance payment if provided
      let pRecord: StayPayment | null = null;
      if (advancePaise > 0) {
        const folio = await folioRepository.findOpenFolio(businessId, booking.id);
        if (folio) {
          pRecord = await recordPayment({
            businessId,
            folioId: folio.id,
            bookingId: booking.id,
            amountPaise: advancePaise,
            paymentMethod,
            referenceNumber: paymentRef.trim() || undefined,
            isAdvance: true,
            notes: mode === 'walkin' ? 'Walk-in payment at desk' : 'Advance deposit for reservation',
          });
        }
      }

      // 5. If Walk-in, perform immediate check-in
      if (mode === 'walkin' && selectedRoomId) {
        await checkIn({
          bookingId: booking.id,
          roomId: selectedRoomId,
          checkedInBy: 'Front Desk',
        });
      }

      if (pRecord) {
        setAdvanceReceiptPayment(pRecord);
        setCompletedBooking(booking);
      } else {
        onSuccess(booking);
        onClose();
      }
    } catch (err: unknown) {
      console.error(err);
      setFieldErrors({
        submit: err instanceof Error ? err.message : 'Failed to save booking. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // If advance payment was made, show Advance Deposit Receipt modal
  if (advanceReceiptPayment && completedBooking) {
    const rateVal = parseFloat(tariffRupees) || 0;
    const totalEstPaise = Math.round(rateVal * nights * 100);
    return (
      <PaymentReceiptModal
        isOpen={isOpen}
        onClose={() => {
          const b = completedBooking;
          setAdvanceReceiptPayment(null);
          setCompletedBooking(null);
          onSuccess(b);
          onClose();
        }}
        payment={advanceReceiptPayment}
        booking={completedBooking}
        guest={existingGuest || undefined}
        totalChargesPaise={totalEstPaise}
        totalPaidPaise={advanceReceiptPayment.amount_paise}
        balanceDuePaise={Math.max(0, totalEstPaise - advanceReceiptPayment.amount_paise)}
      />
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BedDouble className="w-5 h-5 text-violet-600" />
          <span className="font-black text-slate-900 dark:text-slate-100">
            {mode === 'walkin'
              ? isMarathi ? 'नवीन वॉक-इन चेक-इन (Walk-in Check-in)' : 'New Walk-in Check-in'
              : isMarathi ? 'अ‍ॅडव्हान्स बुकिंग (Advance Reservation)' : 'New Advance Reservation'}
          </span>
        </div>
      }
      description={
        isMarathi
          ? 'पाहुण्याची माहिती, तारीख, खोली प्रकार आणि दर निश्चित करा'
          : 'Enter guest details, stay dates, select room category & confirm rate'
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Mode Selector Pill Buttons */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-bold">
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
            <span>{isMarathi ? '१. वॉक-इन (थेट चेक-इन)' : '1. Walk-in (Immediate Check-in)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('advance')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition cursor-pointer ${
              mode === 'advance'
                ? 'bg-violet-600 text-white shadow-sm font-black'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>{isMarathi ? '२. अ‍ॅडव्हान्स बुकिंग (पुढील तारखा)' : '2. Advance Reservation (Future)'}</span>
          </button>
        </div>

        {/* Global Submit Error Banner */}
        {fieldErrors.submit && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{fieldErrors.submit}</span>
          </div>
        )}

        {/* SECTION 1: Stay Dates & Times */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-violet-600" />
              <span>{isMarathi ? 'मुक्कामाचा कालावधी (Stay Dates & Duration)' : 'Stay Dates & Duration'}</span>
            </span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-violet-100 text-violet-800 font-mono">
              {nights} {isMarathi ? 'रात्र(ी)' : 'Night(s)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Check-in Date & Time */}
            <div className="space-y-2">
              <StayDatePicker
                label={isMarathi ? 'चेक-इन तारीख' : 'Check-in Date'}
                value={checkInDate}
                onChange={setCheckInDate}
                minDate={todayStr}
                required
                error={fieldErrors.checkInDate}
              />
              <StayTimePicker
                label={isMarathi ? 'चेक-इन वेळ' : 'Check-in Time'}
                value={checkInTime}
                onChange={setCheckInTime}
                defaultType="checkin"
              />
            </div>

            {/* Check-out Date & Time */}
            <div className="space-y-2">
              <StayDatePicker
                label={isMarathi ? 'चेक-आउट तारीख' : 'Check-out Date'}
                value={checkOutDate}
                onChange={setCheckOutDate}
                minDate={checkInDate || todayStr}
                required
                error={fieldErrors.checkOutDate}
              />
              <StayTimePicker
                label={isMarathi ? 'चेक-आउट वेळ' : 'Check-out Time'}
                value={checkOutTime}
                onChange={setCheckOutTime}
                defaultType="checkout"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Room Category & Room Allocation */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <BedDouble className="w-3.5 h-3.5 text-violet-600" />
            <span>{isMarathi ? 'खोली प्रकार आणि खोली क्रमांक' : 'Room Category & Number'}</span>
          </span>

          <RoomCategorySelector
            businessId={businessId}
            roomTypes={roomTypes}
            selectedRoomTypeId={selectedRoomTypeId}
            onChange={handleCategoryChange}
            onRefreshRoomTypes={loadRoomsData}
            label={isMarathi ? 'खोलीचा प्रकार' : 'Room Category'}
            required
            error={fieldErrors.category}
          />

          {/* Room Allocation Dropdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                {isMarathi ? 'विशिष्ट खोली वाटप करा' : 'Assign Specific Room'}{' '}
                {mode === 'walkin' && <span className="text-rose-500">*</span>}
              </label>
              <select
                className={`w-full bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-violet-600 min-h-[38px] cursor-pointer ${
                  fieldErrors.room ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                }`}
                value={selectedRoomId}
                onChange={(e) => {
                  setSelectedRoomId(e.target.value);
                  if (fieldErrors.room) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.room;
                      return next;
                    });
                  }
                }}
              >
                <option value="">
                  {mode === 'walkin'
                    ? isMarathi
                      ? '-- खोली निवडा (खोली देणे आवश्यक आहे) --'
                      : '-- Choose an available room --'
                    : isMarathi
                    ? '-- चेक-इनच्या वेळी खोली द्या (Unassigned) --'
                    : '-- Assign room at check-in --'}
                </option>
                {availableRoomsForType.map((r) => (
                  <option key={r.id} value={r.id}>
                    {isMarathi ? `खोली ${r.number} (मजला ${r.floor}) · ${r.status}` : `Room ${r.number} (Floor ${r.floor}) · ${r.status}`}
                  </option>
                ))}
              </select>
              {fieldErrors.room && <p className="text-[11px] font-semibold text-rose-600 mt-1">{fieldErrors.room}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Input
                label={isMarathi ? 'प्रौढ व्यक्ती (Adults)' : 'Adults'}
                type="number"
                min="1"
                max="10"
                value={adults}
                onChange={(e) => setAdults(parseInt(e.target.value, 10) || 1)}
                required
              />
              <Input
                label={isMarathi ? 'लहान मुले (Children)' : 'Children'}
                type="number"
                min="0"
                max="10"
                value={children}
                onChange={(e) => setChildren(parseInt(e.target.value, 10) || 0)}
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Guest Registration */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-violet-600" />
              <span>{isMarathi ? 'पाहुण्याची माहिती (Guest Profile)' : 'Guest Profile'}</span>
            </span>
            {existingGuest && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>{isMarathi ? 'जुने पाहुणे (Existing Guest)' : 'Existing Guest'}</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
            <div>
              <Input
                label={(isMarathi ? 'मोबाईल नंबर' : 'Mobile Number') + ' *'}
                type="tel"
                value={guestPhone}
                onChange={handlePhoneChange}
                placeholder="e.g. 9822012345"
                required
                error={fieldErrors.guestPhone}
              />

              {/* Autocomplete dropdown for matched existing guests */}
              {guestSearchResults.length > 0 && !existingGuest && (
                <div className="absolute top-full left-0 z-30 w-full sm:w-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl mt-1 overflow-hidden">
                  <div className="p-1.5 text-[10px] font-bold text-slate-400 bg-slate-50 border-b">
                    {isMarathi ? 'सापडलेले पाहुणे (क्लिक करा):' : 'Matching guests (click to autofill):'}
                  </div>
                  {guestSearchResults.map((g) => (
                    <button
                      type="button"
                      key={g.id}
                      onClick={() => selectExistingGuest(g)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-violet-50 dark:hover:bg-violet-950/40 border-b border-slate-100 last:border-none flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">{g.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{g.phone}</div>
                      </div>
                      <span className="text-[10px] text-violet-600 font-bold">Auto-fill →</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Input
              label={(isMarathi ? 'पाहुण्याचे पूर्ण नाव' : 'Guest Full Name') + ' *'}
              value={guestName}
              onChange={(e) => {
                setGuestName(e.target.value);
                if (fieldErrors.guestName) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.guestName;
                    return next;
                  });
                }
              }}
              placeholder="e.g. Rahul Patil"
              required
              error={fieldErrors.guestName}
            />
          </div>
        </div>

        {/* SECTION 4: Tariff, Total & Advance Payment */}
        <div className="p-3.5 bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/80 dark:border-violet-800/60 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label={(isMarathi ? 'दर प्रति रात्र (₹)' : 'Tariff Per Night (₹)') + ' *'}
              type="number"
              min="0"
              step="1"
              value={tariffRupees}
              onChange={(e) => setTariffRupees(e.target.value)}
              required
              error={fieldErrors.tariff}
            />

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                {isMarathi ? 'एकूण अंदाजे बिल' : 'Total Estimated Bill'} ({nights} {isMarathi ? 'रात्री' : 'Nights'})
              </label>
              <div className="w-full bg-white dark:bg-slate-900 border border-violet-300 dark:border-violet-700 text-violet-900 dark:text-violet-200 rounded-lg px-3 py-2 text-sm font-black font-mono min-h-[38px] flex items-center">
                ₹{totalAmountRupees.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Advance Deposit */}
          <div className="pt-2 border-t border-violet-200/60 dark:border-violet-800/40 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={isMarathi ? 'आगाऊ पेमेंट (Advance ₹)' : 'Advance Deposit (₹)'}
              type="number"
              min="0"
              max={totalAmountRupees}
              value={advancePaymentRupees}
              onChange={(e) => setAdvancePaymentRupees(e.target.value)}
              placeholder="0"
              error={fieldErrors.advance}
            />

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
                {isMarathi ? 'पेमेंट पद्धत' : 'Payment Mode'}
              </label>
              <select
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none min-h-[38px]"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              >
                <option value="cash">{isMarathi ? 'रोख (Cash)' : 'Cash'}</option>
                <option value="upi">{isMarathi ? 'UPI / QR कोड' : 'UPI / QR'}</option>
                <option value="card">{isMarathi ? 'कार्ड (Card)' : 'Card'}</option>
                <option value="bank_transfer">{isMarathi ? 'बँक ट्रान्सफर' : 'Bank Transfer'}</option>
              </select>
            </div>

            {paymentMethod === 'upi' ? (
              <Input
                label="UPI Ref / UTR No."
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder="e.g. 332810984521"
              />
            ) : (
              <Input
                label={isMarathi ? 'विशेष सूचना (Notes)' : 'Special Requests'}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="e.g. Extra towels, 1st floor"
              />
            )}
          </div>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
            className="min-h-[42px]"
          >
            {isMarathi ? 'रद्द करा' : 'Cancel'}
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className={`min-h-[44px] px-6 text-sm font-black flex items-center gap-2 ${
              mode === 'walkin'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-violet-600 hover:bg-violet-700 text-white'
            }`}
          >
            {mode === 'walkin' ? (
              <>
                <DoorOpen className="w-4 h-4" />
                <span>{isMarathi ? 'चेक-इन करा आणि खोली द्या' : 'Check-in Guest Now'}</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isMarathi ? 'बुकिंग निश्चित करा' : 'Confirm Reservation'}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
