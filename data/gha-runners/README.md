# Runner fleet data

The numbers behind [the runner fleet post](../../site/src/content/posts/my-desktop-as-a-github-actions-runner-fleet.mdx).
The harness that produced them is in [`bench/gha-runners/`](../../bench/gha-runners/README.md).

The files at this level are the tables the post and the lab read. Each dated folder is one
measuring run, with the raw per-job and per-step rows it produced. The three datasets were not all
taken on the same day or on the same fleet, and [`env.json`](env.json) records what each one was
taken on, under `fleet.measured_on`.

| File | What it is | From |
| --- | --- | --- |
| `latency.csv` | Pickup latency, p50/p95/max per class and width | `2026-10-15/` |
| `cache.csv`, `cache-steps.csv` | Cold versus warm, whole job and per step | `2026-10-15/` |
| `memory.csv` | Peak memory per container under the heaviest dind jobs | `2026-10-28/` |

## 2026-10-15

The first campaign, run on 14 and 15 October 2026 (UTC) on fleet 0.5.4, with 4 light runners and
2 dind pairs. Everything the post publishes except memory comes from here: the six latency targets,
both cold-versus-warm rounds, and `logs/`, which holds the job logs the per-step tables were read
from. `memory-dind3.csv` is this campaign's memory sample, which the 28 October run superseded.

## 2026-10-28

A re-measurement on fleet 0.5.6, with 6 light runners and 2 dind pairs, after three bugs were fixed
in the harness. `memory-dind3.csv` is the run the published `memory.csv` comes from, taken with a
third dind pair brought up for it.

`latency.csv` here is the reproduction, not a published table. All six targets matched the October
figures to within a second, except `fleet-light` at width 8: six idle runners rather than four
leave two of the eight jobs queued rather than four, so p95 reads 13 s against 11 s.

`latency-fleet-dind-w4.csv` is kept because it is the one sweep that did not reproduce, at p50 10 s
and p95 252 s. In two of its ten runs every job landed on one of the two dind runners while the
other served nothing for about eight minutes, so one runner serialised four jobs. No container had
restarted or run out of memory, nothing else was running on the fleet, and the Docker daemon keeps
no events that far back, so the cause is not known. `latency-fleet-dind-w4-rerun.csv` is the same
target run again straight afterwards: 20 jobs on each runner, p95 11 s, and it is the file the
summary above uses.
