'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Receipt, UtensilsCrossed, IndianRupee, Clock, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { tr } from '@/lib/i18n/core';
import { formatINR } from '@/lib/utils';
import type { StaffMember } from '@/lib/cloud/staff';
import { getStaffTodayPerformance, type StaffTodayPerformance } from '@/lib/staff/staffMetrics';

export function StaffPerformanceDialog({
  open,
  member,
  onClose,
}: {
  open: boolean;
  member: StaffMember | null;
  onClose: () => void;
}) {
  const [perf, setPerf] = useState<StaffTodayPerformance | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !member) {
      setPerf(null);
      return;
    }
    let alive = true;
    setLoading(true);
    getStaffTodayPerformance(member.name, member.id)
      .then((data) => {
        if (alive) setPerf(data);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, member?.name]);

  if (!member) return null;

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={tr('Staff Performance: {name}', { name: member.name })}
      description={tr('Today’s orders, billing total, and active tasks.')}
      size="lg"
    >
      <div className="space-y-4" data-staff-perf-dialog>
        {/* Top KPI Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl border border-indigo-100 bg-indigo-50/50">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-bold mb-1">
              <Receipt className="w-4 h-4" />
              <span>{tr('Today’s Bills')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900" data-perf-order-count>
              {loading ? '—' : perf?.orderCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('Completed orders')}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-emerald-100 bg-emerald-50/50">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-bold mb-1">
              <IndianRupee className="w-4 h-4" />
              <span>{tr('Sales Generated')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900 truncate" data-perf-sales-amount>
              {loading ? '—' : formatINR(perf?.totalSalesPaise ?? 0)}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('Total billed today')}
            </div>
          </div>

          <div className="p-3.5 rounded-2xl border border-amber-100 bg-amber-50/50">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold mb-1">
              <UtensilsCrossed className="w-4 h-4" />
              <span>{tr('Active Tables')}</span>
            </div>
            <div className="text-2xl font-black text-slate-900" data-perf-active-count>
              {loading ? '—' : perf?.activeTablesCount ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {tr('Running orders right now')}
            </div>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-slate-500" />
              {tr('Today’s Orders by {name}', { name: member.name })}
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              {perf?.recentSales.length || 0} {tr('records')}
            </span>
          </div>

          {loading ? (
            <p className="p-5 text-xs text-slate-500 text-center">{tr('Loading performance data…')}</p>
          ) : !perf || perf.recentSales.length === 0 ? (
            <div className="p-6 text-center space-y-1">
              <Clock className="w-6 h-6 text-slate-300 mx-auto" />
              <p className="text-xs font-bold text-slate-600">{tr('No completed orders yet today')}</p>
              <p className="text-[11px] text-slate-400">
                {tr('When this staff member takes orders and bills them, they will appear here.')}
              </p>
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
              {perf.recentSales.map((sale) => (
                <div key={sale.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 font-mono">
                        #{sale.invoice_number}
                      </span>
                      <span className="text-[11px] font-bold text-slate-600 truncate">
                        {sale.customer_name || tr('Counter Bill')}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(sale.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {sale.items.length} {tr('items')}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-black text-slate-900">
                      {formatINR(sale.grand_total)}
                    </div>
                    <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1 justify-end">
                      <CheckCircle2 className="w-3 h-3" />
                      {tr('Paid')} ({sale.payment_method.toUpperCase()})
                    </div>
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
