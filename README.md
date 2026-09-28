<!-- markdownlint-disable MD033 -->

<h1 align="center">Infinity Bench</h1>

<p align="center">
  <i>Every number on the site reproduces from here. One consumer GPU, one Makefile target per table.</i><br><br>

<!-- License Badges -->

<a href="https://github.com/kokou-egbewatt/infinity-bench/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/code-Apache--2.0-blue" alt="Code: Apache-2.0">
  </a>

<a href="https://github.com/kokou-egbewatt/infinity-bench/blob/main/LICENSE-CONTENT">
    <img src="https://img.shields.io/badge/content-CC%20BY%204.0-lightgrey" alt="Content: CC BY 4.0">
  </a>
</p>

## About

**Infinity Bench** is a blog about GPU infrastructure, measured on one consumer card: an RTX 5060 (8 GB) under WSL2. When a post uses rented hardware, it names the hardware and states the cost.

- Each results table is written by a harness in `bench/`, not typed by hand
- Raw results and the captured environment are committed under `data/`, in the same commit as the post
- `make <post>` regenerates a post's table from scratch
- CI fails if a table's CSV goes missing
- Live site: <https://kokou-egbewatt.github.io/infinity-bench/>
