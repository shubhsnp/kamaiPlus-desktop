'use client';

import React, { useEffect, useState } from 'react';
import { Copy, FolderOpen, LifeBuoy, CheckCircle2, AlertTriangle, RefreshCw, Download } from 'lucide-react';
import { getDesktopApi, UpdateStatus } from '@/lib/desktop/desktopBridge';

/** Version, "Check for updates now" and the per-computer beta (early updates) switch. */
function UpdatesCard() {
  const api = getDesktopApi();
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDesktopApi()?.getUpdateStatus().then(setStatus).catch(() => {});
  }, []);

  if (!api || !status) return null;

  const checkNow = async () => {
    setBusy(true);
    const res = await api.checkForUpdates().catch(() => null);
    if (res?.status) setStatus(res.status);
    setBusy(false);
  };

  const toggleBeta = async (on: boolean) => {
    setBusy(true);
    setStatus(await api.setBetaUpdates(on).catch(() => status));
    setBusy(false);
  };

  const lc = status.lastCheck;
  const line = !status.enabled
    ? 'Updates are off in development mode.'
    : status.readyVersion
    ? `Version ${status.readyVersion} is downloaded — restart the app to install it.`
    : !lc
    ? 'Checks for updates automatically every few hours.'
    : lc.result === 'up-to-date'
    ? `You have the latest version (checked ${new Date(lc.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}).`
    : lc.result === 'downloading'
    ? `Downloading version ${lc.version}…`
    : 'Could not check for updates (no internet?). It will try again automatically.';

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900">KamaiPlus Desktop v{status.currentVersion || '—'}</h3>
            <p className="text-[11px] text-slate-500">{line}</p>
          </div>
        </div>
        {status.enabled && (
          <button type="button" onClick={checkNow} disabled={busy} className="h-9 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Check for updates now
          </button>
        )}
      </div>
      <label className="flex items-start gap-2.5 text-xs cursor-pointer">
        <input type="checkbox" checked={Boolean(status.beta)} disabled={busy} onChange={(e) => toggleBeta(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
        <span>
          <span className="font-bold text-slate-900">Get early updates (beta)</span>
          <span className="block text-[11px] text-slate-500">
            This computer receives new versions a few days before other shops. Turn on only if KamaiPlus support asked you to.
          </span>
        </span>
      </label>
    </div>
  );
}

/**
 * Settings → Help & Support. The error log (errorlog.js) turned into something a
 * shopkeeper can act on: copy a report and paste it into WhatsApp / email, or open
 * the log folder for the technician.
 */
export function HelpSupportTab() {
  const api = getDesktopApi();
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getDesktopApi()?.getErrorReport().then((r) => setCount(r.count)).catch(() => setCount(null));
  }, []);

  if (!api) {
    return <p className="text-xs text-slate-500">Support tools are available in the installed desktop app.</p>;
  }

  const copyReport = async () => {
    try {
      const r = await api.getErrorReport();
      await navigator.clipboard.writeText(r.text);
      setCount(r.count);
      setStatus({ ok: true, text: 'Report copied. Paste it in WhatsApp or an email to KamaiPlus support.' });
    } catch {
      setStatus({ ok: false, text: 'Could not copy the report. Use "Open log folder" instead.' });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <UpdatesCard />

      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <LifeBuoy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">Something not working?</h3>
            <p className="text-[11px] text-slate-500">
              The app records problems on this computer.{' '}
              {count === null ? '' : count === 0 ? 'No problems recorded.' : `${count} recorded.`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyReport} className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Copy className="w-3.5 h-3.5" /> Copy report for support
          </button>
          <button type="button" onClick={() => api.openLogFolder()} className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5" /> Open log folder
          </button>
        </div>

        {status && (
          <div className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 ${status.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            {status.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            <span>{status.text}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          KamaiPlus support: <span className="font-mono font-bold text-slate-700 select-all">info@proventure.in</span>. The report contains the
          app version, Windows version and recent errors — no bills, customers or prices.
        </p>
      </div>
    </div>
  );
}
