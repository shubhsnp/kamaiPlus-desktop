'use client';

import React, { useEffect, useState } from 'react';
import { Bike } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import type { OrderGuest } from '@/lib/restaurant/model';
import { cleanGuestPhone } from '@/lib/restaurant/settle';

/**
 * "New delivery" (v4.139.0): who it goes to — name, mobile, address — then the order opens with a DL-
 * token. The mobile fills the WhatsApp bill; the address prints on the KOT side and the bill.
 */
export function DeliveryDialog({ open, onClose, onStart }: { open: boolean; onClose: () => void; onStart: (guest: OrderGuest) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setAddress('');
    }
  }, [open]);

  const phoneBad = phone.trim() !== '' && !cleanGuestPhone(phone);
  const field = 'w-full h-11 px-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:border-emerald-600';
  const label = 'block text-xs font-bold text-slate-700 mb-1';

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneBad || !address.trim()) return;
    onStart({ name: name.trim().slice(0, 40), phone: cleanGuestPhone(phone), address: address.replace(/\s+/g, ' ').trim().slice(0, 160) });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('New delivery')} description={tr('Who is it for? The address prints on the bill.')} size="sm">
      <form onSubmit={start} className="space-y-3" data-delivery-dialog>
        <div>
          <label className={label} htmlFor="dl-name">{tr('Guest name')}</label>
          <input id="dl-name" value={name} onChange={(e) => setName(e.target.value)} className={field} autoFocus data-delivery-name />
        </div>
        <div>
          <label className={label} htmlFor="dl-phone">{tr('Mobile (for the WhatsApp bill)')}</label>
          <input id="dl-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))} inputMode="tel" className={field} data-delivery-phone />
          {phoneBad && <p className="text-[11px] text-rose-600 mt-1">{tr('Enter a 10-digit mobile number, or leave it empty.')}</p>}
        </div>
        <div>
          <label className={label} htmlFor="dl-address">{tr('Delivery address *')}</label>
          <textarea id="dl-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${field} h-auto py-2`} data-delivery-address />
        </div>
        <Button type="submit" variant="success" className="w-full" disabled={phoneBad || !address.trim()} data-delivery-start>
          <Bike className="w-4 h-4" /> {tr('Start delivery order')}
        </Button>
      </form>
    </Modal>
  );
}
