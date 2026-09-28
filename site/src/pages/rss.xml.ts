import rss from '@astrojs/rss';
import type { APIContext } from 'astro';

export function GET(context: APIContext) {
  return rss({
    title: 'Kokou · one GPU, measured',
    description: 'GPU infrastructure, measured on one RTX 5060.',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: [],
  });
}
