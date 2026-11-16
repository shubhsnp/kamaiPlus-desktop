'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { WhatsAppIcon } from '@/components/whatsapp/WhatsAppButton';
import { WaLinkCard } from '@/components/whatsapp/WaLinkCard';
import { WaLinkDialog } from '@/components/whatsapp/WaLinkDialog';
import { formatWaNumber, useWaLink } from '@/lib/whatsapp/useWaLink';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/**
 * v4.187.0 (Rahul): the shop's WhatsApp in the top bar, every screen, every kind of shop — green with a
 * ✓ when this PC's WhatsApp is linked and connected, grey when not. Not linked → click = the warning +
 * QR to link (WaLinkDialog); linked → a small panel (number, "send every bill by itself", Disconnect).
 * Desktop app only, and only with the WhatsApp switch on.
 */
export function WaNavButton() {
  const { available, status } = useWaLink();
  const whatsappOn = useFeatureSwitches().whatsapp;
  const [panel, setPanel] = useState(false);
  const [linking, setLinking] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!panel) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setPanel(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanel(false); };
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [panel]);

  if (!available || !whatsappOn) return null;
  const linked = Boolean(status.linked);
  const open = linked && status.state === 'open';
  const title = open ? tr('WhatsApp connected: {number}', { number: formatWaNumber(status.me) })
    : linked ? tr('Connecting…') : tr('Connect WhatsApp');

  return (
    <div className="relative" ref={box}>
      <button
        type="button"
        onClick={() => (linked ? setPanel((p) => !p) : setLinking(true))}
        title={title}
        aria-label={title}
        className={cn('relative h-9 w-9 rounded-xl border flex items-center justify-center cursor-pointer transition-colors',
          open ? 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100' : 'border-slate-200 bg-white hover:bg-slate-50')}
        data-wa-nav={open ? 'connected' : linked ? 'connecting' : 'off'}
      >
        <WhatsAppIcon className={cn('w-5 h-5', !open && 'grayscale opacity-50')} />
        {open && (
          <span className="absolute -right-1 -bottom-1 w-4 h-4 rounded-full bg-emerald-600 border-2 border-white flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" strokeWidth={4} />
          </span>
        )}
      </button>
      {panel && (
        <div className="absolute left-0 top-11 z-[80] w-[340px] max-w-[calc(100vw-24px)] text-xs bg-white border border-slate-200 rounded-2xl shadow-2xl p-2" data-wa-nav-panel>
          <WaLinkCard />
        </div>
      )}
      <WaLinkDialog open={linking} onClose={() => setLinking(false)} />
    </div>
  );
}
