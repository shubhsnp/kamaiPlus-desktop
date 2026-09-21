'use client';

import { useEffect, useState } from 'react';

const FALLBACK_DOWNLOAD_URL = 'https://github.com/sayrahul/kamai/releases';

/**
 * Reads the same admin-managed "Download / Play Store APK URL" that
 * AppShell's force-update flow already uses, so every Download button
 * across the marketing site always points at whatever the admin has
 * currently configured (Play Store listing or latest APK).
 */
export function useAppDownloadUrl(): string {
  const [url, setUrl] = useState<string>(FALLBACK_DOWNLOAD_URL);

  useEffect(() => {
    fetch('/api/admin/config')
      .then((r) => r.json())
      .then((data) => {
        if (data?.config?.updateDownloadUrl) {
          setUrl(data.config.updateDownloadUrl);
        }
      })
      .catch(() => {});
  }, []);

  return url;
}
