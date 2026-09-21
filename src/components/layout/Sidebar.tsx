'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { 
  Home, 
  Receipt, 
  Package, 
  Boxes, 
  BookOpen, 
  Users, 
  ShoppingBag, 
  Settings, 
  ShieldCheck, 
  Palette, 
  Calculator, 
  Barcode, 
  FileSpreadsheet, 
  HardDrive,
  LineChart,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { APP_VERSION } from '@/lib/constants/version';
import { cn } from '@/lib/utils';
import { useProSubscription } from '@/components/subscription/ProFeatureGate';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed: controlledCollapsed,
  onToggle: controlledToggle,
}) => {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { isPro } = useProSubscription();

  const business = useLiveQuery(() => db.businesses.toCollection().first());

  const [internalCollapsed, setInternalCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('kamai_sidebar_collapsed');
      if (saved === 'true') {
        setInternalCollapsed(true);
      }
    }
  }, []);

  const isCollapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;

  const handleToggle = () => {
    if (controlledToggle) {
      controlledToggle();
    } else {
      const next = !internalCollapsed;
      setInternalCollapsed(next);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kamai_sidebar_collapsed', String(next));
      }
    }
  };

  // Keyboard shortcut: Ctrl + B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Generic Retail Labels
  const productsLabel = t('nav.products') || 'Products';
  const ProductsIcon = Package;
  const productsBg = 'bg-blue-100 text-blue-800';
  const inventoryLabel = 'Inventory & Expiry';
  const purchasesLabel = 'Purchases & Bills';
  const stockSectionTitle = 'Stock & Sourcing';

  const sections = [
    {
      title: 'POS & Counter',
      dotColor: 'bg-emerald-500',
      items: [
        { href: '/', label: t('nav.dashboard') || 'Dashboard', icon: Home, iconBg: 'bg-slate-100 text-slate-700', activeIcon: 'text-white' },
        { href: '/billing', label: 'Billing POS', icon: Receipt, iconBg: 'bg-emerald-100 text-emerald-800', activeIcon: 'text-emerald-300' },
        { href: '/cash-register', label: 'Cash Register', icon: Calculator, iconBg: 'bg-amber-100 text-amber-900', activeIcon: 'text-amber-300' },
        { href: '/barcode-generator', label: 'Barcode Studio', icon: Barcode, iconBg: 'bg-purple-100 text-purple-800', activeIcon: 'text-purple-300' },
        { href: '/transactions', label: 'Transactions', icon: ShieldCheck, iconBg: 'bg-teal-100 text-teal-800', activeIcon: 'text-teal-300' },
        { href: '/reports', label: 'Sales Analytics', icon: LineChart, iconBg: 'bg-indigo-100 text-indigo-800', activeIcon: 'text-indigo-300' },
      ],
    },
    {
      title: stockSectionTitle,
      dotColor: 'bg-blue-500',
      items: [
        { href: '/products', label: productsLabel, icon: ProductsIcon, iconBg: productsBg, activeIcon: 'text-blue-300' },
        { href: '/inventory', label: inventoryLabel, icon: Boxes, iconBg: 'bg-cyan-100 text-cyan-800', activeIcon: 'text-cyan-300' },
        { href: '/purchases', label: purchasesLabel, icon: ShoppingBag, iconBg: 'bg-amber-100 text-amber-800', activeIcon: 'text-amber-300' },
      ],
    },
    {
      title: 'Ledger & Customers',
      dotColor: 'bg-amber-500',
      items: [
        { href: '/khata', label: 'Khata Ledger', icon: BookOpen, iconBg: 'bg-amber-100 text-amber-800', activeIcon: 'text-amber-300' },
        { href: '/customers', label: 'Customers', icon: Users, iconBg: 'bg-sky-100 text-sky-800', activeIcon: 'text-sky-300' },
      ],
    },
    {
      title: 'Tax & Settings',
      dotColor: 'bg-purple-500',
      items: [
        { href: '/gst-reports', label: 'GST & Accounting', icon: FileSpreadsheet, iconBg: 'bg-indigo-100 text-indigo-800', activeIcon: 'text-indigo-300', isPro: true },
        { href: '/invoice-designer', label: 'Invoice Themes', icon: Palette, iconBg: 'bg-amber-100 text-amber-800', activeIcon: 'text-amber-300' },
        { href: '/cloud-backup', label: 'Backup & Restore', icon: HardDrive, iconBg: 'bg-sky-100 text-sky-800', activeIcon: 'text-sky-300', isPro: true },
        { href: '/settings', label: t('nav.settings') || 'Settings', icon: Settings, iconBg: 'bg-slate-100 text-slate-700', activeIcon: 'text-slate-300' },
      ],
    },
  ];

  return (
    <aside 
      className={cn(
        'hidden md:flex flex-col border-r border-slate-200/90 bg-slate-50/60 select-none justify-between transition-all duration-200 ease-in-out flex-shrink-0 z-20 h-full',
        isCollapsed ? 'w-16 px-1.5 py-2' : 'w-56 px-2.5 py-2.5'
      )}
    >
      {/* Top section with items */}
      <div className="space-y-3 overflow-y-auto pr-0.5 overflow-x-hidden">
        {/* Collapse / Expand Toggle Button */}
        <div className={cn('flex items-center', isCollapsed ? 'justify-center pb-1' : 'justify-between px-1 pb-0.5')}>
          {!isCollapsed && (
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Workspace
            </span>
          )}
          <button
            type="button"
            onClick={handleToggle}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {sections.map((sec, idx) => (
          <div key={idx} className="space-y-1">
            {/* Category Header */}
            {!isCollapsed ? (
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                <span className={cn('w-1.5 h-1.5 rounded-full', sec.dotColor)} />
                <span>{sec.title}</span>
              </div>
            ) : (
              <div className="flex justify-center py-1">
                <span className={cn('w-1.5 h-1.5 rounded-full', sec.dotColor)} title={sec.title} />
              </div>
            )}

            {/* Category Menu Items */}
            <div className={cn(
              'space-y-0.5 bg-white/80 border border-slate-200/70 rounded-xl shadow-2xs',
              isCollapsed ? 'p-1 flex flex-col items-center' : 'p-1'
            )}>
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

                return (
                  <Link
                    key={`${idx}-${item.href}-${item.label}`}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={cn(
                      'group flex items-center rounded-lg font-bold transition-all leading-none',
                      isCollapsed 
                        ? 'w-10 h-10 justify-center' 
                        : 'w-full justify-between px-2 py-1.5 text-xs',
                      isActive
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-950'
                    )}
                  >
                    <div className={cn('flex items-center min-w-0', isCollapsed ? 'justify-center' : 'gap-2')}>
                      <div
                        className={cn(
                          'rounded-md flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105',
                          isCollapsed ? 'w-7 h-7' : 'w-6 h-6',
                          isActive
                            ? 'bg-white/15 text-white'
                            : cn(item.iconBg, 'shadow-2xs')
                        )}
                      >
                        <Icon className={cn(isCollapsed ? 'w-4 h-4' : 'w-3.5 h-3.5')} />
                      </div>
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Compact App Footer */}
      <div className={cn(
        'pt-2 border-t border-slate-200/80 flex items-center font-semibold bg-white/60 rounded-lg',
        isCollapsed 
          ? 'justify-center p-1.5 flex-col gap-1' 
          : 'justify-between px-2 py-1.5 text-[11px] text-slate-600'
      )}>
        <span 
          className="flex items-center gap-1.5 cursor-default"
          title={`KamaiPlus Desktop v${APP_VERSION}`}
        >
          <img src="/logo.png" alt="Kamai+" className="w-4 h-4 object-contain" />
          {!isCollapsed && <span className="font-bold text-slate-800">KamaiPlus</span>}
        </span>
        {!isCollapsed && (
          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold border border-slate-200/60">
            {APP_VERSION}
          </span>
        )}
      </div>
    </aside>
  );
};
