'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Customer, CustomerType } from '@/types';
import { Plus, Edit3, Trash2 } from 'lucide-react';

import { validateCustomerData } from '@/lib/validation/validators';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

interface AddEditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCustomer: Customer | null;
  onSaveCustomer: (data: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
    gstin?: string;
    customer_type: CustomerType;
    /** Buys at wholesale prices (v4.87.0). */
    is_wholesale?: boolean;
    date_of_birth?: string;
    anniversary_date?: string;
    loyalty_points: number;
    opening_balance: number;
    current_balance: number;
    /** Udhar limit, paise (0 = none) — v4.102.0, K-D03. */
    credit_limit: number;
    notes?: string;
  }) => Promise<void>;
  onDeleteCustomer: (id: string, name: string) => Promise<void>;
}

export const AddEditCustomerModal: React.FC<AddEditCustomerModalProps> = ({
  isOpen,
  onClose,
  editingCustomer,
  onSaveCustomer,
  onDeleteCustomer,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('regular');
  const [isWholesale, setIsWholesale] = useState(false);
  const wholesaleOn = useFeatureSwitches().wholesale_price;
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [anniversaryDate, setAnniversaryDate] = useState('');
  const [loyaltyPoints, setLoyaltyPoints] = useState<string>('0');
  const [openingBalance, setOpeningBalance] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setFormError('');
    if (editingCustomer) {
      setName(editingCustomer.name || '');
      setPhone(editingCustomer.phone || '');
      setEmail(editingCustomer.email || '');
      setAddress(editingCustomer.address || '');
      setGstin(editingCustomer.gstin || '');
      setCustomerType(editingCustomer.customer_type || 'regular');
      setIsWholesale(Boolean(editingCustomer.is_wholesale));
      setDateOfBirth(editingCustomer.date_of_birth || '');
      setAnniversaryDate(editingCustomer.anniversary_date || '');
      setLoyaltyPoints(editingCustomer.loyalty_points ? String(editingCustomer.loyalty_points) : '0');
      setOpeningBalance(editingCustomer.opening_balance ? (editingCustomer.opening_balance / 100).toFixed(2) : '0.00');
      setCurrentBalance(editingCustomer.current_balance ? (editingCustomer.current_balance / 100).toFixed(2) : '0.00');
      setCreditLimit(editingCustomer.credit_limit ? String(editingCustomer.credit_limit / 100) : '');
      setNotes(editingCustomer.notes || '');
    } else {
      setName('');
      setPhone('');
      setEmail('');
      setAddress('');
      setGstin('');
      setCustomerType('regular');
      setIsWholesale(false);
      setDateOfBirth('');
      setAnniversaryDate('');
      setLoyaltyPoints('0');
      setOpeningBalance('');
      setCurrentBalance('');
      setCreditLimit('');
      setNotes('');
    }
  }, [editingCustomer, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validation = validateCustomerData({
      name,
      phone,
      gstin,
      email,
    });

    if (!validation.isValid) {
      setFormError(validation.error || tr('Please fill in valid customer details.'));
      return;
    }

    const opBalPaise = openingBalance ? Math.round(parseFloat(openingBalance) * 100) : 0;
    const curBalPaise = currentBalance ? Math.round(parseFloat(currentBalance) * 100) : opBalPaise;
    const pts = parseInt(loyaltyPoints) || 0;

    setIsSubmitting(true);
    try {
      await onSaveCustomer({
        name: validation.cleanedValue?.name || name.trim(),
        phone: validation.cleanedValue?.phone || phone.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        gstin: gstin.trim().toUpperCase() || undefined,
        customer_type: customerType,
        // Switch off: the saved choice stays as it was.
        is_wholesale: wholesaleOn ? isWholesale : Boolean(editingCustomer?.is_wholesale),
        date_of_birth: dateOfBirth || undefined,
        anniversary_date: anniversaryDate || undefined,
        loyalty_points: pts,
        opening_balance: opBalPaise,
        current_balance: curBalPaise,
        credit_limit: Math.max(0, Math.round((parseFloat(creditLimit) || 0) * 100)),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save customer:', err);
      setFormError(tr('Failed to save customer. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          {editingCustomer ? <Edit3 className="w-5 h-5 text-sky-500" /> : <Plus className="w-5 h-5 text-sky-500" />}
          <span>{editingCustomer ? tr('Edit Customer: {name}', { name: editingCustomer.name }) : tr('Add New Customer')}</span>
        </div>
      }
      description={editingCustomer ? tr('Update customer profile, address, GSTIN, loyalty points, and credit balance.') : tr('Register a new customer for POS billing, khata credit ledger, and loyalty tracking.')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <Input 
          label={tr('Customer Full Name *')} 
          placeholder={tr('e.g. Anand Sharma')} 
          value={name} 
          onChange={(e) => setName(e.target.value)} 
          required 
          autoFocus 
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input 
            label={tr('Mobile Phone Number')} 
            placeholder={tr('e.g. 9876543210')} 
            type="tel" 
            value={phone} 
            onChange={(e) => setPhone(e.target.value)} 
          />
          <Input 
            label={tr('Email Address (Optional)')} 
            placeholder={tr('e.g. anand@gmail.com')} 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              {tr('Customer Category')}
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as CustomerType)}
              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="regular">{tr('Regular Customer')}</option>
              <option value="vip">{tr('⭐ VIP Customer')}</option>
              <option value="credit">{tr('Credit / Khata Customer')}</option>
              <option value="new">{tr('New Customer')}</option>
            </select>
            {wholesaleOn && (
              <label className="mt-2 flex items-center gap-2 text-xs font-bold text-violet-800 cursor-pointer">
                <input type="checkbox" checked={isWholesale} onChange={(e) => setIsWholesale(e.target.checked)} className="w-4 h-4 accent-violet-600" data-customer-wholesale />
                {tr('Wholesale customer — bills use wholesale prices')}
              </label>
            )}
          </div>

          <Input 
            label={tr('Customer GSTIN (For B2B Tax Invoicing)')} 
            placeholder={tr('e.g. 27AAAAA0000A1Z5')} 
            value={gstin} 
            onChange={(e) => setGstin(e.target.value.toUpperCase())} 
          />
        </div>

        <Input 
          label={tr('Delivery / Billing Address')} 
          placeholder={tr('e.g. Shop 4, MG Road, Mumbai')} 
          value={address} 
          onChange={(e) => setAddress(e.target.value)} 
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input 
            label={tr('Birthday (DD-MM-YYYY)')} 
            placeholder={tr('e.g. 16-08-1992')} 
            value={dateOfBirth} 
            onChange={(e) => setDateOfBirth(e.target.value)} 
          />
          <Input 
            label={tr('Anniversary (DD-MM-YYYY)')} 
            placeholder={tr('e.g. 25-12-2018')} 
            value={anniversaryDate} 
            onChange={(e) => setAnniversaryDate(e.target.value)} 
          />
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200">
            {tr('Opening & Current Balances')}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input 
              label={tr('Opening Balance (₹)')} 
              placeholder="0.00" 
              type="number" 
              step="0.01" 
              value={openingBalance} 
              onChange={(e) => setOpeningBalance(e.target.value)} 
            />
            <Input 
              label={tr('Current Balance Due (₹)')} 
              placeholder="0.00" 
              type="number" 
              step="0.01" 
              value={currentBalance} 
              onChange={(e) => setCurrentBalance(e.target.value)} 
            />
            <Input
              label={tr('Udhar limit (₹)')}
              placeholder={tr('No limit')}
              type="number"
              step="1"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
              data-customer-credit-limit
            />
          </div>
          <p className="text-[10.5px] text-slate-500">{tr('The billing counter warns before a bill takes this customer past the limit. Empty = no limit.')}</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
            {tr('Customer Notes & Preferences')}
          </label>
          <textarea
            rows={2}
            placeholder={tr('e.g. Prefers home delivery in evening, special discount 5%...')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-in fade-in flex items-center gap-2">
            <span>⚠️</span>
            <span>{formError}</span>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          {editingCustomer ? (
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onDeleteCustomer(editingCustomer.id, editingCustomer.name)}
              className="text-rose-600 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs rounded-xl cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>{tr('Delete')}</span>
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-xl">
              {tr('Cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="font-black bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:bg-slate-800 rounded-xl">
              {isSubmitting ? tr('Saving...') : editingCustomer ? tr('Update Customer') : tr('Save Customer')}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
