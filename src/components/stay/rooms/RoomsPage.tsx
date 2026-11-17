'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { roomRepository } from '@/lib/stay/repositories/roomRepository';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import { bookingRepository } from '@/lib/stay/repositories/bookingRepository';
import { guestRepository } from '@/lib/stay/repositories/guestRepository';
import type { Room, RoomType, RoomStatus, Booking, Guest } from '@/lib/stay/types';
import { RoomCard } from './RoomCard';
import { AddRoomDialog } from './AddRoomDialog';
import { AddRoomTypeDialog } from './AddRoomTypeDialog';
import { NewBookingDialog } from '../bookings/NewBookingDialog';
import { CheckOutWizard } from '../checkout/CheckOutWizard';
import { 
  BedDouble, 
  Plus, 
  Layers, 
  RefreshCw, 
  Filter, 
  SlidersHorizontal,
  Edit2,
  Sparkles,
  DoorOpen
} from 'lucide-react';

export const RoomsPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [activeBookings, setActiveBookings] = useState<Booking[]>([]);
  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedFloor, setSelectedFloor] = useState<string>('all');

  // Modals
  const [isAddRoomOpen, setIsAddRoomOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isAddTypeOpen, setIsAddTypeOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  // Contextual checkin/checkout modals
  const [checkInRoomId, setCheckInRoomId] = useState<string | null>(null);
  const [checkOutBooking, setCheckOutBooking] = useState<Booking | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fetchedRooms, fetchedTypes, fetchedBookings, fetchedGuests] = await Promise.all([
        roomRepository.findAll(businessId, true),
        roomTypeRepository.findAll(businessId, true),
        bookingRepository.findByStatus(businessId, 'checked_in'),
        guestRepository.findAll(businessId),
      ]);

      setRooms(fetchedRooms);
      setRoomTypes(fetchedTypes);
      setActiveBookings(fetchedBookings);

      const guestMap: Record<string, Guest> = {};
      fetchedGuests.forEach((g) => {
        guestMap[g.id] = g;
      });
      setGuests(guestMap);
    } catch (err) {
      console.error('Failed to load rooms data', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusChange = async (roomId: string, newStatus: RoomStatus) => {
    // Intercept: Prevent silent status release of occupied rooms without settlement
    const activeBooking = activeBookings.find((b) => b.room_id === roomId);
    if (activeBooking && newStatus !== 'occupied') {
      setCheckOutBooking(activeBooking);
      return;
    }

    try {
      await roomRepository.updateStatus(roomId, newStatus);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, status: newStatus } : r))
      );
    } catch (err) {
      console.error('Failed to update room status', err);
    }
  };

  const roomTypeMap = useMemo(() => {
    const map: Record<string, RoomType> = {};
    roomTypes.forEach((rt) => {
      map[rt.id] = rt;
    });
    return map;
  }, [roomTypes]);

  // Map occupied room ID to current guest name
  const currentGuestByRoomId = useMemo(() => {
    const map: Record<string, string> = {};
    activeBookings.forEach((b) => {
      if (b.room_id) {
        const g = guests[b.primary_guest_id];
        map[b.room_id] = g ? g.name : 'Occupant';
      }
    });
    return map;
  }, [activeBookings, guests]);

  // Unique floors list for filtering
  const floors = useMemo(() => {
    const set = new Set<number>();
    rooms.forEach((r) => set.add(r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [rooms]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (selectedStatus !== 'all' && r.status !== selectedStatus) return false;
      if (selectedFloor !== 'all' && r.floor.toString() !== selectedFloor) return false;
      return true;
    });
  }, [rooms, selectedStatus, selectedFloor]);

  // Quick Checkout trigger for occupied room
  const handleQuickCheckout = (r: Room) => {
    const foundBooking = activeBookings.find((b) => b.room_id === r.id);
    if (foundBooking) {
      setCheckOutBooking(foundBooking);
    }
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <BedDouble className="w-5 h-5 text-violet-600" />
            <span>{isMarathi ? 'खोली व्यवस्थापन (Rooms & Rack)' : 'Rooms & Rack Management'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'खोल्यांचे प्रकार, दर आणि थेट खोली स्थिती व्यवस्थापित करा'
              : 'Manage physical rooms, rate categories, and live room statuses'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            isLoading={isLoading}
            className="flex items-center gap-1.5 min-h-[38px]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setEditingType(null);
              setIsAddTypeOpen(true);
            }}
            className="flex items-center gap-1.5 min-h-[38px] font-bold"
          >
            <Layers className="w-4 h-4" />
            <span>{isMarathi ? '+ खोली प्रकार (Category)' : '+ Room Type'}</span>
          </Button>

          <Button
            variant="primary"
            size="md"
            onClick={() => {
              setEditingRoom(null);
              setIsAddRoomOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1.5 min-h-[38px] shadow-sm"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isMarathi ? '+ नवीन खोली जोडा' : '+ Add Room'}</span>
          </Button>
        </div>
      </div>

      {/* Filter and View Options */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold">
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>{isMarathi ? 'स्थिती' : 'Status'}:</span>
          </span>

          {[
            { id: 'all', label: isMarathi ? 'सर्व' : 'All' },
            { id: 'available', label: isMarathi ? 'उपलब्ध' : 'Available' },
            { id: 'occupied', label: isMarathi ? 'व्यापलेले' : 'Occupied' },
            { id: 'reserved', label: isMarathi ? 'राखीव' : 'Reserved' },
            { id: 'cleaning', label: isMarathi ? 'स्वच्छता' : 'Cleaning' },
            { id: 'maintenance', label: isMarathi ? 'दुरुस्ती' : 'Maintenance' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer whitespace-nowrap text-xs font-bold ${
                selectedStatus === tab.id
                  ? 'bg-violet-600 text-white shadow-2xs font-black'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Floor Filter */}
        {floors.length > 1 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-400">
              {isMarathi ? 'मजला' : 'Floor'}:
            </span>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="all">{isMarathi ? 'सर्व मजले' : 'All Floors'}</option>
              {floors.map((f) => (
                <option key={f} value={f.toString()}>
                  {isMarathi ? `मजला ${f}` : `Floor ${f}`}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Room Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-sm font-semibold text-slate-500">
          {isMarathi ? 'खोल्या लोड करत आहे...' : 'Loading rooms...'}
        </div>
      ) : filteredRooms.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isMarathi ? 'कोणतीही खोली सापडली नाही' : 'No rooms found'}
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            {rooms.length === 0
              ? isMarathi
                ? 'तुमच्या लॉजच्या खोल्या (उदा. १०१, १०२) तयार करा'
                : 'Add rooms like 101, 102 to begin front-desk operations'
              : isMarathi
              ? 'निवडलेल्या निकषांनुसार कोणतीही खोली नाही'
              : 'No rooms match your filter criteria'}
          </p>
          {rooms.length === 0 && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsAddRoomOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[40px] px-6 font-bold"
            >
              + {isMarathi ? 'पहिली खोली जोडा' : 'Add First Room'}
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredRooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              roomType={roomTypeMap[room.room_type_id]}
              currentGuestName={currentGuestByRoomId[room.id]}
              onStatusChange={handleStatusChange}
              onEdit={(r) => {
                setEditingRoom(r);
                setIsAddRoomOpen(true);
              }}
              onQuickCheckIn={(r) => setCheckInRoomId(r.id)}
              onQuickCheckOut={(r) => handleQuickCheckout(r)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Room Modal */}
      <AddRoomDialog
        businessId={businessId}
        roomTypes={roomTypes}
        isOpen={isAddRoomOpen}
        onClose={() => {
          setIsAddRoomOpen(false);
          setEditingRoom(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        initialData={editingRoom}
      />

      {/* Add / Edit Room Type Modal */}
      <AddRoomTypeDialog
        businessId={businessId}
        isOpen={isAddTypeOpen}
        onClose={() => {
          setIsAddTypeOpen(false);
          setEditingType(null);
        }}
        onSuccess={() => {
          loadData();
        }}
        initialData={editingType}
      />

      {/* Contextual Quick Check-in Dialog */}
      {checkInRoomId && (
        <NewBookingDialog
          businessId={businessId}
          isOpen={Boolean(checkInRoomId)}
          initialRoomId={checkInRoomId}
          initialMode="walkin"
          onClose={() => setCheckInRoomId(null)}
          onSuccess={() => {
            setCheckInRoomId(null);
            loadData();
          }}
        />
      )}

      {/* Contextual Quick Checkout Wizard */}
      {checkOutBooking && (
        <CheckOutWizard
          isOpen={Boolean(checkOutBooking)}
          onClose={() => setCheckOutBooking(null)}
          booking={checkOutBooking}
          businessId={businessId}
          onSuccess={() => {
            setCheckOutBooking(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
