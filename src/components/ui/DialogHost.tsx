'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { answerDialog, DialogRequest, subscribeDialogs } from '@/lib/ui/dialogs';

/**
 * Renders showAlert() / showConfirm() dialogs (lib/ui/dialogs.ts). Mounted once in
 * the root layout. Enter = OK / confirm, Esc = cancel. Keys are captured here so
 * page shortcuts (e.g. Enter = complete sale on billing) never fire underneath.
 */
export function DialogHost() {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const okRef = useRef<HTMLButtonElement>(null);
  useEffect(() => subscribeDialogs(setQueue), []);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    okRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        answerDialog(current.id, true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        answerDialog(current.id, current.kind === 'alert');
      }
    };
    // Capture phase so the page's own keyboard shortcuts never see these keys.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [current]);

  if (!current) return null;
  const isConfirm = current.kind === 'confirm';
  const Icon = current.danger ? AlertTriangle : Info;

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${current.danger ? 'bg-rose-100 text-rose-600' : 'bg-sky-100 text-sky-600'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            {current.title && <h3 className="text-sm font-black text-slate-900 mb-1">{current.title}</h3>}
            <p className="text-sm text-slate-700 whitespace-pre-line break-words">{current.message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          {isConfirm && (
            <button
              type="button"
              onClick={() => answerDialog(current.id, false)}
              className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer"
            >
              {current.cancelLabel || 'Cancel'}
            </button>
          )}
          <button
            ref={okRef}
            type="button"
            onClick={() => answerDialog(current.id, true)}
            className={`h-9 px-5 rounded-xl text-white text-xs font-black cursor-pointer ${current.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            {current.confirmLabel || (isConfirm ? 'Yes' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}
