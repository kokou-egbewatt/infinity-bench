import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { TOPICS } from './data/series';
import { REPO_NAMES } from './lib/env';

const date = z.coerce.date().refine((d) => !Number.isNaN(d.valueOf()), 'invalid date');

const correction = z.object({
  date,
  text: z.string().min(10),
  credit: z.string().optional(),
});

const hardware = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }),
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
        .string({ message: 'quote the SHA, e.g. harness: "0c11b4e" (YAML reads some SHAs as numbers)' })
        .regex(/^[0-9a-f]{7,40}$/), // commit in `repo`
      data: z.string(), // folder under /data
      widgets: z.array(z.string()).default([]),
      corrections: z.array(correction).default([]),
      draft: z.boolean().default(false),
    })
    .refine((p) => !p.updated || p.updated >= p.date, { message: 'updated is before date', path: ['updated'] })
    .refine((p) => p.corrections.every((c) => c.date >= p.date), {
      message: 'correction dated before the post',
      path: ['corrections'],
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

export const collections = { posts, models };
