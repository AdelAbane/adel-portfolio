import en from './en.json';
import fr from './fr.json';

export type Translations = typeof en;
export type Locale = 'en' | 'fr';

// `satisfies` makes TypeScript flag any key missing from fr.json
const translations = { en, fr: fr satisfies Translations };

export function getTranslations(locale: string | undefined): Translations {
  return translations[locale as Locale] ?? translations.en;
}
