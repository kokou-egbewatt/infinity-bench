# ADR-0002: Harness data lives in `data/`, outside the site, and is read at build time

- Status: Accepted
- Date: 2026-09-28
- Authors: Kokou Egbewatt

## Context

The site's promise is that every number reproduces from the repository. A results table typed into
a post, or a CSV copied into the site's source tree, can drift from what the harness produced with
nobody noticing. The harnesses (Python, run on the local k3s cluster) and the site (Astro) are
separate toolchains that meet at one boundary: the files a run writes.

## Decision

Each harness writes `data/<folder>/` at the repository root: one CSV per table and an `env.json`
recording what produced it (commit, repository, GPU, driver, CUDA, cluster, package versions, and
measured constants such as `desktop_tax_mb`). A post names its folder with `data:`.

The site reads these files during the build, never at runtime, and never copies them into `site/`:

- `ResultsTable` renders a CSV, and fails the build when the file is missing, empty, lacks a column
  it names, or lies outside the post's folder.
- Widgets take their constants from the same CSVs and `env.json`, so rerunning a harness changes a
  widget without a code edit.
- For every published post, the build requires `env.json`, with `git.sha` matching the post's
  `harness` and `git.repo` matching its `repo`.

The path is resolved from the site's working directory (`site/src/lib/paths.ts`), because built
chunks move and `import.meta.url` no longer points at the source tree.

## Alternatives considered

- **Data inside `site/src/data/` or `site/public/`**: rejected. It puts harness output inside
  another toolchain's tree, invites hand edits, and blurs the license boundary: `data/` is CC BY 4.0
  (`LICENSE-CONTENT`), the site's code Apache-2.0.
- **Fetch data at runtime**: rejected. A page could show numbers from a different commit than its
  text, and the site would stop being a static build.
- **Import CSVs through Vite**: rejected. A missing file becomes a bundler error without the post
  and path, and parsing CSV would need a plugin for one use.

## Consequences

- The build needs the repository layout: it runs from `site/` with `data/` beside it, locally and in
  CI.
- Harness output is reviewed as a diff in the same pull request as the post that cites it.
- `data/_example/` exists only for the draft fixture; published posts never use it.
