# Writing a post

A post is one MDX file in `site/src/content/posts/` and one folder of data in `data/`. The build
checks that the two agree, so a post cannot cite numbers its data does not contain.

## 1. Pick the plan entry

Every planned post is an entry in `site/src/data/series.ts`. Give the entry an `id` if it has none:

```ts
{
  id: 'vram-accounting',
  title: 'VRAM accounting on Windows: how much of the 8 GB is actually free',
  sources: ib(10, 13),
  // ...
}
```

The post claims it with `plan: vram-accounting`. Once the post is published, the Series page links
the entry to the post, using the post's date. Don't add `slug` or `published` to `series.ts`.

## 2. Produce the data

Run the harness. It writes `data/<folder>/` with at least:

- one CSV per table, with a header row and LF line endings
- `env.json`, recording what produced the numbers (see [ADR-0002](adr/0002-data-outside-the-site.md))

For a post about NeuroMesh work, the harness lives in NeuroMesh and its results are copied here;
see [ADR-0003](adr/0003-neuromesh-code-there-numbers-here.md).

## 3. Write the frontmatter

```yaml
---
title: How much of an 8 GB card is actually mine        # 120 characters at most
dek: Between 1.4 and 2.9 GB of my GPU belongs to the desktop.   # 240 at most
date: 2026-10-06
updated: 2026-10-11          # optional; not before date
topic: observability         # orchestration | serving | streaming | observability | agents | platform
plan: vram-accounting        # an id in series.ts
repo: infinity-bench         # or NeuroMesh: where the harness code lives
hardware:
  kind: local                # or: kind: rented, node, provider, cost_usd
cost: "$0 · one evening"     # the line shown in orange
harness: "9f3c1a2"           # commit in `repo`; always quoted
data: vram-accounting        # the folder under data/
widgets: [vram]              # ids from site/src/lib/widgets.ts
corrections: []              # { date, text, credit? }, never dated before the post
draft: true
---
```

Quote `harness`. YAML reads `0000000` as a number and `1e34567` as infinity; the build rejects both.

## 4. What the build checks

A broken post fails `pnpm build` with the file and the reason:

| Check | Where |
| --- | --- |
| Every field above has the right type; rented hardware has `cost_usd` | `site/src/content.config.ts` |
| `updated` and every correction are on or after `date` | same |
| `plan` is an id in `series.ts`; no two published posts claim it | `site/src/lib/posts.ts` |
| Every id in `widgets` is registered | same |
| A published post's `data/<folder>/env.json` exists, `git.sha` matches `harness`, `git.repo` matches `repo` | same |
| Every `ResultsTable` file exists, has rows, and has the columns it names | `ResultsTable.astro` |

Drafts skip the `env.json` check and never reach a production build. `pnpm dev` shows them at
`/posts/<file name>`. `site/src/content/posts/_example.mdx` is a draft using every field and
component, backed by `data/_example/`.

## 5. Components

Posts use these without importing them. Paths are relative to the post's `data/<folder>/`.

**`ResultsTable`** renders a CSV at build time.

```mdx
<ResultsTable
  file="results.csv"
  caption="Deltas by process kill, three trials each."
  columns={{ label: 'Consumer', vram_mb: 'VRAM (MB)', note: 'Note' }}
  highlight={(row) => row.consumer_id === 'chrome'}
/>
```

`columns` picks, orders and renames; a value can also be `{ label, format: (v) => string }`.
Without `columns`, every column is shown as-is. Numeric columns are right-aligned.

**`PullQuote`**

```mdx
<PullQuote source="§2. Every post quotes the post-tax figure.">"8 GB" on the box means 5.7 GB for the model.</PullQuote>
```

**`VramAccount`** reads `consumer_id`, `label` and `vram_mb` from `results.csv`, the card size
from `env.json`, and weights from `site/src/data/models.yaml`. Props: `file`, `fixed` (consumers
that cannot be turned off, default `['dwm']`), `off` (unchecked at first), `model` (a `llama.cpp`
id from `models.yaml`), `workspaceMb` (default 600).

**`KvCalc`** reads the card size from this post's `env.json` and `desktop_tax_mb` from
`data/<taxFrom>/env.json` (default: this post's folder). Props: `taxFrom`, `model` (a `vllm` id),
`workspaceMb`.

A new widget goes in `site/src/components/widgets/`, gets an entry in `site/src/lib/widgets.ts`,
and is added to the component map in `site/src/pages/posts/[slug].astro`.

Code blocks take a language and optional line highlights:

````mdx
```bash {2,4}
kubectl -n infinity-bench attach -it harness
nvidia-smi --query-gpu=memory.used --format=csv,noheader
```
````

## 6. Numbers in prose

Every number in the text should be in a table or read from `env.json`, so the prose cannot drift
from the data. `models.yaml` sizes are published figures, not measurements: check them against the
download before a post relies on one.

## 7. Publish

1. Commit the harness change, rerun it from a clean tree, and set `harness` to the commit
   `env.json` records.
2. Set `draft: false`.
3. Bump the version and add a changelog entry ([CONTRIBUTING.md](../CONTRIBUTING.md)).
4. Read the post on the deployed site on a desktop and a phone before sharing it.

A correction later goes in `corrections`, with the date and, if a reader sent it, `credit`. It
shows in the post's changelog, on the Corrections page and in the status bar.
