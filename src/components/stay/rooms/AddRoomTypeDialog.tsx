'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { validateRoomType } from '@/lib/stay/validation';
import type { RoomType } from '@/lib/stay/types';

interface AddRoomTypeDialogProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roomType: RoomType) => void;
  initialData?: RoomType | null;
}

const COMMON_AMENITIES = ['AC', 'Free WiFi', 'TV', 'Geyser', 'Attached Bath', 'Balcony', 'Breakfast Included', 'Room Service'];

export const AddRoomTypeDialog: React.FC<AddRoomTypeDialogProps> = ({
  businessId,
  isOpen,
  onClose,
  onSuccess,
  initialData,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [priceRupees, setPriceRupees] = useState(
    initialData ? (initialData.base_rate_paise / 100).toString() : '1200'
  );
  const [maxOccupancy, setMaxOccupancy] = useState(
    initialData ? initialData.max_occupancy.toString() : '2'
  );
  const [amenities, setAmenities] = useState<string[]>(initialData?.amenities || ['AC', 'Free WiFi', 'TV']);
  const [customAmenity, setCustomAmenity] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleAmenity = (amenity: string) => {
    if (amenities.includes(amenity)) {
      setAmenities(amenities.filter((a) => a !== amenity));
    } else {
      setAmenities([...amenities, amenity]);
    }
  };

  const addCustomAmenity = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAmenity.trim() && !amenities.includes(customAmenity.trim())) {
      setAmenities([...amenities, customAmenity.trim()]);
      setCustomAmenity('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);

    const parsedPrice = parseFloat(priceRupees);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setErrors(['Price must be a valid non-negative number']);
      return;
    }

    const pricePaise = Math.round(parsedPrice * 100);
    const occ = parseInt(maxOccupancy, 10) || 1;

    const now = new Date().toISOString();
    const typeRecord: RoomType = {
      id: initialData?.id || crypto.randomUUID(),
      business_id: businessId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      base_rate_paise: pricePaise,
      max_occupancy: occ,
      amenities,
      is_active: true,
      created_at: initialData?.created_at || now,
      updated_at: now,
      sync_status: 'pending',
    };

    const validation = validateRoomType(typeRecord);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (initialData) {
        await roomTypeRepository.update(initialData.id, typeRecord);
      } else {
        await roomTypeRepository.create(typeRecord);
      }
      onSuccess(typeRecord);
      onClose();
    } catch (err: unknown) {
      setErrors([err instanceof Error ? err.message : 'Failed to save room type']);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? t('Edit Room Type') : t('Add Room Type')}
      description={t('Configure room category details, rates and amenities')}
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
            label={t('Room Type Name') + ' *'}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!code && e.target.value) {
                setCode(e.target.value.substring(0, 3).toUpperCase());
              }
            }}
            placeholder="e.g. Deluxe Double"
            required
          />
          <Input
            label={t('Code') + ' *'}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. DLX"
            maxLength={10}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={t('Price Per Night (₹)') + ' *'}
            type="number"
            min="0"
            step="1"
            value={priceRupees}
            onChange={(e) => setPriceRupees(e.target.value)}
            placeholder="1200"
            required
          />
          <Input
            label={t('Max Occupancy') + ' *'}
            type="number"
            min="1"
            max="20"
            value={maxOccupancy}
            onChange={(e) => setMaxOccupancy(e.target.value)}
            placeholder="2"
            required
          />
        </div>

        <Input
          label={t('Description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Spacious room with balcony view"
        />

        <div>
          <label className="text-xs font-bold text-slate-900 block mb-1.5">{t('Amenities')}</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {COMMON_AMENITIES.map((item) => {
              const selected = amenities.includes(item);
              return (
                <button
                  type="button"
                  key={item}
                  onClick={() => toggleAmenity(item)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                    selected
                      ? 'bg-violet-100 text-violet-800 border-violet-300'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {selected ? '✓ ' : '+ '}{item}
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Input
              value={customAmenity}
              onChange={(e) => setCustomAmenity(e.target.value)}
              placeholder="Add other amenity..."
              className="min-h-[32px] text-xs"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addCustomAmenity}
            >
              +
            </Button>
          </div>
        </div>

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
            {initialData ? t('Update Room Type') : t('Save Room Type')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
