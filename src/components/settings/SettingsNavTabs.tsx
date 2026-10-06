'use client';

import React from 'react';
import { 
  Store, 
  Receipt, 
  Sparkles,
  Palette,
  HardDrive,
  LifeBuoy,
  ToggleRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { tr } from '@/lib/i18n/core';
import { useFeatureSwitches } from '@/lib/features/featureSwitches';

// UPI QR & bank details live in the Store Profile tab since v4.78.0 (no separate tab).
export type SettingsTabType = 'profile' | 'features' | 'invoicing' | 'data' | 'help';

interface SettingsNavTabsProps {
  activeTab: SettingsTabType;
  onTabChange: (tab: SettingsTabType) => void;
  changedCategories: string[];
}

export const SettingsNavTabs: React.FC<SettingsNavTabsProps> = ({
  activeTab,
  onTabChange,
  changedCategories,
}) => {
  const designerOn = useFeatureSwitches().invoice_designer; // Settings → Features: no Themes link when off
  const tabs = [
    {
      id: 'profile' as SettingsTabType,
      label: tr('Store & GST Profile'),
      shortLabel: tr('Store'),
      icon: Store,
    },
    {
      id: 'features' as SettingsTabType,
      label: tr('Features'),
      shortLabel: tr('Features'),
      icon: ToggleRight,
    },
    {
      id: 'invoicing' as SettingsTabType,
      label: tr('Invoice & Bill Rules'),
      shortLabel: tr('Invoices'),
      icon: Receipt,
    },
    {
      id: 'data' as SettingsTabType,
      label: tr('Data & Reset'),
      shortLabel: tr('Data Clean'),
      icon: HardDrive,
    },
    {
      id: 'help' as SettingsTabType,
      label: tr('Help & Support'),
      shortLabel: tr('Help'),
      icon: LifeBuoy,
    },
  ];

  return (
    <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-1.5 flex-nowrap">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const hasChanges = changedCategories.includes(tab.id);

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer",
                isActive
                  ? "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 shadow-2xs"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800"
              )}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{tab.label}</span>
              {hasChanges && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" title={tr('Unsaved changes in this tab')} />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick Links to Invoice Designer & Cloud Backup */}
      <div className="hidden lg:flex items-center gap-1.5 shrink-0">
        {designerOn && (
        <Link
          href="/invoice-designer"
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shadow-2xs"
        >
          <Palette className="w-3.5 h-3.5 text-amber-600" />
          <span>{tr('Themes')}</span>
        </Link>
        )}
        <Link
          href="/cloud-backup"
          className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 shadow-2xs"
        >
          <HardDrive className="w-3.5 h-3.5 text-sky-600" />
          <span>{tr('Backup')}</span>
        </Link>
      </div>
    </div>
  );
};
