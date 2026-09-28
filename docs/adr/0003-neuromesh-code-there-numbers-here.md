# ADR-0003: Posts about NeuroMesh keep their code there and their numbers here

- Status: Accepted
- Date: 2026-09-28
- Authors: Kokou Egbewatt

## Context

Most planned posts come out of [NeuroMesh](https://github.com/kokou-egbewatt/NeuroMesh), the AI
runtime built in its own repository, with its own `benchmarks/`, CI and release history. The site's
checks ([ADR-0002](0002-data-outside-the-site.md)) assume the data a post cites is in this
repository and that the post's `harness` commit produced it.

## Decision

A NeuroMesh post keeps its harness in NeuroMesh and its results here:

- The benchmark runs in NeuroMesh, from a clean tree.
- Its CSVs and `env.json` are copied into `data/<post>/` here, with `git.repo: NeuroMesh` and the
  NeuroMesh commit in `git.sha`.
- The post sets `repo: NeuroMesh` and `harness` to that commit, and the build checks both against
  `env.json` exactly as it does for local harnesses.
- The post's repo link and its environment block link the commit in NeuroMesh.

## Alternatives considered

- **Fetch CSVs from NeuroMesh at build time**: rejected. Every build would depend on the network and
  on a pinned commit per post, and "every number reproduces from here" would only hold loosely.
- **Duplicate the harness here**: rejected. Two copies of a benchmark diverge, and the one that runs
  in NeuroMesh's CI is the one that is right.

## Consequences

- The site's checks treat both repositories the same way; `repo` in frontmatter and `git.repo` in
  `env.json` are the only difference.
- Copying results is a manual step until an import target exists, which #1 lists as outside the
  first milestone. It should refuse a NeuroMesh tree with uncommitted changes.
- A correction to a NeuroMesh post may need a NeuroMesh commit, a new copy of the data, and a new
  `harness` value, together in one pull request here.
