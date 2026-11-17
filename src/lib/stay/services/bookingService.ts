/**
 * Stay Module – Booking Service
 *
 * Core business logic for managing guest bookings through their lifecycle:
 * enquiry → tentative → confirmed → checked_in → checked_out / cancelled / no_show
 *
 * All monetary values must be in integer PAISE.  Never pass rupee floats.
 */

import { db } from '@/lib/db';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { hasOverlappingBooking, calculateNights } from '@/lib/stay/services/availabilityService';
import { postRoomCharge } from '@/lib/stay/services/financialService';
import type { Booking, BookingStatus, Folio, StayRecord } from '@/lib/stay/types';

// ---------------------------------------------------------------------------
// Reference number generator
// ---------------------------------------------------------------------------

/**
 * Generate a booking reference in the format "STY-DDMM-NNNN".
 * The sequence number must be passed in (sourced from StaySettings).
 */
export function generateBookingReference(prefix: string, sequence: number): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(sequence).padStart(4, '0');
  return `${prefix}-${dd}${mm}-${seq}`;
}

// ---------------------------------------------------------------------------
// createReservation
// ---------------------------------------------------------------------------

export interface CreateReservationInput {
  businessId: string;
  roomTypeId: string;
  roomId?: string;
  primaryGuestId: string;
  additionalGuestIds?: string[];
  checkInDate: string;   // YYYY-MM-DD
  checkOutDate: string;  // YYYY-MM-DD
  adults: number;
  children?: number;
  agreedRatePaise: number;  // per-night rate in paise (integer)
  source?: string;
  specialRequests?: string;
  internalNotes?: string;
  bookingReference: string; // caller must supply (from StaySettings sequence)
  status?: Extract<BookingStatus, 'enquiry' | 'tentative' | 'confirmed'>;
}

/**
 * Create a new booking reservation.
 *
 * Performs a local overlap check before writing.  The booking is marked
 * `is_provisional = true` until a server-side confirmation is received.
 */
export async function createReservation(input: CreateReservationInput): Promise<Booking> {
  const {
    businessId,
    roomTypeId,
    roomId,
    primaryGuestId,
    additionalGuestIds = [],
    checkInDate,
    checkOutDate,
    adults,
    children = 0,
    agreedRatePaise,
    source,
    specialRequests,
    internalNotes,
    bookingReference,
    status = 'confirmed',
  } = input;

  // Validate nights
  const nights = calculateNights(checkInDate, checkOutDate); // throws if invalid

  // Local availability check
  if (roomId) {
    const conflict = await hasOverlappingBooking(businessId, roomId, checkInDate, checkOutDate);
    if (conflict) {
      throw new Error(
        `Room ${roomId} is already booked for ${checkInDate} → ${checkOutDate}. ` +
        'LOCAL CHECK ONLY – verify on all devices before confirming.'
      );
    }
  }

  const now = new Date().toISOString();
  const booking: Booking = {
    id: crypto.randomUUID(),
    business_id: businessId,
    booking_reference: bookingReference,
    room_id: roomId,
    room_type_id: roomTypeId,
    primary_guest_id: primaryGuestId,
    additional_guest_ids: additionalGuestIds,
    status,
    check_in_date: checkInDate,
    check_out_date: checkOutDate,
    adults,
    children,
    is_provisional: true,
    agreed_rate_paise: agreedRatePaise,
    source,
    special_requests: specialRequests,
    internal_notes: internalNotes,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await bookingRepository.create(booking);

  // Create an open folio for this booking
  const folio: Folio = {
    id: crypto.randomUUID(),
    business_id: businessId,
    booking_id: booking.id,
    status: 'open',
    total_charges_paise: 0,
    total_paid_paise: 0,
    balance_paise: 0,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await folioRepository.create(folio);

  // Automatically post scheduled room charge to the folio
  if (agreedRatePaise > 0 && nights > 0) {
    await postRoomCharge({
      businessId,
      folioId: folio.id,
      chargeDate: checkInDate,
      ratePaise: agreedRatePaise,
      nights,
      postedBy: 'system',
    });
  }

  return booking;
}

// ---------------------------------------------------------------------------
// confirmReservation
// ---------------------------------------------------------------------------

/**
 * Move a booking from `enquiry` or `tentative` to `confirmed`.
 * Sets `is_provisional = false`.
 */
export async function confirmReservation(bookingId: string): Promise<void> {
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (!['enquiry', 'tentative'].includes(booking.status)) {
    throw new Error(
      `Cannot confirm booking in status '${booking.status}'. ` +
      'Only enquiry or tentative bookings can be confirmed.'
    );
  }

  await bookingRepository.update(bookingId, {
    status: 'confirmed',
    is_provisional: false,
    confirmed_at: new Date().toISOString(),
    sync_status: 'pending',
  });
}

// ---------------------------------------------------------------------------
// cancelReservation
// ---------------------------------------------------------------------------

export interface CancelReservationInput {
  bookingId: string;
  reason?: string;
}

/**
 * Cancel a booking.  Only `enquiry`, `tentative`, and `confirmed` bookings
 * can be cancelled; use a no-show or checked-out status for other terminal
 * states.
 */
export async function cancelReservation(input: CancelReservationInput): Promise<void> {
  const { bookingId, reason } = input;
  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  const cancellable: BookingStatus[] = ['enquiry', 'tentative', 'confirmed'];
  if (!cancellable.includes(booking.status)) {
    throw new Error(
      `Cannot cancel booking in status '${booking.status}'.`
    );
  }

  const now = new Date().toISOString();
  await bookingRepository.update(bookingId, {
    status: 'cancelled',
    cancelled_at: now,
    cancellation_reason: reason,
    sync_status: 'pending',
  });
}

// ---------------------------------------------------------------------------
// checkIn
// ---------------------------------------------------------------------------

export interface CheckInInput {
  bookingId: string;
  roomId: string;        // must be assigned if not already on booking
  checkedInBy?: string;  // staff ID or name
}

/**
 * Perform guest check-in.
 *  1. Validates booking is confirmed.
 *  2. Local overlap check.
 *  3. Updates booking to `checked_in`.
 *  4. Creates a StayRecord.
 *  5. Sets room status to `occupied`.
 */
export async function checkIn(input: CheckInInput): Promise<StayRecord> {
  const { bookingId, roomId, checkedInBy } = input;

  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (booking.status !== 'confirmed') {
    throw new Error(
      `Cannot check in booking with status '${booking.status}'. Must be confirmed.`
    );
  }

  // Local availability check for the room
  const conflict = await hasOverlappingBooking(
    booking.business_id,
    roomId,
    booking.check_in_date,
    booking.check_out_date,
    bookingId
  );
  if (conflict) {
    throw new Error(
      `Room ${roomId} has a conflicting booking. LOCAL CHECK ONLY – verify across all devices.`
    );
  }

  const now = new Date().toISOString();

  // Update booking
  await bookingRepository.update(bookingId, {
    status: 'checked_in',
    room_id: roomId,
    checked_in_at: now,
    is_provisional: false,
    sync_status: 'pending',
  });

  // Create StayRecord
  const stayRecord: StayRecord = {
    id: crypto.randomUUID(),
    business_id: booking.business_id,
    booking_id: bookingId,
    room_id: roomId,
    status: 'active',
    actual_check_in: now,
    checked_in_by: checkedInBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await db.stay_records.add(stayRecord);

  // Update folio with stay_record_id
  const folio = await folioRepository.findOpenFolio(booking.business_id, bookingId);
  if (folio) {
    await folioRepository.update(folio.id, { stay_record_id: stayRecord.id });
  }

  // Mark room as occupied
  await roomRepository.updateStatus(roomId, 'occupied');

  return stayRecord;
}

// ---------------------------------------------------------------------------
// checkOut
// ---------------------------------------------------------------------------

export interface CheckOutInput {
  bookingId: string;
  checkedOutBy?: string;
  allowCredit?: boolean;
  creditDetails?: {
    debtorName: string;
    debtorPhone: string;
    dueDate?: string;
    notes?: string;
    authorizedBy?: string;
  };
}

/**
 * Perform guest check-out.
 *  1. Validates booking is checked_in.
 *  2. Checks folio balance:
 *     - If balance == 0, closes folio.
 *     - If balance > 0 and allowCredit is true, marks folio as credit_ledger with debtor details.
 *     - If balance > 0 and allowCredit is false, throws an error requiring settlement.
 *  3. Updates the StayRecord with actual checkout time.
 *  4. Updates booking to `checked_out`.
 *  5. Sets room to `cleaning` for housekeeping turnover.
 */
export async function checkOut(input: CheckOutInput): Promise<void> {
  const { bookingId, checkedOutBy, allowCredit, creditDetails } = input;

  const booking = await bookingRepository.findById(bookingId);
  if (!booking) throw new Error(`Booking ${bookingId} not found`);

  if (booking.status !== 'checked_in') {
    throw new Error(
      `Cannot check out booking with status '${booking.status}'. Must be checked_in.`
    );
  }

  // Find open folio for this booking
  const folio = await folioRepository.findOpenFolio(booking.business_id, bookingId);
  if (folio) {
    if (folio.balance_paise > 0) {
      if (!allowCredit || !creditDetails?.debtorName?.trim()) {
        throw new Error(
          `Cannot check out with outstanding balance of ₹${(folio.balance_paise / 100).toFixed(2)} without full settlement or explicit authorized credit approval.`
        );
      }

      await folioRepository.authorizeCredit(folio.id, {
        creditAmountPaise: folio.balance_paise,
        debtorName: creditDetails.debtorName.trim(),
        debtorPhone: creditDetails.debtorPhone.trim(),
        dueDate: creditDetails.dueDate,
        notes: creditDetails.notes,
        authorizedBy: creditDetails.authorizedBy || checkedOutBy,
      });
    } else {
      await folioRepository.close(folio.id);
    }
  }

  const now = new Date().toISOString();

  // Find active stay record
  const stayRecord = await db.stay_records
    .where('booking_id')
    .equals(bookingId)
    .and((sr) => sr.status === 'active')
    .first();

  if (stayRecord) {
    await db.stay_records.update(stayRecord.id, {
      status: 'checked_out',
      actual_check_out: now,
      checked_out_by: checkedOutBy,
      updated_at: now,
    });
  }

  // Update booking
  await bookingRepository.update(bookingId, {
    status: 'checked_out',
    checked_out_at: now,
    sync_status: 'pending',
  });

  // Set room to cleaning
  if (booking.room_id) {
    await roomRepository.updateStatus(booking.room_id, 'cleaning');
  }
}
