import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://reikem.github.io',
  base: '/inspector-municipal',
  integrations: [sitemap()],
  compressHTML: true,
  build: {
    inlineStylesheets: 'never',
  },
  vite: { build: { assetsInlineLimit: 0 } },
});