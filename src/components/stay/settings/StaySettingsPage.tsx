'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { StayTimePicker } from '../ui/StayTimePicker';
import { db } from '@/lib/db';
import { roomTypeRepository } from '@/lib/stay/repositories/roomTypeRepository';
import type { StaySettings, RoomType } from '@/lib/stay/types';
import { showAlert } from '@/lib/ui/dialogs';
import { Building2, Plus, Edit2, Save, RefreshCw, Check, Clock, Sparkles, BarChart3 } from 'lucide-react';
import { HousekeepingBoard } from '../housekeeping/HousekeepingBoard';
import { StayReportsPage } from '../reports/StayReportsPage';

export const StaySettingsPage: React.FC = () => {
  const { t, language } = useTranslation();
  const isMarathi = language === 'mr';
  const business = useBusiness();
  const businessId = business?.id || 'default';

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sub-section tab switcher
  const [activeSection, setActiveSection] = useState<'settings' | 'housekeeping' | 'reports'>('settings');

  // Lodge Settings state
  const [propertyName, setPropertyName] = useState('Kamai Plus Stay');
  const [checkInTime, setCheckInTime] = useState('12:00');
  const [checkOutTime, setCheckOutTime] = useState('11:00');
  const [bookingPrefix, setBookingPrefix] = useState('STY');

  // Room categories
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);

  // Add / Edit Category Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<RoomType | null>(null);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catRateRupees, setCatRateRupees] = useState('');
  const [catMaxOccupancy, setCatMaxOccupancy] = useState('2');
  const [catAmenities, setCatAmenities] = useState('AC, Free WiFi, TV');

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      const [settings, types] = await Promise.all([
        db.stay_settings.where('business_id').equals(businessId).first(),
        roomTypeRepository.findAll(businessId, true),
      ]);

      if (settings) {
        if (settings.property_name) setPropertyName(settings.property_name);
        if (settings.default_check_in_time) setCheckInTime(settings.default_check_in_time);
        if (settings.default_check_out_time) setCheckOutTime(settings.default_check_out_time);
        if (settings.booking_reference_prefix) setBookingPrefix(settings.booking_reference_prefix);
      } else {
        if (business?.name) {
          setPropertyName(business.name);
        }
      }

      setRoomTypes(types);
    } catch (err) {
      console.error('Failed to load stay settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [businessId, business]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const now = new Date().toISOString();
      const existing = await db.stay_settings.where('business_id').equals(businessId).first();

      const newSettings: StaySettings = {
        id: existing?.id || crypto.randomUUID(),
        business_id: businessId,
        property_name: propertyName.trim(),
        default_check_in_time: checkInTime,
        default_check_out_time: checkOutTime,
        gst_rate_bps: existing?.gst_rate_bps || 0,
        booking_reference_prefix: bookingPrefix.trim().toUpperCase() || 'STY',
        next_booking_sequence: existing?.next_booking_sequence || 1000,
        advance_deposit_enabled: existing?.advance_deposit_enabled ?? true,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        created_at: existing?.created_at || now,
        updated_at: now,
      };

      if (existing) {
        await db.stay_settings.update(existing.id, newSettings);
      } else {
        await db.stay_settings.add(newSettings);
      }

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save stay settings:', err);
      await showAlert(t('Failed to save settings.'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCategoryModal = (rt?: RoomType) => {
    if (rt) {
      setEditingType(rt);
      setCatName(rt.name);
      setCatCode(rt.code);
      setCatRateRupees((rt.base_rate_paise / 100).toString());
      setCatMaxOccupancy(rt.max_occupancy.toString());
      setCatAmenities(rt.amenities ? rt.amenities.join(', ') : 'AC, Free WiFi, TV');
    } else {
      setEditingType(null);
      setCatName('');
      setCatCode('');
      setCatRateRupees('1200');
      setCatMaxOccupancy('2');
      setCatAmenities('AC, Free WiFi, TV');
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const rate = parseFloat(catRateRupees);
    if (isNaN(rate) || rate < 0) {
      await showAlert(t('Please enter a valid rate.'));
      return;
    }

    try {
      const now = new Date().toISOString();
      const amenitiesList = catAmenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      if (editingType) {
        await roomTypeRepository.update(editingType.id, {
          name: catName.trim(),
          code: catCode.trim().toUpperCase(),
          base_rate_paise: Math.round(rate * 100),
          max_occupancy: parseInt(catMaxOccupancy, 10) || 2,
          amenities: amenitiesList,
          updated_at: now,
        });
      } else {
        await roomTypeRepository.create({
          id: crypto.randomUUID(),
          business_id: businessId,
          name: catName.trim(),
          code: catCode.trim().toUpperCase(),
          base_rate_paise: Math.round(rate * 100),
          max_occupancy: parseInt(catMaxOccupancy, 10) || 2,
          amenities: amenitiesList,
          is_active: true,
          created_at: now,
          updated_at: now,
          sync_status: 'pending',
        });
      }

      setIsCategoryModalOpen(false);
      loadSettings();
    } catch (err) {
      console.error('Failed to save category:', err);
      await showAlert(t('Failed to save category.'));
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-violet-600" />
            <span>{isMarathi ? 'लॉज सेटिंग्ज आणि धोरणे (Stay Settings)' : 'Lodge Policies & Settings'}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMarathi
              ? 'लॉजचे नाव, मानक चेक-इन/चेक-आउट वेळ आणि खोली प्रकार दर'
              : 'Property name, default check-in/out hours and room rate plans'}
          </p>
        </div>

        {savedSuccess && (
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 flex items-center gap-1.5 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>{isMarathi ? 'सेटिंग्ज जतन झाल्या!' : 'Settings Saved!'}</span>
          </span>
        )}
      </div>

      {/* Sub-Tabs: General Settings, Housekeeping Board, Stay Reports */}
      <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'settings'
              ? 'bg-white text-slate-900 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>{isMarathi ? 'माहिती व दर' : 'General & Rates'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('housekeeping')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'housekeeping'
              ? 'bg-white text-slate-900 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isMarathi ? 'हाउसकीपिंग' : 'Housekeeping'}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('reports')}
          className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'reports'
              ? 'bg-white text-slate-900 shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>{isMarathi ? 'अहवाल' : 'Reports'}</span>
        </button>
      </div>

      {activeSection === 'housekeeping' && <HousekeepingBoard />}
      {activeSection === 'reports' && <StayReportsPage />}
      {activeSection === 'settings' && (
        <>
          {/* Property Details & Policies Form */}
          <form onSubmit={handleSaveSettings}>
        <Card className="p-4 sm:p-5 border-slate-200 dark:border-slate-800 space-y-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            {isMarathi ? 'लॉज माहिती आणि वेळेची धोरणे' : 'Lodge Information & Policy Timings'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={(isMarathi ? 'लॉज / हॉटेलचे नाव' : 'Property / Lodge Name') + ' *'}
              value={propertyName}
              onChange={(e) => setPropertyName(e.target.value)}
              required
            />

            <Input
              label={(isMarathi ? 'बुकिंग कोड उपसर्ग' : 'Booking Prefix') + ' *'}
              value={bookingPrefix}
              onChange={(e) => setBookingPrefix(e.target.value.toUpperCase())}
              placeholder="STY"
              maxLength={6}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <StayTimePicker
              label={isMarathi ? 'प्रमाणित चेक-इन वेळ (Default Check-in)' : 'Default Check-in Time'}
              value={checkInTime}
              onChange={setCheckInTime}
              defaultType="checkin"
              required
            />

            <StayTimePicker
              label={isMarathi ? 'प्रमाणित चेक-आउट वेळ (Default Check-out)' : 'Default Check-out Time'}
              value={checkOutTime}
              onChange={setCheckOutTime}
              defaultType="checkout"
              required
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isSaving}
              className="bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-1.5 min-h-[40px] px-6"
            >
              <Save className="w-4 h-4" />
              <span>{isMarathi ? 'सेटिंग्ज जतन करा' : 'Save Policies'}</span>
            </Button>
          </div>
        </Card>
      </form>

      {/* Room Categories Management Card */}
      <Card className="p-4 sm:p-5 border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              {isMarathi ? 'खोल्यांचे प्रकार आणि प्रमाणित दर' : 'Room Categories & Base Tariffs'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isMarathi
                ? 'प्रत्येक प्रकाराचे नाव, कोड, दर आणि कमाल पाहुण्यांची क्षमता'
                : 'Rack rates, short codes and occupancy limits for each room category'}
            </p>
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenCategoryModal()}
            className="flex items-center gap-1 font-bold text-xs min-h-[34px]"
          >
            <Plus className="w-4 h-4" />
            <span>{isMarathi ? '+ प्रकार जोडा' : '+ Add Category'}</span>
          </Button>
        </div>

        {roomTypes.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">
            {isMarathi ? 'कोणतेही प्रकार उपलब्ध नाहीत. नवीन प्रकार जोडा.' : 'No categories configured.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {roomTypes.map((rt) => (
              <div key={rt.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                      {rt.name}
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 font-bold">
                      {rt.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Max: {rt.max_occupancy} guests · Amenities: {rt.amenities?.join(', ') || 'Standard'}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-sm text-violet-700 dark:text-violet-300">
                    ₹{(rt.base_rate_paise / 100).toFixed(0)}/n
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenCategoryModal(rt)}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </>
      )}

      {/* Category Modal */}
      {isCategoryModalOpen && (
        <Modal
          isOpen={isCategoryModalOpen}
          onClose={() => setIsCategoryModalOpen(false)}
          title={editingType ? t('Edit Category') : t('Add Room Category')}
          description="Set standard room rates, occupancy and code"
          size="md"
        >
          <form onSubmit={handleSaveCategory} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('Category Name') + ' *'}
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Deluxe Double AC"
                required
              />
              <Input
                label={t('Short Code') + ' *'}
                value={catCode}
                onChange={(e) => setCatCode(e.target.value.toUpperCase())}
                placeholder="e.g. DLX"
                maxLength={8}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('Rack Rate (₹/night)') + ' *'}
                type="number"
                min="0"
                step="1"
                value={catRateRupees}
                onChange={(e) => setCatRateRupees(e.target.value)}
                placeholder="1500"
                required
              />
              <Input
                label={t('Max Guests') + ' *'}
                type="number"
                min="1"
                max="20"
                value={catMaxOccupancy}
                onChange={(e) => setCatMaxOccupancy(e.target.value)}
                placeholder="2"
                required
              />
            </div>

            <Input
              label={t('Amenities (comma separated)')}
              value={catAmenities}
              onChange={(e) => setCatAmenities(e.target.value)}
              placeholder="AC, Free WiFi, TV, Geyser"
            />

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="outline" size="md" onClick={() => setIsCategoryModalOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button type="submit" variant="primary" size="md" className="bg-violet-600 hover:bg-violet-700 text-white min-h-[40px]">
                {t('Save Category')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
