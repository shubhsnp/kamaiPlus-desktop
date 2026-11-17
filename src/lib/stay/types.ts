/**
 * Stay Module – TypeScript Domain Models
 *
 * Rules enforced across all types:
 *  - All monetary amounts are stored as **integer paise** (₹1 = 100 paise).
 *    Never use a floating-point rupee value.
 *  - Dates / datetimes are **ISO 8601 strings** (YYYY-MM-DD or full ISO).
 *  - Every record carries `business_id` for multi-tenant isolation.
 *  - IDs are `crypto.randomUUID()` strings.
 */

// ---------------------------------------------------------------------------
// Enumerations / union types
// ---------------------------------------------------------------------------

export type RoomStatus =
  | 'available'
  | 'occupied'
  | 'reserved'
  | 'cleaning'
  | 'maintenance'
  | 'out_of_service';

export type BookingStatus =
  | 'enquiry'
  | 'tentative'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type PaymentMethod =
  | 'cash'
  | 'upi'
  | 'card'
  | 'bank_transfer'
  | 'ota_collect'   // Online Travel Agent collects on behalf of property
  | 'credit'        // Authorized credit / debtor account
  | 'split'         // Multi-tender split payment
  | 'other';

export type FolioEntryType =
  | 'room_charge'
  | 'additional_charge'
  | 'discount'
  | 'tax'
  | 'payment'
  | 'refund'
  | 'adjustment';

export type HousekeepingTaskType =
  | 'checkout_clean'
  | 'stayover_clean'
  | 'deep_clean'
  | 'inspection'
  | 'turndown'
  | 'maintenance_request';

export type HousekeepingTaskStatus =
  | 'pending'
  | 'in_progress'
  | 'done'
  | 'skipped';

export type FolioStatus = 'open' | 'closed' | 'settled' | 'credit_ledger';

export type SyncStatus = 'pending' | 'synced' | 'conflict';

// ---------------------------------------------------------------------------
// Room types (categories of rooms, e.g. "Deluxe", "Suite")
// ---------------------------------------------------------------------------

export interface RoomType {
  id: string;
  business_id: string;
  name: string;             // e.g. "Deluxe Double"
  code: string;             // short code e.g. "DD"
  description?: string;
  base_rate_paise: number;  // per-night rack rate in paise (integer)
  max_occupancy: number;
  amenities: string[];      // e.g. ["AC", "WiFi", "TV"]
  is_active: boolean;
  created_at: string;       // ISO string
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Individual rooms
// ---------------------------------------------------------------------------

export interface Room {
  id: string;
  business_id: string;
  room_type_id: string;
  number: string;           // e.g. "101", "2A"
  floor: number;
  status: RoomStatus;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Guest profile
// ---------------------------------------------------------------------------

export interface Guest {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  email?: string;
  id_type?: 'aadhaar' | 'passport' | 'driving_license' | 'voter_id' | 'other';
  id_number?: string;
  nationality?: string;
  address?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Booking
// ---------------------------------------------------------------------------

export interface Booking {
  id: string;
  business_id: string;

  /** Human-readable reference, e.g. "STY-2611-0001" */
  booking_reference: string;

  room_id?: string;         // may be unassigned at enquiry stage
  room_type_id: string;
  primary_guest_id: string;
  additional_guest_ids: string[];

  status: BookingStatus;

  /** ISO date string YYYY-MM-DD */
  check_in_date: string;
  /** ISO date string YYYY-MM-DD */
  check_out_date: string;

  /** Number of adults */
  adults: number;
  children: number;

  /**
   * `true` for bookings created offline (no server round-trip).
   * Must be synced / confirmed with backend before treating as final.
   */
  is_provisional: boolean;

  /** Rate agreed at booking time, in paise per night */
  agreed_rate_paise: number;

  source?: string;          // e.g. "walk_in", "phone", "booking.com", "airbnb"
  special_requests?: string;
  internal_notes?: string;

  confirmed_at?: string;    // ISO datetime
  checked_in_at?: string;
  checked_out_at?: string;
  cancelled_at?: string;
  cancellation_reason?: string;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Stay Record (the actual in-house stay once checked in)
// ---------------------------------------------------------------------------

export interface StayRecord {
  id: string;
  business_id: string;
  booking_id: string;
  room_id: string;

  status: 'active' | 'checked_out' | 'early_departure';

  /** Actual check-in datetime */
  actual_check_in: string;
  /** Actual check-out datetime, set on departure */
  actual_check_out?: string;

  /** ID of staff who performed check-in */
  checked_in_by?: string;
  checked_out_by?: string;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Folio (the guest's bill / account)
// ---------------------------------------------------------------------------

export interface Folio {
  id: string;
  business_id: string;
  booking_id: string;
  stay_record_id?: string;

  status: FolioStatus;

  /** Sum of all debit entries in paise (computed, stored for quick access) */
  total_charges_paise: number;
  /** Sum of all payment entries in paise */
  total_paid_paise: number;
  /** total_charges_paise - total_paid_paise */
  balance_paise: number;

  /** Authorized credit details if checked out with unpaid balance */
  credit_authorized_paise?: number;
  debtor_name?: string;
  debtor_phone?: string;
  credit_due_date?: string;
  credit_notes?: string;
  credit_authorized_by?: string;

  closed_at?: string;
  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Folio Entry (line item on a folio)
// ---------------------------------------------------------------------------

export interface FolioEntry {
  id: string;
  business_id: string;
  folio_id: string;

  entry_type: FolioEntryType;

  /** ISO date YYYY-MM-DD this charge relates to */
  entry_date: string;

  description: string;

  /**
   * Amount in **paise** (always a positive integer).
   * Whether it is a debit or credit is determined by `entry_type`.
   * Payments and refunds are credits; charges are debits.
   */
  amount_paise: number;

  /** Quantity, e.g. 1 night, 2 meals */
  quantity: number;
  /** Unit price in paise */
  unit_price_paise: number;

  reference_id?: string;    // e.g. linked sale ID for restaurant charges
  posted_by?: string;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Stay Payment
// ---------------------------------------------------------------------------

export interface StayPayment {
  id: string;
  business_id: string;
  folio_id: string;
  booking_id: string;

  amount_paise: number;     // positive integer paise
  payment_method: PaymentMethod;

  /** ISO datetime when payment was received */
  paid_at: string;

  reference_number?: string; // UPI transaction ID, card auth code, etc.

  /**
   * `true` for advance payments collected before check-in.
   */
  is_advance: boolean;

  /**
   * `true` for refunds issued to the guest.
   */
  is_refund: boolean;

  notes?: string;
  recorded_by?: string;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Housekeeping Task
// ---------------------------------------------------------------------------

export interface HousekeepingTask {
  id: string;
  business_id: string;
  room_id: string;

  task_type: HousekeepingTaskType;
  status: HousekeepingTaskStatus;

  assigned_to?: string;     // staff ID or name

  /** ISO date YYYY-MM-DD this task is scheduled for */
  scheduled_date: string;

  started_at?: string;
  completed_at?: string;
  notes?: string;

  created_at: string;
  updated_at: string;
  sync_status: SyncStatus;
}

// ---------------------------------------------------------------------------
// Stay Settings (per business)
// ---------------------------------------------------------------------------

export interface StaySettings {
  id: string;
  business_id: string;

  property_name?: string;
  property_star_rating?: 1 | 2 | 3 | 4 | 5;

  /** Default check-in time, e.g. "14:00" */
  default_check_in_time: string;
  /** Default check-out time, e.g. "11:00" */
  default_check_out_time: string;

  /** GST rate on room charges in basis points (e.g. 1200 = 12%) */
  gst_rate_bps: number;

  /** Prefix for booking reference numbers, e.g. "STY" */
  booking_reference_prefix: string;

  /** Next sequential booking number (integer counter) */
  next_booking_sequence: number;

  /** Accept advance deposits? */
  advance_deposit_enabled: boolean;

  currency: string;         // "INR"
  timezone: string;         // e.g. "Asia/Kolkata"

  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Stay Audit Log
// ---------------------------------------------------------------------------

export type StayAuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'status_changed'
  | 'payment_recorded'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled';

export interface StayAuditLog {
  id: string;
  business_id: string;

  entity_type:
    | 'room_type'
    | 'room'
    | 'guest'
    | 'booking'
    | 'stay_record'
    | 'folio'
    | 'folio_entry'
    | 'stay_payment'
    | 'housekeeping_task'
    | 'stay_settings';

  entity_id: string;
  action: StayAuditAction;

  /** JSON-serialized diff or snapshot */
  payload?: string;

  performed_by?: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Utility / helper types
// ---------------------------------------------------------------------------

/** Generic validation result returned by all validation functions */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Summary row in a final bill */
export interface BillSummaryLine {
  label: string;
  amount_paise: number;
  is_subtotal?: boolean;
  is_total?: boolean;
}

/** Full final bill summary */
export interface FinalBillSummary {
  folio_id: string;
  booking_reference: string;
  guest_name: string;
  room_number: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  lines: BillSummaryLine[];
  grand_total_paise: number;
  total_paid_paise: number;
  balance_due_paise: number;
  generated_at: string;
}
