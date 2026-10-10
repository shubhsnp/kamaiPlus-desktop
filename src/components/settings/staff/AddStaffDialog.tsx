'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import type { VerticalId } from '@/lib/business/verticalProfile';
import { addStaff, staffDraft, staffRolesFor } from '@/lib/cloud/staff';

/** v4.144.0 — a new staff member: name + role (this kind of shop's roles; planned ones are shown, not pickable). */
export function AddStaffDialog({ open, vertical, onClose, onAdded }: {
  open: boolean;
  vertical: VerticalId | null;
  onClose: () => void;
  onAdded: (staffId: string, name: string) => void;
}) {
  const roles = staffRolesFor(vertical);
  const firstAvailable = roles.find((r) => r.available)?.id || '';
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>(firstAvailable);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setRole(firstAvailable);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const d = staffDraft(name, role, vertical, new Date().toISOString());
    if (!d.ok) {
      setError(d.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await addStaff(d.doc);
      onAdded(id, String(d.doc.name));
    } catch {
      setError(tr('Could not save. Check the internet and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={open} onClose={() => !busy && onClose()} title={tr('Add staff')} description={tr('Then sign in their phone with a one-time code.')} size="md">
      <form onSubmit={save} className="space-y-4" data-add-staff>
        <div>
          <label htmlFor="staff-name" className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">{tr('Name')}</label>
          <input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={40} placeholder={tr('e.g. Raju')}
            className="w-full h-11 px-3 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" data-staff-name />
        </div>
        <div>
          <span className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1.5">{tr('Role')}</span>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={tr('Role')}>
            {roles.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={role === r.id} disabled={!r.available} onClick={() => setRole(r.id)} data-staff-role={r.id}
                className={cn('text-left p-3 rounded-xl border transition-colors',
                  !r.available ? 'border-dashed border-slate-200 bg-slate-50 cursor-not-allowed' : role === r.id ? 'border-emerald-500 bg-emerald-50/70 cursor-pointer' : 'border-slate-200 bg-white hover:border-slate-400 cursor-pointer')}>
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('text-sm font-black', r.available ? 'text-slate-900' : 'text-slate-400')}>{r.label}</span>
                  {!r.available && <span className="text-[10px] font-black uppercase tracking-wide text-slate-500 bg-slate-200 rounded-full px-1.5 py-0.5">{tr('Coming next')}</span>}
                </span>
                <span className={cn('block text-[11px] leading-snug mt-0.5', r.available ? 'text-slate-600' : 'text-slate-400')}>{r.does}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</p>}
        <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>{tr('Cancel')}</Button>
          <Button type="submit" variant="success" disabled={busy || !firstAvailable} data-staff-save>
            <UserPlus className="w-4 h-4" /> {busy ? tr('Saving…') : tr('Add and show code')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
