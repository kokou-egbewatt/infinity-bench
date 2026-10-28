import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from './paths';
import { REPOS, type RepoKey } from './issues';

// Shape written by bench/_lib/capture_env.py (#9). Every field can be null.
export interface Env {
  git?: { repo?: string; sha?: string; dirty?: boolean; branch?: string };
  gpu?: { name?: string; driver?: string; cuda?: string; vram_total_mb?: number };
  host?: { os?: string; distro?: string; docker_vm?: { cpus?: number; memory_bytes?: number; kernel?: string } };
  cluster?: { k3s?: string; device_plugin?: string };
  desktop_tax_mb?: number | null;
  /** The runner fleet a gha-runners measurement ran against. */
  fleet?: {
    repo?: string;
    sha?: string;
    light?: { runners?: number; cpus?: number; memory_gb?: number };
    dind?: { pairs?: number; sidecar_cpus?: number; sidecar_memory_gb?: number; runner_limits?: { cpus?: number; memory_gb?: number } | null };
    vm_in_use_by_others_gib?: number[];
    /** Per measurement, the fleet it was taken on. The datasets are not all from one run. */
    measured_on?: Record<string, { light_runners?: number; dind_pairs?: number; captured?: string }>;
  };
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
