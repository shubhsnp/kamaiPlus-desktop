'use client';

import React, { useEffect, useState } from 'react';
import { Banknote, IndianRupee, Plus, Trash2, Calendar, Edit3, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { showConfirm } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';
import { formatINR, parseRupeesToPaise } from '@/lib/utils';
import type { StaffMember } from '@/lib/cloud/staff';
import { updateStaffSalary } from '@/lib/cloud/staff';
import {
  getStaffSalaryLedger,
  deleteStaffPayment,
  type StaffSalaryLedger,
} from '@/lib/staff/staffMetrics';
import { StaffPaymentForm } from './StaffPaymentForm';

export function StaffSalaryDialog({
  open,
  member,
  businessId = 'biz_default',
  onClose,
  onSalaryUpdated,
}: {
  open: boolean;
  member: StaffMember | null;
  businessId?: string;
  onClose: () => void;
  onSalaryUpdated: (memberId: string, monthlySalaryPaise: number) => void;
}) {
  const [ledger, setLedger] = useState<StaffSalaryLedger | null>(null);
  const [loading, setLoading] = useState(false);

  // Edit Monthly Base Salary
  const [editingSalary, setEditingSalary] = useState(false);
  const [salaryRupees, setSalaryRupees] = useState('');
  const [savingSalary, setSavingSalary] = useState(false);

  // Add Advance / Payment
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLedger = async (staffName: string, salaryPaise = 0) => {
    setLoading(true);
    try {
      const data = await getStaffSalaryLedger(staffName, salaryPaise);
      setLedger(data);
    } catch {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !member) {
      setLedger(null);
      setEditingSalary(false);
      setShowAddPayment(false);
      return;
    }
    const currentSalPaise = member.monthlySalaryPaise ?? 0;
    setSalaryRupees(currentSalPaise > 0 ? (currentSalPaise / 100).toString() : '');
    void loadLedger(member.name, currentSalPaise);
  }, [open, member?.name, member?.monthlySalaryPaise]);

  if (!member) return null;

  const handleSaveSalary = async () => {
    const paise = parseRupeesToPaise(salaryRupees);
    setSavingSalary(true);
    setError(null);
    try {
      await updateStaffSalary(member.id, paise);
      onSalaryUpdated(member.id, paise);
      setEditingSalary(false);
      await loadLedger(member.name, paise);
    } catch {
      setError(tr('Could not update salary. Check internet and try again.'));
    } finally {
      setSavingSalary(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    const ok = await showConfirm(
      tr('Delete this salary/advance entry? It will also be removed from the cash register expenses.'),
      { title: tr('Delete Payment Record'), confirmLabel: tr('Delete entry') }
    );
    if (!ok) return;

    try {
      await deleteStaffPayment(id, businessId);
      await loadLedger(member.name, member.monthlySalaryPaise ?? 0);
    } catch {
      setError(tr('Could not delete entry. Please try again.'));
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={tr('Salary & Advances: {name}', { name: member.name })}
      description={tr('Manage monthly base salary, record advance payments, and view payment ledger.')}
      size="lg"
    >
      <div className="space-y-4" data-staff-salary-dialog>
        {/* Top Financial KPI Strip */}
        <div className="grid grid-cols-3 gap-3">
          {/* Monthly Base Salary */}
          <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/60 relative">
            <div className="flex items-center justify-between text-slate-600 text-xs font-bold mb-1">
              <span className="flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-indigo-600" />
                {tr('Monthly Salary')}
              </span>
              <button
                type="button"
                onClick={() => setEditingSalary(!editingSalary)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5"
                data-salary-edit-btn
              >
                <Edit3 className="w-3 h-3" />
                {editingSalary ? tr('Cancel') : tr('Edit')}
              </button>
            </div>

            {editingSalary ? (
              <div className="mt-1 flex items-center gap-1.5">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={salaryRupees}
                    onChange={(e) => setSalaryRupees(e.target.value)}
                    placeholder="15000"
                    autoFocus
                    className="w-full h-8 pl-6 pr-2 rounded-lg border border-indigo-400 text-xs font-black focus:outline-none"
                    data-salary-input
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="success"
                  onClick={handleSaveSalary}
                  disabled={savingSalary}
                  data-salary-save-btn
                >
                  {savingSalary ? '…' : tr('Save')}
                </Button>
              </div>
            ) : (
              <div className="text-xl font-black text-slate-900 truncate" data-salary-display>
                {formatINR(member.monthlySalaryPaise ?? 0)}
                <span className="text-[10px] text-slate-400 font-bold ml-1">{tr('/ mo')}</span>
              </div>
            )}
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('Base monthly wage')}
            </div>
          </div>

          {/* Advances Paid This Month */}
          <div className="p-3.5 rounded-2xl border border-amber-200 bg-amber-50/50">
            <div className="flex items-center gap-1.5 text-amber-800 text-xs font-bold mb-1">
              <IndianRupee className="w-4 h-4" />
              <span>{tr('Advances Paid')}</span>
            </div>
            <div className="text-xl font-black text-slate-900 truncate" data-advances-display>
              {loading ? '—' : formatINR(ledger?.totalAdvanceThisMonthPaise ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('This month total')}
            </div>
          </div>

          {/* Remaining Balance Payable */}
          <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50">
            <div className="flex items-center gap-1.5 text-emerald-800 text-xs font-bold mb-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>{tr('Net Payable')}</span>
            </div>
            <div className="text-xl font-black text-slate-900 truncate" data-net-payable-display>
              {loading ? '—' : formatINR(ledger?.netPayablePaise ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('Salary - Advances')}
            </div>
          </div>
        </div>

        {/* Action Header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
            {tr('Advance & Salary Payment History')}
          </span>
          <Button
            type="button"
            variant={showAddPayment ? 'outline' : 'success'}
            size="sm"
            onClick={() => setShowAddPayment(!showAddPayment)}
            data-add-advance-btn
          >
            <Plus className="w-3.5 h-3.5" />
            {showAddPayment ? tr('Hide Form') : tr('Pay Advance / Salary')}
          </Button>
        </div>

        {/* Modular Add Payment Form */}
        {showAddPayment && (
          <StaffPaymentForm
            businessId={businessId}
            staffName={member.name}
            onCancel={() => setShowAddPayment(false)}
            onRecorded={() => {
              setShowAddPayment(false);
              void loadLedger(member.name, member.monthlySalaryPaise ?? 0);
            }}
            onError={(msg) => setError(msg)}
          />
        )}

        {error && (
          <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        {/* Payment History List */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-500 font-bold">
            <span>{tr('Date & Reason')}</span>
            <span>{tr('Amount & Mode')}</span>
          </div>

          {loading ? (
            <p className="p-5 text-xs text-slate-500 text-center">{tr('Loading payment history…')}</p>
          ) : !ledger || ledger.expenses.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <Calendar className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">{tr('No advance or salary payments recorded yet')}</p>
              <p className="text-[11px] text-slate-400">
                {tr('Click "Pay Advance / Salary" above to record a payment. It will automatically reflect in Cash Register.')}
              </p>
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
              {ledger.expenses.map((exp) => (
                <div key={exp.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900">{exp.title}</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {exp.payment_mode.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {new Date(exp.created_at).toLocaleDateString([], {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {exp.notes && <span> · {exp.notes}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-black text-rose-700">
                      -{formatINR(exp.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="p-1 rounded text-slate-400 hover:text-rose-600 transition-colors"
                      title={tr('Delete entry')}
                      data-delete-expense={exp.id}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" onClick={onClose}>
            {tr('Close')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
