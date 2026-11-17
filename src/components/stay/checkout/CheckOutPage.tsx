'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { db } from '@/lib/db';
import type { Booking, Guest, Room, Folio } from '@/lib/stay/types';
import { calculateNights } from '@/lib/stay/services/availabilityService';
import { CheckOutWizard } from './CheckOutWizard';
import { FolioView } from '../folio/FolioView';
import { LogOut, Search, FileText, BedDouble, RefreshCw, Receipt, Clock } from 'lucide-react';

interface ActiveStayItem {
  booking: Booking;
  guest?: Guest;
  room?: Room;
  folio?: Folio;
  nights: number;
}

export const CheckOutPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [stays, setStays] = useState<ActiveStayItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [selectedBookingForCheckout, setSelectedBookingForCheckout] = useState<Booking | null>(null);
  const [selectedFolioIdForView, setSelectedFolioIdForView] = useState<string | null>(null);

  const loadActiveStays = useCallback(async () => {
    try {
      setIsLoading(true);
      const activeBookings = await db.stay_bookings
        .where('business_id')
        .equals(businessId)
        .and((b) => b.status === 'checked_in')
        .toArray();

      const items: ActiveStayItem[] = await Promise.all(
        activeBookings.map(async (b) => {
          const [guest, room, folio] = await Promise.all([
            db.stay_guests.get(b.primary_guest_id),
            b.room_id ? db.rooms.get(b.room_id) : Promise.resolve(undefined),
            db.stay_folios
              .where('booking_id')
              .equals(b.id)
              .and((f) => f.status === 'open')
              .first(),
          ]);

          let nights = 1;
          try {
            nights = calculateNights(b.check_in_date, b.check_out_date);
          } catch {
            nights = 1;
          }

          return {
            booking: b,
            guest,
            room,
            folio,
            nights,
          };
        })
      );

      // Sort by check_out_date ascending (departures due first)
      items.sort((a, b) => a.booking.check_out_date.localeCompare(b.booking.check_out_date));
      setStays(items);
    } catch (err) {
      console.error('Failed to load active stays for checkout:', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    loadActiveStays();
  }, [loadActiveStays]);

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);

  const filteredStays = useMemo(() => {
    if (!searchQuery.trim()) return stays;
    const q = searchQuery.toLowerCase();
    return stays.filter((s) => {
      const matchGuest = s.guest && (s.guest.name.toLowerCase().includes(q) || s.guest.phone.includes(q));
      const matchRoom = s.room && s.room.number.toLowerCase().includes(q);
      const matchRef = s.booking.booking_reference.toLowerCase().includes(q);
      return matchGuest || matchRoom || matchRef;
    });
  }, [stays, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-violet-600" />
            <span>{isMarathi ? 'चेक-आउट आणि बिलिंग डेस्क (Check-out Desk)' : 'Check-out & Billing Desk'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'सध्या मुक्कामी असलेल्या पाहुण्यांचे अंतिम बिल तयार करा, पेमेंट जमा करा आणि चेक-आउट करा'
              : 'Review folio charges, record final payments, print tax receipts and checkout'}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadActiveStays}
          isLoading={isLoading}
          className="flex items-center gap-1.5 min-h-[38px]"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>{isMarathi ? 'रिफ्रेश' : 'Refresh'}</span>
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isMarathi ? 'पाहुण्याचे नाव, खोली क्रमांक किंवा फोनने शोधा...' : 'Search guest name, room number, or phone...'}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:border-violet-600 min-h-[40px] shadow-2xs"
        />
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
      </div>

      {/* Active Stays Table */}
      {isLoading ? (
        <div className="p-12 text-center text-sm font-semibold text-slate-500">
          {isMarathi ? 'मुक्काम डेटा लोड करत आहे...' : 'Loading active stays...'}
        </div>
      ) : filteredStays.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <BedDouble className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
            {isMarathi ? 'सध्या कोणतीही खोली व्यापलेली नाही' : 'No occupied rooms / active stays'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {isMarathi
              ? 'सध्या सर्व पाहुण्यांचे चेक-आउट झालेले आहे.'
              : 'All guests have checked out or no rooms are currently occupied.'}
          </p>
        </Card>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">{isMarathi ? 'खोली क्र.' : 'Room'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'पाहुण्याचे नाव' : 'Guest Name'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'चेक-इन तारीख' : 'Check-in'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'अपेक्षित चेक-आउट' : 'Check-out'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'एकूण शुल्क' : 'Total Charges'}</th>
                  <th className="py-3 px-4">{isMarathi ? 'शिल्लक देणी' : 'Balance Due'}</th>
                  <th className="py-3 px-4 text-right">{isMarathi ? 'कृती (Actions)' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {filteredStays.map(({ booking, guest, room, folio, nights }) => {
                  const isDueToday = booking.check_out_date === todayStr;
                  const balancePaise = folio?.balance_paise ?? 0;
                  const chargesPaise = folio?.total_charges_paise ?? (booking.agreed_rate_paise * nights);

                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-black text-base text-slate-900 dark:text-slate-100">
                          {room ? room.number : '-'}
                        </span>
                        {isDueToday && (
                          <span className="ml-2 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-900">
                            {isMarathi ? 'आज' : 'Due Today'}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {guest?.name || 'Guest'}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {guest?.phone || ''}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {booking.check_in_date}
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">
                        {booking.check_out_date} ({nights} {isMarathi ? 'रात्री' : 'n'})
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-slate-100">
                        ₹{(chargesPaise / 100).toFixed(0)}
                      </td>

                      <td className="py-3 px-4 font-mono font-black">
                        {balancePaise > 0 ? (
                          <span className="text-rose-600">₹{(balancePaise / 100).toFixed(2)}</span>
                        ) : (
                          <span className="text-emerald-600 font-bold">₹0.00 (Nil)</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {folio && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedFolioIdForView(folio.id)}
                              className="text-xs min-h-[32px] px-2.5 py-1"
                              title={isMarathi ? 'तपशीलवार फोलिओ पहा' : 'View full folio'}
                            >
                              <FileText className="w-3.5 h-3.5 mr-1" />
                              <span>{isMarathi ? 'फोलिओ' : 'Folio'}</span>
                            </Button>
                          )}

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setSelectedBookingForCheckout(booking)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold min-h-[32px] px-3 py-1 flex items-center gap-1 shadow-2xs"
                          >
                            <Receipt className="w-3.5 h-3.5" />
                            <span>{isMarathi ? 'बिल व चेक-आउट' : 'Check-out'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Check-Out Wizard */}
      {selectedBookingForCheckout && (
        <CheckOutWizard
          isOpen={Boolean(selectedBookingForCheckout)}
          onClose={() => setSelectedBookingForCheckout(null)}
          booking={selectedBookingForCheckout}
          businessId={businessId}
          onSuccess={() => {
            setSelectedBookingForCheckout(null);
            loadActiveStays();
          }}
        />
      )}

      {/* Folio View Modal */}
      {selectedFolioIdForView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-4">
            <FolioView
              folioId={selectedFolioIdForView}
              businessId={businessId}
              onBack={() => {
                setSelectedFolioIdForView(null);
                loadActiveStays();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
