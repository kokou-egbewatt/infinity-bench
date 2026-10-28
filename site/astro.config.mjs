// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { transformerMetaHighlight } from '@shikijs/transformers';

export default defineConfig({
  // The one place the public address is set. Canonical links, the sitemap and the RSS feed all
  // read it. The site serves from the root of the domain, so there is no `base`; every internal
  // link still goes through `url()` in src/lib/url.ts, so adding one back is a one-line change.
  site: 'https://kokou.dev',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'github-dark-dimmed',
      transformers: [transformerMetaHighlight()],
    },
  },
});
