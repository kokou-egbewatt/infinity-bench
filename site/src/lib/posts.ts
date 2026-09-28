import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getCollection, type CollectionEntry } from 'astro:content';
import { SERIES, flatten, byPriority, type ResolvedSeries } from '../data/series';
import { DATA_DIR } from './paths';
import { computeStats } from './stats';

export type Post = CollectionEntry<'posts'>;

const planIds = new Set(SERIES.flatMap((s) => s.posts.map((p) => p.id).filter(Boolean)));

// Checks the schema can't express: they need other files or other posts.
function check(posts: Post[]): void {
  const claimed = new Map<string, string>();
  for (const p of posts) {
    const where = `post ${p.id} (${p.filePath ?? 'unknown file'})`;
    const { plan, data, harness, repo, draft } = p.data;

    if (plan && !planIds.has(plan)) throw new Error(`${where}: plan "${plan}" is not an id in src/data/series.ts`);

    if (draft) continue;
    if (plan) {
      const other = claimed.get(plan);
      if (other) throw new Error(`${where}: plan "${plan}" is already claimed by post ${other}`);
      claimed.set(plan, p.id);
    }

    const envPath = join(DATA_DIR, data, 'env.json');
    if (!existsSync(envPath)) throw new Error(`${where}: ${envPath} not found`);
    const git = JSON.parse(readFileSync(envPath, 'utf8')).git ?? {};
    const sha = String(git.sha ?? '');
    if (!sha || !(sha.startsWith(harness) || harness.startsWith(sha))) {
      throw new Error(`${where}: harness ${harness} does not match env.json git.sha ${sha || '(missing)'}`);
    }
    if ((git.repo ?? 'infinity-bench') !== repo) {
      throw new Error(`${where}: repo ${repo} does not match env.json git.repo ${git.repo}`);
    }
  }
}

let cache: Promise<Post[]> | undefined;

/** Every post, drafts included in dev only, newest first. Throws on a broken post. */
export function getPosts(): Promise<Post[]> {
  cache ??= getCollection('posts').then((all) => {
    check(all);
    return all
      .filter((p) => import.meta.env.DEV || !p.data.draft)
      .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  });
  return cache;
}

export async function getStats() {
  return computeStats(await getPosts());
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/** The series plan with each entry's published post attached. */
export async function resolveSeries() {
  const byPlan = new Map((await getPosts()).filter((p) => p.data.plan && !p.data.draft).map((p) => [p.data.plan!, p]));
  const series: ResolvedSeries[] = SERIES.map((s) => ({
    ...s,
    posts: s.posts.map((entry) => {
      const post = entry.id ? byPlan.get(entry.id) : undefined;
      return post ? { ...entry, slug: post.id, published: isoDate(post.data.date) } : entry;
    }),
  }));
  const all = flatten(series);
  return { series, all, nextUp: byPriority(all) };
}
