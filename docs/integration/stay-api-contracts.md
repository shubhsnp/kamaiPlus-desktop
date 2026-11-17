# KAMAI STAY — DOMAIN API & SERVICE CONTRACTS

**Document:** `docs/integration/stay-api-contracts.md`  
**Purpose:** Formal TypeScript interface specifications for all Stay domain services.  
**Last Updated:** November 2026  

---

## 1. Domain Services Overview

Stay encapsulates all business logic inside typed domain services located in `src/lib/stay/services/`:

```text
src/lib/stay/services/
├── bookingService.ts       # Booking creation, check-in, reference generation
├── availabilityService.ts  # Room conflict detection, nights calculation
└── financialService.ts     # Charges, payments, refunds, final bill calculation
```

---

## 2. Core Service Contracts

### 2.1 Booking Service (`bookingService.ts`)

```typescript
export interface CreateReservationParams {
  businessId: string;
  roomTypeId: string;
  roomId?: string;
  primaryGuestId: string;
  checkInDate: string;        // YYYY-MM-DD
  checkOutDate: string;       // YYYY-MM-DD
  adults: number;
  children: number;
  agreedRatePaise: number;    // integer paise
  source?: BookingSource;
  specialRequests?: string;
  bookingReference?: string;
  status?: BookingStatus;
}

export function createReservation(params: CreateReservationParams): Promise<Booking>;

export function checkIn(params: {
  bookingId: string;
  roomId: string;
  checkedInBy?: string;
}): Promise<Booking>;

export function checkOut(bookingId: string): Promise<Booking>;

export function generateBookingReference(prefix?: string, seq?: number): string;
```

---

### 2.2 Availability Service (`availabilityService.ts`)

```typescript
export function calculateNights(checkInDate: string, checkOutDate: string): number;

export function hasOverlappingBooking(
  businessId: string,
  roomId: string,
  checkInDate: string,
  checkOutDate: string,
  excludeBookingId?: string
): Promise<boolean>;

export function getAvailableRooms(
  businessId: string,
  checkInDate: string,
  checkOutDate: string,
  roomTypeId?: string
): Promise<Room[]>;
```

---

### 2.3 Financial Service (`financialService.ts`)

```typescript
export interface RecordPaymentParams {
  businessId: string;
  folioId: string;
  bookingId: string;
  amountPaise: number;        // positive integer paise
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  isAdvance?: boolean;
  isRefund?: boolean;
  notes?: string;
}

export function recordPayment(params: RecordPaymentParams): Promise<StayPayment>;

export function postRoomCharge(
  businessId: string,
  folioId: string,
  amountPaise: number,
  description: string,
  entryDate: string
): Promise<FolioEntry>;

export function generateFinalBillSummary(
  folioId: string,
  businessId: string
): Promise<FinalBillSummary>;
```
