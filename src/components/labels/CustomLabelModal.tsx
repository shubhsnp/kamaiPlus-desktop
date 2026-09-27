'use client';

import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { QueueItem } from './LabelQueuePanel';
import { tr } from '@/lib/i18n/core';

/** A label for something that is not in the catalogue (loose grains, bakery, gift packs). */
export function CustomLabelModal({ onClose, onAdd, defaultCopies }: { onClose: () => void; onAdd: (item: QueueItem) => void; defaultCopies: number }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [code, setCode] = useState('');
  const [copies, setCopies] = useState(String(defaultCopies));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const pricePaise = Math.round((parseFloat(price) || 0) * 100);
    onAdd({
      id: `custom_${Date.now()}`,
      name: name.trim(),
      // Not a catalogue item: this code is only printed, the POS will not know it.
      barcode: code.trim() || `KP${Date.now().toString().slice(-6)}`,
      pricePaise,
      mrpPaise: mrp ? Math.round(parseFloat(mrp) * 100) : pricePaise,
      copies: Math.max(1, parseInt(copies, 10) || 1),
      stock: null,
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title={tr('Create Custom Barcode Price Tag')} description={tr('Generate sticker tags for loose grains, bakery items, dry fruits, or custom products.')}>
      <form onSubmit={submit} className="space-y-3 text-xs">
        <Input label={tr('Product Description / Name')} placeholder={tr('e.g. Premium California Almonds 250g, Loose Sugar 1kg')} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="grid grid-cols-2 gap-2">
          <Input label={tr('Selling Price (₹)')} type="number" step="1" placeholder={tr('e.g. 240')} value={price} onChange={(e) => setPrice(e.target.value)} required />
          <Input label={tr('MRP (₹, Optional)')} type="number" step="1" placeholder={tr('e.g. 280')} value={mrp} onChange={(e) => setMrp(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label={tr('Custom Barcode / SKU (Optional)')} placeholder={tr('Leave blank for auto-generate')} value={code} onChange={(e) => setCode(e.target.value)} />
          <Input label={tr('Number of Label Copies')} type="number" min="1" max="500" value={copies} onChange={(e) => setCopies(e.target.value)} />
        </div>
        <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{tr('Cancel')}</Button>
          <Button type="submit" size="sm" className="bg-slate-900 text-white font-bold">{tr('Add to Print Queue')}</Button>
        </div>
      </form>
    </Modal>
  );
}
