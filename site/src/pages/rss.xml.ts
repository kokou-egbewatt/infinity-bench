import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getPosts } from '../lib/posts';
import { url } from '../lib/url';

export async function GET(context: APIContext) {
  const posts = (await getPosts()).filter((p) => !p.data.draft);
  return rss({
    title: 'Kokou · one GPU, measured',
    description: 'GPU infrastructure, measured on one RTX 5060.',
    site: new URL(import.meta.env.BASE_URL, context.site),
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.dek,
      pubDate: p.data.date,
      link: url(`/posts/${p.id}`),
    })),
  });
}
