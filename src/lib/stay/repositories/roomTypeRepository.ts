/**
 * Stay Module – Room Type Repository
 *
 * All CRUD operations for the `room_types` table.
 * Uses the main Dexie db instance.
 */

import { db } from '@/lib/db';
import type { RoomType } from '@/lib/stay/types';

export const roomTypeRepository = {
  /**
   * Fetch all room types for a business (active only by default).
   */
  async findAll(businessId: string, includeInactive = false): Promise<RoomType[]> {
    try {
      const query = db.room_types.where('business_id').equals(businessId);
      const all = await query.toArray();
      return includeInactive ? all : all.filter((rt) => rt.is_active);
    } catch (err) {
      console.error('[roomTypeRepository.findAll]', err);
      throw err;
    }
  },

  /**
   * Find a single room type by its ID.
   */
  async findById(id: string): Promise<RoomType | undefined> {
    try {
      return await db.room_types.get(id);
    } catch (err) {
      console.error('[roomTypeRepository.findById]', err);
      throw err;
    }
  },

  /**
   * Find a room type by its short code within a business.
   */
  async findByCode(businessId: string, code: string): Promise<RoomType | undefined> {
    try {
      return await db.room_types
        .where('business_id')
        .equals(businessId)
        .and((rt) => rt.code === code)
        .first();
    } catch (err) {
      console.error('[roomTypeRepository.findByCode]', err);
      throw err;
    }
  },

  /**
   * Create a new room type.
   */
  async create(roomType: RoomType): Promise<string> {
    try {
      return await db.room_types.add(roomType);
    } catch (err) {
      console.error('[roomTypeRepository.create]', err);
      throw err;
    }
  },

  /**
   * Update an existing room type (full replacement).
   */
  async update(id: string, changes: Partial<Omit<RoomType, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.room_types.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`RoomType ${id} not found`);
    } catch (err) {
      console.error('[roomTypeRepository.update]', err);
      throw err;
    }
  },

  /**
   * Soft-delete: set is_active to false.
   */
  async deactivate(id: string): Promise<void> {
    try {
      await roomTypeRepository.update(id, { is_active: false });
    } catch (err) {
      console.error('[roomTypeRepository.deactivate]', err);
      throw err;
    }
  },

  /**
   * Hard-delete.  Prefer `deactivate` unless truly needed.
   */
  async delete(id: string): Promise<void> {
    try {
      await db.room_types.delete(id);
    } catch (err) {
      console.error('[roomTypeRepository.delete]', err);
      throw err;
    }
  },

  /**
   * Save (upsert) a room type.
   */
  async save(roomType: RoomType): Promise<string> {
    try {
      return await db.room_types.put(roomType);
    } catch (err) {
      console.error('[roomTypeRepository.save]', err);
      throw err;
    }
  },
} as const;
