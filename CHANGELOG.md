# Changelog

All notable changes to infinity-bench are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Every merged pull request adds a version here, and `site/package.json` carries the same number;
`ci/scripts/version-gate.sh` enforces it and `ci/scripts/changelog-integrity.sh` checks the file's
structure.

## [Unreleased]

## [0.5.0] - Widgets (2026-09-28)

**The mock's two widgets, driven by the harness's files.** Rerunning a harness changes what a
widget shows without a code edit
([#8](https://github.com/kokou-egbewatt/infinity-bench/issues/8)).

### Added

- **`VramAccount`**: consumers and their MB from the post's `results.csv`, card size from its
  `env.json`, model weights from `models.yaml`. Shows what is taken before load, the weights, what
  is left, and the FP16 context that fits.
- **`KvCalc`**: model, KV dtype, concurrency, prompt and output tokens, and
  `gpu-memory-utilization`, against the desktop tax from `env.json`. Shows the pool, KV per token,
  what the sequences need, and the most that fit, with the formula printed under it.
- **`src/data/models.yaml`** as a `models` collection: weight sizes and the architecture fields the
  KV arithmetic needs. Sizes are published figures, flagged for checking against the download.
- **`src/lib/kv.ts`**: the arithmetic both widgets use, with Vitest tests.
- **Widget registry** (`src/lib/widgets.ts`) for the Labs page; an unknown id in a post's
  `widgets` fails the build.
- Plain TypeScript, no framework: each widget initialises when it scrolls into view, and a post
  with both ships about 3 KB of gzipped JavaScript. Every control has a label, ranges announce
  their value, results are in a live region, and focus is visible site-wide. axe reports no
  violations on either widget.

### Changed

- `noUnusedLocals` and `noUnusedParameters` are on, so dead code fails `pnpm check`.
- One source for repository URLs (`src/lib/issues.ts`), topics (`TOPICS`) and GB formatting
  (`src/lib/format.ts`); CSV and `env.json` reading shared by `ResultsTable`, the widgets and the
  build checks.
- `site/.gitignore` removed; the root `.gitignore` covers the site.

### Removed

- `getStats()`, unused until the status bar lands (#6); `computeStats()` stays with its tests.

## [0.4.0] - Post Components (2026-09-28)

**A post renders like the mock, and its tables come from the harness's files.** A missing or
empty CSV fails the build with the post and the path
([#7](https://github.com/kokou-egbewatt/infinity-bench/issues/7)).

### Added

- **Post layout** (`/posts/[slug]`): back link, title, dek, meta row (dates, read time, cost,
  repo or NeuroMesh commit, changelog), hardware block, prose, and a sticky sidebar with contents
  and the environment.
- **`ResultsTable`**: reads `data/<post>/<file>` at build time with `csv-parse`. Picks, renames and
  formats columns, right-aligns numbers, highlights rows; fails on a missing file, zero rows, an
  unknown column, or a path leaving the post's data folder. Posts use it without importing it.
- **`HardwareBlock`**: the local card with used and free VRAM from `env.json`, or the rented node in
  orange with provider and cost.
- **`EnvBlock`**: GPU, driver, CUDA, k3s and package versions from `env.json`, the harness commit
  linked in the post's repo, and a warning when the run came from uncommitted changes.
- **`PullQuote`** and **`Changelog`** (corrections newest first, then "Published").
- **Code blocks** highlighted by Shiki (`github-dark-dimmed`), `{2,4}` line highlights, line
  numbers from CSS counters, and a copy button that copies the code without them.
- **Contents** from the post's `##` headings plus the changelog, with the current section marked
  as you scroll.
- **`data/_example/`**: a CSV and `env.json` used only by the draft fixture, which now exercises
  every component in `astro dev`.

### Changed

- Read time is computed from the post body at 230 words a minute, ignoring tags and code.
- Dates are formatted in UTC everywhere, through `src/lib/format.ts`.
- The home page says the physics matches an H100 or H200, not only an H100.

## [0.3.0] - Post Content Schema (2026-09-28)

**Posts have a contract.** Frontmatter is typed, and a post that cites data it did not produce
fails the build instead of rendering wrong
([#5](https://github.com/kokou-egbewatt/infinity-bench/issues/5),
[#16](https://github.com/kokou-egbewatt/infinity-bench/pull/16)).

### Added

- **`posts` content collection** (`src/content.config.ts`) over `src/content/posts/**/*.mdx`, with
  a Zod schema for title, dek, dates, topic, hardware (local, or rented with provider and
  `cost_usd`), cost line, harness SHA, data folder, widgets, corrections and draft.
- **`plan` and `repo` fields.** A post claims an entry in `src/data/series.ts` by its `id`; `repo`
  says whether the harness lives in infinity-bench or NeuroMesh.
- **Build-time checks** in `src/lib/posts.ts`: an unknown or double-claimed `plan`, a missing
  `data/<post>/env.json`, and a `harness` or `repo` that disagrees with `env.json` all fail the
  build with the post's file and the reason.
- **`resolveSeries()`** attaches each published post to its plan entry; the Series and 404 pages
  read it.
- **`src/lib/stats.ts`** (post count, correction count, last measurement) with Vitest tests;
  `pnpm test` runs them.
- **Draft fixture** `_example.mdx` covering every field, so `astro check` sees the whole schema.
- **About profile card** with a photo, role and contact links.
- **CHANGELOG.md** covering every release so far.
- **CI workflow** (`.github/workflows/ci.yml`) on pull requests and `main`, with the version and its
  changelog entry in the job summary:
  - `ci/scripts/version-gate.sh`: a change under `site`, `bench`, `deploy`, `data`, `ci`,
    `.github` or the Makefile needs a version bump in `site/package.json` and a new changelog
    entry against `origin/main`.
  - `ci/scripts/changelog-integrity.sh`: no duplicate versions, newest first, no skipped
    versions, and the newest entry is the version in `site/package.json`.
  - `ci/scripts/check-doc-links.sh`: every relative link in a tracked Markdown file resolves
    inside the repository.

### Changed

- `series.ts` no longer takes `slug` or `published`; both come from the post that claims the
  entry. The twelve prioritised entries have ids.
- `harness` must be quoted in frontmatter: YAML reads SHAs such as `0000000` or `1e34567` as
  numbers.
- `/posts/[slug]` is generated from the collection; drafts render in `astro dev` only.

## [0.2.0] - Site Skeleton (2026-09-28)

**The site builds.** The approved single-file mock is now an Astro project with real routes, and
the lists that will hold posts render empty
([#4](https://github.com/kokou-egbewatt/infinity-bench/issues/4),
[#15](https://github.com/kokou-egbewatt/infinity-bench/pull/15)).

### Added

- **Astro 7 in `site/`**, TypeScript strict, MDX, RSS and sitemap, managed with pnpm 11
  (`packageManager` pinned, esbuild the only dependency allowed to run build scripts).
- **`base: /infinity-bench`** for GitHub Pages; every internal link goes through `url()` in
  `src/lib/url.ts`, so a custom domain is a one-line change.
- **Design tokens and layout CSS** from the mock; Newsreader, Inter and IBM Plex Mono self-hosted
  through Fontsource.
- **`BaseLayout`** with canonical, Open Graph and Twitter tags, a status bar, a sticky header with
  the active route, and a footer.
- **Routes:** `/`, `/posts/[slug]`, `/series`, `/labs`, `/corrections`, `/about`, `/404`,
  `/rss.xml`.
- **Series page** built from `src/data/series.ts`: every series and planned post with the
  NeuroMesh and infinity-bench issues it is written from. Status (ready, waiting, rented, no
  issue yet) is derived from issue states fetched from GitHub at build time, and the page says so
  when the fetch fails.
- **404 page** in the NeuroMesh gateway's error shape, suggesting the closest routes and posts.

### Changed

- Six topics: orchestration, serving, streaming, observability, agents, platform.
- "Writing" is now "Posts"; the About page is rewritten; contact email updated.
- The rig card and About say k3s, not minikube, and CUDA 13.4. The rig shows 8 GB nominal until
  the first harness measures what the desktop takes.
- NeuroMesh is linked under Elsewhere.

## [0.1.0] - Repo Hygiene (2026-09-28)

**Before any real files land.** Line endings are pinned for a repo edited from Windows and WSL2,
and code and content carry different licenses
([#3](https://github.com/kokou-egbewatt/infinity-bench/issues/3),
[#14](https://github.com/kokou-egbewatt/infinity-bench/pull/14)).

### Added

- **`.gitattributes`**: LF everywhere, binaries marked; the tree was renormalised.
- **`.gitignore`** for the site, Python, model weights and raw harness output.
- **`.editorconfig`**: LF, final newline, two spaces for web files, four for Python, tabs for the
  Makefile.
- **`LICENSE-CONTENT`**: CC BY 4.0 for writing, figures and data, next to the Apache-2.0
  `LICENSE` for code.
- **README** in the house layout, with license badges.

[0.5.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/18
[0.4.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/17
[0.3.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/16
[0.2.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/15
[0.1.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/14
