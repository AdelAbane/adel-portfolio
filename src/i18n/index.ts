import en from './en.json';
import fr from './fr.json';

export type Translations = typeof en;
export type Locale = 'en' | 'fr';

// `satisfies` makes TypeScript flag any key missing from fr.json
const translations = { en, fr: fr satisfies Translations };

export function getTranslations(locale: string | undefined): Translations {
  return translations[locale as Locale] ?? translations.en;
}

/** Root of a locale's pages: '/' or '/fr/' */
export function localeBase(locale: string | undefined): string {
  return locale === 'fr' ? '/fr/' : '/';
}

/** The CV in the page's language (the PDFs live in public/cv/) */
export function cvHref(locale: string | undefined): string {
  return locale === 'fr' ? '/cv/Adel-Abane-CV-FR.pdf' : '/cv/Adel-Abane-CV-EN.pdf';
}
