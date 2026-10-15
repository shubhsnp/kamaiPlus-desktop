'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import type { VerticalId } from '@/lib/business/verticalProfile';
import { addStaff, staffDraft, staffRolesFor } from '@/lib/cloud/staff';

interface AddStaffDialogProps {
  open: boolean;
  vertical: VerticalId | null;
  onClose: () => void;
  onAdded: (staffId: string, name: string) => void;
}

/**
 * Suggestion chips for quick one-tap role selection per business vertical, in the shop's language.
 * No "Kitchen": a kitchen phone cannot sign in yet (no kitchen screen) — v4.171.0.
 */
function getRoleSuggestions(vertical: VerticalId | null | undefined): string[] {
  switch (vertical) {
    case 'restaurant':
      return [tr('Waiter'), tr('Captain'), tr('Cashier'), tr('Helper'), tr('Manager')];
    case 'pharmacy':
      return [tr('Billing staff'), tr('Stock staff'), tr('Pharmacist'), tr('Helper'), tr('Delivery')];
    case 'clothing':
      return [tr('Salesperson'), tr('Cashier'), tr('Floor Manager'), tr('Helper'), tr('Tailor')];
    case 'hardware':
      return [tr('Salesman'), tr('Godown staff'), tr('Counter Billing'), tr('Helper')];
    default:
      return [tr('Billing staff'), tr('Stock staff'), tr('Delivery staff'), tr('Helper'), tr('Manager')];
  }
}

/**
 * Add staff dialog — owner can specify ANY custom role (or tap convenient vertical presets).
 */
export function AddStaffDialog({ open, vertical, onClose, onAdded }: AddStaffDialogProps) {
  const roles = staffRolesFor(vertical);
  const suggestions = getRoleSuggestions(vertical);
  const defaultRole = suggestions[0] || tr('Waiter');

  const [name, setName] = useState('');
  const [role, setRole] = useState(defaultRole);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setRole(defaultRole);
      setError(null);
    }
  }, [open, defaultRole]);

  const applyRoleSuggestion = (suggested: string) => {
    setRole(suggested);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRole = role.trim();
    const isPreset = roles.some((r) => r.id.toLowerCase() === cleanRole.toLowerCase() || r.label.toLowerCase() === cleanRole.toLowerCase());

    const d = staffDraft(name, cleanRole, vertical, new Date().toISOString(), {
      isCustom: !isPreset,
    });

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
    <Modal
      isOpen={open}
      onClose={() => !busy && onClose()}
      title={tr('Add staff')}
      description={tr('Type the name and pick a role, then connect their phone.')}
      size="md"
    >
      <form onSubmit={save} className="space-y-4" data-add-staff>
        {/* Name input */}
        <div>
          <label htmlFor="staff-name" className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Staff Name')}
          </label>
          <input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={40}
            placeholder={tr('e.g. Raju, Amit, Sunita')}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            data-staff-name
          />
        </div>

        {/* Role input & suggestions */}
        <div>
          <label htmlFor="staff-role" className="block text-[11px] font-black uppercase tracking-wide text-slate-500 mb-1">
            {tr('Role (Type custom role or select below)')}
          </label>
          <input
            id="staff-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            maxLength={40}
            placeholder={tr('e.g. Waiter, Helper, Chef, Floor Manager...')}
            className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-sm font-semibold focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
            data-staff-role-input
          />
          {/* Quick suggestion chips */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {suggestions.map((s) => {
              const active = role.toLowerCase() === s.toLowerCase();
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => applyRoleSuggestion(s)}
                  data-staff-role={s.toLowerCase()}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer',
                    active
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>



        {error && (
          <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {tr('Cancel')}
          </Button>
          <Button type="submit" variant="success" disabled={busy || !name.trim() || !role.trim()} data-staff-save>
            <UserPlus className="w-4 h-4" /> {busy ? tr('Saving…') : tr('Add and show code')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
