'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Megaphone, X } from 'lucide-react';
import { AdminMessage, getDesktopApi, LicenceStatus } from '@/lib/desktop/desktopBridge';
import { LicenceEndingNotice } from '@/components/licence/LicenceEndedScreen';
import { readDismissedMessages, saveDismissedMessage, visibleAdminMessages } from '@/lib/admin/adminMessages';
import { tr } from '@/lib/i18n/core';
import { cn } from '@/lib/utils';

const STYLE: Record<AdminMessage['level'], string> = {
  info: 'bg-sky-50 border-sky-200 text-sky-950',
  warning: 'bg-amber-50 border-amber-300 text-amber-950',
  urgent: 'bg-rose-50 border-rose-300 text-rose-950',
};

/**
 * The strips under the top bar (v4.98.0): "your licence ends in N days" (last 7 days) and the
 * Admin Console's messages for this computer — this key's own, or the one for
 * every Desktop — as a strip under the top bar. They arrive with the hourly licence check-in
 * (adminLink.js). Info / warning: ✕ closes it for good. Urgent: ✕ closes it until the app is
 * opened again. The Admin's text is shown as text (never as HTML).
 */
export const AdminMessageBanner: React.FC = () => {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [sessionClosed, setSessionClosed] = useState<string[]>([]);
  const [licence, setLicence] = useState<LicenceStatus | null>(null);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    void api.getLicenceStatus().then(setLicence).catch(() => {});
    const offLicence = api.onLicenceChanged?.(setLicence);
    if (!api.getAdminMessages) return offLicence;
    setDismissed(readDismissedMessages());
    void api.getAdminMessages().then(setMessages).catch(() => {});
    const offMessages = api.onAdminMessages?.(setMessages);
    return () => {
      offLicence?.();
      offMessages?.();
    };
  }, []);

  const visible = visibleAdminMessages(messages, dismissed, sessionClosed);
  // v4.105.0: a pop-up message opens as a window over the screen (one at a time); the rest are strips.
  const popup = visible.find((m) => m.style === 'popup');
  const shown = visible.filter((m) => m.style !== 'popup').slice(0, 2);
  const ending = licence?.state === 'active' && licence.validUntil && licence.daysLeft != null && licence.daysLeft <= 7 ? licence : null;
  if (shown.length === 0 && !ending && !popup) return null;

  const close = (m: AdminMessage) => {
    setSessionClosed((prev) => [...prev, m.id]);
    if (m.level !== 'urgent') {
      saveDismissedMessage(m.id);
      setDismissed((prev) => [...prev, m.id]);
    }
  };

  return (
    <div className="shrink-0 px-3 sm:px-5 pt-2 space-y-1.5" data-admin-messages>
      {ending && (
        <LicenceEndingNotice validUntil={ending.validUntil!} daysLeft={ending.daysLeft!} licenceKey={ending.key} shopName={ending.shopName || ending.machineName} />
      )}
      {shown.map((m) => {
        const Icon = m.level === 'info' ? Megaphone : AlertTriangle;
        return (
          <div key={m.id} role="status" className={cn('flex items-start gap-2.5 px-3.5 py-1.5 rounded-xl border text-[13px]', STYLE[m.level])} data-admin-message={m.level}>
            <Icon className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <span className="font-black mr-1.5">{tr('Message from KamaiPlus:')}</span>
              <span className="whitespace-pre-line break-words">{m.text}</span>
              {m.link && <MessageLink href={m.link} label={m.link_label} />}
            </div>
            <button type="button" onClick={() => close(m)} className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer" aria-label={tr('Close')} data-admin-message-close>
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
      {popup && (
        <div className="fixed inset-0 z-[80] bg-slate-950/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" data-admin-popup={popup.level}>
          <div className={cn('w-full max-w-md rounded-2xl border shadow-2xl p-5 space-y-3', STYLE[popup.level])}>
            <div className="flex items-center gap-2 font-black text-sm">
              {popup.level === 'info' ? <Megaphone className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              {tr('Message from KamaiPlus:')}
            </div>
            <p className="text-sm whitespace-pre-line break-words">{popup.text}</p>
            <div className="flex flex-wrap justify-end gap-2">
              {popup.link && <MessageLink href={popup.link} label={popup.link_label} big />}
              <button type="button" onClick={() => close(popup)} className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer" data-admin-popup-close>
                {tr('OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** The Admin's one link (https only — checked in the main process too); opens outside the app. */
const MessageLink: React.FC<{ href: string; label?: string; big?: boolean }> = ({ href, label, big }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={cn('inline-flex items-center gap-1 font-bold underline underline-offset-2', big ? 'px-4 py-2 rounded-xl bg-white/70 no-underline border border-current text-xs' : 'ml-2 text-[12px]')}
    data-admin-message-link
  >
    {label || tr('Open')} <ExternalLink className="w-3 h-3" />
  </a>
);
