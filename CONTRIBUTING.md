# Contributing

This is a personal blog: I write the posts and the code, and I don't take pull requests. You can
still change what gets published, through an issue.

- **Something is wrong.** A number, a claim, a broken page. [Report a
  correction](https://github.com/kokou-egbewatt/infinity-bench/issues/new?template=correction.yml).
  If I agree, the post gets fixed, its changelog says what changed, and you are credited in the
  Errata unless you'd rather not be.
- **Something you'd like measured or explained.** [Request a
  topic](https://github.com/kokou-egbewatt/infinity-bench/issues/new?template=topic.yml). Planned
  posts are on the Series page; a request that fits one gets linked to it.

Anything else, open a [blank issue](https://github.com/kokou-egbewatt/infinity-bench/issues/new).

---

## Notes for working on the repo

### Setting up

The site lives in `site/` and uses [pnpm](https://pnpm.io), pinned through `packageManager` in
`site/package.json`. Node comes from `site/.nvmrc`, which CI and Cloudflare both read.

```sh
cd site
pnpm install --frozen-lockfile
```

pnpm only lets packages listed under `allowBuilds` in `site/pnpm-workspace.yaml` run install
scripts. If a new dependency needs one, run `pnpm approve-builds <package>` and commit the change.

On Windows, run everything from Git Bash. Line endings are LF everywhere (`.gitattributes`); an
editor that honours `.editorconfig` keeps them that way.

### The loop

| Command | Does |
| --- | --- |
| `pnpm dev` | Dev server at `http://localhost:4321/`, drafts included |
| `pnpm check` | `astro check`: types, props, and unused locals or parameters |
| `pnpm test` | Vitest |
| `pnpm build` | Production build into `site/dist/`; drafts left out, every post checked |
| `pnpm preview` | Serves `site/dist/` |
| `pnpm deploy:check` | `wrangler deploy --dry-run`: builds as Cloudflare does, then checks the deployment |
| `pnpm verify` | Everything the `site` job runs, in the same order |

Writing a post has its own guide: [docs/writing-a-post.md](docs/writing-a-post.md).

### Checks CI runs

`.github/workflows/ci.yml` runs on every pull request and on `main`. Each step is a script that
runs from the repository root:

```sh
bash ci/scripts/version-gate.sh         # shipped files changed => version bump + changelog entry
bash ci/scripts/changelog-integrity.sh  # no duplicates or gaps, newest first, matches package.json
bash ci/scripts/check-doc-links.sh      # every relative Markdown link resolves
```

The `site` job then runs `pnpm check`, `pnpm test` and `pnpm deploy:check` in `site/`. The last is
`wrangler deploy --dry-run`, which builds through the `build` block in `site/wrangler.jsonc` and
then checks the deployment, so CI takes the same path Cloudflare does. There is no separate
`pnpm build` step: it would build the site twice.

### Deploying

Nothing in this repository deploys the site. Cloudflare's Git integration builds it: a push to
`main` deploys, and a pull request gets a preview URL
([ADR-0004](docs/adr/0004-static-site-on-cloudflare-workers.md)). CI only runs `pnpm deploy:check`,
so a broken deployment configuration fails the pull request instead of the deploy.

`site/wrangler.jsonc` holds the deployment, the build included, so it is reviewed like any other
file and no dashboard setting can drift from it. The Worker's **Settings, Build** needs a root
directory, two commands and no build command:

| Field | Value |
| --- | --- |
| Root directory | `site` |
| Build command | *leave empty* |
| Deploy command | `npx wrangler deploy` |
| Preview command | `npx wrangler preview` |

Cloudflare clones the whole repository, so the build still reads `../data`, and it installs
dependencies before either command runs, reading the package manager from `packageManager` and the
Node version from `site/.nvmrc`.

### Versions and the changelog

Every merged pull request adds a version to [CHANGELOG.md](CHANGELOG.md), and `site/package.json`
carries the same number. The gate compares against `origin/main`: a change under `site`, `bench`,
`deploy`, `data`, `ci`, `.github` or the Makefile needs both.

- Minor (`0.5.0` to `0.6.0`) for anything a reader can see or a post can use.
- Patch (`0.5.0` to `0.5.1`) for fixes and docs.
- One step from the previous entry; the integrity check rejects a skipped version.

Each entry has a bold one-line summary, then Added, Changed and Removed, with the issue and pull
request linked.

### Branches and pull requests

- Branch from `main` as `dev/kokou/<topic>`.
- One issue per pull request, titled like the issue, with `Closes #N` in the body.
- Squash fix-ups into the commit they fix before merge.

### Decisions

Choices that shape the repository are recorded in [docs/adr/](docs/adr/README.md). Add one when a
choice would surprise me reading the code in a year, or when an obvious alternative was rejected.
