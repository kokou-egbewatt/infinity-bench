# infinity-bench

GPU infrastructure, measured on one consumer card: an RTX 5060 with 8 GB, running under WSL2. When a post uses rented hardware, it says which hardware and what it cost.

## Every number on the site reproduces from here

Each results table on the site is written by a harness in `bench/`, committed under `data/`, and rendered by the site in the same commit. To regenerate a post's table, run `make <post>`.

## Layout

```
infinity-bench/
├── .github/workflows/site.yml
├── bench/
│   ├── _lib/{capture_env.py, io.py, __init__.py}
│   ├── vram-accounting/{harness.py, config.yaml, README.md}
│   └── pyproject.toml, uv.lock
├── data/
│   └── vram-accounting/{results.csv, env.json}
├── docs/dev-machine.md
├── site/
│   ├── src/{content.config.ts, content/posts/, components/, layouts/, pages/, lib/, data/planned.yaml, styles/}
│   └── astro.config.mjs, package.json, tsconfig.json
├── Makefile
├── LICENSE, LICENSE-CONTENT, README.md
└── .gitignore, .gitattributes, .editorconfig
```

## Quickstart

Not ready yet. The Makefile lands in #11.

## License

Code is Apache-2.0. Writing, figures, and raw data are CC BY 4.0.

See [LICENSE](LICENSE) and [LICENSE-CONTENT](LICENSE-CONTENT).

## Site

https://kokou-egbewatt.github.io/infinity-bench/
