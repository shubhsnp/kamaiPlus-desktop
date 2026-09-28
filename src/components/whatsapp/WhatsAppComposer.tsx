'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, RotateCcw, Settings2, X } from 'lucide-react';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { db } from '@/lib/db';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { getPrimaryUpiVpa } from '@/lib/invoices/invoiceDocument';
import { getLanguage, tr } from '@/lib/i18n/core';
import { openWhatsApp, WhatsAppOpenResult, WhatsAppRequest } from '@/lib/whatsapp/openWhatsApp';
import { resolveWhatsAppDraft, WhatsAppDraft } from '@/lib/whatsapp/whatsappDrafts';
import { toWhatsAppNumber, WHATSAPP_URL_LIMIT, whatsAppWebUrl } from '@/lib/whatsapp/whatsappLinks';
import { getWhatsAppSettings, saveWhatsAppSettings, WaLang } from '@/lib/whatsapp/whatsappSettings';
import type { ReminderTone } from '@/lib/whatsapp/customerMessages';
import { WhatsAppIcon } from './WhatsAppButton';
import { Chips, LANG_CHIPS, RecipientField, SentNote } from './WhatsAppComposerParts';

/** Saved number for a customer: the 10 digits for India, "+…" for another country. */
const storedPhone = (number: string) => (/^91\d{10}$/.test(number) ? number.slice(2) : `+${number}`);

/**
 * The WhatsApp window (v4.79.0): to whom, the message (edit it freely; language and tone rebuild
 * it), then WhatsApp opens with it — the shop presses Send there. Sits above any other window;
 * Esc closes only this one.
 */
export function WhatsAppComposer({ request, onClose }: { request: WhatsAppRequest; onClose: () => void }) {
  const business = useBusiness();
  const initial = useMemo(getWhatsAppSettings, []);
  const [draft, setDraft] = useState<WhatsAppDraft | null | undefined>(undefined);
  const [lang, setLang] = useState<WaLang>(initial.lang || getLanguage());
  const [tone, setTone] = useState<ReminderTone>('friendly');
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [savePhone, setSavePhone] = useState(true);
  const [attachPdf, setAttachPdf] = useState(initial.attachPdf);
  const [payLink, setPayLink] = useState(initial.payLink);
  const [signOff, setSignOff] = useState(initial.signOff);
  const [showSettings, setShowSettings] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{ open: WhatsAppOpenResult; pdfPath?: string } | null>(null);

  useEffect(() => {
    let alive = true;
    resolveWhatsAppDraft(request, business).then((d) => {
      if (!alive) return;
      setDraft(d);
      if (d) setPhone(d.phone);
    });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, business?.id]);

  // Message = the template, until the shop edits it (language / tone / settings rebuild it).
  useEffect(() => {
    if (draft && !edited) setText(draft.build({ lang, payLink, signOff }, tone));
  }, [draft, lang, tone, edited, payLink, signOff]);

  // Esc closes this window only — not the bill window it may sit on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const number = toWhatsAppNumber(phone);
  const phoneBad = phone.trim() !== '' && !number;
  const canSend = Boolean(draft) && !busy && !phoneBad && (Boolean(number) || Boolean(draft?.phoneOptional)) && text.trim() !== '';
  const longText = whatsAppWebUrl(number, text).length > WHATSAPP_URL_LIMIT;

  const rebuild = (fn: () => void) => {
    fn();
    setEdited(false);
  };
  const changeSetting = (patch: { payLink?: boolean; signOff?: string }) => {
    saveWhatsAppSettings(patch);
    if (patch.payLink !== undefined) setPayLink(patch.payLink);
    if (patch.signOff !== undefined) setSignOff(patch.signOff);
    setEdited(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  const send = async () => {
    if (!canSend || !draft) return;
    setBusy(true);
    try {
      const remember = draft.remember && number ? { [draft.remember === 'owner' ? 'ownerPhone' : 'caPhone']: phone.trim() } : {};
      saveWhatsAppSettings({ ...(draft.languages ? { lang } : {}), ...(draft.pdfSale ? { attachPdf } : {}), ...remember });
      if (draft.customerId && !draft.customerHasPhone && number && savePhone) {
        await db.customers.update(draft.customerId, { phone: storedPhone(number), updated_at: new Date().toISOString() });
      }
      let pdfPath: string | undefined;
      const desktop = getDesktopApi();
      if (draft.pdfSale && attachPdf && business && desktop) {
        const { saveInvoicePdf } = await import('@/lib/invoices/invoiceOutput');
        const customer = draft.pdfSale.customer_id ? await db.customers.get(draft.pdfSale.customer_id) : undefined;
        const res = await saveInvoicePdf({ sale: draft.pdfSale, business, customer, upiVpa: getPrimaryUpiVpa(business) });
        if (res.ok && res.path) {
          pdfPath = res.path;
          void desktop.showItemInFolder(res.path);
        }
      }
      setResult({ open: await openWhatsApp(number, text), pdfPath });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4" role="dialog" aria-modal="true" data-whatsapp-composer>
      <div className="fixed inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] text-slate-900 text-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-base font-black flex items-center gap-2">
            <WhatsAppIcon className="w-5 h-5" /> {draft ? tr(draft.title) : tr('WhatsApp')}
          </h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" aria-label={tr('Close')}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-3">
          {draft === undefined && <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> {tr('Preparing the message…')}</p>}
          {draft === null && <p className="text-rose-700 font-bold">{tr('This record could not be found.')}</p>}
          {draft && (
            <>
              <RecipientField
                name={draft.recipientName}
                phone={phone}
                onPhone={setPhone}
                number={number}
                optional={draft.phoneOptional}
                offerSave={Boolean(draft.customerId && !draft.customerHasPhone)}
                save={savePhone}
                onSave={setSavePhone}
              />
              {(draft.tones || draft.languages) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {draft.tones && <Chips name="tone" items={draft.tones} value={tone} onPick={(t) => rebuild(() => setTone(t))} />}
                  {draft.languages && <Chips name="lang" items={LANG_CHIPS} value={lang} onPick={(l) => rebuild(() => setLang(l))} />}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-slate-700">{tr('Message')}</span>
                  {edited && (
                    <button type="button" onClick={() => setEdited(false)} className="inline-flex items-center gap-1 text-sky-700 font-bold cursor-pointer">
                      <RotateCcw className="w-3 h-3" /> {tr('Back to the standard message')}
                    </button>
                  )}
                </div>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setEdited(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.ctrlKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={12}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-[#f0fdf4] text-[12.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-emerald-300"
                  data-wa-text
                />
                {longText && <p className="text-amber-700 font-semibold mt-1">{tr('Long message: WhatsApp opens the chat and the message is copied — paste it with Ctrl+V.')}</p>}
              </div>
              {draft.pdfSale && getDesktopApi() && (
                <label className="flex items-center gap-1.5 cursor-pointer text-slate-700">
                  <input type="checkbox" checked={attachPdf} onChange={(e) => setAttachPdf(e.target.checked)} data-wa-attach-pdf />
                  {tr('Also save the bill PDF and open its folder, to drag it into the chat')}
                </label>
              )}
              <div className="rounded-xl border border-slate-200">
                <button type="button" onClick={() => setShowSettings((s) => !s)} className="w-full flex items-center gap-1.5 px-2.5 py-2 font-bold text-slate-600 cursor-pointer" aria-expanded={showSettings}>
                  <Settings2 className="w-3.5 h-3.5" /> {tr('Message settings (this computer)')}
                </button>
                {showSettings && (
                  <div className="px-2.5 pb-2.5 space-y-2 border-t border-slate-100 pt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={payLink} onChange={(e) => changeSetting({ payLink: e.target.checked })} data-wa-paylink />
                      {tr('Add a "Pay by UPI" link when money is due (opens the customer\'s UPI app with the amount)')}
                    </label>
                    <label className="block">
                      <span className="font-bold text-slate-700">{tr('Last line of customer messages')}</span>
                      <input value={signOff} onChange={(e) => changeSetting({ signOff: e.target.value })} placeholder={tr('Empty = "Thank you for shopping with us! Visit again"')} className="w-full mt-1 h-8 px-2.5 rounded-lg border border-slate-300" maxLength={200} />
                    </label>
                  </div>
                )}
              </div>
              {result && <SentNote result={result.open} pdfPath={result.pdfPath} />}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button type="button" onClick={copy} disabled={!text} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-300 bg-white font-bold cursor-pointer disabled:opacity-50" data-wa-copy>
            <Copy className="w-3.5 h-3.5" /> {copied ? tr('Copied') : tr('Copy message')}
          </button>
          <span className="text-slate-400 hidden sm:inline">{tr('Ctrl+Enter sends')}</span>
          <button type="button" onClick={onClose} className="ml-auto h-9 px-3 rounded-lg font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">
            {result?.open.ok ? tr('Done') : tr('Cancel')}
          </button>
          <button type="button" onClick={send} disabled={!canSend} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black cursor-pointer disabled:opacity-50" data-wa-send>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <WhatsAppIcon className="w-4 h-4 text-white" />}
            {result?.open.ok ? tr('Open again') : tr('Open WhatsApp')}
          </button>
        </div>
      </div>
    </div>
  );
}
