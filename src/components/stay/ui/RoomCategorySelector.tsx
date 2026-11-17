'use client';

import React, { useState } from 'react';
import { BedDouble, Plus, Check, Sparkles, AlertCircle } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import type { RoomType } from '@/lib/stay/types';

interface RoomCategorySelectorProps {
  businessId: string;
  roomTypes: RoomType[];
  selectedRoomTypeId: string;
  onChange: (roomTypeId: string, roomType?: RoomType) => void;
  onRefreshRoomTypes?: () => Promise<void>;
  label?: string;
  required?: boolean;
  error?: string;
  className?: string;
  availableCountPerType?: Record<string, number>;
}

export const RoomCategorySelector: React.FC<RoomCategorySelectorProps> = ({
  businessId,
  roomTypes,
  selectedRoomTypeId,
  onChange,
  onRefreshRoomTypes,
  label,
  required = true,
  error,
  className = '',
  availableCountPerType,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';
  const [isSeeding, setIsSeeding] = useState(false);

  // Quick seed standard categories for new lodges
  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const now = new Date().toISOString();
      const defaults: RoomType[] = [
        {
          id: crypto.randomUUID(),
          business_id: businessId,
          name: isMarathi ? 'डबल नॉन-एसी' : 'Double Non-AC',
          code: 'DBL',
          description: 'Standard double room with fan',
          base_rate_paise: 120000, // ₹1,200
          max_occupancy: 2,
          amenities: ['Fan', 'Free WiFi', 'Attached Bath'],
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          business_id: businessId,
          name: isMarathi ? 'डीफॉल्ट डिलक्स एसी' : 'Deluxe AC',
          code: 'DLX',
          description: 'Air conditioned comfortable room',
          base_rate_paise: 180000, // ₹1,800
          max_occupancy: 2,
          amenities: ['AC', 'Free WiFi', 'TV', 'Geyser'],
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        },
        {
          id: crypto.randomUUID(),
          business_id: businessId,
          name: isMarathi ? 'फॅमिली रूम एसी' : 'Family AC Room',
          code: 'FAM',
          description: 'Spacious room for families (4 guests)',
          base_rate_paise: 250000, // ₹2,500
          max_occupancy: 4,
          amenities: ['AC', 'Free WiFi', 'TV', 'Geyser', 'Attached Bath'],
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        },
      ];

      for (const item of defaults) {
        await roomTypeRepository.create(item);
      }

      if (onRefreshRoomTypes) {
        await onRefreshRoomTypes();
      }
    } catch (err) {
      console.error('Failed to seed default categories', err);
    } finally {
      setIsSeeding(false);
    }
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
          <span className="text-[11px] text-slate-400">
            {isMarathi ? 'खोलीचा प्रकार निवडा' : 'Click to select'}
          </span>
        </div>
      )}

      {/* When no room categories exist */}
      {roomTypes.length === 0 ? (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              {isMarathi
                ? 'कोणताही खोली प्रकार तयार केलेला नाही.'
                : 'No room categories created yet.'}
            </span>
          </div>
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            {isMarathi
              ? 'बुकिंग सुरू करण्यासाठी खालील बटण दाबून स्टँडर्ड प्रकार त्वरित तयार करा:'
              : 'Click below to instantly create standard lodge categories (Non-AC, Deluxe AC, Family):'}
          </p>
          <button
            type="button"
            disabled={isSeeding}
            onClick={handleSeedDefaults}
            className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isSeeding
                ? isMarathi
                  ? 'तयार करत आहे...'
                  : 'Creating categories...'
                : isMarathi
                ? '+ प्रमाणित प्रकार तयार करा (Seed Standard Categories)'
                : '+ Create Standard Categories'}
            </span>
          </button>
        </div>
      ) : (
        /* Visual Category Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {roomTypes.map((rt) => {
            const isSelected = selectedRoomTypeId === rt.id;
            const rateRupees = (rt.base_rate_paise / 100).toFixed(0);
            const count = availableCountPerType?.[rt.id];

            return (
              <button
                type="button"
                key={rt.id}
                onClick={() => onChange(rt.id, rt)}
                className={`flex flex-col text-left p-2.5 rounded-xl border transition cursor-pointer relative ${
                  isSelected
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-600 ring-2 ring-violet-500/20'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="flex items-start justify-between gap-1 w-full mb-1">
                  <div className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                    {rt.name}
                  </div>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-violet-600 text-white flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between w-full mt-auto text-xs">
                  <span className="font-mono font-black text-violet-700 dark:text-violet-400">
                    ₹{rateRupees}
                    <span className="text-[10px] font-normal text-slate-400">/n</span>
                  </span>

                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                      {rt.code}
                    </span>
                    {count !== undefined && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          count > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {count} {isMarathi ? 'उपलब्ध' : 'free'}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-[11px] font-semibold text-rose-600 mt-1">{error}</p>}
    </div>
  );
};
