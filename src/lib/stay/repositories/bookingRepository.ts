/**
 * Stay Module – Booking Repository
 *
 * All CRUD operations for the `stay_bookings` table.
 * Uses the main Dexie db instance.
 */

import { db } from '@/lib/db';
import type { Booking, BookingStatus } from '@/lib/stay/types';

export const bookingRepository = {
  /**
   * Fetch all bookings for a business.
   */
  async findAll(businessId: string): Promise<Booking[]> {
    try {
      return await db.stay_bookings.where('business_id').equals(businessId).toArray();
    } catch (err) {
      console.error('[bookingRepository.findAll]', err);
      throw err;
    }
  },

  /**
   * Find a booking by its ID.
   */
  async findById(id: string): Promise<Booking | undefined> {
    try {
      return await db.stay_bookings.get(id);
    } catch (err) {
      console.error('[bookingRepository.findById]', err);
      throw err;
    }
  },

  /**
   * Find a booking by its human-readable reference number.
   */
  async findByReference(businessId: string, bookingReference: string): Promise<Booking | undefined> {
    try {
      return await db.stay_bookings
        .where('booking_reference')
        .equals(bookingReference)
        .and((b) => b.business_id === businessId)
        .first();
    } catch (err) {
      console.error('[bookingRepository.findByReference]', err);
      throw err;
    }
  },

  /**
   * Find all bookings for a specific room.
   */
  async findByRoom(businessId: string, roomId: string): Promise<Booking[]> {
    try {
      return await db.stay_bookings
        .where('room_id')
        .equals(roomId)
        .and((b) => b.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[bookingRepository.findByRoom]', err);
      throw err;
    }
  },

  /**
   * Find all bookings for a specific guest.
   */
  async findByGuest(businessId: string, guestId: string): Promise<Booking[]> {
    try {
      return await db.stay_bookings
        .where('primary_guest_id')
        .equals(guestId)
        .and((b) => b.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[bookingRepository.findByGuest]', err);
      throw err;
    }
  },

  /**
   * Find bookings by status.
   */
  async findByStatus(businessId: string, status: BookingStatus): Promise<Booking[]> {
    try {
      return await db.stay_bookings
        .where('status')
        .equals(status)
        .and((b) => b.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[bookingRepository.findByStatus]', err);
      throw err;
    }
  },

  /**
   * Find bookings for a room within a date range (for overlap detection).
   * Returns bookings whose check-in/out window overlaps with [from, to].
   */
  async findByRoomAndDateRange(
    businessId: string,
    roomId: string,
    fromDate: string,
    toDate: string,
    excludeStatuses: BookingStatus[] = ['cancelled', 'no_show']
  ): Promise<Booking[]> {
    try {
      const all = await db.stay_bookings
        .where('room_id')
        .equals(roomId)
        .and((b) => b.business_id === businessId && !excludeStatuses.includes(b.status))
        .toArray();

      return all.filter(
        (b) =>
          // Overlap: b starts before toDate AND b ends after fromDate
          b.check_in_date < toDate && b.check_out_date > fromDate
      );
    } catch (err) {
      console.error('[bookingRepository.findByRoomAndDateRange]', err);
      throw err;
    }
  },

  /**
   * Find bookings arriving on a specific date.
   */
  async findArrivalsOn(businessId: string, date: string): Promise<Booking[]> {
    try {
      return await db.stay_bookings
        .where('check_in_date')
        .equals(date)
        .and((b) => b.business_id === businessId && !['cancelled', 'no_show'].includes(b.status))
        .toArray();
    } catch (err) {
      console.error('[bookingRepository.findArrivalsOn]', err);
      throw err;
    }
  },

  /**
   * Find bookings departing on a specific date.
   */
  async findDeparturesOn(businessId: string, date: string): Promise<Booking[]> {
    try {
      return await db.stay_bookings
        .where('check_out_date')
        .equals(date)
        .and((b) => b.business_id === businessId && !['cancelled', 'no_show'].includes(b.status))
        .toArray();
    } catch (err) {
      console.error('[bookingRepository.findDeparturesOn]', err);
      throw err;
    }
  },

  /**
   * Create a new booking.
   */
  async create(booking: Booking): Promise<string> {
    try {
      return await db.stay_bookings.add(booking);
    } catch (err) {
      console.error('[bookingRepository.create]', err);
      throw err;
    }
  },

  /**
   * Update booking fields.
   */
  async update(id: string, changes: Partial<Omit<Booking, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.stay_bookings.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`Booking ${id} not found`);
    } catch (err) {
      console.error('[bookingRepository.update]', err);
      throw err;
    }
  },

  /**
   * Update just the status of a booking.
   */
  async updateStatus(id: string, status: BookingStatus, extra?: Partial<Booking>): Promise<void> {
    try {
      await bookingRepository.update(id, { status, ...extra });
    } catch (err) {
      console.error('[bookingRepository.updateStatus]', err);
      throw err;
    }
  },

  /**
   * Hard-delete a booking.
   */
  async delete(id: string): Promise<void> {
    try {
      await db.stay_bookings.delete(id);
    } catch (err) {
      console.error('[bookingRepository.delete]', err);
      throw err;
    }
  },

  /**
   * Upsert a booking.
   */
  async save(booking: Booking): Promise<string> {
    try {
      return await db.stay_bookings.put(booking);
    } catch (err) {
      console.error('[bookingRepository.save]', err);
      throw err;
    }
  },
} as const;
