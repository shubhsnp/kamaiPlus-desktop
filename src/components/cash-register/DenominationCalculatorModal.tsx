'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { formatINR, cn } from '@/lib/utils';
import { Calculator, CheckCircle2, AlertTriangle, Copy, RotateCcw, Printer, Check } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { msg, tr } from '@/lib/i18n/core';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';
import { cashTallyMessage } from '@/lib/whatsapp/businessMessages';
import { messageShop } from '@/lib/whatsapp/whatsappDrafts';
import { generateCashTallyTextBreakdown, generateCashTallySlipHtml } from './cashTallySlip';

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

const NOTE_STYLES: Record<number, string> = {
  500: 'from-stone-400 to-stone-500 text-stone-950 border-stone-300',
  200: 'from-orange-400 to-amber-500 text-orange-950 border-orange-300',
  100: 'from-violet-400 to-purple-500 text-white border-violet-300',
  50: 'from-cyan-300 to-cyan-500 text-cyan-950 border-cyan-200',
  20: 'from-lime-400 to-emerald-400 text-emerald-950 border-lime-200',
  10: 'from-amber-600 to-amber-800 text-white border-amber-500',
  5: 'from-yellow-300 to-amber-400 text-yellow-950 border-yellow-200',
  2: 'from-slate-300 to-slate-400 text-slate-900 border-slate-200',
  1: 'from-slate-300 to-slate-400 text-slate-900 border-slate-200',
};

export const DenominationCalculatorModal: React.FC<DenominationCalculatorModalProps> = ({
  isOpen,
  onClose,
  denominations,
  onDenominationChange,
  expectedDrawerCashPaise,
  onConfirmCloseShift,
  isSubmitting = false,
}) => {
  const business = useBusiness();
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
    const text = generateCashTallyTextBreakdown({
      expectedDrawerCashPaise,
      totalCalculatedCashPaise,
      totalNotesCount,
      discrepancyPaise,
      denominations,
      noteDenominations,
    });
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrintSlip = async () => {
    const slipHtml = generateCashTallySlipHtml({
      expectedDrawerCashPaise,
      totalCalculatedCashPaise,
      totalNotesCount,
      discrepancyPaise,
      denominations,
      noteDenominations,
    });
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
              {tr('Denomination Tally Counter')}
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition"
            title={tr('Reset all counts to zero')}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{tr('Reset')}</span>
          </button>
        </div>
      }
      description={tr('Physical currency notes counter with auto-draft persistence.')}
      size="lg"
    >
      <div className="space-y-4">
        {/* Notes Grid with Steppers */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {noteDenominations.map((denom) => {
            const count = denominations[denom] || 0;
            const subtotalRupees = denom * count;
            const isCoin = denom <= 5;
            const styles = NOTE_STYLES[denom] || 'from-slate-100 to-slate-200 text-slate-800';

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
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center">
                      {/* Real Indian currency note / coin image */}
                      <img
                        src={`/images/denominations/${denom}.png`}
                        alt={`₹${denom} ${isCoin ? 'Coin' : 'Note'}`}
                        className={cn(
                          'object-contain select-none',
                          isCoin
                            ? 'w-10 h-10 drop-shadow-xs'
                            : 'w-16 h-9 rounded shadow-2xs border border-slate-200/90'
                        )}
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = target.nextElementSibling as HTMLElement;
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                      <div
                        style={{ display: 'none' }}
                        className={cn(
                          'items-center justify-center font-black text-xs shadow-inner border',
                          isCoin ? 'w-10 h-10 rounded-full border-2' : 'w-16 h-9 rounded opacity-90',
                          styles
                        )}
                      >
                        ₹{denom}
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-black text-slate-800 leading-tight">
                        ₹{denom}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {isCoin ? tr('Coin') : tr('Note')}
                      </span>
                    </div>
                  </div>

                  <span className={cn("text-xs font-black font-mono shrink-0 transition-colors", count > 0 ? "text-emerald-700" : "text-slate-400")}>
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
                    title={tr('Add 5')}
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
              {tr('Total Counted Cash (')}{totalNotesCount} {tr('Notes):')}
            </span>
            <span className="text-base font-black text-emerald-400">
              {formatINR(totalCalculatedCashPaise)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
            <span className="text-slate-400">{tr('Expected in Drawer:')}</span>
            <span className="font-bold text-slate-200">
              {formatINR(expectedDrawerCashPaise)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-1.5">
            <span className="text-slate-400">{tr('Discrepancy:')}</span>
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
                ? tr('Exact Match (₹0.00)')
                : isExcess
                ? tr('+{v1} (Excess)', { v1: formatINR(discrepancyPaise) })
                : tr('{v1} (Shortage)', { v1: formatINR(discrepancyPaise) })}
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
              <span>{copied ? tr('Copied!') : tr('Copy Breakdown')}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrintSlip}
              className="text-xs font-bold gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{tr('Print Slip')}</span>
            </Button>
            <WhatsAppButton
              className="h-8"
              request={() => ({
                kind: 'text', title: msg('Cash count on WhatsApp'), remember: 'owner',
                message: cashTallyMessage({ shop: messageShop(business), counts: noteDenominations.map((value) => ({ value, count: denominations[value] || 0 })), countedPaise: totalCalculatedCashPaise, expectedPaise: expectedDrawerCashPaise }),
              })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {tr('Close')}
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
                {isSubmitting ? tr('Closing...') : tr('Confirm & Close Shift')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
