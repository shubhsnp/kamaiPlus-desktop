'use client';

import React from 'react';
import { CheckCircle2, FolderOpen, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { msg, tr } from '@/lib/i18n/core';
import { displayWhatsAppNumber } from '@/lib/whatsapp/whatsappLinks';
import type { WaLang } from '@/lib/whatsapp/whatsappSettings';
import type { WhatsAppOpenResult } from '@/lib/whatsapp/openWhatsApp';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';

export const LANG_CHIPS: { id: WaLang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिंदी' },
  { id: 'mr', label: 'मराठी' },
];

export function Chips<T extends string>({ items, value, onPick, name }: { items: { id: T; label: string }[]; value: T; onPick: (id: T) => void; name: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" data-wa-chips={name}>
      {items.map((it) => (
        <button
          key={it.id}
          type="button"
          role="radio"
          aria-checked={value === it.id}
          onClick={() => onPick(it.id)}
          className={cn(
            'px-2.5 h-7 rounded-lg border text-[11px] font-bold cursor-pointer',
            value === it.id ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
          )}
          data-wa-chip={it.id}
        >
          {name === 'lang' ? it.label : tr(it.label)}
        </button>
      ))}
    </div>
  );
}

/** "To" box: name, number, and what will happen with it. */
export function RecipientField(props: {
  name?: string;
  phone: string;
  onPhone: (v: string) => void;
  number: string | null;
  optional: boolean;
  offerSave: boolean;
  save: boolean;
  onSave: (v: boolean) => void;
}) {
  const { name, phone, onPhone, number, optional, offerSave, save, onSave } = props;
  const bad = phone.trim() !== '' && !number;
  return (
    <div className="space-y-1">
      <label className="block">
        <span className="font-bold text-slate-700">{tr('To')}{name ? `: ${name}` : ''}</span>
        <input
          value={phone}
          onChange={(e) => onPhone(e.target.value.replace(/[^\d+ ]/g, ''))}
          maxLength={16}
          placeholder={tr('WhatsApp number, e.g. 98765 43210')}
          inputMode="tel"
          className={cn('w-full mt-1 h-9 px-2.5 rounded-lg border bg-white font-mono font-bold focus:outline-none focus:ring-2', bad ? 'border-rose-400 focus:ring-rose-300' : 'border-slate-300 focus:ring-emerald-300')}
          data-wa-phone
        />
      </label>
      <p className={cn('text-[11px]', bad ? 'text-rose-600 font-bold' : number ? 'text-emerald-700 font-semibold' : 'text-slate-500')} data-wa-phone-note>
        {bad
          ? tr('Enter a 10-digit mobile number (or +country code for another country).')
          : number
          ? tr('Sends to {number}', { number: displayWhatsAppNumber(number) })
          : optional
          ? tr('Leave empty to choose the chat in WhatsApp.')
          : tr('Type the customer\'s WhatsApp number.')}
      </p>
      {offerSave && number && (
        <label className="flex items-center gap-1.5 text-[11px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={save} onChange={(e) => onSave(e.target.checked)} data-wa-save-phone />
          {tr('Save this number for {name}', { name: name || tr('this customer') })}
        </label>
      )}
    </div>
  );
}

const VIA: Record<WhatsAppOpenResult['via'], string> = { app: msg('WhatsApp Desktop'), web: msg('WhatsApp Web (browser)') };

/** What happened after "Open WhatsApp". */
export function SentNote({ result, pdfPath, pdfPasteReady }: { result: WhatsAppOpenResult; pdfPath?: string; pdfPasteReady?: boolean }) {
  const desktop = getDesktopApi();
  if (!result.ok) {
    return (
      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-start gap-2" data-wa-result="error">
        <AlertCircle className="w-4 h-4 shrink-0" />
        <span>{tr('Could not open WhatsApp: {error}', { error: result.error || '' })} {tr('Use "Copy message" and paste it in WhatsApp.')}</span>
      </div>
    );
  }
  return (
    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1" data-wa-result={result.via}>
      <p className="font-black flex items-center gap-1.5" {...(result.filePasted ? { 'data-wa-ready': '' } : {})}>
        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        {result.filePasted
          ? tr('WhatsApp is ready: the bill PDF with the message under it. Check the name at the top and press Send (✕ there cancels it).')
          : tr('{app} opened — check the message and press Send.', { app: tr(VIA[result.via]) })}
      </p>
      {result.copied && <p className="font-bold">{tr('The message was too long for a link, so it is copied: click in the chat and press Ctrl+V.')}</p>}
      {pdfPath && pdfPasteReady && (
        <p className="font-black text-emerald-800" data-wa-pdf-paste>
          {tr('Bill PDF is copied: click in the WhatsApp chat, press Ctrl+V, then Send.')}
        </p>
      )}
      {pdfPath && (
        <p className="flex flex-wrap items-center gap-2">
          {!pdfPasteReady && <span>{tr('Bill PDF saved — drag it from the folder into the chat.')}</span>}
          {desktop && (
            <button type="button" onClick={() => desktop.showItemInFolder(pdfPath)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-emerald-300 font-bold cursor-pointer">
              <FolderOpen className="w-3 h-3" /> {tr('Show PDF')}
            </button>
          )}
        </p>
      )}
    </div>
  );
}
