'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, Percent, Trash2, ArrowLeftRight, BarChart3, Wallet, Lock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import type { StaffMember, StaffPermissions } from '@/lib/cloud/staff';
import { updateStaffPermissions } from '@/lib/cloud/staff';

export function StaffPermissionsDialog({
  open,
  member,
  onClose,
  onUpdated,
}: {
  open: boolean;
  member: StaffMember | null;
  onClose: () => void;
  onUpdated: (memberId: string, permissions: StaffPermissions) => void;
}) {
  const [canDiscount, setCanDiscount] = useState(false);
  const [maxDiscountPct, setMaxDiscountPct] = useState(10);
  const [canCancelItem, setCanCancelItem] = useState(false);
  const [canChangeTable, setCanChangeTable] = useState(true);
  const [canViewReports, setCanViewReports] = useState(false);
  const [canAccessCashDrawer, setCanAccessCashDrawer] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && member) {
      const p = member.permissions || {};
      setCanDiscount(p.canDiscount ?? false);
      setMaxDiscountPct(p.maxDiscountPct ?? 10);
      setCanCancelItem(p.canCancelItem ?? false);
      setCanChangeTable(p.canChangeTable ?? true);
      setCanViewReports(p.canViewReports ?? false);
      setCanAccessCashDrawer(p.canAccessCashDrawer ?? false);
      setError(null);
    }
  }, [open, member]);

  if (!member) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const newPerms: StaffPermissions = {
      canDiscount,
      maxDiscountPct: Math.max(1, Math.min(100, Number(maxDiscountPct) || 10)),
      canCancelItem,
      canChangeTable,
      canViewReports,
      canAccessCashDrawer,
    };

    try {
      await updateStaffPermissions(member.id, newPerms);
      onUpdated(member.id, newPerms);
      onClose();
    } catch {
      setError(tr('Could not update permissions. Check internet and try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={() => !busy && onClose()}
      title={tr('Role Permissions: {name}', { name: member.name })}
      description={tr('Configure access limits and security controls for this staff member.')}
      size="md"
    >
      <form onSubmit={save} className="space-y-4" data-staff-permissions-dialog>
        <div className="space-y-3">
          {/* Can give discounts */}
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Percent className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <span className="block text-xs font-black text-slate-900">
                    {tr('Allow Giving Discounts')}
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    {tr('Staff can reduce bill total or item price.')}
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={canDiscount}
                onChange={(e) => setCanDiscount(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
                data-perm-discount
              />
            </div>

            {canDiscount && (
              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-3">
                <label htmlFor="max-disc-input" className="text-[11px] font-bold text-slate-700">
                  {tr('Maximum Discount Limit (%):')}
                </label>
                <div className="flex items-center gap-1">
                  <input
                    id="max-disc-input"
                    type="number"
                    min="1"
                    max="100"
                    value={maxDiscountPct}
                    onChange={(e) => setMaxDiscountPct(Number(e.target.value) || 0)}
                    className="w-16 h-8 px-2 text-center rounded-lg border border-slate-300 text-xs font-black focus:outline-none focus:border-indigo-600"
                    data-perm-max-discount
                  />
                  <span className="text-xs font-bold text-slate-500">%</span>
                </div>
              </div>
            )}
          </div>

          {/* Cancel items / orders */}
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Trash2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-black text-slate-900">
                  {tr('Cancel Items / Dishes')}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {tr('Allow removing sent items from running KOT orders.')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={canCancelItem}
              onChange={(e) => setCanCancelItem(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              data-perm-cancel
            />
          </div>

          {/* Shift tables */}
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <ArrowLeftRight className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-black text-slate-900">
                  {tr('Move / Shift Tables')}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {tr('Allow shifting orders between tables or merging.')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={canChangeTable}
              onChange={(e) => setCanChangeTable(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              data-perm-shift-table
            />
          </div>

          {/* View financial reports / profits */}
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <BarChart3 className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-black text-slate-900">
                  {tr('View Reports & Profits')}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {tr('See daily sale totals, margin, and business reports.')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={canViewReports}
              onChange={(e) => setCanViewReports(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              data-perm-reports
            />
          </div>

          {/* Access cash drawer */}
          <div className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Wallet className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="block text-xs font-black text-slate-900">
                  {tr('Access Cash Register / Drawer')}
                </span>
                <span className="block text-[11px] text-slate-500">
                  {tr('Allow opening the cash drawer and taking cash payouts.')}
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={canAccessCashDrawer}
              onChange={(e) => setCanAccessCashDrawer(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              data-perm-cash-drawer
            />
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
          <Button type="submit" variant="success" disabled={busy} data-perm-save>
            <ShieldCheck className="w-4 h-4" />
            {busy ? tr('Saving…') : tr('Save Permissions')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
