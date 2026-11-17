'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { validateRoom } from '@/lib/stay/validation';
import type { Room, RoomType, RoomStatus } from '@/lib/stay/types';

interface AddRoomDialogProps {
  businessId: string;
  roomTypes: RoomType[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (room: Room) => void;
  initialData?: Room | null;
}

export const AddRoomDialog: React.FC<AddRoomDialogProps> = ({
  businessId,
  roomTypes,
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { t } = useTranslation();
  const [number, setNumber] = useState(initialData?.number || '');
  const [floor, setFloor] = useState(initialData ? initialData.floor.toString() : '1');
  const [roomTypeId, setRoomTypeId] = useState(
    initialData?.room_type_id || (roomTypes.length > 0 ? roomTypes[0].id : '')
  );
  const [status, setStatus] = useState<RoomStatus>(initialData?.status || 'available');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    if (!roomTypeId) {
      setErrors([t('Please select a room category first')]);
      return;
    }

    const floorNum = parseInt(floor, 10);
    if (isNaN(floorNum)) {
      setErrors([t('Floor must be a valid integer number')]);
      return;
    }

    const now = new Date().toISOString();
    const roomRecord: Room = {
      id: initialData?.id || crypto.randomUUID(),
      business_id: businessId,
      number: number.trim(),
      floor: floorNum,
      room_type_id: roomTypeId,
      status,
      notes: notes.trim() || undefined,
      is_active: true,
      created_at: initialData?.created_at || now,
      updated_at: now,
      sync_status: 'pending',
    };

    const validation = validateRoom(roomRecord);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialData) {
        await roomRepository.update(initialData.id, roomRecord);
      } else {
        // check duplicate number
        const existing = await roomRepository.findByNumber(businessId, roomRecord.number);
        if (existing) {
          setErrors([`Room number ${roomRecord.number} already exists`]);
          setIsSubmitting(false);
          return;
        }
        await roomRepository.create(roomRecord);
      }
      onSuccess(roomRecord);
      onClose();
    } catch (err: unknown) {
      setErrors([err instanceof Error ? err.message : 'Failed to save room']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? t('Edit Room') : t('Add Room')}
      description={t('Assign room number, floor, category and initial status')}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errors.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold space-y-1">
            {errors.map((err, idx) => (
              <div key={idx}>• {err}</div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('Room Number') + ' *'}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            placeholder="e.g. 101, 204"
            required
          />
          <Input
            label={t('Floor') + ' *'}
            type="number"
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="1"
            required
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-900 block mb-1">
            {t('Room Category / Type')} *
          </label>
          <select
            className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-900 min-h-[38px]"
            value={roomTypeId}
            onChange={(e) => setRoomTypeId(e.target.value)}
            required
          >
            {roomTypes.length === 0 ? (
              <option value="">{t('No room categories created yet')}</option>
            ) : (
              roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name} ({rt.code}) — ₹{(rt.base_rate_paise / 100).toFixed(0)}/night
                </option>
              ))
            )}
          </select>
        </div>

        {initialData && (
          <div>
            <label className="text-xs font-bold text-slate-900 block mb-1">
              {t('Status')}
            </label>
            <select
              className="w-full bg-white border border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:border-slate-900 min-h-[38px]"
              value={status}
              onChange={(e) => setStatus(e.target.value as RoomStatus)}
            >
              <option value="available">{t('Available')}</option>
              <option value="occupied">{t('Occupied')}</option>
              <option value="reserved">{t('Reserved')}</option>
              <option value="cleaning">{t('Cleaning')}</option>
              <option value="maintenance">{t('Maintenance')}</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </div>
        )}

        <Input
          label={t('Notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. East facing, extra bed space"
        />

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="md" onClick={onClose}>
            {t('Cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            className="bg-violet-600 hover:bg-violet-700 text-white min-h-[40px]"
          >
            {initialData ? t('Update Room') : t('Save Room')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
