'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { LANGUAGES, useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * English / हिंदी / मराठी pills for the screens before the app opens (licence,
 * master password, store setup), so a shop can pick its language from the very
 * first screen. Inside the app the same choice lives in the Navbar store menu.
 */
export const LanguageSwitcher: React.FC<{ className?: string }> = ({ className }) => {
  const { language, setLanguage } = useTranslation();
  return (
    <div
      role="group"
      aria-label="Language / भाषा"
      className={cn('inline-flex items-center gap-1 p-1 rounded-full bg-slate-900/80 border border-slate-800', className)}
    >
      <Languages className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" aria-hidden />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => language !== l.code && setLanguage(l.code)}
          aria-pressed={language === l.code}
          className={cn(
            'px-3 h-8 rounded-full text-xs font-bold cursor-pointer transition-colors',
            language === l.code ? 'bg-amber-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
          )}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};
