# Changelog

All notable changes to infinity-bench are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Every merged pull request adds a version here, and `site/package.json` carries the same number.

## [Unreleased]

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

[0.3.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/16
[0.2.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/15
[0.1.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/14
