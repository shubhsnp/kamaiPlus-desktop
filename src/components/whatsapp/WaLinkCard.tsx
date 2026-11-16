'use client';

import React, { useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { WaLinkDialog } from '@/components/whatsapp/WaLinkDialog';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { formatWaNumber, useWaLink } from '@/lib/whatsapp/useWaLink';
import { getWhatsAppSettings, saveWhatsAppSettings } from '@/lib/whatsapp/whatsappSettings';
import { showConfirm } from '@/lib/ui/dialogs';
import { tr } from '@/lib/i18n/core';

/**
 * Settings → Invoice & Bill Rules → WhatsApp (v4.185.0): link the shop's WhatsApp to this PC so
 * every bill with a mobile number goes by itself (waLink.js). Desktop app only.
 */
export function WaLinkCard() {
  const { available, status } = useWaLink();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [autoSend, setAutoSend] = useState(() => getWhatsAppSettings().autoSendBills);
  if (!available) return null;

  const linked = Boolean(status.linked);
  const label = !linked ? tr('Not connected')
    : status.state === 'open' ? tr('Connected: {number}', { number: formatWaNumber(status.me) })
      : status.state === 'replaced' ? tr('Opened on another computer — connect again here')
        : tr('Connecting…');

  const disconnect = async () => {
    const ok = await showConfirm(tr('Bills will no longer go by themselves. This PC is removed from the linked devices of your WhatsApp.'), {
      title: tr('Disconnect WhatsApp?'), confirmLabel: tr('Disconnect'), cancelLabel: tr('Cancel'), danger: true,
    });
    if (ok) await getDesktopApi()?.waLinkLogout?.();
  };
  const toggle = (on: boolean) => setAutoSend(saveWhatsAppSettings({ autoSendBills: on }).autoSendBills);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 space-y-2" data-wa-link-card={linked ? status.state : 'none'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-slate-900">{tr('Send bills by themselves (your WhatsApp number)')}</p>
          <p className={linked && status.state === 'open' ? 'text-emerald-700 font-bold' : 'text-slate-500'}>{label}</p>
        </div>
        {linked
          ? <Button size="sm" variant="outline" onClick={disconnect} data-wa-link-disconnect><Unlink className="w-3.5 h-3.5" /> {tr('Disconnect')}</Button>
          : <Button size="sm" variant="success" onClick={() => setDialogOpen(true)} data-wa-link-connect><Link2 className="w-3.5 h-3.5" /> {tr('Connect WhatsApp')}</Button>}
      </div>
      {linked && (
        <label className="flex items-start gap-2 cursor-pointer">
          <input type="checkbox" checked={autoSend} onChange={(e) => toggle(e.target.checked)} className="mt-0.5" data-wa-auto-send />
          <span>
            <span className="block font-bold text-slate-800">{tr('Send every bill with a mobile number by itself')}</span>
            <span className="block text-slate-500">{tr('The A4 bill PDF with the message, from your number, a few seconds after the bill. No mobile = nothing is sent.')}</span>
          </span>
        </label>
      )}
      <p className="text-[11px] text-slate-500">{tr('A linked device, like WhatsApp Web — not an official WhatsApp service. Send only bills from this number.')}</p>
      <WaLinkDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setAutoSend(getWhatsAppSettings().autoSendBills); }} />
    </div>
  );
}
