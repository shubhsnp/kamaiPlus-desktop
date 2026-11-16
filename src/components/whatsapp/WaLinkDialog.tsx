'use client';

import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Loader2, ShieldAlert, Smartphone } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { formatWaNumber, useWaLink } from '@/lib/whatsapp/useWaLink';
import { saveWhatsAppSettings } from '@/lib/whatsapp/whatsappSettings';
import { tr } from '@/lib/i18n/core';

/**
 * v4.185.0 (Rahul 2026-11-15): link the shop's WhatsApp to this PC — first the warning (an
 * unofficial WhatsApp Web link: WhatsApp can restrict a number that sends spam), ticked by the
 * shop; then the QR, scanned in WhatsApp → Linked devices. Once linked, "Send every bill by
 * itself" is switched on (the card can switch it off).
 */
export function WaLinkDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { status } = useWaLink();
  const [agreed, setAgreed] = useState(false);
  const [started, setStarted] = useState(false);
  const [qrImage, setQrImage] = useState('');

  useEffect(() => {
    if (!open) { setAgreed(false); setStarted(false); setQrImage(''); }
  }, [open]);

  useEffect(() => {
    if (!status.qr) { setQrImage(''); return; }
    QRCode.toDataURL(status.qr, { width: 264, margin: 1, errorCorrectionLevel: 'L' }).then(setQrImage).catch(() => setQrImage(''));
  }, [status.qr]);

  const connected = started && status.state === 'open';
  useEffect(() => {
    if (connected) saveWhatsAppSettings({ autoSendBills: true });
  }, [connected]);

  const start = async () => {
    setStarted(true);
    await getDesktopApi()?.waLinkConnect?.();
  };
  const close = () => {
    if (started && status.state !== 'open') void getDesktopApi()?.waLinkCancel?.();
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={close} title={tr('Connect your WhatsApp')} size="md">
      <div className="space-y-4 text-sm text-slate-800" data-wa-link-dialog>
        {!started && (
          <>
            <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
              <div className="space-y-1.5">
                <p className="font-black text-slate-900">{tr('Bills will go from your own WhatsApp number, by themselves.')}</p>
                <p>{tr('This PC becomes a "linked device" of your WhatsApp, like WhatsApp Web. It is not an official WhatsApp service: WhatsApp can block a number that sends spam.')}</p>
                <p>{tr('KamaiPlus sends only the bill, only to that bill\'s customer, one at a time. Do not use this number for bulk messages.')}</p>
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" data-wa-link-agree />
              <span className="font-bold">{tr('I understand. Link my WhatsApp to this PC.')}</span>
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={close}>{tr('Cancel')}</Button>
              <Button variant="success" onClick={start} disabled={!agreed} data-wa-link-start>{tr('Show QR code')}</Button>
            </div>
          </>
        )}

        {started && !connected && (
          <div className="grid gap-4 sm:grid-cols-[264px_1fr] items-start">
            <div className="w-[264px] h-[264px] rounded-xl border border-slate-200 bg-white flex items-center justify-center" data-wa-link-qr={status.qr ? 'shown' : 'waiting'}>
              {qrImage ? <img src={qrImage} alt={tr('WhatsApp QR code')} className="w-full h-full rounded-xl" />
                : status.state === 'qrTimeout' ? <span className="px-4 text-center text-xs font-bold text-slate-600">{tr('The QR code expired.')}</span>
                  : <Loader2 className="w-7 h-7 animate-spin text-slate-400" />}
            </div>
            <div className="space-y-2 text-xs">
              <p className="font-black text-slate-900 flex items-center gap-1.5"><Smartphone className="w-4 h-4" /> {tr('On your phone:')}</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>{tr('Open WhatsApp (the number bills should come from).')}</li>
                <li>{tr('Tap ⋮ (or Settings) → Linked devices → Link a device.')}</li>
                <li>{tr('Point the phone at this QR code.')}</li>
              </ol>
              {status.state === 'qrTimeout' && <Button size="sm" variant="success" onClick={start}>{tr('Show a new QR code')}</Button>}
              {status.error && status.state !== 'qrTimeout' && <p className="text-rose-600 font-bold">{tr('Could not reach WhatsApp. Check the internet and try again.')}</p>}
            </div>
          </div>
        )}

        {connected && (
          <div className="text-center space-y-3 py-2" data-wa-link-connected>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-black text-slate-900">{tr('WhatsApp connected: {number}', { number: formatWaNumber(status.me) })}</p>
            <p className="text-xs text-slate-600">{tr('Every bill with a mobile number now goes to the customer by itself (PDF + message). You can switch this off in Settings.')}</p>
            <Button variant="success" onClick={onClose}>{tr('Done')}</Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
