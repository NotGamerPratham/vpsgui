import en from './locales/en.json';
import de from './locales/de.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ja from './locales/ja.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ko from './locales/ko.json';

export type LanguageCode = 'en' | 'de' | 'es' | 'fr' | 'ja' | 'zh' | 'hi' | 'pt' | 'ru' | 'ko';

export const i18nTranslations: Record<LanguageCode, Record<string, string>> = {
  en,
  de,
  es,
  fr,
  ja,
  zh,
  hi,
  pt,
  ru,
  ko,
};

export const availableLanguages: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
];

export function getTranslation(lang: LanguageCode, key: string): string {
  const dictionary = i18nTranslations[lang] || i18nTranslations.en;
  return dictionary[key] || i18nTranslations.en[key] || key;
}
