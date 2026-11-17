'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useStayEnabled, setStayDevEnabled } from '@/lib/stay/stayActivation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RoomsPage } from './rooms/RoomsPage';
import { BookingsPage } from './bookings/BookingsPage';
import { CheckInPage } from './checkin/CheckInPage';
import { CheckOutPage } from './checkout/CheckOutPage';
import { HousekeepingBoard } from './housekeeping/HousekeepingBoard';
import { StayReportsPage } from './reports/StayReportsPage';
import { StaySettingsPage } from './settings/StaySettingsPage';
import { usePathname, useRouter } from 'next/navigation';
import {
  BedDouble,
  CalendarCheck,
  DoorOpen,
  LogOut,
  Sparkles,
  BarChart3,
  Settings,
  Hotel,
  AlertTriangle,
} from 'lucide-react';

export type StayTab =
  | 'rooms'
  | 'bookings'
  | 'checkin'
  | 'checkout'
  | 'housekeeping'
  | 'reports'
  | 'settings';

interface StayModuleProps {
  currentTab?: StayTab;
  children?: React.ReactNode;
}

export const StayModule: React.FC<StayModuleProps> = ({ currentTab, children }) => {
  const { t } = useTranslation();
  const isEnabled = useStayEnabled();
  const pathname = usePathname();
  const router = useRouter();

  // Determine active tab from prop, pathname, or state
  const getTabFromPath = (): StayTab => {
    if (currentTab) return currentTab;
    if (pathname.includes('/stay/bookings')) return 'bookings';
    if (pathname.includes('/stay/checkin')) return 'checkin';
    if (pathname.includes('/stay/checkout')) return 'checkout';
    if (pathname.includes('/stay/housekeeping')) return 'housekeeping';
    if (pathname.includes('/stay/reports')) return 'reports';
    if (pathname.includes('/stay/settings')) return 'settings';
    return 'rooms';
  };

  const [activeTab, setActiveTab] = useState<StayTab>(getTabFromPath());

  useEffect(() => {
    setActiveTab(getTabFromPath());
  }, [pathname, currentTab]);

  const handleTabChange = (tab: StayTab) => {
    setActiveTab(tab);
    // If not on stay pages, push to matching sub-route
    if (pathname.startsWith('/stay')) {
      router.push(`/stay/${tab}`);
    }
  };

  // Disabled fallback
  if (!isEnabled) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center bg-white border border-slate-200 shadow-lg rounded-2xl space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {t('Stay Module Disabled')}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {t(
              'The Kamai Plus Stay (Hotel & Lodge Management) module is currently disabled for this business or environment.'
            )}
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setStayDevEnabled(true);
                window.location.reload();
              }}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              {t('Enable Dev Mode')}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const TABS = [
    { id: 'rooms' as StayTab, label: t('Rooms'), icon: BedDouble },
    { id: 'bookings' as StayTab, label: t('Bookings'), icon: CalendarCheck },
    { id: 'checkin' as StayTab, label: t('Check-in'), icon: DoorOpen },
    { id: 'checkout' as StayTab, label: t('Check-out'), icon: LogOut },
    { id: 'housekeeping' as StayTab, label: t('Housekeeping'), icon: Sparkles },
    { id: 'reports' as StayTab, label: t('Stay Reports'), icon: BarChart3 },
    { id: 'settings' as StayTab, label: t('Lodge Settings'), icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Module Navigation Top Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs">
                <Hotel className="w-4 h-4" />
              </div>
              <div className="leading-tight">
                <span className="text-sm font-black text-slate-900 block">
                  {t('Stay & Lodging')}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Kamai Plus Stay
                </span>
              </div>
            </div>

            {/* Tab navigation pills */}
            <nav className="flex items-center gap-1 overflow-x-auto py-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1">
        {children ? (
          children
        ) : (
          <>
            {activeTab === 'rooms' && <RoomsPage />}
            {activeTab === 'bookings' && <BookingsPage />}
            {activeTab === 'checkin' && <CheckInPage />}
            {activeTab === 'checkout' && <CheckOutPage />}
            {activeTab === 'housekeeping' && <HousekeepingBoard />}
            {activeTab === 'reports' && <StayReportsPage />}
            {activeTab === 'settings' && <StaySettingsPage />}
          </>
        )}
      </main>
    </div>
  );
};
