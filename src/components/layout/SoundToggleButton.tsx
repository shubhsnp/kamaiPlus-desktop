'use client';

import React, { useEffect, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSoundMuted, setSoundMuted, SOUND_MUTE_EVENT } from '@/lib/sound/soundSettings';
import { cn } from '@/lib/utils';
import { tr } from '@/lib/i18n/core';

/** Top bar 🔊 / 🔇 — mutes every beep and voice in the app on this computer. */
export function SoundToggleButton() {
  const [muted, setMuted] = useState<boolean>(isSoundMuted);

  useEffect(() => {
    const refresh = () => setMuted(isSoundMuted());
    window.addEventListener(SOUND_MUTE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SOUND_MUTE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const label = muted ? tr('Sound off — click to turn on') : tr('Sound on — click to mute');

  return (
    <button
      type="button"
      onClick={() => setSoundMuted(!muted)}
      aria-pressed={muted}
      aria-label={label}
      title={label}
      className={cn(
        'flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition shadow-2xs',
        muted
          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
      )}
    >
      {muted ? <VolumeX className="w-3.5 h-3.5 text-amber-600" /> : <Volume2 className="w-3.5 h-3.5 text-slate-700" />}
      <span className="hidden sm:inline">{muted ? tr('Muted') : tr('Sound')}</span>
    </button>
  );
}
