'use client';

import React, { useEffect, useState } from 'react';
import { Bike, MapPin, Phone, UserRound, History } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { formatINR } from '@/lib/utils';
import type { OrderGuest } from '@/lib/restaurant/model';
import type { RestaurantSettings } from '@/lib/restaurant/settings';
import { cleanGuestPhone } from '@/lib/restaurant/settle';
import { findKnownGuest } from '@/lib/restaurant/guestLookup';

/**
 * "New delivery" (v4.139.0): who it goes to — name, mobile, address — then the order opens with a DL-
 * token. The mobile fills the WhatsApp bill; the address prints on the KOT side and the bill.
 * v4.143.0: laid out like the restaurant's other dialogs (icons, Cancel + Start); the mobile comes first
 * and a guest delivered to before fills the name and last address by itself; the charges are shown.
 */
export function DeliveryDialog({ open, settings, onClose, onStart }: { open: boolean; settings?: RestaurantSettings; onClose: () => void; onStart: (guest: OrderGuest) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [known, setKnown] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setPhone('');
      setAddress('');
      setKnown(false);
    }
  }, [open]);

  // A full mobile number: fill what is still empty from the last delivery to it.
  useEffect(() => {
    const p = cleanGuestPhone(phone);
    if (!open || !p) {
      setKnown(false);
      return;
    }
    let alive = true;
    findKnownGuest(p).then((g) => {
      if (!alive || !g) return;
      setKnown(true);
      setName((v) => v || g.name);
      setAddress((v) => v || g.address);
    });
    return () => {
      alive = false;
    };
  }, [phone, open]);

  const phoneBad = phone.trim() !== '' && !cleanGuestPhone(phone);
  const field = 'w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20';
  const label = 'block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1';
  const icon = 'absolute left-3 top-3 w-4 h-4 text-slate-400 pointer-events-none';
  const charges = [
    settings && settings.packingChargePaise > 0 ? `${tr('Packing charge')} ${formatINR(settings.packingChargePaise)}` : '',
    settings && settings.deliveryChargePaise > 0 ? `${tr('Delivery charge')} ${formatINR(settings.deliveryChargePaise)}` : '',
  ].filter(Boolean);

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneBad || !address.trim()) return;
    onStart({ name: name.trim().slice(0, 40), phone: cleanGuestPhone(phone), address: address.replace(/\s+/g, ' ').trim().slice(0, 160) });
  };

  return (
    <Modal isOpen={open} onClose={onClose} title={tr('New delivery')} description={tr('Who is it for? The address prints on the bill.')} size="sm">
      <form onSubmit={start} className="space-y-3.5" data-delivery-dialog>
        <div>
          <label className={label} htmlFor="dl-phone">{tr('Mobile (for the WhatsApp bill)')}</label>
          <div className="relative">
            <Phone className={icon} />
            <input id="dl-phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ''))} inputMode="tel" placeholder="98765 43210" className={`${field} font-mono`} autoFocus data-delivery-phone />
          </div>
          {phoneBad && <p className="text-[11px] text-rose-600 mt-1">{tr('Enter a 10-digit mobile number, or leave it empty.')}</p>}
          {known && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800" data-delivery-known>
              <History className="w-3 h-3" /> {tr('Delivered before — name and last address filled')}
            </p>
          )}
        </div>
        <div>
          <label className={label} htmlFor="dl-name">{tr('Guest name')}</label>
          <div className="relative">
            <UserRound className={icon} />
            <input id="dl-name" value={name} onChange={(e) => setName(e.target.value)} className={field} data-delivery-name />
          </div>
        </div>
        <div>
          <label className={label} htmlFor="dl-address">{tr('Delivery address *')}</label>
          <div className="relative">
            <MapPin className={icon} />
            <textarea id="dl-address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} className={`${field} h-auto py-2.5 resize-none`} data-delivery-address />
          </div>
        </div>
        {charges.length > 0 && (
          <p className="text-[11px] font-semibold text-slate-600 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2" data-delivery-charges>
            {tr('Added to the bill: {charges}', { charges: charges.join(' + ') })}
          </p>
        )}
        <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="submit" variant="success" disabled={phoneBad || !address.trim()} data-delivery-start>
            <Bike className="w-4 h-4" /> {tr('Start delivery order')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
