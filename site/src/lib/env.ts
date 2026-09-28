import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths';

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

export const REPO_URLS = {
  'infinity-bench': 'https://github.com/kokou-egbewatt/infinity-bench',
  NeuroMesh: 'https://github.com/kokou-egbewatt/NeuroMesh',
} as const;

export type Repo = keyof typeof REPO_URLS;

export const commitUrl = (repo: Repo, sha: string) => `${REPO_URLS[repo]}/commit/${sha}`;
