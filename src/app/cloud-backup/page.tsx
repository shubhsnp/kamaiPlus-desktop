'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { BackupCheck, checkBackupPayload, downloadBackupJSON } from '@/lib/backup/cloudBackupService';
import { Download, Upload, CheckCircle2, HardDrive, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AutoBackupCard } from '@/components/backup/AutoBackupCard';
import { RestoreBackupModal } from '@/components/backup/RestoreBackupModal';
import { AccountingExportsCard } from '@/components/backup/AccountingExportsCard';
import { tr } from '@/lib/i18n/core';

/**
 * Data Backup & Tax Reports (v4.78.0): the daily automatic backup, a backup file to keep
 * anywhere, a safe restore (checked file, one transaction, today's backup refreshed
 * first, app reloaded after), and Tally / CA exports for a chosen period.
 */
export default function CloudBackupPage() {
  const business = useBusiness();
  const productCount = useLiveQuery(async () => db.products.count()) || 0;
  const customerCount = useLiveQuery(async () => db.customers.count()) || 0;
  const saleCount = useLiveQuery(async () => db.sales.count()) || 0;
  const khataCount = useLiveQuery(async () => db.ledger_transactions.count()) || 0;
  const totalRecords = productCount + customerCount + saleCount + khataCount;

  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);
  const [restoreCheck, setRestoreCheck] = useState<Extract<BackupCheck, { ok: true }> | null>(null);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const read = () => {
      try {
        setLastBackupTime(localStorage.getItem('kamai_last_backup_time'));
      } catch {}
    };
    read();
    window.addEventListener('auto_backup_saved', read);
    return () => window.removeEventListener('auto_backup_saved', read);
  }, []);

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const filename = await downloadBackupJSON();
      setLastBackupTime(new Date().toISOString());
      setBackupSuccessMessage(tr('Backup successfully downloaded: {filename}', { filename }));
      setTimeout(() => setBackupSuccessMessage(null), 5000);
    } catch (err: any) {
      showAlert(err.message || tr('Download failed.'));
    } finally {
      setIsBackingUp(false);
    }
  };

  // A file is read and checked before anything can be restored.
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      let json: unknown;
      try {
        json = JSON.parse(String(evt.target?.result || ''));
      } catch {
        showAlert(tr('Failed to read JSON backup file.'));
        return;
      }
      const check = checkBackupPayload(json);
      if (!check.ok) showAlert(check.error);
      else setRestoreCheck(check);
    };
    reader.onerror = () => showAlert(tr('Failed to read JSON backup file.'));
    reader.readAsText(file);
  };

  // After a restore every screen and cache (invoice numbers, open lists) must start from the
  // restored data: the app reloads itself (the master password is not asked again).
  const handleRestored = (message: string) => {
    setRestoreCheck(null);
    setRestoreSuccessMessage(`${message} ${tr('The app reloads to show the restored data…')}`);
    window.setTimeout(() => window.location.reload(), 2500);
  };

  const lastText = lastBackupTime && !Number.isNaN(Date.parse(lastBackupTime))
    ? new Date(lastBackupTime).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : tr('Never');

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 pb-16">
      <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <HardDrive className="w-4 h-4 text-amber-700 shrink-0" />
            <h1 className="text-sm xs:text-base sm:text-lg font-black text-slate-900 truncate">{tr('Data Backup & Tax Reports')}</h1>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate">{tr('Offline JSON database snapshots, Tally Prime XML, and CA Master Sales Registers')}</p>
        </div>
        <Button size="sm" onClick={handleDownloadBackup} disabled={isBackingUp} className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-2xs border-none gap-1 cursor-pointer flex-shrink-0">
          <FileDown className="w-3.5 h-3.5 text-slate-950" />
          <span className="hidden sm:inline">{isBackingUp ? tr('Backing up...') : tr('Download Backup (.JSON)')}</span>
          <span className="sm:hidden">{isBackingUp ? tr('Saving...') : tr('Backup')}</span>
        </Button>
      </div>

      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          <span className="font-bold text-slate-900 truncate">{tr('Saved on this computer')}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 truncate text-[11px]">
            {totalRecords} {tr('entries (')}{productCount} {tr('items,')} {saleCount} {tr('bills)')}
          </span>
        </div>
        <div className="text-[10.5px] text-slate-500 font-mono shrink-0" data-last-backup>{tr('Last:')} {lastText}</div>
      </div>

      {backupSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{backupSuccessMessage}</span>
        </div>
      )}
      {restoreSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in" data-restore-done>
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{restoreSuccessMessage}</span>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">{tr('Store Data Backup & Restore')}</h2>
        <AutoBackupCard />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold flex-shrink-0">
                <Download className="w-4 h-4 text-amber-800" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 leading-tight">{tr('Export Full Backup')}</h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{tr('Everything, incl. feature and label settings — keep it on a pen drive')}</p>
              </div>
            </div>
            <Button size="sm" onClick={handleDownloadBackup} disabled={isBackingUp} className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex-shrink-0 cursor-pointer h-8">
              <Download className="w-3 h-3 mr-1 text-amber-400" />
              <span>{isBackingUp ? tr('Saving...') : tr('Download')}</span>
            </Button>
          </div>

          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-800 flex items-center justify-center font-bold flex-shrink-0">
                <Upload className="w-4 h-4 text-slate-700" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 leading-tight">{tr('Restore Store Data')}</h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{tr('Upload .json backup file')}</p>
              </div>
            </div>
            <label className="cursor-pointer flex-shrink-0">
              <div className="px-3 py-1.5 border border-slate-300 hover:bg-slate-50 rounded-lg text-slate-800 font-bold text-xs flex items-center gap-1 transition-colors h-8">
                <Upload className="w-3 h-3 text-slate-700" />
                <span>{tr('Select File')}</span>
              </div>
              <input type="file" accept=".json,application/json" onChange={handleFileSelect} className="hidden" data-restore-file />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 pt-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">{tr('Accounting Software & Tax Exports')}</h2>
        <AccountingExportsCard business={business} />
      </div>

      {restoreCheck && (
        <RestoreBackupModal check={restoreCheck} currentShopName={business?.name || ''} onClose={() => setRestoreCheck(null)} onRestored={handleRestored} />
      )}
    </div>
  );
}
