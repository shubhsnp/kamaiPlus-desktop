'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR, cn } from '@/lib/utils';
import { Calculator, CheckCircle2, AlertTriangle, Copy, RotateCcw, Printer, Check } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';

interface DenominationCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  denominations: { [key: number]: number };
  onDenominationChange: (denom: number, count: number) => void;
  expectedDrawerCashPaise: number;
  onConfirmCloseShift?: (physicalCashPaise: number, discrepancyPaise: number) => Promise<void>;
  isSubmitting?: boolean;
}

const TALLY_DRAFT_KEY = 'kamai_cash_tally_draft';

export const DenominationCalculatorModal: React.FC<DenominationCalculatorModalProps> = ({
  isOpen,
  onClose,
  denominations,
  onDenominationChange,
  expectedDrawerCashPaise,
  onConfirmCloseShift,
  isSubmitting = false,
}) => {
  const noteDenominations = [500, 200, 100, 50, 20, 10, 5, 2, 1];
  const [copied, setCopied] = useState(false);

  // Restore draft counts on modal open if current counts are zero
  useEffect(() => {
    if (!isOpen) return;
    try {
      const saved = localStorage.getItem(TALLY_DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const hasAnyExisting = noteDenominations.some((d) => (denominations[d] || 0) > 0);
        if (!hasAnyExisting && typeof parsed === 'object' && parsed !== null) {
          noteDenominations.forEach((d) => {
            if (typeof parsed[d] === 'number' && parsed[d] > 0) {
              onDenominationChange(d, parsed[d]);
            }
          });
        }
      }
    } catch {}
  }, [isOpen]);

  // Save changes to draft
  const handleCountChange = (denom: number, count: number) => {
    const validCount = Math.max(0, count);
    onDenominationChange(denom, validCount);
    try {
      const currentDraft = { ...denominations, [denom]: validCount };
      localStorage.setItem(TALLY_DRAFT_KEY, JSON.stringify(currentDraft));
    } catch {}
  };

  const handleReset = () => {
    noteDenominations.forEach((d) => onDenominationChange(d, 0));
    try {
      localStorage.removeItem(TALLY_DRAFT_KEY);
    } catch {}
  };

  const totalCalculatedCashPaise = noteDenominations.reduce((acc, denom) => {
    const count = denominations[denom] || 0;
    return acc + denom * count * 100;
  }, 0);

  const totalNotesCount = noteDenominations.reduce((acc, denom) => {
    return acc + (denominations[denom] || 0);
  }, 0);

  const discrepancyPaise = totalCalculatedCashPaise - expectedDrawerCashPaise;
  const isExactMatch = discrepancyPaise === 0;
  const isExcess = discrepancyPaise > 0;

  const handleCopyBreakdown = () => {
    let text = `CASH DRAWER TALLY\n`;
    text += `Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}\n`;
    text += `Expected: ${formatINR(expectedDrawerCashPaise)}\n`;
    text += `Counted: ${formatINR(totalCalculatedCashPaise)} (${totalNotesCount} Notes)\n`;
    text += `Diff: ${isExactMatch ? 'Exact Match (₹0)' : isExcess ? '+' + formatINR(discrepancyPaise) : formatINR(discrepancyPaise)}\n\n`;
    text += `DENOMINATIONS BREAKDOWN:\n`;

    let hasNotes = false;
    noteDenominations.forEach((denom) => {
      const count = denominations[denom] || 0;
      if (count > 0) {
        hasNotes = true;
        text += `₹${denom} × ${count} = ₹${denom * count}\n`;
      }
    });

    if (!hasNotes) {
      text += `No notes counted.\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintSlip = async () => {
    let rowsHtml = '';
    noteDenominations.forEach((denom) => {
      const count = denominations[denom] || 0;
      if (count > 0) {
        rowsHtml += `
          <div style="display:flex; justify-content:space-between; margin-bottom: 2px;">
            <span>₹${denom} × ${count}</span>
            <span>₹${denom * count}</span>
          </div>
        `;
      }
    });

    const slipHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cash Tally Slip</title>
        <style>
          @page { size: 58mm auto; margin: 0; }
          body { font-family: monospace; font-size: 11px; padding: 6px; margin: 0; width: 56mm; }
          .center { text-align: center; }
          .bold { font-weight: 800; }
          .rule { border-top: 1px dashed #000; margin: 4px 0; }
        </style>
      </head>
      <body>
        <div class="center bold" style="font-size: 13px;">CASH TALLY SLIP</div>
        <div class="center" style="font-size: 10px;">${new Date().toLocaleString('en-IN')}</div>
        <div class="rule"></div>
        ${rowsHtml || '<div class="center">No notes counted</div>'}
        <div class="rule"></div>
        <div style="display:flex; justify-content:space-between;" class="bold">
          <span>Total Counted:</span>
          <span>₹${(totalCalculatedCashPaise / 100).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;">
          <span>Total Notes:</span>
          <span>${totalNotesCount}</span>
        </div>
        <div class="rule"></div>
        <div style="display:flex; justify-content:space-between;">
          <span>Expected:</span>
          <span>₹${(expectedDrawerCashPaise / 100).toFixed(2)}</span>
        </div>
        <div style="display:flex; justify-content:space-between;" class="bold">
          <span>Diff:</span>
          <span>${isExactMatch ? 'MATCH' : (isExcess ? '+' : '') + (discrepancyPaise / 100).toFixed(2)}</span>
        </div>
        <script>window.onload = () => window.print();</script>
      </body>
      </html>
    `;

    const desktop = getDesktopApi();
    if (desktop && desktop.isDesktop) {
      await desktop.print({ html: slipHtml, paper: 'thermal-58', silent: false });
    } else {
      const w = window.open('', '_blank', 'width=300,height=400');
      if (w) {
        w.document.write(slipHtml);
        w.document.close();
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-600" />
            <span className="font-black text-slate-900 dark:text-slate-100">
              Denomination Tally Counter
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition"
            title="Reset all counts to zero"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>
      }
      description="Physical currency notes counter with auto-draft persistence."
      size="lg"
    >
      <div className="space-y-4">
        {/* Notes Grid with Steppers */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {noteDenominations.map((denom) => {
            const count = denominations[denom] || 0;
            const subtotalRupees = denom * count;
            const isCoin = denom <= 5;
            
            // Indian Currency Colors
            const getNoteStyles = (val: number) => {
              switch (val) {
                case 500: return 'from-stone-400 to-stone-500 text-stone-950 border-stone-300';
                case 200: return 'from-orange-400 to-amber-500 text-orange-950 border-orange-300';
                case 100: return 'from-violet-400 to-purple-500 text-white border-violet-300';
                case 50: return 'from-cyan-300 to-cyan-500 text-cyan-950 border-cyan-200';
                case 20: return 'from-lime-400 to-emerald-400 text-emerald-950 border-lime-200';
                case 10: return 'from-amber-600 to-amber-800 text-white border-amber-500';
                case 5: return 'from-yellow-300 to-amber-400 text-yellow-950 border-yellow-200';
                case 2: return 'from-slate-300 to-slate-400 text-slate-900 border-slate-200';
                case 1: return 'from-slate-300 to-slate-400 text-slate-900 border-slate-200';
                default: return 'from-slate-100 to-slate-200 text-slate-800';
              }
            };
            
            const styles = getNoteStyles(denom);

            return (
              <div
                key={denom}
                className={cn(
                  'p-2.5 rounded-2xl border transition-all duration-200 shadow-sm flex flex-col gap-2.5',
                  count > 0
                    ? 'border-emerald-300 bg-emerald-50/50 ring-2 ring-emerald-400/20 scale-[1.02]'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
                )}
              >
                <div className="flex items-center justify-between">
                  {isCoin ? (
                    <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center font-black text-sm shadow-inner border-2', styles)}>
                      ₹{denom}
                    </div>
                  ) : (
                    <div className={cn('w-16 h-9 rounded bg-gradient-to-br flex items-center justify-center font-black text-sm shadow-inner border opacity-90', styles)}>
                      ₹{denom}
                    </div>
                  )}
                  <span className={cn("text-xs font-black font-mono transition-colors", count > 0 ? "text-emerald-700" : "text-slate-400")}>
                    = ₹{subtotalRupees}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleCountChange(denom, Math.max(0, count - 1))}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center cursor-pointer active:scale-95 hover:bg-slate-100 transition-all shadow-2xs"
                  >
                    -
                  </button>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={count || ''}
                    onChange={(e) => {
                      const parsed = parseInt(e.target.value, 10);
                      handleCountChange(denom, isNaN(parsed) || parsed < 0 ? 0 : parsed);
                    }}
                    className="flex-1 w-full h-8 bg-transparent text-slate-900 font-black font-mono focus:outline-none text-center text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => handleCountChange(denom, count + 1)}
                    className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-lg flex items-center justify-center cursor-pointer active:scale-95 hover:bg-slate-100 transition-all shadow-2xs"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCountChange(denom, count + 5)}
                    className="px-2 h-8 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 font-black text-[10px] flex items-center justify-center cursor-pointer active:scale-95 hover:bg-emerald-200 transition-all shadow-2xs"
                    title="Add 5"
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Financial Comparison Summary */}
        <div className="p-3.5 rounded-2xl bg-slate-900 text-white space-y-2 font-mono">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">
              Total Counted Cash ({totalNotesCount} Notes):
            </span>
            <span className="text-base font-black text-emerald-400">
              {formatINR(totalCalculatedCashPaise)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
            <span className="text-slate-400">Expected in Drawer:</span>
            <span className="font-bold text-slate-200">
              {formatINR(expectedDrawerCashPaise)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
            <span className="text-slate-400">Discrepancy:</span>
            <span
              className={cn(
                'font-black',
                isExactMatch
                  ? 'text-emerald-400'
                  : isExcess
                  ? 'text-amber-400'
                  : 'text-rose-400'
              )}
            >
              {isExactMatch
                ? 'Exact Match (₹0.00)'
                : isExcess
                ? `+${formatINR(discrepancyPaise)} (Excess)`
                : `${formatINR(discrepancyPaise)} (Shortage)`}
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyBreakdown}
              className="text-xs font-bold gap-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy Breakdown'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintSlip}
              className="text-xs font-bold gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Slip</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
            {onConfirmCloseShift && (
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={() =>
                  onConfirmCloseShift(totalCalculatedCashPaise, discrepancyPaise)
                }
                className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-black text-xs"
              >
                {isSubmitting ? 'Closing...' : 'Confirm & Close Shift'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
