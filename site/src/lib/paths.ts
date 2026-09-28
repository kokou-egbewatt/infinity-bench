import { resolve } from 'node:path';

// Astro runs from site/, locally and in CI.
export const REPO_ROOT = resolve(process.cwd(), '..');
export const DATA_DIR = resolve(REPO_ROOT, 'data');
