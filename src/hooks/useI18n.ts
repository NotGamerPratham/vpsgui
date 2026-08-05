import { useState, useCallback } from 'react';
import { LanguageCode, getTranslation } from '../i18n';

const DEFAULT_LANG: LanguageCode = 'en';
const LOCAL_STORAGE_KEY = 'vpsgui_language';

export function useI18n() {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY) as LanguageCode;
      if (stored) return stored;
    } catch {}
    return DEFAULT_LANG;
  });

  const setLanguage = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newLang);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string): string => {
      return getTranslation(lang, key);
    },
    [lang]
  );

  return { lang, setLanguage, t };
}
