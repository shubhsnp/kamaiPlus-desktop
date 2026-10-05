'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AdminControl, getDesktopApi } from '@/lib/desktop/desktopBridge';
import { adminBlock, applyFeatureOverrides, blocksBilling, counterHasOpenBill } from '@/lib/admin/adminControl';
import { runAutoBackup } from '@/lib/backup/autoBackup';
import { TABS_STORAGE_KEY } from '@/lib/billing/billTabs';
import { AdminLockScreen, BillingPausedScreen, UpdateRequiredScreen } from '@/components/admin/AdminBlockScreens';

/**
 * Applies the Admin Console's remote control on this computer (v4.105.0; main process:
 * adminLink.js + main.js "Remote control"). Mounted once in AppShell, after the shop unlocks.
 * - Forced features → localStorage, read by every screen through readFeatureSwitches.
 * - Locked / update required → a window over the whole app; read-only → over the counter only.
 * - Jobs from the main process: "backup now" (the same backup as Backup Now) and "is a bill
 *   open?" (a restart / update install waits until the counter is empty).
 */
export function AdminControlHost() {
  const [control, setControl] = useState<AdminControl | null>(null);
  const pathname = usePathname() || '/';

  useEffect(() => {
    const api = getDesktopApi();
    if (!api?.getAdminControl) return;
    const apply = (c: AdminControl) => {
      setControl(c);
      applyFeatureOverrides(c?.features);
    };
    void api.getAdminControl().then(apply).catch(() => {});
    const offControl = api.onAdminControl?.(apply);
    const offCommand = api.onAdminCommand?.((cmd) => {
      const done = (ok: boolean, note: string) => void api.adminCommandDone?.({ id: cmd.id, ok, note });
      if (cmd.type === 'idle_check') {
        let busy = false;
        try {
          busy = counterHasOpenBill(localStorage.getItem(TABS_STORAGE_KEY));
        } catch {}
        done(!busy, busy ? 'A bill is open on the counter' : 'Counter is free');
      } else if (cmd.type === 'backup_now') {
        void runAutoBackup({ force: true })
          .then((r) => done(r.status === 'saved', r.status === 'saved' ? 'Backup saved' : r.status === 'failed' ? `Backup failed: ${r.error}` : `Backup skipped: ${r.reason}`))
          .catch((err) => done(false, `Backup failed: ${err?.message || err}`));
      }
    });
    return () => {
      offControl?.();
      offCommand?.();
    };
  }, []);

  const block = adminBlock(control);
  if (block === 'locked') return <AdminLockScreen reason={control?.mode_reason} />;
  if (block === 'update') return <UpdateRequiredScreen current={control?.appVersion} required={control?.min_version} />;
  if (blocksBilling(control, pathname)) return <BillingPausedScreen reason={control?.mode_reason} />;
  return null;
}
