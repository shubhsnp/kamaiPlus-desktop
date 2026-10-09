import { showAlert } from '@/lib/ui/dialogs';
import React, { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { 
  FileDown, 
  Copy, 
  Check, 
  Banknote, 
  QrCode, 
  BookOpen, 
  Store, 
  AlertCircle,
  RefreshCw,
  Send
} from 'lucide-react';
import { Business, Sale, CashExpense, LedgerTransaction, SalesReturn } from '@/types';
import { formatINR } from '@/lib/utils';
import { generateDailyClosingPDF } from '@/lib/reports/dailyClosingPdf';
import { localDateKey, summarizeDay } from '@/lib/reports/cashDrawer';
import { msg, tr } from '@/lib/i18n/core';
import { counterPace, hourRangeLabel } from '@/lib/dashboard/todayInsights';
import { WhatsAppButton } from '@/components/whatsapp/WhatsAppButton';

interface DayEndClosingReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  business: Business | null | undefined;
  sales: Sale[];
  expenses: CashExpense[];
  /** That day's khata entries — cash collections count as drawer money. */
  ledger?: LedgerTransaction[];
  /** The day's morning float (`dayOpeningFloat`): net cash in hand is what the drawer holds (K-D38). */
  openingCash?: number;
  /** Returns of that day's bills: refunds come off how each bill was paid, as in Transactions. */
  returns?: SalesReturn[];
  selectedDate?: string; // YYYY-MM-DD
}

export const DayEndClosingReportModal: React.FC<DayEndClosingReportModalProps> = ({
  isOpen,
  onClose,
  business,
  sales,
  expenses,
  ledger,
  openingCash,
  returns,
  selectedDate,
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const targetPhone = business?.phone || '';
  // Local calendar day (the old UTC date put 12–5:30 AM bills on the previous day).
  const datePrefix = selectedDate || localDateKey(new Date());
  const day = summarizeDay({ sales, expenses, ledger, openingCash, returns, dateKey: datePrefix });

  // Estimates, cancelled and fully returned bills are not sales; change handed back is not cash kept.
  const daysSales = day.sales;
  const totalSalesPaise = day.netSalesPaise;
  // After returns (K-D35): these three add up to the total sales above.
  const cashSalesPaise = day.paidBy.cash;
  const upiSalesPaise = day.paidBy.upi + day.paidBy.card;
  const creditSalesPaise = day.paidBy.credit;
  // v4.124.0 (AU-17): udhar paid back in cash is drawer money — shown, so cash in hand adds up.
  const khataCashPaise = day.khataCashCollected;
  const totalItemsCount = day.itemsCount;
  const totalExpensePaise = day.totalExpensePaise;
  const cashExpensePaise = day.cashExpenses;
  const netCashInTillPaise = day.netCashInTillPaise;
  const topItems: [string, number][] = day.topItems.slice(0, 3).map((t) => [t.name, t.qty]);
  const pace = counterPace(daysSales, totalSalesPaise);
  const clock = (d: Date | null) => (d ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : '');

  const dateFormatted = new Date(datePrefix).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = new Date().toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Construct Plain Text Message for Clipboard copy
  const constructWhatsAppMessage = () => {
    const storeName = business?.name || 'My Store';
    let msg = `🏪 *${storeName.toUpperCase()} — DAILY CLOSING REPORT*\n`;
    msg += `📅 Date: ${dateFormatted} | ⏰ ${timeFormatted}\n`;
    msg += `─────────────────────────\n\n`;

    msg += `📊 *TODAY'S SALES OVERVIEW:*\n`;
    msg += `• 🧾 Total Invoices: *${daysSales.length} bills*\n`;
    msg += `• 💰 Gross Sales: *${formatINR(totalSalesPaise)}*\n`;
    msg += `• 📦 Total Items Sold: *${totalItemsCount} pcs*\n\n`;

    msg += `💳 *COLLECTIONS BREAKDOWN:*\n`;
    msg += `• 💵 Cash Sales: *${formatINR(cashSalesPaise)}*\n`;
    msg += `• 📱 UPI / Online QR: *${formatINR(upiSalesPaise)}*\n`;
    msg += `• 📒 Customer Credit (Udhar): *${formatINR(creditSalesPaise)}*\n`;
    if (khataCashPaise > 0) msg += `• 💰 Udhar received in cash (Khata): *${formatINR(khataCashPaise)}*\n`;
    msg += `\n`;

    if (totalExpensePaise > 0) {
      msg += `🔻 *STORE EXPENSES:*\n`;
      msg += `• Total Expenses: -${formatINR(totalExpensePaise)}\n`;
      msg += `• 💵 Net Cash in Till: *${formatINR(netCashInTillPaise)}*\n\n`;
    }

    if (topItems.length > 0) {
      msg += `⭐ *TOP SELLING PRODUCTS TODAY:*\n`;
      topItems.forEach(([name, qty], idx) => {
        msg += `${idx + 1}. ${name} (${qty} sold)\n`;
      });
      msg += `\n`;
    }

    msg += `✅ *Day Shift Safely Closed!* 🙏\n`;
    msg += `_Generated via KamaiPlus Store POS_`;
    return msg;
  };

  const handleCopyText = async () => {
    const message = constructWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      showAlert(tr('Failed to copy text.'));
    }
  };

  // Download PDF Report locally
  const handleDownloadPDF = () => {
    setIsGeneratingPdf(true);
    try {
      const { blob, filename } = generateDailyClosingPDF({
        business,
        sales,
        expenses,
        ledger,
        openingCash,
        returns,
        dateStr: datePrefix,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      showAlert(err.message || tr('Failed to generate Closing PDF.'));
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tr('1-Tap Day-End Closing & Summary')}
      description={tr('Official store closing summary & hisab-kitab sent directly to owner\'s WhatsApp.')}
      size="md"
    >
      <div className="space-y-4 text-xs p-0.5">
        {/* Preview Card */}
        <div className="p-3.5 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3 font-sans shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <div className="font-black text-xs text-white uppercase tracking-wide">
                  {business?.name || tr('My Store')}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {dateFormatted} • {timeFormatted}
                </div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
              {tr('Shift Closing')}
            </span>
          </div>

          {/* Key Totals Grid */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{tr('Total Sales (Bikri)')}</span>
              <div className="text-base font-black text-amber-400 font-mono mt-0.5">
                {formatINR(totalSalesPaise)}
              </div>
              <span className="text-[10px] text-slate-400">{daysSales.length} {tr('bills generated')}</span>
            </div>

            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">{tr('Net Cash in Hand')}</span>
              <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                {formatINR(netCashInTillPaise)}
              </div>
              <span className="text-[10px] text-slate-400">{tr('After ₹')}{(cashExpensePaise / 100).toFixed(0)} {tr('expenses')}</span>
            </div>
          </div>

          {/* Counter pace (v4.93.0): average bill, the busiest hour, first → last bill */}
          {pace.bills > 0 && (
            <div className="grid grid-cols-3 gap-2 text-[11px]" data-day-pace>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tr('Average Bill')}</span>
                <span className="font-black text-white font-mono">{formatINR(pace.averagePaise)}</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tr('Busiest hour')}</span>
                <span className="font-black text-white">{pace.busiestHour === null ? '—' : hourRangeLabel(pace.busiestHour)}</span>
                <span className="block text-[10px] text-slate-400">{tr('{count} bills', { count: pace.busiestBills })}</span>
              </div>
              <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">{tr('First → last bill')}</span>
                <span className="font-black text-white">{clock(pace.firstAt)}</span>
                <span className="block text-[10px] text-slate-400">{clock(pace.lastAt)}</span>
              </div>
            </div>
          )}

          {/* Payment Breakdown Rows */}
          <div className="space-y-1.5 pt-1 text-[11px] font-mono border-t border-slate-800/80 text-slate-300">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Banknote className="w-3.5 h-3.5 text-amber-400" /> {tr('Cash Collections:')}
              </span>
              <span className="font-bold text-white">{formatINR(cashSalesPaise)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <QrCode className="w-3.5 h-3.5 text-sky-400" /> {tr('UPI / QR Payments:')}
              </span>
              <span className="font-bold text-white">{formatINR(upiSalesPaise)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1.5 text-slate-400">
                <BookOpen className="w-3.5 h-3.5 text-rose-400" /> {tr('Customer Udhar (Credit):')}
              </span>
              <span className="font-bold text-white">{formatINR(creditSalesPaise)}</span>
            </div>
            {khataCashPaise > 0 && (
              <div className="flex justify-between items-center" data-day-khata-cash>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Banknote className="w-3.5 h-3.5 text-emerald-400" /> {tr('Udhar received in cash (Khata):')}
                </span>
                <span className="font-bold text-emerald-300">+{formatINR(khataCashPaise)}</span>
              </div>
            )}
          </div>

          {/* Top 3 Products */}
          {topItems.length > 0 && (
            <div className="pt-2 border-t border-slate-800 text-[11px]">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                {tr('Top Selling Today:')}
              </span>
              <div className="space-y-1 text-slate-300">
                {topItems.map(([name, qty], idx) => (
                  <div key={name} className="flex justify-between">
                    <span className="truncate max-w-[200px]">{idx + 1}. {name}</span>
                    <span className="font-mono text-slate-400 font-bold">{qty} {tr('sold')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* v4.79.0: the summary straight to the owner's WhatsApp (the number is remembered) */}
        <WhatsAppButton
          variant="block"
          label={tr("Send to owner's WhatsApp")}
          request={() => ({ kind: 'text', title: msg('Day summary on WhatsApp'), message: constructWhatsAppMessage(), recipientName: business?.owner_name, remember: 'owner' })}
        />

        {/* 2 Action Buttons: Copy, PDF */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyText}
            className="w-full font-bold text-[11px] gap-1 rounded-xl border-slate-300 hover:bg-slate-50 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-black">{tr('Copied!')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>{tr('Copy Text')}</span>
              </>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPdf}
            className="w-full font-bold text-[11px] gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border-slate-900 cursor-pointer shadow-xs"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400" />
            <span>{isGeneratingPdf ? tr('Saving...') : tr('PDF Report')}</span>
          </Button>
        </div>
      </div>
    </Modal>
  );
};
