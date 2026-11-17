'use client';

import React from 'react';
import { Card } from '@/components/ui/Card';
import { useTranslation } from '@/lib/i18n';
import type { Room, RoomType, RoomStatus } from '@/lib/stay/types';
import { 
  BedDouble, 
  User, 
  Sparkles, 
  Wrench, 
  Ban, 
  Calendar, 
  CheckCircle2, 
  Edit2, 
  Receipt,
  DoorOpen
} from 'lucide-react';

interface RoomCardProps {
  room: Room;
  roomType?: RoomType;
  currentGuestName?: string;
  onStatusChange: (roomId: string, newStatus: RoomStatus) => void;
  onEdit?: (room: Room) => void;
  onQuickCheckIn?: (room: Room) => void;
  onQuickCheckOut?: (room: Room) => void;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  roomType,
  currentGuestName,
  onStatusChange,
  onEdit,
  onQuickCheckIn,
  onQuickCheckOut,
}) => {
  const { language } = useTranslation();
  const isMarathi = language === 'mr';

  const getStatusConfig = (status: RoomStatus) => {
    switch (status) {
      case 'available':
        return {
          bg: 'bg-emerald-50/70 border-emerald-200/90 text-emerald-800',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          dot: 'bg-emerald-500',
          label: isMarathi ? 'उपलब्ध (Free)' : 'Available',
          icon: CheckCircle2,
        };
      case 'occupied':
        return {
          bg: 'bg-rose-50/70 border-rose-200/90 text-rose-800',
          badgeBg: 'bg-rose-100 text-rose-800 border-rose-300',
          dot: 'bg-rose-500',
          label: isMarathi ? 'व्यापलेले (Occupied)' : 'Occupied',
          icon: User,
        };
      case 'reserved':
        return {
          bg: 'bg-amber-50/70 border-amber-200/90 text-amber-800',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: isMarathi ? 'राखीव (Reserved)' : 'Reserved',
          icon: Calendar,
        };
      case 'cleaning':
        return {
          bg: 'bg-sky-50/70 border-sky-200/90 text-sky-800',
          badgeBg: 'bg-sky-100 text-sky-800 border-sky-300',
          dot: 'bg-sky-500',
          label: isMarathi ? 'स्वच्छता (Cleaning)' : 'Cleaning',
          icon: Sparkles,
        };
      case 'maintenance':
        return {
          bg: 'bg-slate-100/80 border-slate-300 text-slate-700',
          badgeBg: 'bg-slate-200 text-slate-800 border-slate-300',
          dot: 'bg-slate-500',
          label: isMarathi ? 'दुरुस्ती (Maintenance)' : 'Maintenance',
          icon: Wrench,
        };
      case 'out_of_service':
      default:
        return {
          bg: 'bg-zinc-100 border-zinc-300 text-zinc-600',
          badgeBg: 'bg-zinc-200 text-zinc-800 border-zinc-300',
          dot: 'bg-zinc-500',
          label: isMarathi ? 'बंद (Out of Service)' : 'Out of Service',
          icon: Ban,
        };
    }
  };

  const statusConfig = getStatusConfig(room.status);

  return (
    <Card
      className={`relative p-3.5 sm:p-4 rounded-xl border transition-all hover:shadow-md flex flex-col justify-between ${statusConfig.bg}`}
    >
      <div>
        {/* Top bar with Room Number and Status Dropdown */}
        <div className="flex items-start justify-between gap-1 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-slate-900">
              {room.number}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200">
              {isMarathi ? 'मजला' : 'F'}-{room.floor}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <select
              value={room.status}
              onChange={(e) => onStatusChange(room.id, e.target.value as RoomStatus)}
              className={`text-[11px] font-black rounded-lg border px-2 py-1 cursor-pointer focus:outline-none transition ${statusConfig.badgeBg}`}
            >
              <option value="available">{isMarathi ? 'उपलब्ध (Available)' : 'Available'}</option>
              <option value="occupied">{isMarathi ? 'व्यापलेले (Occupied)' : 'Occupied'}</option>
              <option value="reserved">{isMarathi ? 'राखीव (Reserved)' : 'Reserved'}</option>
              <option value="cleaning">{isMarathi ? 'स्वच्छता (Cleaning)' : 'Cleaning'}</option>
              <option value="maintenance">{isMarathi ? 'दुरुस्ती (Maintenance)' : 'Maintenance'}</option>
              <option value="out_of_service">{isMarathi ? 'बंद (Out of Service)' : 'Out of Service'}</option>
            </select>

            {onEdit && (
              <button
                type="button"
                onClick={() => onEdit(room)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white/70 transition cursor-pointer"
                title="Edit Room"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Room Category and Rate */}
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
          <span className="truncate flex items-center gap-1">
            <BedDouble className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <span className="font-bold text-slate-800">{roomType?.name || 'Standard'}</span>
          </span>
          {roomType?.base_rate_paise ? (
            <span className="font-mono font-bold text-slate-900">
              ₹{(roomType.base_rate_paise / 100).toFixed(0)}/n
            </span>
          ) : null}
        </div>

        {/* Occupant Guest info or notes */}
        {room.status === 'occupied' && currentGuestName ? (
          <div className="bg-white/90 border border-rose-200 rounded-lg p-2 flex items-center gap-2 mb-2">
            <User className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                {isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name'}
              </p>
              <p className="text-xs font-black text-slate-900 truncate">{currentGuestName}</p>
            </div>
          </div>
        ) : room.notes ? (
          <p className="text-[11px] text-slate-500 italic truncate mb-2">{room.notes}</p>
        ) : null}
      </div>

      {/* Footer 1-Click Contextual Actions */}
      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>

        {/* 1-Click Contextual Action based on Room Status */}
        {room.status === 'available' && onQuickCheckIn && (
          <button
            type="button"
            onClick={() => onQuickCheckIn(room)}
            className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
          >
            <DoorOpen className="w-3 h-3" />
            <span>{isMarathi ? 'चेक-इन' : 'Check-in'}</span>
          </button>
        )}

        {room.status === 'occupied' && onQuickCheckOut && (
          <button
            type="button"
            onClick={() => onQuickCheckOut(room)}
            className="text-[11px] font-bold text-violet-800 hover:text-violet-950 bg-violet-100 hover:bg-violet-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
          >
            <Receipt className="w-3 h-3" />
            <span>{isMarathi ? 'बिल/चेक-आउट' : 'Bill'}</span>
          </button>
        )}

        {room.status === 'cleaning' && (
          <button
            type="button"
            onClick={() => onStatusChange(room.id, 'available')}
            className="text-[11px] font-bold text-sky-800 hover:text-sky-950 bg-sky-100 hover:bg-sky-200 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>{isMarathi ? 'स्वच्छ झाले ✓' : 'Mark Cleaned'}</span>
          </button>
        )}

        {room.status === 'maintenance' && (
          <button
            type="button"
            onClick={() => onStatusChange(room.id, 'available')}
            className="text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
          >
            <span>{isMarathi ? 'सुरू करा ✓' : 'Mark Ready'}</span>
          </button>
        )}
      </div>
    </Card>
  );
};
