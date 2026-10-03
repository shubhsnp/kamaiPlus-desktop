'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Megaphone, X } from 'lucide-react';
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

  const shown = visibleAdminMessages(messages, dismissed, sessionClosed).slice(0, 2);
  const ending = licence?.state === 'active' && licence.validUntil && licence.daysLeft != null && licence.daysLeft <= 7 ? licence : null;
  if (shown.length === 0 && !ending) return null;

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
            </div>
            <button type="button" onClick={() => close(m)} className="p-0.5 opacity-70 hover:opacity-100 cursor-pointer" aria-label={tr('Close')} data-admin-message-close>
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
