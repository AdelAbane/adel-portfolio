// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  // The production URL: canonical links, hreflang alternates and Open Graph URLs are built from it
  site: 'https://www.adelabane.com',
  // sitemap-index.xml, with each page's EN/FR alternates (404 pages are left out)
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'en', locales: { en: 'en-CA', fr: 'fr-CA' } },
    }),
  ],
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
