import { useState, useCallback } from 'react';
import { LanguageCode, getTranslation, i18nTranslations } from '../i18n';

const DEFAULT_LANG: LanguageCode = 'en';
const LOCAL_STORAGE_KEY = 'vpsgui_language';

/** Narrow an arbitrary stored string to a supported language. */
function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(i18nTranslations, value);
}

export function useI18n() {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    try {
      // The stored value was previously cast straight to LanguageCode, so a stale or hand-edited
      // entry (say "en-GB") propagated as if it were a supported language.
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (isLanguageCode(stored)) return stored;
    } catch (e) {
      // Storage unavailable (private browsing / sandboxed iframe); fall through to the default.
    }
    return DEFAULT_LANG;
  });

  const setLanguage = useCallback((newLang: LanguageCode) => {
    setLangState(newLang);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, newLang);
    } catch (e) {
      // Storage unavailable; the choice still applies for this session.
    }
  }, []);

  const t = useCallback((key: string): string => getTranslation(lang, key), [lang]);

  return { lang, setLanguage, t };
}
