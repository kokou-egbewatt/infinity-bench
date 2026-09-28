// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://kokou-egbewatt.github.io',
  base: '/infinity-bench',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
});
