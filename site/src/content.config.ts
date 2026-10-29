import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TOPICS } from './data/series';
import { REPO_NAMES } from './lib/env';

const date = z.coerce.date().refine((d) => !Number.isNaN(d.valueOf()), 'invalid date');

// An erratum: a published number or claim that was wrong. `credit` names the reader who found it.
const erratum = z.object({
  date,
  text: z.string().min(10),
  credit: z.string().optional(),
});

// A change that is not an error: new results, a re-run harness, a section added. Typos and wording
// fixes do not get one; an entry is for something that changes what a reader takes away.
const change = z.object({
  date,
  text: z.string().min(10),
});

const hardware = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }),
  // Platform posts measured on the same machine with the GPU idle.
  z.object({ kind: z.literal('cpu'), host: z.string() }), // e.g. "Ryzen 5 8400F, Windows 11, WSL2"
  z.object({
    kind: z.literal('rented'),
    node: z.string(), // e.g. "8 × H100 SXM 80 GB"
    provider: z.string(),
    cost_usd: z.number().positive(),
  }),
]);

const posts = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/posts' }),
  schema: z
    .object({
      title: z.string().max(120),
      dek: z.string().max(240),
      date,
      updated: date.optional(),
      topic: z.enum(TOPICS),
      plan: z.string().optional(), // id of an entry in data/series.ts
      repo: z.enum(REPO_NAMES).default('infinity-bench'),
      hardware,
      cost: z.string(), // display line, e.g. "$0 · 18 h of runs"
      harness: z
        .string({
          message: 'quote the SHA, e.g. harness: "0c11b4e" (YAML reads some SHAs as numbers)',
        })
        .regex(/^[0-9a-f]{7,40}$/), // commit in `repo`
      data: z.string(), // folder under /data
      widgets: z.array(z.string()).default([]),
      errata: z.array(erratum).default([]),
      changes: z.array(change).default([]),
      draft: z.boolean().default(false),
    })
    .refine((p) => !p.updated || p.updated >= p.date, {
      message: 'updated is before date',
      path: ['updated'],
    })
    .refine((p) => p.errata.every((c) => c.date >= p.date), {
      message: 'erratum dated before the post',
      path: ['errata'],
    })
    .refine((p) => p.changes.every((c) => c.date >= p.date), {
      message: 'change dated before the post',
      path: ['changes'],
    }),
});

const models = defineCollection({
  loader: file('src/data/models.yaml'),
  schema: z.object({
    name: z.string(),
    quantization: z.string(),
    runtime: z.enum(['llama.cpp', 'vllm']),
    size_mb: z.number().int().positive(),
    layers: z.number().int().positive(),
    kv_heads: z.number().int().positive(),
    head_dim: z.number().int().positive(),
  }),
});

const elsewhere = defineCollection({
  loader: file('src/data/elsewhere.yaml'),
  schema: z.object({ title: z.string(), url: z.url(), note: z.string() }),
});

export const collections = { posts, models, elsewhere };
