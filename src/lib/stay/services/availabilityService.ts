/**
 * Stay Module – Availability Service
 *
 * Functions for checking room availability and calculating stays.
 *
 * @warning LOCAL CHECK ONLY - not a multi-device booking lock.
 * These checks operate purely against the local IndexedDB.  In a
 * multi-device or multi-user environment a room can be double-booked
 * if two devices are online simultaneously and no server-side lock
 * is in place.  Always confirm with the backend before treating a
 * booking as final.
 */

import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import type { BookingStatus } from '@/lib/stay/types';

/** Statuses that represent an active claim on a room (not free). */
const ACTIVE_STATUSES: BookingStatus[] = [
  'tentative',
  'confirmed',
  'checked_in',
];

/**
 * Calculate the number of nights between two ISO date strings.
 *
 * @param checkIn  - ISO date string YYYY-MM-DD
 * @param checkOut - ISO date string YYYY-MM-DD
 * @returns number of nights (always a positive integer; throws if <= 0)
 */
export function calculateNights(checkIn: string, checkOut: string): number {
  const inMs = new Date(checkIn).getTime();
  const outMs = new Date(checkOut).getTime();
  const diffMs = outMs - inMs;

  if (diffMs <= 0) {
    throw new Error(
      `checkOut (${checkOut}) must be strictly after checkIn (${checkIn})`
    );
  }

  return Math.round(diffMs / (1_000 * 60 * 60 * 24));
}

/**
 * Check whether a room has any overlapping active booking in the given
 * date window.
 *
 * @warning LOCAL CHECK ONLY - not a multi-device booking lock.
 *
 * @param businessId      - Tenant ID
 * @param roomId          - ID of the room to check
 * @param checkIn         - Proposed check-in  (YYYY-MM-DD)
 * @param checkOut        - Proposed check-out (YYYY-MM-DD)
 * @param excludeBookingId - Optional booking ID to ignore (for editing an
 *                          existing booking without false-positive overlap).
 * @returns `true` if another booking conflicts with the requested window.
 */
export async function hasOverlappingBooking(
  businessId: string,
  roomId: string,
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
): Promise<boolean> {
  const cancelledStatuses: BookingStatus[] = ['cancelled', 'no_show', 'checked_out', 'enquiry'];

  const overlapping = await bookingRepository.findByRoomAndDateRange(
    businessId,
    roomId,
    checkIn,
    checkOut,
    cancelledStatuses
  );

  const conflicts = overlapping.filter(
    (b) =>
      ACTIVE_STATUSES.includes(b.status) &&
      b.id !== excludeBookingId
  );

  return conflicts.length > 0;
}

/**
 * Returns available room IDs for a given room-type within a date window.
 *
 * @warning LOCAL CHECK ONLY - not a multi-device booking lock.
 *
 * @param businessId   - Tenant ID
 * @param roomIds      - All room IDs of the requested type to check
 * @param checkIn      - YYYY-MM-DD
 * @param checkOut     - YYYY-MM-DD
 * @returns subset of `roomIds` that have no conflicting booking
 */
export async function getAvailableRooms(
  businessId: string,
  roomIds: string[],
  checkIn: string,
  checkOut: string
): Promise<string[]> {
  const checks = await Promise.all(
    roomIds.map((roomId) =>
      hasOverlappingBooking(businessId, roomId, checkIn, checkOut).then(
        (conflict) => ({ roomId, conflict })
      )
    )
  );

  return checks.filter((c) => !c.conflict).map((c) => c.roomId);
}
