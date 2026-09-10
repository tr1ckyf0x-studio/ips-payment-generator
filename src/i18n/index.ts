/**
 * Interface localisation.
 *
 * The interface language never changes what is printed: the blank's own wording is
 * Serbian Cyrillic by regulation, and the QR payload is transliterated to Latin
 * regardless. Only the surrounding form is translated.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { ru } from './ru.ts';
import { sr } from './sr.ts';
import { en } from './en.ts';
import { languageFromPath } from './routing.ts';

export const LANGUAGES = { ru, sr, en } as const;
export type Language = keyof typeof LANGUAGES;

export const LANGUAGE_NAMES: Record<Language, string> = {
  ru: 'Русский',
  sr: 'Srpski',
  en: 'English',
};

/**
 * The counted phrases live in their own namespace because their plural forms differ by
 * language, so they cannot share the key list the others are typed against.
 */
export const resources = Object.fromEntries(
  Object.entries(LANGUAGES).map(([code, dictionary]) => {
    const { counted, ...rest } = dictionary;
    return [code, { translation: { ...rest, ...counted } }];
  }),
);

/**
 * One URL, one language.
 *
 * The path decides, and where it names none — the root — Russian is what the page is
 * written in, so Russian is what runs. The browser's `Accept-Language` deliberately does
 * not get a vote: serving a different language at the same URL is what search engines
 * call dynamic serving, and it would have let a crawler index the root as English while
 * its own markup declared Russian and pointed `hreflang` at `/en/` for English.
 *
 * A visitor who picks a language still gets it back on the next visit — that choice is
 * remembered, and a crawler has no such memory, so the root stays Russian for it.
 */
const fromPath =
  typeof window === 'undefined' ? undefined : languageFromPath(window.location.pathname);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: fromPath,
    fallbackLng: 'ru',
    supportedLngs: Object.keys(LANGUAGES),
    // Serbian is served in Latin script, so sr-Cyrl and sr-Latn both land on 'sr'.
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'nalog-za-uplatu.language',
      caches: ['localStorage'],
    },
  });

export default i18n;
