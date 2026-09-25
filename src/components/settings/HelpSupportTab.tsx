'use client';

import React, { useEffect, useState } from 'react';
import { Copy, FolderOpen, LifeBuoy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { getDesktopApi } from '@/lib/desktop/desktopBridge';

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
