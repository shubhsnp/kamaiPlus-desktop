'use client';

import React, { useEffect, useState } from 'react';
import { UserPlus, Shield, ChevronDown, ChevronUp, Percent, Trash2, ArrowLeftRight, BarChart3, Wallet } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';
import type { VerticalId } from '@/lib/business/verticalProfile';
import { addStaff, staffDraft, staffRolesFor, type StaffPermissions } from '@/lib/cloud/staff';

interface AddStaffDialogProps {
  open: boolean;
  vertical: VerticalId | null;
  onClose: () => void;
  onAdded: (staffId: string, name: string) => void;
}

/** Suggestion chips for quick one-tap role selection per business vertical */
function getRoleSuggestions(vertical: VerticalId | null | undefined): string[] {
  switch (vertical) {
    case 'restaurant':
      return ['Waiter', 'Captain', 'Cashier', 'Kitchen', 'Helper', 'Manager'];
    case 'pharmacy':
      return ['Billing staff', 'Stock staff', 'Pharmacist', 'Helper', 'Delivery'];
    case 'clothing':
      return ['Salesperson', 'Cashier', 'Floor Manager', 'Helper', 'Tailor'];
    case 'hardware':
      return ['Salesman', 'Godown staff', 'Counter Billing', 'Helper'];
    default:
      return ['Billing staff', 'Stock staff', 'Delivery staff', 'Helper', 'Manager'];
  }
}

/**
 * Add staff dialog — owner can specify ANY custom role (or tap convenient vertical presets),
 * and configure permissions right away.
 */
export function AddStaffDialog({ open, vertical, onClose, onAdded }: AddStaffDialogProps) {
  const roles = staffRolesFor(vertical);
  const suggestions = getRoleSuggestions(vertical);
  const defaultRole = suggestions[0] || 'Waiter';

  const [name, setName] = useState('');
  const [role, setRole] = useState(defaultRole);
  const [showPermissions, setShowPermissions] = useState(false);

  // Permission settings
  const [canDiscount, setCanDiscount] = useState(false);
  const [maxDiscountPct, setMaxDiscountPct] = useState(10);
  const [canCancelItem, setCanCancelItem] = useState(false);
  const [canChangeTable, setCanChangeTable] = useState(true);
  const [canViewReports, setCanViewReports] = useState(false);
  const [canAccessCashDrawer, setCanAccessCashDrawer] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setRole(defaultRole);
      setShowPermissions(false);
      setCanDiscount(false);
      setMaxDiscountPct(10);
      setCanCancelItem(false);
      setCanChangeTable(true);
      setCanViewReports(false);
      setCanAccessCashDrawer(false);
      setError(null);
    }
  }, [open, defaultRole]);

  // Intelligent preset adjustments when role changes
  const applyRoleSuggestion = (suggested: string) => {
    setRole(suggested);
    const lower = suggested.toLowerCase();
    if (lower.includes('cashier') || lower.includes('manager')) {
      setCanDiscount(true);
      setCanViewReports(true);
      setCanAccessCashDrawer(true);
      setCanCancelItem(true);
    } else if (lower.includes('captain')) {
      setCanCancelItem(true);
      setCanChangeTable(true);
    } else if (lower.includes('waiter') || lower.includes('helper')) {
      setCanDiscount(false);
      setCanViewReports(false);
      setCanAccessCashDrawer(false);
      setCanCancelItem(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanRole = role.trim();
    const isPreset = roles.some((r) => r.id.toLowerCase() === cleanRole.toLowerCase() || r.label.toLowerCase() === cleanRole.toLowerCase());

    const permissions: StaffPermissions = {
      canDiscount,
      maxDiscountPct: Math.max(1, Math.min(100, Number(maxDiscountPct) || 10)),
      canCancelItem,
      canChangeTable,
      canViewReports,
      canAccessCashDrawer,
    };

    const d = staffDraft(name, cleanRole, vertical, new Date().toISOString(), {
      isCustom: !isPreset,
      permissions,
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
      description={tr('Enter member details, assign role & permissions, then connect their phone.')}
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

        {/* Permissions Accordion */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50">
          <button
            type="button"
            onClick={() => setShowPermissions(!showPermissions)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-100/60 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-600" />
              <div>
                <p className="text-xs font-black text-slate-800">{tr('Permissions & Security Limits')}</p>
                <p className="text-[10.5px] text-slate-500">
                  {showPermissions ? tr('Tap to collapse') : tr('Configure discounts, cancels, drawer & reports access')}
                </p>
              </div>
            </div>
            {showPermissions ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
          </button>

          {showPermissions && (
            <div className="p-3.5 pt-1 space-y-2.5 border-t border-slate-200 bg-white">
              {/* Allow giving discounts */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Percent className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-700">{tr('Allow Giving Discounts')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={canDiscount}
                  onChange={(e) => setCanDiscount(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
              {canDiscount && (
                <div className="pl-6 flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">{tr('Max discount limit:')}</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={maxDiscountPct}
                    onChange={(e) => setMaxDiscountPct(Number(e.target.value) || 10)}
                    className="w-16 h-7 px-2 border border-slate-300 rounded text-center text-xs font-bold"
                  />
                  <span className="text-slate-500 font-bold">%</span>
                </div>
              )}

              {/* Allow cancelling items */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-xs font-bold text-slate-700">{tr('Allow Canceling Sent Items (KOT)')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={canCancelItem}
                  onChange={(e) => setCanCancelItem(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Allow changing table */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-slate-700">{tr('Allow Shifting / Changing Tables')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={canChangeTable}
                  onChange={(e) => setCanChangeTable(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Allow viewing reports */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-600" />
                  <span className="text-xs font-bold text-slate-700">{tr('Allow Viewing Sales Reports')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={canViewReports}
                  onChange={(e) => setCanViewReports(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>

              {/* Allow cash drawer / settle bill */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2">
                  <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">{tr('Allow Cash Drawer & Settle Bill')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={canAccessCashDrawer}
                  onChange={(e) => setCanAccessCashDrawer(e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                />
              </div>
            </div>
          )}
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
