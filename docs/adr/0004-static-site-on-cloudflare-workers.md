# ADR-0004: The site deploys to Cloudflare Workers as static assets, at kokou.dev

- Status: Accepted
- Date: 2026-10-15
- Authors: Kokou Egbewatt

## Context

The site was built for GitHub Pages, under `base: /infinity-bench` at
`kokou-egbewatt.github.io`, but nothing deployed it: CI built it and stopped. The blog now has its
own domain, `kokou.dev`, and the first post is close to publishing.

The site is plain files. Nothing on it needs a server at request time: posts, labs and tables are
all rendered at build time from `site/` and `data/` (ADR-0002). The repository is not the site
alone; it also holds harnesses, data and CI scripts, so the site lives in `site/`.

The AA Grace Counseling site already deploys this way, and it has worked without attention.

## Decision

Hosting is Cloudflare Workers with static assets, connected to this repository through Cloudflare's
Git integration. A push to `main` builds and deploys; a pull request gets a preview URL. The
Worker's root directory is `site/`. Cloudflare clones the whole repository, so `../data` is
present when the build reads it.

`site/wrangler.jsonc` carries the whole deployment: the Worker name, the build command, and an
`assets` block pointing at `dist/`. There is no `main`, so no Worker script exists and nothing runs
per request. `not_found_handling: "404-page"` serves the `404.html` Astro already builds.

The public address is `https://kokou.dev`, set once as `site` in `site/astro.config.mjs`, with no
`base`. Every internal link already goes through `url()`, so dropping the base changed no page.

## Alternatives considered

- **GitHub Pages**, the original plan: rejected. It needs a deploy workflow and a Pages
  environment in this repository, and it has no pull request previews. A post with animated
  figures and tables is worth reading on a phone before it merges, not after.
- **Cloudflare Pages**: rejected, narrowly. It serves this site just as well, but Cloudflare's own
  Pages documentation recommends starting new projects on Workers, and the counseling site already
  runs there. One platform, one way of deploying, one set of commands to remember.
- **A GitHub Actions job that runs `wrangler deploy` with an API token**: rejected. It puts a
  long-lived Cloudflare token in the repository's secrets for no gain over the Git integration,
  which needs no token here at all.
- **Moving the site to the repository root**: rejected. The repository's point is that the
  harnesses, the data and the site that renders them sit together (ADR-0002); the root directory
  setting handles the subfolder.

## Consequences

- No server to run and nothing to patch at runtime; hosting is free at this size.
- The Worker name in `site/wrangler.jsonc` must match the Worker in the Cloudflare dashboard, or
  the build fails. `previews` must exist, even empty, or `wrangler preview` refuses to run.
- The build lives in `site/wrangler.jsonc`, not in the dashboard, so `wrangler deploy` builds before
  it uploads and no setting outside the repository can break it. The dashboard's build command
  stays empty.
- CI's `site` job runs `pnpm deploy:check` (`wrangler deploy --dry-run`) in place of `pnpm build`:
  it builds exactly as the deploy does, so a broken deployment configuration fails the pull
  request rather than the deploy.
- Node comes from `site/.nvmrc`, read by both CI and Cloudflare, so the two cannot drift.
- The series page fetches issue states from GitHub at build time, now from Cloudflare's builders
  too. Unauthenticated, that is 60 requests an hour per address, shared with whoever else builds
  from that address. A failed fetch marks every status unknown and the page says so, rather than
  failing the build. A read-only `GITHUB_TOKEN` set as a build variable in the dashboard removes the
  limit.
- Links to `kokou-egbewatt.github.io/infinity-bench` that were shared before this change will not
  redirect. None were published.
