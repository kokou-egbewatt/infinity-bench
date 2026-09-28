import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { parse } from 'csv-parse/sync';
import { DATA_DIR } from './paths';
import { readEnv } from './env';

export type Row = Record<string, string>;

/** The current post from Astro.locals; components that read data/ fail without one. */
export function currentPost(locals: App.Locals, who: string) {
  if (!locals.post) throw new Error(`${who}: used outside a post`);
  return locals.post;
}

/** Rows of data/<folder>/<file>. Throws with the post and path when missing or empty. */
export function readCsv(folder: string, file: string, who: string, slug: string): Row[] {
  if (normalize(file).startsWith('..')) throw new Error(`${who}: ${file} leaves data/${folder}/ (post: ${slug})`);
  const path = join(DATA_DIR, folder, file);
  if (!existsSync(path)) throw new Error(`${who}: ${path} not found (post: ${slug})`);
  const rows = parse(readFileSync(path, 'utf8'), { columns: true, cast: false, skip_empty_lines: true, trim: true }) as Row[];
  if (rows.length === 0) throw new Error(`${who}: ${path} has no rows (post: ${slug})`);
  return rows;
}

/** A number from data/<folder>/env.json, or a build error naming what is missing. */
export function envNumber(folder: string, pick: (env: NonNullable<ReturnType<typeof readEnv>>) => number | null | undefined, field: string, who: string, slug: string): number {
  const env = readEnv(folder);
  const v = env ? pick(env) : undefined;
  if (typeof v !== 'number') throw new Error(`${who}: data/${folder}/env.json has no ${field} (post: ${slug})`);
  return v;
}
