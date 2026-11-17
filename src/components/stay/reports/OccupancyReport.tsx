'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { db } from '@/lib/db';
import type { Room, RoomType, Booking, Guest } from '@/lib/stay/types';
import { RefreshCw, Users, Bed, LogIn, LogOut, TrendingUp } from 'lucide-react';

interface OccupancyReportProps {
  businessId: string;
  selectedDate: string; // YYYY-MM-DD
}

interface RoomOccupancyRow {
  room: Room;
  roomType?: RoomType;
  statusOnDate: 'occupied' | 'available' | 'cleaning' | 'maintenance';
  booking?: Booking;
  guestName?: string;
  revenuePaise: number;
}

export const OccupancyReport: React.FC<OccupancyReportProps> = ({
  businessId,
  selectedDate,
}) => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RoomOccupancyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOccupancy() {
      try {
        setIsLoading(true);
        const [rooms, types, bookings, entries] = await Promise.all([
          db.rooms.where('business_id').equals(businessId).toArray(),
          db.room_types.where('business_id').equals(businessId).toArray(),
          db.stay_bookings.where('business_id').equals(businessId).toArray(),
          db.stay_folio_entries
            .where('business_id')
            .equals(businessId)
            .and((e) => e.entry_date === selectedDate && e.entry_type === 'room_charge')
            .toArray(),
        ]);

        const typeMap = new Map<string, RoomType>();
        types.forEach((rt) => typeMap.set(rt.id, rt));

        // Find bookings active on selectedDate:
        // check_in_date <= selectedDate and check_out_date > selectedDate
        const activeBookings = bookings.filter(
          (b) =>
            b.check_in_date <= selectedDate &&
            b.check_out_date >= selectedDate &&
            ['checked_in', 'confirmed', 'checked_out'].includes(b.status)
        );

        const occupancyRows: RoomOccupancyRow[] = await Promise.all(
          rooms.map(async (r) => {
            const rt = typeMap.get(r.room_type_id);
            const activeBooking = activeBookings.find((b) => b.room_id === r.id);

            let guestName = '-';
            let revenuePaise = 0;

            if (activeBooking) {
              const g = await db.stay_guests.get(activeBooking.primary_guest_id);
              if (g) guestName = g.name;

              // Room charge for this booking on this date
              const dayEntry = entries.find((e) => e.folio_id === activeBooking.id);
              revenuePaise = dayEntry ? dayEntry.amount_paise : activeBooking.agreed_rate_paise;
            }

            let statusOnDate: 'occupied' | 'available' | 'cleaning' | 'maintenance' = 'available';
            if (activeBooking && activeBooking.status === 'checked_in') {
              statusOnDate = 'occupied';
            } else if (r.status === 'cleaning') {
              statusOnDate = 'cleaning';
            } else if (r.status === 'maintenance' || r.status === 'out_of_service') {
              statusOnDate = 'maintenance';
            }

            return {
              room: r,
              roomType: rt,
              statusOnDate,
              booking: activeBooking,
              guestName,
              revenuePaise,
            };
          })
        );

        setRows(occupancyRows);
      } catch (err) {
        console.error('Failed to load occupancy report:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOccupancy();
  }, [businessId, selectedDate]);

  const totalRooms = rows.length;
  const occupiedRooms = rows.filter((r) => r.statusOnDate === 'occupied').length;
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;
  const checkInsCount = rows.filter((r) => r.booking?.check_in_date === selectedDate).length;
  const checkOutsCount = rows.filter((r) => r.booking?.check_out_date === selectedDate).length;
  const totalRevenuePaise = rows.reduce((acc, r) => acc + (r.statusOnDate === 'occupied' ? r.revenuePaise : 0), 0);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
        {t('Loading occupancy data...')}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border-slate-200">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Occupancy Rate')}</span>
            <TrendingUp className="w-4 h-4 text-sky-600" />
          </div>
          <span className="text-2xl font-black text-slate-900 block mt-1">
            {occupancyRate}%
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            {occupiedRooms} / {totalRooms} {t('Rooms occupied')}
          </span>
        </Card>

        <Card className="bg-white border-slate-200">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Check-ins')}</span>
            <LogIn className="w-4 h-4 text-emerald-600" />
          </div>
          <span className="text-2xl font-black text-slate-900 block mt-1">
            {checkInsCount}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">{t('Scheduled today')}</span>
        </Card>

        <Card className="bg-white border-slate-200">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Check-outs')}</span>
            <LogOut className="w-4 h-4 text-rose-600" />
          </div>
          <span className="text-2xl font-black text-slate-900 block mt-1">
            {checkOutsCount}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">{t('Expected today')}</span>
        </Card>

        <Card className="bg-white border-slate-200">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">{t('Room Revenue')}</span>
            <Bed className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-black text-emerald-700 block mt-1">
            ₹{(totalRevenuePaise / 100).toFixed(2)}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">{t('Estimated room charges')}</span>
        </Card>
      </div>

      {/* Room Wise Status Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-900">
            {t('Room-wise Occupancy Status')} — {selectedDate}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-600 border-y border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-semibold">{t('Room')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Category')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Status')}</th>
                <th className="py-2.5 px-4 font-semibold">{t('Guest Name')}</th>
                <th className="py-2.5 px-4 font-semibold text-right">{t('Daily Rate / Rev (₹)')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                    {t('No rooms registered.')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  let badge = 'bg-slate-100 text-slate-700';
                  if (row.statusOnDate === 'occupied') badge = 'bg-rose-100 text-rose-800 font-bold';
                  if (row.statusOnDate === 'available') badge = 'bg-emerald-100 text-emerald-800 font-bold';
                  if (row.statusOnDate === 'cleaning') badge = 'bg-amber-100 text-amber-800 font-bold';

                  return (
                    <tr key={row.room.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        Room {row.room.number}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {row.roomType?.name || 'Standard'}
                      </td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase ${badge}`}>
                          {t(row.statusOnDate)}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-800">
                        {row.guestName}
                      </td>
                      <td className="py-2.5 px-4 text-right font-bold text-slate-900">
                        {row.statusOnDate === 'occupied'
                          ? `₹${(row.revenuePaise / 100).toFixed(2)}`
                          : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
