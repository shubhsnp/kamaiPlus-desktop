/**
 * Stay Module – Folio Repository
 *
 * CRUD operations for `stay_folios` and `stay_folio_entries` tables.
 * Uses the main Dexie db instance.
 */

import { db } from '@/lib/db';
import type { Folio, FolioEntry, FolioStatus, FolioEntryType } from '@/lib/stay/types';

export const folioRepository = {
  // ── Folio methods ─────────────────────────────────────────────────────────

  /**
   * Find a folio by ID.
   */
  async findById(id: string): Promise<Folio | undefined> {
    try {
      return await db.stay_folios.get(id);
    } catch (err) {
      console.error('[folioRepository.findById]', err);
      throw err;
    }
  },

  /**
   * Find the folio(s) for a booking.
   */
  async findByBooking(businessId: string, bookingId: string): Promise<Folio[]> {
    try {
      return await db.stay_folios
        .where('booking_id')
        .equals(bookingId)
        .and((f) => f.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[folioRepository.findByBooking]', err);
      throw err;
    }
  },

  /**
   * Find the open folio for a booking (there should normally be only one).
   */
  async findOpenFolio(businessId: string, bookingId: string): Promise<Folio | undefined> {
    try {
      return await db.stay_folios
        .where('booking_id')
        .equals(bookingId)
        .and((f) => f.business_id === businessId && f.status === 'open')
        .first();
    } catch (err) {
      console.error('[folioRepository.findOpenFolio]', err);
      throw err;
    }
  },

  /**
   * Find folios by status.
   */
  async findByStatus(businessId: string, status: FolioStatus): Promise<Folio[]> {
    try {
      return await db.stay_folios
        .where('status')
        .equals(status)
        .and((f) => f.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[folioRepository.findByStatus]', err);
      throw err;
    }
  },

  /**
   * Create a new folio.
   */
  async create(folio: Folio): Promise<string> {
    try {
      return await db.stay_folios.add(folio);
    } catch (err) {
      console.error('[folioRepository.create]', err);
      throw err;
    }
  },

  /**
   * Update folio fields (e.g., recalculated totals, status change).
   */
  async update(id: string, changes: Partial<Omit<Folio, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.stay_folios.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`Folio ${id} not found`);
    } catch (err) {
      console.error('[folioRepository.update]', err);
      throw err;
    }
  },

  /**
   * Close a folio.
   */
  async close(id: string): Promise<void> {
    try {
      await folioRepository.update(id, {
        status: 'closed',
        closed_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('[folioRepository.close]', err);
      throw err;
    }
  },

  /**
   * Upsert a folio.
   */
  async save(folio: Folio): Promise<string> {
    try {
      return await db.stay_folios.put(folio);
    } catch (err) {
      console.error('[folioRepository.save]', err);
      throw err;
    }
  },

  // ── Folio Entry methods ───────────────────────────────────────────────────

  /**
   * Fetch all entries for a folio.
   */
  async getEntries(businessId: string, folioId: string): Promise<FolioEntry[]> {
    try {
      return await db.stay_folio_entries
        .where('folio_id')
        .equals(folioId)
        .and((e) => e.business_id === businessId)
        .toArray();
    } catch (err) {
      console.error('[folioRepository.getEntries]', err);
      throw err;
    }
  },

  /**
   * Fetch entries of a specific type for a folio.
   */
  async getEntriesByType(businessId: string, folioId: string, entryType: FolioEntryType): Promise<FolioEntry[]> {
    try {
      return await db.stay_folio_entries
        .where('folio_id')
        .equals(folioId)
        .and((e) => e.business_id === businessId && e.entry_type === entryType)
        .toArray();
    } catch (err) {
      console.error('[folioRepository.getEntriesByType]', err);
      throw err;
    }
  },

  /**
   * Add a single entry to a folio.
   */
  async addEntry(entry: FolioEntry): Promise<string> {
    try {
      return await db.stay_folio_entries.add(entry);
    } catch (err) {
      console.error('[folioRepository.addEntry]', err);
      throw err;
    }
  },

  /**
   * Update a folio entry.
   */
  async updateEntry(id: string, changes: Partial<Omit<FolioEntry, 'id' | 'business_id' | 'created_at'>>): Promise<void> {
    try {
      const count = await db.stay_folio_entries.update(id, {
        ...changes,
        updated_at: new Date().toISOString(),
      });
      if (count === 0) throw new Error(`FolioEntry ${id} not found`);
    } catch (err) {
      console.error('[folioRepository.updateEntry]', err);
      throw err;
    }
  },

  /**
   * Delete a folio entry (e.g., void a posted charge).
   */
  async deleteEntry(id: string): Promise<void> {
    try {
      await db.stay_folio_entries.delete(id);
    } catch (err) {
      console.error('[folioRepository.deleteEntry]', err);
      throw err;
    }
  },

  /**
   * Upsert a folio entry.
   */
  async saveEntry(entry: FolioEntry): Promise<string> {
    try {
      return await db.stay_folio_entries.put(entry);
    } catch (err) {
      console.error('[folioRepository.saveEntry]', err);
      throw err;
    }
  },
} as const;
