'use client';
import { showAlert } from '@/lib/ui/dialogs';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { useBusiness } from '@/components/layout/BusinessProvider';
import { 
  downloadBackupJSON, 
  restoreDatabaseFromPayload, 
  FullBackupPayload 
} from '@/lib/backup/cloudBackupService';
import { generateTallyPrimeXML } from '@/lib/tally/tallyXmlGenerator';
import { generateCASalesRegisterCSV } from '@/lib/tally/caExcelGenerator';
import { 
  Download, 
  Upload, 
  CheckCircle2, 
  HardDrive,
  FileDown,
  FileSpreadsheet,
  BookOpen,
  ArrowRight,
  Sparkles,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import Link from 'next/link';
import { AutoBackupCard } from '@/components/backup/AutoBackupCard';
import { tr } from '@/lib/i18n/core';

export default function CloudBackupPage() {
  const business = useBusiness();
  const productCount = useLiveQuery(async () => db.products.count()) || 0;
  const customerCount = useLiveQuery(async () => db.customers.count()) || 0;
  const saleCount = useLiveQuery(async () => db.sales.count()) || 0;
  const khataCount = useLiveQuery(async () => db.ledger_transactions.count()) || 0;


  const totalRecords = productCount + customerCount + saleCount + khataCount;

  // State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupSuccessMessage, setBackupSuccessMessage] = useState<string | null>(null);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // Restore State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [restorePayload, setRestorePayload] = useState<FullBackupPayload | null>(null);
  const [restoreMode, setRestoreMode] = useState<'clean' | 'merge'>('clean');
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  // Load last backup timestamp on mount
  useEffect(() => {
    try {
      const lastTime = localStorage.getItem('kamai_last_backup_time');
      if (lastTime) setLastBackupTime(lastTime);
    } catch (e) {}
  }, []);

  // 1-Click Local File Download
  const handleDownloadBackup = async () => {
    setIsBackingUp(true);
    try {
      const filename = await downloadBackupJSON();
      const now = new Date().toISOString();
      setLastBackupTime(now);
      localStorage.setItem('kamai_last_backup_time', now);
      setBackupSuccessMessage(tr('Backup successfully downloaded: {filename}', { filename: filename }));
      setTimeout(() => setBackupSuccessMessage(null), 5000);
    } catch (err: any) {
      showAlert(err.message || tr('Download failed.'));
    } finally {
      setIsBackingUp(false);
    }
  };

  // Export 1-Click Tally Prime XML
  const handleExportTallyXML = async () => {
    if (saleCount === 0) {
      showAlert(tr('No sales transactions recorded yet.'));
      return;
    }
    const [sales, customers] = await Promise.all([db.sales.toArray(), db.customers.toArray()]);
    const { xml, filename } = generateTallyPrimeXML({
      business,
      sales,
      customers,
    });
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Export CA Master Excel CSV
  const handleExportCAMasterCSV = async () => {
    if (saleCount === 0) {
      showAlert(tr('No sales transactions recorded yet.'));
      return;
    }
    const sales = await db.sales.toArray();
    const { csv, filename } = generateCASalesRegisterCSV({
      business,
      sales,
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Handle file select for restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const json = JSON.parse(evt.target?.result as string);
        if (!json.metadata || !json.products) {
          throw new Error(tr('Invalid backup file. Format not recognized.'));
        }
        setRestorePayload(json);
        setIsRestoreModalOpen(true);
      } catch (err: any) {
        showAlert(err.message || tr('Failed to read JSON backup file.'));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Confirm Restore
  const handleConfirmRestore = async () => {
    if (!restorePayload) return;
    setIsRestoring(true);
    try {
      const res = await restoreDatabaseFromPayload(restorePayload, restoreMode);
      setIsRestoreModalOpen(false);
      setRestorePayload(null);
      setRestoreSuccessMessage(res.message);
      setTimeout(() => setRestoreSuccessMessage(null), 5000);
    } catch (err: any) {
      showAlert(err.message || tr('Database restore failed.'));
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-3.5 pb-16">
      {/* ---------------- TOP HEADER (Single Row Compact) ---------------- */}
      <div className="bg-white px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate">
            <HardDrive className="w-4 h-4 text-amber-700 shrink-0" />
            <h1 className="text-sm xs:text-base sm:text-lg font-black text-slate-900 truncate">
              {tr('Data Backup & Tax Reports')}
            </h1>
          </div>
          <p className="text-[10px] sm:text-xs text-slate-500 truncate">
            {tr('Offline JSON database snapshots, Tally Prime XML, and CA Master Sales Registers')}
          </p>
        </div>

        <Button
          size="sm"
          onClick={handleDownloadBackup}
          disabled={isBackingUp}
          className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg shadow-2xs border-none gap-1 cursor-pointer flex-shrink-0"
        >
          <FileDown className="w-3.5 h-3.5 text-slate-950" />
          <span className="hidden sm:inline">{isBackingUp ? tr('Backing up...') : tr('Download Backup (.JSON)')}</span>
          <span className="sm:hidden">{isBackingUp ? tr('Saving...') : tr('Backup')}</span>
        </Button>
      </div>

      {/* ---------------- COMPACT STATUS BADGE ---------------- */}
      <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <span className="font-bold text-slate-900 truncate">{tr('Offline Active')}</span>
          <span className="text-slate-400">•</span>
          <span className="text-slate-600 truncate text-[11px]">
            {totalRecords} {tr('entries (')}{productCount} {tr('items,')} {saleCount} {tr('bills)')}
          </span>
        </div>

        <div className="text-[10.5px] text-slate-500 font-mono shrink-0">
          {tr('Last:')} {lastBackupTime ? new Date(lastBackupTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : tr('Never')}
        </div>
      </div>

      {/* FEEDBACK BANNERS */}
      {backupSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{backupSuccessMessage}</span>
        </div>
      )}

      {restoreSuccessMessage && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center gap-2 shadow-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>{restoreSuccessMessage}</span>
        </div>
      )}

      {/* ---------------- SECTION 1: DATABASE BACKUP & RESTORE ---------------- */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {tr('Store Data Backup & Restore')}
        </h2>

        <AutoBackupCard />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* CARD 1: EXPORT / DOWNLOAD */}
          <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs flex items-center justify-between gap-3 hover:border-slate-300 transition-all">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-900 flex items-center justify-center font-bold flex-shrink-0">
                <Download className="w-4 h-4 text-amber-800" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-900 leading-tight">{tr('Export Full Backup')}</h3>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{tr('Save .json snapshot file')}</p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={handleDownloadBackup}
              disabled={isBackingUp}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex-shrink-0 cursor-pointer h-8"
            >
              <Download className="w-3 h-3 mr-1 text-amber-400" />
              <span>{isBackingUp ? tr('Saving...') : tr('Download')}</span>
            </Button>
          </div>

          {/* CARD 2: RESTORE DATABASE */}
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
              <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
            </label>
          </div>
        </div>

      </div>

      {/* ---------------- SECTION 2: TALLY PRIME & CA MASTER EXCEL BRIDGE (Compact) ---------------- */}
      <div className="space-y-2.5 pt-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          {tr('Accounting Software & Tax Exports')}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* TALLY PRIME XML */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border border-amber-300/80 rounded-xl space-y-2.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                  T
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-900 truncate">{tr('Tally Prime XML')}</h3>
                  <p className="text-[10.5px] text-slate-500 truncate">{tr('Vouchers & Sundry Debtors')}</p>
                </div>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-200 text-amber-950 shrink-0 font-mono">
                {tr('Tally ERP 9')}
              </span>
            </div>

            <Button
              size="sm"
              onClick={handleExportTallyXML}
              disabled={saleCount === 0}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs gap-1.5 h-8 cursor-pointer shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>{tr('Export Tally XML (')}{saleCount})</span>
            </Button>
          </div>

          {/* CA MASTER EXCEL / GSTR-1 */}
          <div className="p-3 sm:p-3.5 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-white border border-indigo-200 rounded-xl space-y-2.5 shadow-2xs flex flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-2xs shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-slate-900 truncate">{tr('CA Master Sales Register')}</h3>
                  <p className="text-[10.5px] text-slate-500 truncate">{tr('GSTR-1 Excel / CSV Table')}</p>
                </div>
              </div>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-indigo-100 text-indigo-900 shrink-0 font-mono">
                {tr('CA Format')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                onClick={handleExportCAMasterCSV}
                disabled={saleCount === 0}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1 h-8 cursor-pointer shadow-2xs truncate"
              >
                <Download className="w-3.5 h-3.5 text-white" />
                <span>{tr('Export CSV')}</span>
              </Button>

              <Link href="/gst-reports" className="flex-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-bold gap-1 border-indigo-200 text-indigo-900 hover:bg-indigo-50 h-8 shadow-2xs cursor-pointer truncate"
                >
                  <span>{tr('GSTR-1 Hub')}</span>
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- RESTORE CONFIRMATION MODAL ---------------- */}
      {restorePayload && (
        <Modal
          isOpen={isRestoreModalOpen}
          onClose={() => {
            setIsRestoreModalOpen(false);
            setRestorePayload(null);
          }}
          title={tr('Verify & Confirm Database Restore')}
          description={tr('Review backup file contents before restoring onto your store.')}
          size="md"
        >
          <div className="space-y-4 text-xs p-1">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-black text-slate-900 text-sm">
                {tr('Store:')} {restorePayload.metadata.business_name}
              </div>
              <div className="text-[11px] text-slate-500 font-mono">
                {tr('Date:')} {new Date(restorePayload.metadata.created_at).toLocaleString('en-IN')}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 font-mono text-[11px] text-slate-700">
                <div>{tr('• Products:')} {restorePayload.metadata.counts.products}</div>
                <div>{tr('• Customers:')} {restorePayload.metadata.counts.customers}</div>
                <div>{tr('• Bills:')} {restorePayload.metadata.counts.sales}</div>
                <div>{tr('• Khata:')} {restorePayload.metadata.counts.ledger_transactions}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5">
                {tr('Choose Restore Strategy:')}
              </label>
              <div className="space-y-2">
                <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-300 cursor-pointer bg-white">
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === 'clean'}
                    onChange={() => setRestoreMode('clean')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{tr('Clean Replace (Recommended)')}</div>
                    <div className="text-[10px] text-slate-500">
                      {tr('Replaces existing database completely with the exact state from this backup file.')}
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-300 cursor-pointer bg-white">
                  <input
                    type="radio"
                    name="restoreMode"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold text-slate-900">{tr('Merge & Append')}</div>
                    <div className="text-[10px] text-slate-500">
                      {tr('Appends missing products and sales without deleting new records.')}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsRestoreModalOpen(false);
                  setRestorePayload(null);
                }}
              >
                {tr('Cancel')}
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold"
              >
                {isRestoring ? tr('Restoring...') : tr('Confirm & Restore')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
