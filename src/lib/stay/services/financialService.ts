/**
 * Stay Module – Financial Service
 *
 * All folio posting and payment recording for the Stay module.
 *
 * IMPORTANT: ALL monetary amounts are in integer PAISE (₹1 = 100 paise).
 * Never pass rupee floats to any function in this file.
 */

import { db } from '@/lib/db';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { folioRepository } from '@/lib/stay/repositories/folioRepository';
import { calculateNights } from '@/lib/stay/services/availabilityService';
import type {
  FolioEntry,
  StayPayment,
  PaymentMethod,
  FinalBillSummary,
  BillSummaryLine,
} from '@/lib/stay/types';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Recalculate and persist folio totals after any entry/payment change.
 * @internal
 */
async function recalculateFolioTotals(folioId: string, businessId: string): Promise<void> {
  const entries = await folioRepository.getEntries(businessId, folioId);

  const CREDIT_TYPES = new Set(['payment', 'refund', 'discount']);

  let totalChargesPaise = 0;
  let totalPaidPaise = 0;

  for (const entry of entries) {
    if (CREDIT_TYPES.has(entry.entry_type)) {
      totalPaidPaise += entry.amount_paise;
    } else {
      totalChargesPaise += entry.amount_paise;
    }
  }

  const balancePaise = totalChargesPaise - totalPaidPaise;

  await folioRepository.update(folioId, {
    total_charges_paise: totalChargesPaise,
    total_paid_paise: totalPaidPaise,
    balance_paise: balancePaise,
  });
}

// ---------------------------------------------------------------------------
// postRoomCharge
// ---------------------------------------------------------------------------

export interface PostRoomChargeInput {
  businessId: string;
  folioId: string;
  /** Date the room charge relates to (YYYY-MM-DD) */
  chargeDate: string;
  /** Per-night rate in paise (integer) */
  ratePaise: number;
  /** Number of nights */
  nights: number;
  postedBy?: string;
}

/**
 * Post a room charge (accommodation fee) to the folio.
 * Amount = `ratePaise × nights` in paise.
 */
export async function postRoomCharge(input: PostRoomChargeInput): Promise<FolioEntry> {
  const { businessId, folioId, chargeDate, ratePaise, nights, postedBy } = input;

  if (!Number.isInteger(ratePaise) || ratePaise < 0) {
    throw new Error('ratePaise must be a non-negative integer (paise).');
  }
  if (nights <= 0) {
    throw new Error('nights must be a positive integer.');
  }

  const totalPaise = ratePaise * nights;
  const now = new Date().toISOString();

  const entry: FolioEntry = {
    id: crypto.randomUUID(),
    business_id: businessId,
    folio_id: folioId,
    entry_type: 'room_charge',
    entry_date: chargeDate,
    description: `Room charge – ${nights} night${nights !== 1 ? 's' : ''} @ ₹${(ratePaise / 100).toFixed(2)}`,
    amount_paise: totalPaise,
    quantity: nights,
    unit_price_paise: ratePaise,
    posted_by: postedBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await folioRepository.addEntry(entry);
  await recalculateFolioTotals(folioId, businessId);

  return entry;
}

// ---------------------------------------------------------------------------
// postAdditionalCharge
// ---------------------------------------------------------------------------

export interface PostAdditionalChargeInput {
  businessId: string;
  folioId: string;
  description: string;
  amountPaise: number;      // total amount in paise (integer)
  quantity?: number;
  unitPricePaise?: number;  // if provided, amountPaise should equal quantity * unitPricePaise
  chargeDate?: string;      // defaults to today
  referenceId?: string;
  postedBy?: string;
}

/**
 * Post any additional charge to the folio (restaurant, laundry, etc.).
 * Amount must be a non-negative integer in paise.
 */
export async function postAdditionalCharge(input: PostAdditionalChargeInput): Promise<FolioEntry> {
  const {
    businessId,
    folioId,
    description,
    amountPaise,
    quantity = 1,
    unitPricePaise,
    chargeDate,
    referenceId,
    postedBy,
  } = input;

  if (!Number.isInteger(amountPaise) || amountPaise < 0) {
    throw new Error('amountPaise must be a non-negative integer (paise).');
  }

  const now = new Date().toISOString();
  const entry: FolioEntry = {
    id: crypto.randomUUID(),
    business_id: businessId,
    folio_id: folioId,
    entry_type: 'additional_charge',
    entry_date: chargeDate ?? now.slice(0, 10),
    description,
    amount_paise: amountPaise,
    quantity,
    unit_price_paise: unitPricePaise ?? amountPaise,
    reference_id: referenceId,
    posted_by: postedBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await folioRepository.addEntry(entry);
  await recalculateFolioTotals(folioId, businessId);

  return entry;
}

// ---------------------------------------------------------------------------
// postDiscount
// ---------------------------------------------------------------------------

export interface PostDiscountInput {
  businessId: string;
  folioId: string;
  description: string;
  discountPaise: number;  // amount to discount in paise (positive integer)
  chargeDate?: string;
  postedBy?: string;
}

/**
 * Post a discount to the folio.
 * Stored as a credit entry (`entry_type: 'discount'`).
 * discountPaise must be a positive integer.
 */
export async function postDiscount(input: PostDiscountInput): Promise<FolioEntry> {
  const { businessId, folioId, description, discountPaise, chargeDate, postedBy } = input;

  if (!Number.isInteger(discountPaise) || discountPaise <= 0) {
    throw new Error('discountPaise must be a positive integer (paise).');
  }

  const now = new Date().toISOString();
  const entry: FolioEntry = {
    id: crypto.randomUUID(),
    business_id: businessId,
    folio_id: folioId,
    entry_type: 'discount',
    entry_date: chargeDate ?? now.slice(0, 10),
    description,
    amount_paise: discountPaise,
    quantity: 1,
    unit_price_paise: discountPaise,
    posted_by: postedBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await folioRepository.addEntry(entry);
  await recalculateFolioTotals(folioId, businessId);

  return entry;
}

// ---------------------------------------------------------------------------
// recordPayment
// ---------------------------------------------------------------------------

export interface RecordPaymentInput {
  businessId: string;
  folioId: string;
  bookingId: string;
  amountPaise: number;      // positive integer paise
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  isAdvance?: boolean;
  isRefund?: boolean;
  notes?: string;
  recordedBy?: string;
  paidAt?: string;          // ISO datetime; defaults to now
}

/**
 * Record a payment (or refund) against a folio.
 * Creates both a FolioEntry and a StayPayment record.
 * amountPaise must be a positive integer.
 */
export async function recordPayment(input: RecordPaymentInput): Promise<StayPayment> {
  const {
    businessId,
    folioId,
    bookingId,
    amountPaise,
    paymentMethod,
    referenceNumber,
    isAdvance = false,
    isRefund = false,
    notes,
    recordedBy,
    paidAt,
  } = input;

  if (!Number.isInteger(amountPaise) || amountPaise <= 0) {
    throw new Error('amountPaise must be a positive integer (paise).');
  }

  const now = new Date().toISOString();
  const paidAtStr = paidAt ?? now;

  // Post folio entry
  const entry: FolioEntry = {
    id: crypto.randomUUID(),
    business_id: businessId,
    folio_id: folioId,
    entry_type: isRefund ? 'refund' : 'payment',
    entry_date: paidAtStr.slice(0, 10),
    description: isRefund
      ? `Refund via ${paymentMethod}`
      : `Payment via ${paymentMethod}${referenceNumber ? ` (${referenceNumber})` : ''}`,
    amount_paise: amountPaise,
    quantity: 1,
    unit_price_paise: amountPaise,
    posted_by: recordedBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await folioRepository.addEntry(entry);

  // Create StayPayment record
  const payment: StayPayment = {
    id: crypto.randomUUID(),
    business_id: businessId,
    folio_id: folioId,
    booking_id: bookingId,
    amount_paise: amountPaise,
    payment_method: paymentMethod,
    paid_at: paidAtStr,
    reference_number: referenceNumber,
    is_advance: isAdvance,
    is_refund: isRefund,
    notes,
    recorded_by: recordedBy,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };
  await db.stay_payments.add(payment);

  await recalculateFolioTotals(folioId, businessId);

  return payment;
}

// ---------------------------------------------------------------------------
// calculateFolioBalance
// ---------------------------------------------------------------------------

/**
 * Returns the current balance of a folio in paise.
 * Positive value = amount owed by guest.
 * Negative value = credit in favour of guest.
 */
export async function calculateFolioBalance(folioId: string): Promise<number> {
  const folio = await folioRepository.findById(folioId);
  if (!folio) throw new Error(`Folio ${folioId} not found.`);
  return folio.balance_paise;
}

// ---------------------------------------------------------------------------
// generateFinalBillSummary
// ---------------------------------------------------------------------------

/**
 * Generate a structured final bill summary for display or printing.
 * All amounts are in paise.
 */
export async function generateFinalBillSummary(
  folioId: string,
  businessId: string
): Promise<FinalBillSummary> {
  const folio = await folioRepository.findById(folioId);
  if (!folio) throw new Error(`Folio ${folioId} not found.`);

  const booking = await bookingRepository.findById(folio.booking_id);
  if (!booking) throw new Error(`Booking ${folio.booking_id} not found.`);

  const entries = await folioRepository.getEntries(businessId, folioId);

  const lines: BillSummaryLine[] = [];
  let subtotal = 0;
  let discounts = 0;
  let payments = 0;

  // Room charges
  const roomEntries = entries.filter((e) => e.entry_type === 'room_charge');
  for (const e of roomEntries) {
    lines.push({ label: e.description, amount_paise: e.amount_paise });
    subtotal += e.amount_paise;
  }

  // Additional charges
  const additionalEntries = entries.filter((e) => e.entry_type === 'additional_charge');
  for (const e of additionalEntries) {
    lines.push({ label: e.description, amount_paise: e.amount_paise });
    subtotal += e.amount_paise;
  }

  // Taxes
  const taxEntries = entries.filter((e) => e.entry_type === 'tax');
  for (const e of taxEntries) {
    lines.push({ label: e.description, amount_paise: e.amount_paise });
    subtotal += e.amount_paise;
  }

  lines.push({ label: 'Subtotal', amount_paise: subtotal, is_subtotal: true });

  // Discounts
  for (const e of entries.filter((e) => e.entry_type === 'discount')) {
    lines.push({ label: `Discount: ${e.description}`, amount_paise: -e.amount_paise });
    discounts += e.amount_paise;
  }

  const grandTotal = subtotal - discounts;
  lines.push({ label: 'Grand Total', amount_paise: grandTotal, is_total: true });

  // Payments received
  for (const e of entries.filter((e) => e.entry_type === 'payment' || e.entry_type === 'refund')) {
    const isRefund = e.entry_type === 'refund';
    lines.push({ label: isRefund ? `Refund: ${e.description}` : e.description, amount_paise: -e.amount_paise });
    payments += isRefund ? -e.amount_paise : e.amount_paise;
  }

  // Resolve room number
  let roomNumber = 'N/A';
  if (booking.room_id) {
    const room = await db.rooms.get(booking.room_id);
    if (room) roomNumber = room.number;
  }

  // Resolve guest name
  let guestName = 'Guest';
  const guest = await db.stay_guests.get(booking.primary_guest_id);
  if (guest) guestName = guest.name;

  const nights = calculateNights(booking.check_in_date, booking.check_out_date);

  return {
    folio_id: folioId,
    booking_reference: booking.booking_reference,
    guest_name: guestName,
    room_number: roomNumber,
    check_in_date: booking.check_in_date,
    check_out_date: booking.check_out_date,
    nights,
    lines,
    grand_total_paise: grandTotal,
    total_paid_paise: payments,
    balance_due_paise: grandTotal - payments,
    generated_at: new Date().toISOString(),
  };
}
