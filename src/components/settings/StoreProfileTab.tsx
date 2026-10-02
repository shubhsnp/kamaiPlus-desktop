'use client';
import { showConfirm } from '@/lib/ui/dialogs';

import React from 'react';
import { 
  Store, 
  Camera, 
  Trash2, 
  Building2, 
  MapPin, 
  Phone, 
  Mail, 
  User,
  LogOut
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { tr } from '@/lib/i18n/core';

interface StoreProfileTabProps {
  name: string;
  setName: (val: string) => void;
  tagline: string;
  setTagline: (val: string) => void;

  ownerName: string;
  setOwnerName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  phone2: string;
  setPhone2: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  address: string;
  setAddress: (val: string) => void;
  pincode: string;
  setPincode: (val: string) => void;
  gstin: string;
  setGstin: (val: string) => void;

  logoUrl: string;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onSwitchToDataTab?: () => void;
}

export const StoreProfileTab: React.FC<StoreProfileTabProps> = ({
  name,
  setName,
  tagline,
  setTagline,

  ownerName,
  setOwnerName,
  phone,
  setPhone,
  phone2,
  setPhone2,
  email,
  setEmail,
  address,
  setAddress,
  pincode,
  setPincode,
  gstin,
  setGstin,

  logoUrl,
  onLogoUpload,
  onRemoveLogo,
  onSwitchToDataTab,
}) => {
  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* 1. Store Identity & Logo */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Store className="w-4 h-4 text-sky-600" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {tr('Store Identity & Branding')}
          </h3>
        </div>

        {/* Logo Upload Section */}
        <div className="flex flex-col sm:flex-row items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200/80 dark:border-slate-700">
          <div className="relative w-20 h-20 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
            {logoUrl ? (
              <img src={logoUrl} alt="Store Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <Camera className="w-6 h-6 text-slate-400" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left space-y-1">
            <div className="text-xs font-black text-slate-900 dark:text-slate-100">
              {tr('Store Brand Logo (Printable on Tax Invoices)')}
            </div>
            <p className="text-[11px] text-slate-400">
              {tr('Recommended size: 250x250 PNG/JPG. Automatically compressed for thermal printing.')}
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <label className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-bold text-xs cursor-pointer hover:bg-slate-800 shadow-2xs">
                <span>{tr('Upload Logo')}</span>
                <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  className="px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-50 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Store Name & Tagline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={tr('Business / Store Name *')}
            placeholder={tr('e.g. Mahavir Kirana & General Store')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label={tr('Store Tagline / Slogan')}
            placeholder={tr('e.g. Always Fresh, Best Wholesale Rates')}
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
          />
        </div>


      </Card>

      {/* 2. Contact & Address Details */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Phone className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {tr('Contact & Store Location')}
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label={tr('Owner / Contact Person *')}
            placeholder={tr('e.g. Ramesh Patel')}
            value={ownerName}
            onChange={(e) => setOwnerName(e.target.value)}
            required
          />
          <Input
            label={tr('Store Mobile Number *')}
            placeholder={tr('e.g. 9876543210')}
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <Input
            label={tr('Second Contact Number (Optional)')}
            placeholder={tr('e.g. 9123456780')}
            type="tel"
            value={phone2}
            onChange={(e) => setPhone2(e.target.value)}
            data-settings-phone2
          />
          <Input
            label={tr('Email Address (Optional)')}
            placeholder={tr('e.g. store@gmail.com')}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="sm:col-span-3">
            <Input
              label={tr('Full Store Address (Printed on Bill Header)')}
              placeholder={tr('e.g. Shop No. 12, Gandhi Market, Station Road')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div>
            <Input
              label={tr('Pincode')}
              placeholder={tr('e.g. 400001')}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* 3. GST, FSSAI & Pharmacy Licensing */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3.5">
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Building2 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
            {tr('GST & Statutory Licenses')}
          </h3>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <Input
            label={tr('GSTIN Number (For GST Tax Invoices)')}
            placeholder={tr('e.g. 27AAAAA0000A1Z5')}
            value={gstin}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
          />
        </div>
      </Card>

      {/* Account & Session Management Card */}
      <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-700 dark:text-slate-300" />
            <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
              {tr('Account & Session Management')}
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {tr('Current Device Session')}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {tr('Logged in as')} {ownerName || tr('Merchant')} ({phone || tr('Owner')})
            </div>
            <p className="text-[11px] text-slate-400">
              {tr('Log out to switch accounts or securely sign in from another phone number / Google account.')}
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              if (await showConfirm(tr('Are you sure you want to log out from this device?'))) {
                const { logoutUser } = await import('@/lib/auth');
                await logoutUser();
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 dark:text-rose-300 dark:bg-rose-950/60 dark:border-rose-800 font-bold text-xs flex items-center gap-1.5 self-start sm:self-center transition active:scale-95 cursor-pointer shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{tr('Logout Account')}</span>
          </button>
        </div>
      </Card>

      {/* Catalog & Data Maintenance Card */}
      {onSwitchToDataTab && (
        <Card className="p-4 sm:p-5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-rose-600" />
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {tr('Product Catalog & Data Reset')}
              </h3>
            </div>
            <span className="text-xs font-bold text-slate-400">
              {tr('Maintenance')}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {tr('Clean All Product Data / Reset Catalog')}
              </div>
              <p className="text-[11px] text-slate-400">
                {tr('Testing ke liye sabhi products ko 1-click me clean karein ya fresh sample catalog load karein.')}
              </p>
            </div>

            <button
              type="button"
              onClick={onSwitchToDataTab}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900 font-bold text-xs flex items-center gap-1.5 self-start sm:self-center transition active:scale-95 cursor-pointer shrink-0"
            >
              <span>{tr('Manage & Clean Data →')}</span>
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};
