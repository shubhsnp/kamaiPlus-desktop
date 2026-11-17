/**
 * Stay Module – Validation Utilities
 *
 * All validators return { valid: boolean, errors: string[] }
 * Follows strict rules:
 * - Integer paise amounts (non-negative)
 * - Required fields check
 * - Date string format & range validation
 */

import type {
  RoomType,
  Room,
  Guest,
  Booking,
  StayPayment,
  ValidationResult,
  RoomStatus,
  BookingStatus,
  PaymentMethod,
} from '@/lib/stay/types';

const VALID_ROOM_STATUSES: RoomStatus[] = [
  'available',
  'occupied',
  'reserved',
  'cleaning',
  'maintenance',
  'out_of_service',
];

const VALID_BOOKING_STATUSES: BookingStatus[] = [
  'enquiry',
  'tentative',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
];

const VALID_PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'upi',
  'card',
  'bank_transfer',
  'ota_collect',
  'other',
];

/**
 * Validate ISO date string format (YYYY-MM-DD or full ISO 8601)
 */
function isValidDateString(dateStr: string | undefined): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Validate Date Range (checkIn vs checkOut)
 */
export function validateDateRange(checkInDate: string, checkOutDate: string): ValidationResult {
  const errors: string[] = [];

  if (!isValidDateString(checkInDate)) {
    errors.push('Check-in date must be a valid date string (YYYY-MM-DD)');
  }
  if (!isValidDateString(checkOutDate)) {
    errors.push('Check-out date must be a valid date string (YYYY-MM-DD)');
  }

  if (errors.length === 0) {
    const inTime = new Date(checkInDate).getTime();
    const outTime = new Date(checkOutDate).getTime();
    if (outTime <= inTime) {
      errors.push('Check-out date must be strictly after check-in date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate RoomType entity
 */
export function validateRoomType(roomType: Partial<RoomType>): ValidationResult {
  const errors: string[] = [];

  if (!roomType.business_id?.trim()) {
    errors.push('business_id is required');
  }
  if (!roomType.name?.trim()) {
    errors.push('Room type name is required');
  }
  if (!roomType.code?.trim()) {
    errors.push('Room type code is required');
  }
  if (
    roomType.base_rate_paise === undefined ||
    !Number.isInteger(roomType.base_rate_paise) ||
    roomType.base_rate_paise < 0
  ) {
    errors.push('base_rate_paise must be a non-negative integer (paise)');
  }
  if (
    roomType.max_occupancy === undefined ||
    !Number.isInteger(roomType.max_occupancy) ||
    roomType.max_occupancy <= 0
  ) {
    errors.push('max_occupancy must be a positive integer');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Room entity
 */
export function validateRoom(room: Partial<Room>): ValidationResult {
  const errors: string[] = [];

  if (!room.business_id?.trim()) {
    errors.push('business_id is required');
  }
  if (!room.room_type_id?.trim()) {
    errors.push('room_type_id is required');
  }
  if (!room.number?.trim()) {
    errors.push('Room number is required');
  }
  if (room.floor === undefined || !Number.isInteger(room.floor)) {
    errors.push('Floor must be an integer');
  }
  if (!room.status || !VALID_ROOM_STATUSES.includes(room.status)) {
    errors.push(`Invalid room status: ${room.status}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Guest entity
 */
export function validateGuest(guest: Partial<Guest>): ValidationResult {
  const errors: string[] = [];

  if (!guest.business_id?.trim()) {
    errors.push('business_id is required');
  }
  if (!guest.name?.trim()) {
    errors.push('Guest name is required');
  }
  if (!guest.phone?.trim()) {
    errors.push('Guest phone number is required');
  } else {
    // Basic phone validation (allowing digits, spaces, plus sign, min 7 digits)
    const cleaned = guest.phone.replace(/[\s\-()]/g, '');
    if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
      errors.push('Invalid phone number format');
    }
  }

  if (guest.email && guest.email.trim() !== '') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest.email.trim())) {
      errors.push('Invalid email address format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Booking entity
 */
export function validateBooking(booking: Partial<Booking>): ValidationResult {
  const errors: string[] = [];

  if (!booking.business_id?.trim()) {
    errors.push('business_id is required');
  }
  if (!booking.booking_reference?.trim()) {
    errors.push('booking_reference is required');
  }
  if (!booking.room_type_id?.trim()) {
    errors.push('room_type_id is required');
  }
  if (!booking.primary_guest_id?.trim()) {
    errors.push('primary_guest_id is required');
  }
  if (!booking.status || !VALID_BOOKING_STATUSES.includes(booking.status)) {
    errors.push(`Invalid booking status: ${booking.status}`);
  }

  if (
    booking.adults === undefined ||
    !Number.isInteger(booking.adults) ||
    booking.adults <= 0
  ) {
    errors.push('adults must be a positive integer');
  }

  if (
    booking.children !== undefined &&
    (!Number.isInteger(booking.children) || booking.children < 0)
  ) {
    errors.push('children must be a non-negative integer');
  }

  if (
    booking.agreed_rate_paise === undefined ||
    !Number.isInteger(booking.agreed_rate_paise) ||
    booking.agreed_rate_paise < 0
  ) {
    errors.push('agreed_rate_paise must be a non-negative integer (paise)');
  }

  if (!booking.check_in_date || !booking.check_out_date) {
    errors.push('check_in_date and check_out_date are required');
  } else {
    const dateRangeResult = validateDateRange(booking.check_in_date, booking.check_out_date);
    if (!dateRangeResult.valid) {
      errors.push(...dateRangeResult.errors);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate StayPayment entity
 */
export function validatePayment(payment: Partial<StayPayment>): ValidationResult {
  const errors: string[] = [];

  if (!payment.business_id?.trim()) {
    errors.push('business_id is required');
  }
  if (!payment.folio_id?.trim()) {
    errors.push('folio_id is required');
  }
  if (!payment.booking_id?.trim()) {
    errors.push('booking_id is required');
  }
  if (
    payment.amount_paise === undefined ||
    !Number.isInteger(payment.amount_paise) ||
    payment.amount_paise <= 0
  ) {
    errors.push('amount_paise must be a positive integer (paise)');
  }
  if (!payment.payment_method || !VALID_PAYMENT_METHODS.includes(payment.payment_method)) {
    errors.push(`Invalid payment method: ${payment.payment_method}`);
  }
  if (!isValidDateString(payment.paid_at)) {
    errors.push('paid_at must be a valid ISO date string');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
