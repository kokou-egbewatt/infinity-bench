# Changelog

All notable changes to infinity-bench are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Every merged pull request adds a version here, and `site/package.json` carries the same number;
`ci/scripts/version-gate.sh` enforces it and `ci/scripts/changelog-integrity.sh` checks the file's
structure.

## [0.9.0] - Reads on a phone (2026-10-28)

**The nav fits one row and the text column is centred.** The header hid six links and three icons
behind nothing on a phone, so it wrapped to three rows; the narrow pages sat against the left edge
of a wrapper almost twice their width.

### Added

- **A menu button in the header below 860px.** It opens the full nav, closes on Escape, on a link
  and on a tap outside, and its links are 38px tall. The button is hidden until the script unhides
  it, so without JavaScript the nav stays inline and wraps as before.

### Changed

- **The Series page splits the plan from what shipped.** The series accordion takes the 640px
  column, because its summary row carries a title, a count line and up to seven status dots on one
  line and stops fitting them at 400px. Recently published and Next up take the 400px column
  beside it. They come first in the markup, so a phone reads what exists before what is planned
  while a wide screen still reads left column then right. `.plan` also picks up the
  `margin-inline: auto` it never had, so the page is no longer pinned to the left of the wrapper.

- **The About page puts the core stack beside the prose.** 640px of text and a 400px column, so
  the prose keeps the measure the rest of the site uses and the page stops running twice as long
  as it needs to. Each role now sits above its own badges at every width rather than beside them:
  the label took 170px of the line, which left the longest badge, NVIDIA GPU Operator at 176px,
  nowhere to go. The two columns stack below 1080px, where neither would be at its measure.

- **The rig card follows the home page down.** The page is one grid now, an intro and the posts
  list in a column beside a rail the card sticks to, so the list no longer runs the full width
  underneath where the card used to be. On a phone the card still sits under the intro and is read
  in full; once it scrolls away a 36px strip takes over under the header, carrying the VRAM bar,
  and opens the same rows on a tap. The card itself never moves, so nothing jumps, and only one of
  the two is in the accessibility tree at a time.

- **The post's reading column is centred.** `.post` is `1fr minmax(0, 640px) 1fr` with the
  contents in the third track, so the text is centred at every width instead of sitting 176px left
  of it. The wrapper is 1200px, which is what gives the contents a usable 200px.
- **`.simple` pages are centred**: About, Labs, Changelog, Errata and the 404 page, which were
  640px columns pinned to the left of a 1040px wrapper. The lab pages are capped at 900px rather
  than stretching across the full width.
- **Anchors and the sticky contents follow the header height** through `--hdr`, rather than a
  96px offset fixed for a header that is 52px tall on a phone.
- **The header background is `var(--bg)`** through `color-mix`, not a hard-coded rgba.
- **A 16px gutter below 600px**, down from 24px, which gives the result tables that much more room.
  Figures bleed to the new edge.
- **The status bar keeps the post counts on phones** and drops the hardware string, which was
  ellipsised to nothing anyway and is on the home page.
- **CI runs in two jobs rather than three.** The documentation links check moves in beside the
  version and changelog gates, which need no Node either, and every step after the first is
  guarded with `!cancelled()` so a failing gate no longer hides the ones behind it. Taken from
  the AA Grace Counseling site, whose pipeline this one is otherwise a copy of.
- **Prettier and ESLint run in CI and in `pnpm verify`**, with the same configuration as that
  site: `eslint-plugin-astro` with its accessibility rules, and Prettier at 100 columns with
  single quotes. The stylesheets, the generated figure components and the post itself are left
  out, because the first is written one rule per line on purpose, the second is rebuilt by
  `build.py`, and the third is prose.

## [0.8.0] - Live at kokou.dev (2026-10-28)

**The site deploys to Cloudflare at kokou.dev.** It deploys the way the AA Grace Counseling site
does: Cloudflare's Git integration builds and deploys on every push, with a preview URL for every
pull request, and the whole configuration lives in the repository
([ADR-0004](docs/adr/0004-static-site-on-cloudflare-workers.md)).

### Added

- **`site/wrangler.jsonc`**: Worker `infinity-bench`, static assets from `dist/`, the 404 page for
  unmatched paths, the build command, and an empty `previews` block for pull request previews.
- **`pnpm deploy:check`** (`wrangler deploy --dry-run`) and **`pnpm verify`**, with `wrangler` as a
  dev dependency; `workerd` is kept from running install scripts, since deploying assets never
  needs it.
- **`site/.nvmrc`**, read by CI and by Cloudflare's build.
- **ADR-0004** and a Deploy section in the README with the dashboard settings and a launch list.
- **A Changelog page** at `/changelog`: every post published, updated or corrected and every new
  lab, newest first, with chips to filter by kind. Changes to the site's code stay in this file.
- **`changes`** in post frontmatter, `{ date, text }`, for updates that are not errors. They show
  in the post's changelog and on the Changelog page.

### Changed

- **`site` is `https://kokou.dev`, with no `base`.** Pages, the sitemap and the RSS feed serve
  from the root; `url()` already carried every internal link, so no page changed.
- **CI's `site` job runs `pnpm deploy:check`** in place of `pnpm build`, and takes Node from
  `site/.nvmrc`.
- **The dev server is at `http://localhost:4321/`**, and the correction form's example link points
  at `kokou.dev`.
- **The menu starts with About**, then Posts and Series; the footer follows the same order.
- **GitHub, LinkedIn and email are icons**, in the header and under the name on the About page,
  from one `SocialIcons` component.
- **The About page's core stack is badges**, grouped by what each tool does, each linking to the
  project.
- **Corrections are errata, as in a journal.** The page is `/errata`, the frontmatter field is
  `errata`, and the status bar and post list count errata. Each post's changelog now lists its
  updates and labs too, with errata marked.
- **Header and footer carry Labs, Errata and Changelog**, and the repeated inline social SVGs
  became one `SocialIcons` component.
- **The home page's opening paragraph and the About page are rewritten**, plainer and without the
  editorial "we".
- **The runner fleet harness takes the fleet's name as `PROJECT`** instead of hardcoding it. The
  committed scripts were sanitised to `runner-fleet`, which is still the default, but that meant
  they matched nothing on a fleet named anything else: `meta.sh` recorded no containers, the memory
  summaries matched no rows, and `cache.sh cold` removed no volumes and produced a warm run wearing
  a cold label. `cache.sh` now refuses a cold run when no volume matches the prefix, so that failure
  cannot be silent again.
- **`latency.sh` fails rather than record a short sweep.** `gh run watch` returns early on a
  transient error, and the job query kept only jobs that had already succeeded, so a job still in
  flight was dropped and the CSV came up a sample short of the runs dispatched. The samples at risk
  are the ones slowest to land, so a short sweep can report a better tail than it measured. It now
  waits for every job in a run to land and exits non-zero if they do not.
- **`cache.sh` passes `LIGHT` through to the fleet** when it is set, so a cold round brings the
  fleet back up in the shape it was measured in. Without it the Makefile default took over and
  shrank the fleet midway through a measurement.
- **`cache.sh` waits for a re-run to finish before recording it.** `gh run watch` returns early on
  a transient error, and an unfinished job has a null `completed_at`, which made the timings a jq
  error on a line whose status `tee` hid: the cycle recorded nothing and the round was quietly a
  cycle short. It also notes that from fleet 0.5.6 the tool cache is per runner and seeded by the
  image, so a cold run no longer re-downloads the pinned toolchains and cold setup times are not
  comparable across that version.
- **The runner fleet post carries re-measured numbers and per-dataset provenance.** All six pickup
  latency targets were run again on the corrected harness and reproduced the published figures, so
  those tables are the October ones. The memory table is new, measured on fleet 0.5.6 with six light
  runners and three dind pairs. The cold-versus-warm numbers stay as measured on 0.5.4, because
  0.5.6 moved the tool cache into the image and a cold run there no longer re-downloads the pinned
  toolchains. `env.json` now records what each dataset was taken on, in `fleet.measured_on`, rather
  than one environment standing for all three, and the provenance line no longer reports a run from
  uncommitted changes.
- **The post said the Docker VM has 12 threads.** It has 10, which the post's own `env.json` had
  recorded all along. The host has 12; the VM is given 10.
- **`FleetSizing` takes the pickup line's runner count from the run that produced it.** The fleet has
  six light runners now and `latency.csv` was measured on four, so the widget had started reading
  "8 jobs on 6 runners" beside a p95 measured with four of the eight queued.
- **The harness README says how to take the fleet back down to two dind pairs.** The pairs are compose
  profiles, so `up DIND=2` only ever adds: the third pair keeps running, and holding its memory,
  until it is removed by name.
- **Raw harness output is filed one folder per run**, `data/gha-runners/<date>/`, so re-measuring a
  target never lands on an earlier campaign's file. The scripts default the folder to today in UTC
  and take `RUN` to add to an existing one. The summaries the post and the lab read stay a level up,
  because the three datasets are not all from one campaign, and a new
  `data/gha-runners/README.md` says which run each came from.
- **The 28 October reproduction is committed** next to the October campaign it checks, including the
  one dind sweep that did not reproduce and the re-run that did, with what is and is not known about
  why. `env.json` names the folder each dataset came from.
- **Section 1 no longer credits branch protection** for stopping anything merging without a passing
  CI. Branch protection needs a paid plan for private repositories, and the lapsed billing that
  blocked the runners is the same lapse that would have removed it. Not merging on red is a rule kept
  by hand, which is what the section now says.

### Removed

- **`/corrections`**, replaced by `/errata`. The site was never deployed at that path, so nothing
  redirects.

## [0.7.0] - CI Runners (2026-10-13)

**A post can be measured with the GPU idle.** Platform posts get a hardware kind of their own, and
the first of them lands as a draft while its harness is still to be written
([#23](https://github.com/kokou-egbewatt/infinity-bench/issues/23),
[#24](https://github.com/kokou-egbewatt/infinity-bench/pull/24)).

### Added

- **`kind: cpu` hardware** with a required `host` string, for posts measured on the desktop with
  the card idle. `HardwareBlock` draws a CPU die and records that the 5060 sat idle; home rows read
  `no GPU` instead of `RTX 5060`.
- **`ci-runners` series**: the runner fleet post, and a planned runner lab with a public copy of
  the Compose file. The runner repository is private, so the series cites the harness here rather
  than linking issues in it.
- **The runner fleet post**, published: a Docker daemon per runner so parallel jobs stop colliding
  on fixed host ports, a registrar container so no job can read the GitHub App key, and what
  `privileged: true` still costs. Section 10 reads the measured CSVs, and the env block says the
  numbers were captured from an uncommitted tree until the harness is re-run from a clean one.
- **The namespace pairs figure** for that post, stacking to one column under 760px.
- **An SM grid** on the home page's rig card: 30 cells for the card's 30 SMs, a few drifting on. A
  picture of the chip, not a readout.
- **A `site` CI job** running `pnpm check`, `pnpm test` and `pnpm build`. The three `ci/scripts`
  checks never touched the site, so a post that broke the build could merge green
  ([#12](https://github.com/kokou-egbewatt/infinity-bench/issues/12)).

### Changed

- `EnvBlock` falls back to the host OS and distro when `env.json` records no GPU.
- Markdown tables in a post are set in sans, not the mono `ResultsTable` uses for measurements, and
  scroll in place on a narrow screen.
- Home page rows fade in, staggered to the eighth row. Both it and the SM grid honour
  `prefers-reduced-motion`.
- The rig card's arch line names `sm_120` and the SM count.
- **Drafts show in the home list under `pnpm dev`**, with a draft badge. They were filtered out
  there too, so a draft had no link anywhere and the list read "Nothing here yet". Production is
  unchanged.

### Removed

- **The `_example.mdx` draft fixture and `data/_example/`.** It was the only post exercising
  `ResultsTable`, `VramAccount`, `KvCalc`, `corrections` and `widgets`, so `astro check` no longer
  type-checks those through a post until a real one uses them. `docs/writing-a-post.md` and
  [ADR-0002](docs/adr/0002-data-outside-the-site.md) no longer point at it.

## [0.6.0] - Pages From Post Data (2026-09-28)

**Every list on the site is built from the posts.** One correction in one post's frontmatter
changes its changelog, its row, the Corrections page and the status bar
([#6](https://github.com/kokou-egbewatt/infinity-bench/issues/6),
[#21](https://github.com/kokou-egbewatt/infinity-bench/pull/21)).

### Added

- **Post rows** on the home page: date, title, dek, `RTX 5060` or the rented node in orange, a
  `NeuroMesh` link for posts whose code lives there, read time, and corrections in orange. The whole
  row opens the post.
- **Topic filters** as `?topic=` links. A small script hides other topics; without it, every post
  shows and each link reloads.
- **Corrections page**: every correction, newest first, with credit and a link to the post's
  changelog, and a link to the correction issue form.
- **Labs page**: every registered widget, linked to its post once published, otherwise marked
  planned.
- **Status bar**: post count, correction count and the last measurement date.
- **RSS**: published posts with title, dek, date and link.
- **`src/data/elsewhere.yaml`** for the home page's Elsewhere list.

### Changed

- The rig card's VRAM bar reads `data/vram-accounting/env.json` once it exists, and shows 8 GB
  nominal until then.
- `[hidden]` always hides, even on elements that set their own `display`.

## [0.5.1] - Docs and Issue Forms (2026-09-28)

**The rules the build enforces are written down, and readers have a way in**
([#20](https://github.com/kokou-egbewatt/infinity-bench/issues/20),
[#19](https://github.com/kokou-egbewatt/infinity-bench/pull/19)).

### Added

- **`docs/writing-a-post.md`**: plan ids, data folders, frontmatter, what the build checks, the
  components and their props, and the steps to publish.
- **`CONTRIBUTING.md`**: readers report corrections and request topics through issues; pull
  requests are not taken. Below that, notes for working on the repo: setup, the dev loop, the CI
  checks, versioning.
- **Issue forms** for a correction (page, what is wrong, evidence, how to be credited) and a topic
  request, with `correction` and `topic-request` labels.
- **ADRs** in `docs/adr/`: [0001](docs/adr/0001-series-plan-in-typescript.md) the series plan in
  TypeScript, [0002](docs/adr/0002-data-outside-the-site.md) data outside the site,
  [0003](docs/adr/0003-neuromesh-code-there-numbers-here.md) NeuroMesh code there, numbers here.

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

[0.9.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/26
[0.8.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/24
[0.7.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/24
[0.6.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/21
[0.5.1]: https://github.com/kokou-egbewatt/infinity-bench/pull/19
[0.5.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/18
[0.4.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/17
[0.3.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/16
[0.2.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/15
[0.1.0]: https://github.com/kokou-egbewatt/infinity-bench/pull/14
