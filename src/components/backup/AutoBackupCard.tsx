'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, FolderOpen, Usb, RefreshCw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { BackupInfo, getDesktopApi } from '@/lib/desktop/desktopBridge';
import { runAutoBackup } from '@/lib/backup/autoBackup';
import { tr } from '@/lib/i18n/core';

/**
 * Status and controls for the automatic backup (backup.js + autoBackup.ts).
 * Shown only in the desktop app — a browser has nowhere to write the files.
 */
export function AutoBackupCard() {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const refresh = useCallback(() => {
    getDesktopApi()?.getBackupInfo().then(setInfo).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener('auto_backup_saved', refresh);
    return () => window.removeEventListener('auto_backup_saved', refresh);
  }, [refresh]);

  const api = getDesktopApi();
  if (!api || !info) return null;

  const handleBackupNow = async () => {
    setBusy(true);
    setMessage(null);
    const out = await runAutoBackup({ force: true });
    if (out.status === 'saved') {
      const extra = out.result.extra;
      setMessage(
        extra && !extra.ok
          ? { ok: false, text: tr('Backup saved on this computer. {error}', { error: extra.error }) }
          : { ok: true, text: extra?.ok ? tr('Backup saved on this computer and in the extra folder.') : tr('Backup saved on this computer.') }
      );
    } else if (out.status === 'failed') {
      setMessage({ ok: false, text: out.error });
    } else if (out.status === 'skipped' && out.reason === 'empty-shop') {
      setMessage({ ok: false, text: tr('Nothing to back up yet — set up your store first.') });
    }
    setBusy(false);
    refresh();
  };

  const last = info.lastBackupAt ? new Date(info.lastBackupAt) : null;
  const lastLabel = last
    ? `${info.hasTodaysBackup ? tr('Today') : last.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}, ${last.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
    : tr('Not yet');

  return (
    <div className="p-3.5 bg-white border border-emerald-300 rounded-xl shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-900 leading-tight">{tr('Automatic Backup')}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {tr('Last backup:')} <span className="font-bold text-slate-800">{lastLabel}</span> · {info.count} {tr('kept (last')} {info.keepDays} {tr('days)')}
            </p>
            <p className="text-[10.5px] text-slate-400 mt-0.5">
              {tr('Saved when the app opens, then every hour while you keep billing — when the counter is free.')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => api.openPath(info.folder)}
            className="h-8 px-3 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            {tr('Open Folder')}
          </button>
          <button
            type="button"
            onClick={handleBackupNow}
            disabled={busy}
            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            {busy ? tr('Saving…') : tr('Backup Now')}
          </button>
        </div>
      </div>

      <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <Usb className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          {info.extraFolder ? (
            <span className="truncate">
              {tr('Extra copy:')} <span className="font-mono font-bold text-slate-800">{info.extraFolder}</span>
              {info.extraFolderAvailable === false && (
                <span className="ml-1.5 font-bold text-amber-700">{tr('(not connected)')}</span>
              )}
            </span>
          ) : (
            <span className="text-slate-600">{tr('Keep an extra copy on a pen drive or a Google Drive folder, in case this computer fails.')}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={async () => setInfo(await api.chooseBackupFolder())}
            className="h-7 px-2.5 rounded-md border border-slate-300 bg-white hover:bg-slate-100 font-bold text-slate-800 cursor-pointer"
          >
            {info.extraFolder ? tr('Change') : tr('Choose Folder')}
          </button>
          {info.extraFolder && (
            <button
              type="button"
              onClick={async () => setInfo(await api.clearBackupFolder())}
              className="h-7 w-7 rounded-md border border-slate-300 bg-white hover:bg-slate-100 flex items-center justify-center cursor-pointer"
              aria-label={tr('Stop extra copy')}
            >
              <X className="w-3.5 h-3.5 text-slate-600" />
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`px-3 py-2 rounded-lg text-[11px] font-bold flex items-center gap-2 ${
            message.ok ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'
          }`}
        >
          {message.ok ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      <p className="text-[10.5px] text-slate-400">
        {tr('To restore, use “Restore Store Data” below and pick a file from the backup folder.')}
      </p>
    </div>
  );
}
