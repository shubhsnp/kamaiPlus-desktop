'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { APP_VERSION } from '@/lib/constants/version';
import { tr } from '@/lib/i18n/core';
import {
  CHANGELOG,
  compareVersions,
  markWhatsNewSeen,
  OPEN_WHATS_NEW_EVENT,
  readWhatsNewSeen,
  Release,
  unseenReleases,
} from '@/lib/whatsNew/changelog';

export function ReleaseList({ releases }: { releases: Release[] }) {
  return (
    <div className="space-y-4">
      {releases.map((r) => (
        <div key={r.version}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[11px] font-black font-mono">{`v${r.version}`}</span>
            {r.version === APP_VERSION && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">{tr('This version')}</span>
            )}
          </div>
          <ul className="space-y-1.5">
            {r.items.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700 leading-snug">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{tr(item)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/**
 * Opens by itself once after an update (the releases this computer has not seen),
 * and on demand (status-bar version, Help & Support) with the full list.
 * A brand-new shop is marked as up to date by onboarding, so it never pops up there.
 */
export function WhatsNewModal() {
  const [releases, setReleases] = useState<Release[] | null>(null);

  useEffect(() => {
    const unseen = unseenReleases(readWhatsNewSeen(), APP_VERSION);
    let timer: number | undefined;
    if (unseen.length) timer = window.setTimeout(() => setReleases(unseen), 800);
    else markWhatsNewSeen(APP_VERSION);

    const openAll = () => setReleases(CHANGELOG.filter((r) => compareVersions(r.version, APP_VERSION) <= 0));
    window.addEventListener(OPEN_WHATS_NEW_EVENT, openAll);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(OPEN_WHATS_NEW_EVENT, openAll);
    };
  }, []);

  const close = () => {
    markWhatsNewSeen(APP_VERSION);
    setReleases(null);
  };

  return (
    <Modal
      isOpen={Boolean(releases)}
      onClose={close}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> {tr("What's new in KamaiPlus")}
        </span>
      }
      description={tr('Version {version} is installed on this computer.', { version: APP_VERSION })}
      size="md"
    >
      {releases && <ReleaseList releases={releases} />}
      <div className="flex justify-end pt-4 mt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={close}
          className="h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold cursor-pointer"
        >
          {tr('Got it')}
        </button>
      </div>
    </Modal>
  );
}

/** Ask the shell's WhatsNewModal to show every release. */
export function openWhatsNew(): void {
  window.dispatchEvent(new Event(OPEN_WHATS_NEW_EVENT));
}
