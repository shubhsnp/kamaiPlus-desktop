'use client';

import React, { useEffect, useState } from 'react';
import { Download, RotateCw, X } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';

/**
 * Shown once a newer version has downloaded in the background (updater.js).
 * The app never restarts on its own — the cashier chooses when. "Later" hides the
 * banner; the update then installs silently the next time the app is closed.
 */
export const UpdateReadyBanner: React.FC = () => {
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    // The download may have finished before this screen mounted.
    api.getUpdateStatus().then((s) => s.readyVersion && setVersion(s.readyVersion)).catch(() => {});
    return api.onUpdateReady((info) => {
      setVersion(info.version);
      setDismissed(false);
    });
  }, []);

  if (!version || dismissed) return null;

  const handleInstall = async () => {
    const api = getDesktopApi();
    if (!api) return;
    setInstalling(true);
    const res = await api.installUpdate().catch(() => ({ ok: false }));
    if (!res.ok) setInstalling(false);
  };

  return (
    <div className="fixed bottom-10 left-4 z-50 w-[340px] bg-slate-900 text-white rounded-2xl border border-emerald-500/40 shadow-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
          <Download className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">{tr('Update ready (v')}{version})</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {tr('Restart to finish updating. All bills and data stay safe. Or keep working — it installs when you close the app.')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="p-1 text-slate-500 hover:text-white rounded-lg cursor-pointer"
          aria-label={tr('Later')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleInstall}
          disabled={installing}
          className="flex-1 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-700 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          {installing ? tr('Restarting…') : tr('Restart & Update')}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="h-9 px-4 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 font-bold text-xs cursor-pointer"
        >
          {tr('Later')}
        </button>
      </div>
    </div>
  );
};
