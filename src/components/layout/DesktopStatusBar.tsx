'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Printer, Clock, FileText, LifeBuoy, Barcode, Keyboard } from 'lucide-react';
import { APP_VERSION } from '@/lib/constants/version';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import { getPrintSettings, printerForFormat } from '@/lib/hardware/printSettings';
import { getLabelSettings, LABEL_SETTINGS_EVENT } from '@/lib/labels/labelSettings';
import { billPrinterMismatch, PrinterLine, printerLine } from '@/lib/hardware/printerDetect';
import type { PaperFormat } from '@/lib/desktop/desktopBridge';
import { openPrintersWindow, usePrinterFacts } from '@/lib/hardware/printerWatch';
import { msg, tr } from '@/lib/i18n/core';
import { openWhatsNew } from '@/components/whatsNew/WhatsNewModal';
import { globalShortcutHints, pagePath } from '@/lib/ui/globalShortcuts';
import { openSettingsTab } from '@/lib/ui/settingsLinks';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

// Keep in step with the keydown handler in app/billing/page.tsx. The bar used to
// advertise F1 Billing / F2 Products / F4 Register everywhere — none of which existed.
const BILLING_SHORTCUTS: [string, string][] = [
  ['F1', msg('New bill')],
  ['F2', msg('Next bill')],
  ['/', msg('Search')],
  ['F4', msg('Cash')],
  ['F8', 'UPI'],
  ['F9', msg('Credit')],
  ['F10', msg('Complete sale')],
  ['Esc', msg('Clear search')],
];
const MENU_SHORTCUT: [string, string] = ['Ctrl+B', msg('Show / hide menu')];
// v4.93.0: on a laptop the bar showed every key and wrapped onto two lines. These two show only
// on wide screens; "All keys" lists everything.
const MINOR_KEYS = new Set(['/', 'Esc']);

type Tone = 'ok' | 'warn' | 'bad';
const DOT: Record<Tone, string> = { ok: 'bg-emerald-400', warn: 'bg-amber-400', bad: 'bg-rose-500' };
const TEXT: Record<Tone, string> = { ok: 'text-emerald-400', warn: 'text-amber-400', bad: 'text-rose-400' };

/** The bill printer in the status bar: green = ready, amber = check it, red = bills cannot print. */
function billPrinterText(line: PrinterLine): { tone: Tone; label: string; title: string } {
  switch (line.state) {
    case 'none':
      return { tone: 'bad', label: tr('None installed'), title: tr('No printer is installed in Windows.') };
    case 'no-default':
      return { tone: 'warn', label: tr('No default'), title: tr('Choose a printer in Settings → Print.') };
    case 'missing':
      return { tone: 'bad', label: tr('Not found: {chosen}', { chosen: line.name }), title: tr('The printer chosen in Settings ({chosen}) is not connected or was removed.', { chosen: line.name }) };
    case 'offline':
      return { tone: 'bad', label: tr('Offline: {name}', { name: line.name }), title: tr('The bill printer ({name}) is switched off or unplugged.', { name: line.name }) };
    case 'ready':
      return { tone: 'ok', label: line.name, title: tr('Bills print on {displayName}.', { displayName: line.name }) };
    default:
      if (line.virtual) return { tone: 'warn', label: line.name, title: tr('Bills go to {name} (Windows default), which only saves a file. Click to choose your bill printer.', { name: line.name }) };
      if (line.offline) return { tone: 'bad', label: tr('Offline: {name}', { name: line.name }), title: tr('The bill printer ({name}) is switched off or unplugged.', { name: line.name }) };
      return { tone: 'ok', label: line.name, title: tr('Bills print on the Windows default printer ({displayName}).', { displayName: line.name }) };
  }
}

/** The keys that work on this page: the counter's own keys on Billing, then the app-wide ones. */
function shortcutsFor(pathname: string, khataOn: boolean, paymentKeysOn: boolean): { key: string; label: string; wide?: boolean }[] {
  const global = globalShortcutHints(pathname).map(([key, label]) => ({ key, label }));
  // Khata switched off: F9 (Credit) does nothing on the counter, so it is not shown.
  // Payment keys (F4 / F8 / F9) switched off (the default since v4.85.0): none of them is shown.
  const counterKeys = BILLING_SHORTCUTS.filter(([key]) => khataOn || key !== 'F9')
    .filter(([key]) => paymentKeysOn || !['F4', 'F8', 'F9'].includes(key));
  if (pagePath(pathname) === '/billing') return [...counterKeys.map(([key, label]) => ({ key, label })), ...global.map((g) => ({ ...g, wide: true }))];
  return [...global, { key: MENU_SHORTCUT[0], label: MENU_SHORTCUT[1] }];
}

export const DesktopStatusBar: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const switches = useFeatureSwitches();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [keysOpen, setKeysOpen] = useState(false);

  const business = useBusiness();

  // Real printer status (it used to say "Ready" whatever was connected): the printers the
  // watcher saw in Windows (v4.78.0: offline too), against the bill and label printer chosen.
  const printers = usePrinterFacts();
  const [chosen, setChosen] = useState<{ bill: string; format: PaperFormat; label: string }>({ bill: '', format: 'a4', label: '' });
  useEffect(() => {
    const read = () => {
      const settings = getPrintSettings();
      setChosen({ bill: printerForFormat(settings, settings.defaultFormat), format: settings.defaultFormat, label: getLabelSettings().printer });
    };
    read();
    window.addEventListener('print_settings_changed', read);
    window.addEventListener(LABEL_SETTINGS_EVENT, read);
    return () => {
      window.removeEventListener('print_settings_changed', read);
      window.removeEventListener(LABEL_SETTINGS_EVENT, read);
    };
  }, []);
  const billLine = printers ? billPrinterText(printerLine(chosen.bill, printers)) : null;
  // v4.80.0: a ready bill printer of the wrong kind (a label printer, or a receipt printer for
  // A4 bills) — chosen or the Windows default — is shown amber with the reason.
  const billTarget = printers?.find((p) => p.name === (chosen.bill || printers.find((d) => d.isDefault)?.name));
  const billMismatch = billTarget && billLine?.tone === 'ok' ? billPrinterMismatch(billTarget, chosen.format) : null;
  const printer = billLine && billTarget && billMismatch
    ? {
        ...billLine,
        tone: 'warn' as Tone,
        title: billMismatch === 'label'
          ? tr('Bills go to {name}, a barcode label printer — they would print on your labels. Click to choose your bill printer.', { name: billTarget.name })
          : tr('A4 bills go to {name}, a receipt printer. Click to choose an A4 printer or another bill size.', { name: billTarget.name }),
      }
    : billLine;
  // v4.186.0: no label printer in the status bar of a shop without barcode labels (Barcode Studio off).
  const labelLine = printers && chosen.label && switches.barcode_studio ? printerLine(chosen.label, printers) : null;

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    };

    updateClock();
    const interval = setInterval(updateClock, 30000);

    return () => clearInterval(interval);
  }, []);

  // "All keys" closes on Esc or a click anywhere else.
  useEffect(() => {
    if (!keysOpen) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'mousedown' && (e.target as HTMLElement).closest('[data-status-keys]')) return;
      setKeysOpen(false);
    };
    window.addEventListener('keydown', close);
    window.addEventListener('mousedown', close);
    return () => {
      window.removeEventListener('keydown', close);
      window.removeEventListener('mousedown', close);
    };
  }, [keysOpen]);

  const keys = shortcutsFor(pathname, switches.khata, switches.payment_keys);

  return (
    <footer className="h-7 bg-slate-900 text-slate-400 text-[11px] font-medium px-3 flex items-center justify-between gap-3 whitespace-nowrap border-t border-slate-800 select-none flex-shrink-0 z-30">
      {/* Left: the shop's name on wide screens. "Online • Saved Locally" is in the top bar —
          the same two facts were here twice ("Offline DB: Ready" next to "Online"), v4.93.0. */}
      <div className="flex items-center gap-3 min-w-0">
        {business?.name && <span className="text-slate-400 font-normal hidden 2xl:inline truncate max-w-[180px]">{business.name}</span>}
      </div>

      {/* Center: the keyboard shortcuts that actually work on this screen */}
      <div className="hidden lg:flex items-center gap-3 text-slate-400 text-[10.5px] min-w-0 overflow-hidden">
        {keys.map(({ key, label, wide }) => (
          // On Billing the app-wide keys (and / Esc) show only on wide screens (the counter keys come first).
          <div key={key} className={`${wide || MINOR_KEYS.has(key) ? 'hidden 2xl:flex' : 'flex'} items-center gap-1 shrink-0`} data-status-shortcut={key}>
            <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold text-[10px]">{key}</kbd>
            <span>{tr(label)}</span>
          </div>
        ))}
      </div>
      <div className="relative hidden lg:block shrink-0" data-status-keys>
        <button type="button" onClick={() => setKeysOpen((v) => !v)} className="flex items-center gap-1 text-slate-300 hover:text-amber-400 cursor-pointer" aria-expanded={keysOpen} title={tr('All keyboard shortcuts on this screen')}>
          <Keyboard className="w-3.5 h-3.5" />
          <span>{tr('All keys')}</span>
        </button>
        {keysOpen && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-64 p-3 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl space-y-1.5" data-status-keys-list>
            <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-500">{tr('Keyboard shortcuts')}</div>
            {keys.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-2 text-[11px] text-slate-300">
                <span>{tr(label)}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono font-bold text-[10px]">{key}</kbd>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: quick links, Printer, Clock, Version */}
      <div className="flex items-center gap-3 shrink-0">
        <button type="button" onClick={() => openSettingsTab('invoicing', pathname, router.push)} title={tr('Invoice & Bill Rules')} className="flex items-center gap-1 text-slate-300 hover:text-amber-400 cursor-pointer" data-status-bill-rules>
          <FileText className="w-3 h-3" />
          <span className="hidden xl:inline">{tr('Bill rules')}</span>
        </button>
        <button type="button" onClick={() => openSettingsTab('help', pathname, router.push)} title={tr('Help & Support')} className="flex items-center gap-1 text-slate-300 hover:text-amber-400 cursor-pointer" data-status-help>
          <LifeBuoy className="w-3 h-3" />
          <span className="hidden xl:inline">{tr('Help')}</span>
        </button>
        <span className="text-slate-700">|</span>

        {printer && (
          <>
            <button type="button" onClick={openPrintersWindow} className="flex items-center gap-1.5 text-slate-300 hover:text-amber-400 cursor-pointer" title={printer.title} data-status-printer={printer.tone}>
              <Printer className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">{tr('Printer:')}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${DOT[printer.tone]}`} />
              <span className={`font-mono truncate max-w-[180px] ${TEXT[printer.tone]}`}>{printer.label}</span>
            </button>
            {labelLine && (
              <button type="button" onClick={openPrintersWindow} className="hidden xl:flex items-center gap-1.5 text-slate-300 hover:text-amber-400 cursor-pointer" title={tr('Barcode label printer')} data-status-label-printer={labelLine.state}>
                <Barcode className="w-3 h-3 text-slate-400" />
                <span className={`w-1.5 h-1.5 rounded-full ${DOT[labelLine.state === 'ready' ? 'ok' : 'bad']}`} />
                <span className={`font-mono truncate max-w-[140px] ${TEXT[labelLine.state === 'ready' ? 'ok' : 'bad']}`}>{'name' in labelLine ? labelLine.name : ''}</span>
              </button>
            )}
            <span className="text-slate-700">|</span>
          </>
        )}

        {currentTime && (
          <div className="flex items-center gap-1 text-slate-300 font-mono">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{currentTime}</span>
          </div>
        )}

        <span className="text-slate-700 hidden sm:inline">|</span>

        <button
          type="button"
          onClick={openWhatsNew}
          title={tr("What's new in KamaiPlus")}
          className="font-mono text-[10px] text-slate-400 hover:text-amber-400 hidden sm:inline cursor-pointer"
        >
          {tr('v')}{APP_VERSION}
        </button>
      </div>
    </footer>
  );
};
