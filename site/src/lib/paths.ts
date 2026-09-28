import { resolve } from 'node:path';

// Astro runs from site/, locally and in CI.
export const DATA_DIR = resolve(process.cwd(), '..', 'data');
