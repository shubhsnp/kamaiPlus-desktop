/**
 * Stay Module – Room Repository
 *
 * All CRUD operations for the `rooms` table.
 * Uses the main Dexie db instance.
 */

import { db } from '@/lib/db';
import type { Room, RoomStatus } from '@/lib/stay/types';

export const roomRepository = {
  /**
   * Fetch all rooms for a business (active only by default).
   */
  async findAll(businessId: string, includeInactive = false): Promise<Room[]> {
    try {
      const all = await db.rooms.where('business_id').equals(businessId).toArray();
      return includeInactive ? all : all.filter((r) => r.is_active);
    } catch (err) {
      console.error('[roomRepository.findAll]', err);
      throw err;
    }
  },

  /**
   * Find a single room by its ID.
   */
  async findById(id: string): Promise<Room | undefined> {
    try {
      return await db.rooms.get(id);
    } catch (err) {
      console.error('[roomRepository.findById]', err);
      throw err;
    }
  },

  /**
   * Find rooms by room type.
   */
  async findByRoomType(businessId: string, roomTypeId: string): Promise<Room[]> {
    try {
      return await db.rooms
        .where('business_id')
        .equals(businessId)
        .and((r) => r.room_type_id === roomTypeId && r.is_active)
        .toArray();
    } catch (err) {
      console.error('[roomRepository.findByRoomType]', err);
      throw err;
    }
  },

  /**
   * Find rooms by status.
   */
  async findByStatus(businessId: string, status: RoomStatus): Promise<Room[]> {
    try {
      return await db.rooms
        .where('status')
        .equals(status)
        .and((r) => r.business_id === businessId && r.is_active)
        .toArray();
    } catch (err) {
      console.error('[roomRepository.findByStatus]', err);
      throw err;
    }
  },

  /**
   * Find a room by its room number within a business.
   */
  async findByNumber(businessId: string, number: string): Promise<Room | undefined> {
    try {
      return await db.rooms
        .where('business_id')
        .equals(businessId)
        .and((r) => r.number === number)
        .first();
    } catch (err) {
      console.error('[roomRepository.findByNumber]', err);
      throw err;
    }
  },

  /**
   * Create a new room.
   */
  async create(room: Room): Promise<string> {
    try {
      return await db.rooms.add(room);
    } catch (err) {
      console.error('[roomRepository.create]', err);
      throw err;
    }
  },

  /**
   * Update room fields.
   */
  async update(id: string, changes: Partial<Omit<Room, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.rooms.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`Room ${id} not found`);
    } catch (err) {
      console.error('[roomRepository.update]', err);
      throw err;
    }
  },

  /**
   * Update just the status of a room.
   */
  async updateStatus(id: string, status: RoomStatus): Promise<void> {
    try {
      await roomRepository.update(id, { status });
    } catch (err) {
      console.error('[roomRepository.updateStatus]', err);
      throw err;
    }
  },

  /**
   * Soft-delete a room.
   */
  async deactivate(id: string): Promise<void> {
    try {
      await roomRepository.update(id, { is_active: false });
    } catch (err) {
      console.error('[roomRepository.deactivate]', err);
      throw err;
    }
  },

  /**
   * Hard-delete a room.
   */
  async delete(id: string): Promise<void> {
    try {
      await db.rooms.delete(id);
    } catch (err) {
      console.error('[roomRepository.delete]', err);
      throw err;
    }
  },

  /**
   * Upsert a room.
   */
  async save(room: Room): Promise<string> {
    try {
      return await db.rooms.put(room);
    } catch (err) {
      console.error('[roomRepository.save]', err);
      throw err;
    }
  },
} as const;
