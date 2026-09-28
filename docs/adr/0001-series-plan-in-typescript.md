# ADR-0001: The series plan is TypeScript, and posts claim entries by id

- Status: Accepted
- Date: 2026-09-28
- Authors: Kokou Egbewatt

## Context

The Series page shows every planned post, grouped by series, with the NeuroMesh and infinity-bench
issues each one is written from, and a status derived from those issues: ready, waiting, needs
rented hardware, or no issue yet. The first plan (#5 as written) was a flat `planned.yaml` of
`{ week, title, topic, rented }`, loaded as a content collection.

By the time #5 started, `site/src/data/series.ts` already existed and did more than that file
could: series contain posts, a post's sources are either an issue or a document such as an ADR, and
the status rule sits next to the data it reads. It also recorded publication by hand, with `slug`
and `published` on the entry, which repeated what the post's own frontmatter says.

## Decision

The plan stays in `series.ts`. Entries a post may be written from get a stable `id`, and a post
claims one with `plan: <id>` in its frontmatter.

Publication is never typed in `series.ts`. `resolveSeries()` in `site/src/lib/posts.ts` attaches
each published post to the entry it claims, and the Series and 404 pages read the result, so the
link and the date come from the post.

The build fails when a post's `plan` is not an id in `series.ts`, or when two published posts claim
the same one. A draft may claim an entry a published post also claims.

## Alternatives considered

- **`planned.yaml` as a content collection**: rejected. Nested series and a union of source types
  need a Zod schema that repeats the TypeScript types, the `nm()`/`ib()` shorthands are lost, and
  mistakes surface at build time instead of in the editor. The file has one editor, who works in
  VS Code.
- **Keep `slug` and `published` in `series.ts`**: rejected. Two places to record one fact drift
  apart, and nothing would catch an entry pointing at a post that was renamed or unpublished.
- **Order posts by a `week` field**: rejected. `series.ts` orders series and entries itself, and
  `priority` marks what comes next without promising dates.

## Consequences

- Changing the plan is a commit, checked by `pnpm check`.
- Only the twelve prioritised entries have ids so far; the rest get one when a post is written from
  them.
- Every page that shows a status goes through `resolveSeries()`.
