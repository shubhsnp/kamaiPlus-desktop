'use client';

import { useEffect } from 'react';
import { installGlobalErrorReporting } from '@/lib/diagnostics/errorReporter';

/** Mounted once in the root layout: every unhandled page error reaches the error log. */
export function ErrorReporter() {
  useEffect(() => {
    installGlobalErrorReporting();
  }, []);
  return null;
}
