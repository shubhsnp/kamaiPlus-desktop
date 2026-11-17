/**
 * Stay Module – Guest Repository
 *
 * All CRUD operations for the `stay_guests` table.
 * Uses the main Dexie db instance.
 */

import { db } from '@/lib/db';
import type { Guest } from '@/lib/stay/types';

export const guestRepository = {
  /**
   * Fetch all guests for a business.
   */
  async findAll(businessId: string): Promise<Guest[]> {
    try {
      return await db.stay_guests.where('business_id').equals(businessId).toArray();
    } catch (err) {
      console.error('[guestRepository.findAll]', err);
      throw err;
    }
  },

  /**
   * Find a guest by ID.
   */
  async findById(id: string): Promise<Guest | undefined> {
    try {
      return await db.stay_guests.get(id);
    } catch (err) {
      console.error('[guestRepository.findById]', err);
      throw err;
    }
  },

  /**
   * Search guests by name or phone (case-insensitive prefix match).
   */
  async search(businessId: string, query: string): Promise<Guest[]> {
    try {
      const q = query.toLowerCase().trim();
      const all = await db.stay_guests.where('business_id').equals(businessId).toArray();
      return all.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          g.phone.includes(q) ||
          (g.email?.toLowerCase().includes(q) ?? false)
      );
    } catch (err) {
      console.error('[guestRepository.search]', err);
      throw err;
    }
  },

  /**
   * Find a guest by phone within a business.
   */
  async findByPhone(businessId: string, phone: string): Promise<Guest | undefined> {
    try {
      return await db.stay_guests
        .where('business_id')
        .equals(businessId)
        .and((g) => g.phone === phone)
        .first();
    } catch (err) {
      console.error('[guestRepository.findByPhone]', err);
      throw err;
    }
  },

  /**
   * Create a new guest profile.
   */
  async create(guest: Guest): Promise<string> {
    try {
      return await db.stay_guests.add(guest);
    } catch (err) {
      console.error('[guestRepository.create]', err);
      throw err;
    }
  },

  /**
   * Update guest profile fields.
   */
  async update(id: string, changes: Partial<Omit<Guest, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.stay_guests.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`Guest ${id} not found`);
    } catch (err) {
      console.error('[guestRepository.update]', err);
      throw err;
    }
  },

  /**
   * Hard-delete a guest.
   */
  async delete(id: string): Promise<void> {
    try {
      await db.stay_guests.delete(id);
    } catch (err) {
      console.error('[guestRepository.delete]', err);
      throw err;
    }
  },

  /**
   * Upsert a guest.
   */
  async save(guest: Guest): Promise<string> {
    try {
      return await db.stay_guests.put(guest);
    } catch (err) {
      console.error('[guestRepository.save]', err);
      throw err;
    }
  },

  /**
   * Find or create a guest by phone number.
   * Returns the guest and a boolean indicating whether it was newly created.
   */
  async findOrCreate(
    businessId: string,
    phone: string,
    defaults: Omit<Guest, 'id' | 'business_id' | 'created_at' | 'updated_at' | 'sync_status'>
  ): Promise<{ guest: Guest; created: boolean }> {
    try {
      const existing = await guestRepository.findByPhone(businessId, phone);
      if (existing) return { guest: existing, created: false };

      const now = new Date().toISOString();
      const newGuest: Guest = {
        ...defaults,
        id: crypto.randomUUID(),
        business_id: businessId,
        phone,
        created_at: now,
        updated_at: now,
        sync_status: 'pending',
      };

      await db.stay_guests.add(newGuest);
      return { guest: newGuest, created: true };
    } catch (err) {
      console.error('[guestRepository.findOrCreate]', err);
      throw err;
    }
  },
} as const;
