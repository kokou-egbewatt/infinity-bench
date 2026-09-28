// Issue states for the Series page, fetched from GitHub once per build.
//
// If the fetch fails (offline dev, rate limit), every state is 'unknown' and
// the page says its statuses may be stale instead of failing the build.
// Set GITHUB_TOKEN in CI to avoid the 60 requests/hour anonymous limit.

export type RepoKey = 'nm' | 'ib';
export type IssueState = 'open' | 'closed' | 'unknown';

export const REPOS: Record<RepoKey, { slug: string; short: string; url: string }> = {
  nm: { slug: 'kokou-egbewatt/NeuroMesh', short: 'NM', url: 'https://github.com/kokou-egbewatt/NeuroMesh' },
  ib: { slug: 'kokou-egbewatt/infinity-bench', short: 'IB', url: 'https://github.com/kokou-egbewatt/infinity-bench' },
};

export interface IssueStates {
  get(repo: RepoKey, issue: number): IssueState;
  fetched: boolean;
  fetchedAt: Date;
}

const MAX_PAGES = 5;

async function fetchRepo(slug: string, token: string | undefined): Promise<Map<number, IssueState>> {
  const states = new Map<number, IssueState>();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'infinity-bench-site',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(
      `https://api.github.com/repos/${slug}/issues?state=all&per_page=100&page=${page}`,
      { headers, signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
    const batch = (await res.json()) as Array<{ number: number; state: string }>;
    for (const i of batch) states.set(i.number, i.state === 'closed' ? 'closed' : 'open');
    if (batch.length < 100) break;
  }
  return states;
}

let cached: Promise<IssueStates> | undefined;

export function getIssueStates(): Promise<IssueStates> {
  cached ??= (async () => {
    const token = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
      ?.GITHUB_TOKEN;
    const fetchedAt = new Date();
    try {
      const [nm, ib] = await Promise.all([fetchRepo(REPOS.nm.slug, token), fetchRepo(REPOS.ib.slug, token)]);
      const byRepo: Record<RepoKey, Map<number, IssueState>> = { nm, ib };
      return { fetched: true, fetchedAt, get: (repo, issue) => byRepo[repo].get(issue) ?? 'unknown' };
    } catch (err) {
      console.warn(`[issues] could not fetch issue states, statuses will show as unknown: ${String(err)}`);
      return { fetched: false, fetchedAt, get: () => 'unknown' };
    }
  })();
  return cached;
}

export function issueUrl(repo: RepoKey, issue: number): string {
  return `${REPOS[repo].url}/issues/${issue}`;
}

export function milestoneUrl(repo: RepoKey, milestone: number): string {
  return `${REPOS[repo].url}/milestone/${milestone}`;
}

export function docUrl(repo: RepoKey, path: string): string {
  return `${REPOS[repo].url}/blob/main/${path}`;
}
