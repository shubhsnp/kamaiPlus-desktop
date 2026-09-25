'use client';

import { useEffect } from 'react';
import { reportError } from '@/lib/diagnostics/errorReporter';

/** Last-resort screen when the app shell itself fails. Logs the error for support. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportError('app', error, error.digest);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#f8fafc' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{ fontSize: 36 }}>⚠️</div>
            <h2 style={{ fontSize: 18, fontWeight: 900, margin: '8px 0' }}>KamaiPlus ran into a problem</h2>
            <p style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>
              Your bills and data are safe on this computer. The problem has been saved for support.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 12, padding: '10px 18px', borderRadius: 12, border: 0, background: '#f59e0b', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
