'use client';

import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useState } from 'react';
import { SupportedLanguage } from '@/types';
import {
  LANGUAGE_STORAGE_KEY,
  Messages,
  TVars,
  loadMessages,
  readSavedLanguage,
  setActiveLanguage,
  translate,
} from './core';

export { LANGUAGES, LANGUAGE_STORAGE_KEY, getLanguage, msg, tr, translate } from './core';
export type { Messages, TVars } from './core';

interface I18nContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (text: string, vars?: TVars) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (text: string, vars?: TVars) => translate(null, text, vars),
});

// Before paint on the client (no flash of English), plain effect when prerendering.
const useBeforePaint = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Holds the app language. A saved Hindi / Marathi choice holds the first paint
 * until its table has loaded; changing the language remounts the app so every
 * tr() on screen runs again (bills in progress are kept — they live in localStorage).
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [table, setTable] = useState<Messages | null>(null);
  const [ready, setReady] = useState(true);

  const apply = useCallback((lang: SupportedLanguage, messages: Messages | null) => {
    setActiveLanguage(lang, messages);
    setTable(messages);
    setLanguageState(lang);
    try {
      document.documentElement.lang = lang;
    } catch {}
  }, []);

  useBeforePaint(() => {
    const saved = readSavedLanguage();
    if (saved === 'en') return;
    setReady(false);
    loadMessages(saved)
      .then((messages) => apply(saved, messages))
      .catch(() => apply('en', null))
      .finally(() => setReady(true));
  }, [apply]);

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {}
    loadMessages(lang)
      .then((messages) => apply(lang, messages))
      .catch(() => apply('en', null));
  }, [apply]);

  const t = useCallback((text: string, vars?: TVars) => translate(table, text, vars), [table]);

  if (!ready) return <main className="min-h-screen bg-slate-950" />;

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      <React.Fragment key={language}>{children}</React.Fragment>
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
