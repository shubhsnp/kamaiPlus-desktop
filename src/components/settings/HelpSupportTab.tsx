'use client';

import React, { useEffect, useState } from 'react';
import { Copy, FolderOpen, LifeBuoy, CheckCircle2, AlertTriangle, RefreshCw, Download, MessageCircle, Mail, Sparkles } from 'lucide-react';
import { getDesktopApi, UpdateStatus } from '@/lib/desktop/desktopBridge';
import { tr } from '@/lib/i18n/core';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { SupportContactCard } from '@/components/support/SupportContact';
import { supportEmailUrl, supportGreeting, supportWhatsAppUrl } from '@/lib/support/contact';
import { CHANGELOG, compareVersions } from '@/lib/whatsNew/changelog';
import { APP_VERSION } from '@/lib/constants/version';
import { openWhatsNew, ReleaseList } from '@/components/whatsNew/WhatsNewModal';

/** The newest "What's new" entry, with a button for the full list. */
function WhatsNewCard() {
  const latest = CHANGELOG.find((r) => compareVersions(r.version, APP_VERSION) <= 0);
  if (!latest) return null;
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-slate-900">{tr("What's new")}</h3>
        </div>
        <button type="button" onClick={openWhatsNew} className="h-9 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer shrink-0">
          {tr('All updates')}
        </button>
      </div>
      <ReleaseList releases={[latest]} />
    </div>
  );
}

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
    ? tr('Updates are off in development mode.')
    : status.readyVersion
    ? tr('Version {readyVersion} is downloaded — restart the app to install it.', { readyVersion: status.readyVersion })
    : !lc
    ? tr('Checks for updates automatically every few hours.')
    : lc.result === 'up-to-date'
    ? tr('You have the latest version (checked {v1}).', { v1: new Date(lc.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) })
    : lc.result === 'downloading'
    ? tr('Downloading version {version}…', { version: lc.version })
    : tr('Could not check for updates (no internet?). It will try again automatically.');

  return (
    <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-black text-slate-900">{tr('KamaiPlus Desktop v')}{status.currentVersion || '—'}</h3>
            <p className="text-[11px] text-slate-500">{line}</p>
          </div>
        </div>
        {status.enabled && (
          <button type="button" onClick={checkNow} disabled={busy} className="h-9 px-3 rounded-xl border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> {tr('Check for updates now')}
          </button>
        )}
      </div>
      <label className="flex items-start gap-2.5 text-xs cursor-pointer">
        <input type="checkbox" checked={Boolean(status.beta)} disabled={busy} onChange={(e) => toggleBeta(e.target.checked)} className="w-4 h-4 mt-0.5 accent-emerald-600" />
        <span>
          <span className="font-bold text-slate-900">{tr('Get early updates (beta)')}</span>
          <span className="block text-[11px] text-slate-500">
            {tr('This computer receives new versions a few days before other shops. Turn on only if KamaiPlus support asked you to.')}
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
  const business = useBusiness();
  const [count, setCount] = useState<number | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    getDesktopApi()?.getErrorReport().then((r) => setCount(r.count)).catch(() => setCount(null));
  }, []);

  if (!api) {
    return (
      <div className="space-y-4 max-w-2xl">
        <SupportContactCard shopName={business?.name} />
        <p className="text-xs text-slate-500">{tr('Support tools are available in the installed desktop app.')}</p>
      </div>
    );
  }

  const copyReport = async () => {
    try {
      const r = await api.getErrorReport();
      await navigator.clipboard.writeText(r.text);
      setCount(r.count);
      setStatus({ ok: true, text: tr('Report copied. Paste it in WhatsApp or an email to KamaiPlus support.') });
    } catch {
      setStatus({ ok: false, text: tr('Could not copy the report. Use "Open log folder" instead.') });
    }
  };

  // Opens WhatsApp / Gmail with the report already typed (the shop only presses Send).
  const sendReport = async (via: 'whatsapp' | 'email') => {
    try {
      const r = await api.getErrorReport();
      setCount(r.count);
      const body = `${supportGreeting(business?.name)}\n${tr('Problem report from the app:')}\n\n${r.text}`;
      window.open(via === 'whatsapp' ? supportWhatsAppUrl(body) : supportEmailUrl(tr('KamaiPlus Desktop problem report'), body), '_blank');
      setStatus({ ok: true, text: tr('Report ready in {app} — check it and press Send.', { app: via === 'whatsapp' ? 'WhatsApp' : 'Gmail' }) });
    } catch {
      setStatus({ ok: false, text: tr('Could not prepare the report. Use "Copy report for support" instead.') });
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <SupportContactCard shopName={business?.name} />
      <UpdatesCard />
      <WhatsNewCard />

      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
            <LifeBuoy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900">{tr('Something not working?')}</h3>
            <p className="text-[11px] text-slate-500">
              {tr('The app records problems on this computer.')}{' '}
              {count === null ? '' : count === 0 ? tr('No problems recorded.') : tr('{count} recorded.', { count: count })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copyReport} className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Copy className="w-3.5 h-3.5" /> {tr('Copy report for support')}
          </button>
          <button type="button" onClick={() => sendReport('whatsapp')} className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <MessageCircle className="w-3.5 h-3.5" /> {tr('Send report on WhatsApp')}
          </button>
          <button type="button" onClick={() => sendReport('email')} className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Mail className="w-3.5 h-3.5" /> {tr('Send report by email')}
          </button>
          <button type="button" onClick={() => api.openLogFolder()} className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <FolderOpen className="w-3.5 h-3.5" /> {tr('Open log folder')}
          </button>
        </div>

        {status && (
          <div className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 ${status.ok ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
            {status.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
            <span>{status.text}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-500">
          {tr('The report contains the app version, Windows version and recent errors — no bills, customers or prices.')}
        </p>
      </div>
    </div>
  );
}
