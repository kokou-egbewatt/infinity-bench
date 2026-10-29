<!-- markdownlint-disable MD033 -->

<h1 align="center">Infinity Bench</h1>

<p align="center">
  <i>Every number on the site reproduces from here. One harness per table, committed with the post that cites it.</i><br><br>

<!-- License Badges -->

<a href="https://github.com/kokou-egbewatt/infinity-bench/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/code-Apache--2.0-blue" alt="Code: Apache-2.0">
  </a>

<a href="https://github.com/kokou-egbewatt/infinity-bench/blob/main/LICENSE-CONTENT">
    <img src="https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey" alt="Content: CC BY 4.0">
  </a>
</p>

## About

**Infinity Bench** is my blog about software and platform engineering, most of it around GPU infrastructure. I write about the things that only show up when you run the hardware yourself: memory pressure, KV-cache sizing, scheduler behaviour, what a runtime actually costs. Some posts never touch the GPU at all and are plain platform work.

The rule the repository exists to enforce is that nothing on the site is a number I remembered. A post cites a table, the table is a CSV, and the CSV was written by a harness that is in this repository and runs again.

- Each results table is written by a harness in `bench/`, not typed by hand
- Raw results and the captured environment land in `data/`, in the same commit as the post that cites them
- Every post names the hardware that produced its numbers, what it cost, and what I got wrong
- The build fails if a post cites a CSV that is missing, or an environment that disagrees with the post's frontmatter
- Live site: <https://kokou.dev>

Most measurements come from one consumer card, an RTX 5060 with 8 GB under WSL2. When a post rents hardware instead, it says so and states the bill. The physics is the same as an H100's; the fuse is shorter.

## Layout

| Path | What |
| --- | --- |
| `site/` | The Astro site: posts, components, widgets, pages |
| `bench/` | One folder per post, holding the harness that produced its numbers and a README on running it |
| `data/` | What the harnesses wrote: a CSV per table, plus `env.json` recording the machine and the commit |
| `docs/` | [Writing a post](docs/writing-a-post.md), and [ADRs](docs/adr/README.md) for the choices that shaped the repository |
| `ci/scripts/` | The checks CI runs over tracked files: version gate, changelog integrity, link resolution |

The split between `bench/`, `data/` and `site/` is deliberate and written down in [ADR-0002](docs/adr/0002-data-outside-the-site.md): harness output lives outside the site and is read at build time, so a table cannot drift from the run that produced it.

## Reproducing a number

Each harness is a folder under `bench/` with its own README, and the scripts run from the repository root. The runner fleet post, for example:

```sh
cat bench/gha-runners/README.md
```

That README says what each script measures, what it needs installed, and where the results go. Run `meta.sh` alongside any measurement and keep its output with the CSVs, so the numbers carry the machine that produced them.

If your numbers disagree with mine, that is worth knowing. Open an issue with your CSVs and I will say so in the post.

## Working on the site

```sh
cd site
pnpm install --frozen-lockfile
pnpm dev
```

[CONTRIBUTING.md](CONTRIBUTING.md) has the rest: the dev loop, the checks CI runs, and how versions and the changelog work. Writing a post has its own guide in [docs/writing-a-post.md](docs/writing-a-post.md).

This is a personal blog, so I don't take pull requests. Corrections and topic requests go through [issues](https://github.com/kokou-egbewatt/infinity-bench/issues/new/choose), and a correction that lands gets credited in the [Errata](https://kokou.dev/errata).

## Licenses

Code is [Apache-2.0](LICENSE). The writing, figures and data are [CC BY 4.0](LICENSE-CONTENT).
