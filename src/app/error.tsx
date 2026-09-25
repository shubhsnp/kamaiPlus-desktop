'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/diagnostics/errorReporter';

/**
 * Shown instead of a blank page when a screen crashes. The error is logged for
 * support; the shop's data is in the local database and is not affected.
 */
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError('screen', error, error.digest);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-rose-200 rounded-2xl shadow-sm p-6 text-center space-y-3">
        <div className="text-3xl">⚠️</div>
        <h2 className="text-base font-black text-slate-900">This screen ran into a problem</h2>
        <p className="text-xs text-slate-600">
          Your bills and data are safe. The problem has been saved for support (Settings → Help &amp; Support).
        </p>
        <div className="flex gap-2 justify-center pt-1">
          <button type="button" onClick={() => reset()} className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer">
            Try again
          </button>
          <button type="button" onClick={() => window.location.assign('/')} className="h-9 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold cursor-pointer">
            Go to Home
          </button>
        </div>
      </div>
    </div>
  );
}
