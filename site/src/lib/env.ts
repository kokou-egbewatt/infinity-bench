import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths';
import { REPOS, type RepoKey } from './issues';

// Shape written by bench/_lib/capture_env.py (#9). Every field can be null.
export interface Env {
  git?: { repo?: string; sha?: string; dirty?: boolean; branch?: string };
  gpu?: { name?: string; driver?: string; cuda?: string; vram_total_mb?: number };
  host?: { os?: string; distro?: string };
  cluster?: { k3s?: string; device_plugin?: string };
  desktop_tax_mb?: number | null;
  packages?: Record<string, string | null>;
}

export function readEnv(data: string): Env | null {
  const path = join(DATA_DIR, data, 'env.json');
  return existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as Env) : null;
}

/** Values of a post's `repo` frontmatter field. */
export const REPO_NAMES = ['infinity-bench', 'NeuroMesh'] as const;
export type Repo = (typeof REPO_NAMES)[number];

const KEYS: Record<Repo, RepoKey> = { 'infinity-bench': 'ib', NeuroMesh: 'nm' };
export const repoUrl = (repo: Repo) => REPOS[KEYS[repo]].url;
export const commitUrl = (repo: Repo, sha: string) => `${repoUrl(repo)}/commit/${sha}`;
