# Runner fleet benchmarks

How the numbers in [the runner fleet post](../../site/src/content/posts/my-desktop-as-a-github-actions-runner-fleet.mdx)
were measured, so you can measure them again. Results go to [`data/gha-runners/`](../../data/gha-runners/),
which the post reads. If yours disagree with mine, open an issue with your CSVs and `meta.sh` output.

Needs bash, [gh](https://cli.github.com/) logged in with `repo` and `workflow` scope, and docker on the
fleet's host. No jq or Python: `gh --jq` and awk do the parsing. Run everything from the repository root. On Windows, run under Git Bash with `MSYS_NO_PATHCONV=1`, or it rewrites docker
arguments that look like paths, such as `--tmpfs /m` and `-w /w`.

## What is measured

| Number | Script | How |
| --- | --- | --- |
| Job pickup latency, p50 and p95 | `latency.sh`, `summarize.sh` | `started_at` minus `created_at` for a do-nothing job, from the Actions API |
| Cold versus warm cache | `cache.sh`, `cache-summary.sh` | one job re-run on a fixed commit, per-step times from the API |
| Host memory, three dind pairs | `memory.sh`, `memory-summary.sh` | `docker stats` per container plus the VM's own `/proc/meminfo`, peaks |

Run `meta.sh` alongside every measurement and keep its output with the results.

## Naming your fleet

The scripts read container, volume and image names from one variable, `PROJECT`, which is the
fleet's Docker Compose project name. It defaults to `runner-fleet`, which is what the committed
CSVs were sanitised to. If your fleet runs under another name, pass it:

```bash
PROJECT=my-ci bench/gha-runners/meta.sh
PROJECT=my-ci bench/gha-runners/memory.sh
PROJECT=my-ci bench/gha-runners/memory-summary.sh data/gha-runners/memory-dind3.csv
PROJECT=my-ci FLEET=/path/to/fleet bench/gha-runners/cache.sh cold owner/repo <run_id> <job>
```

`docker compose ls` prints the name. Getting it wrong used to be silent: `meta.sh` recorded no
containers, the memory summaries matched nothing, and worst of all `cache.sh cold` removed no
volumes and produced a warm run labelled cold. `cache.sh` now refuses to start a cold run when no
volume matches the prefix. Re-running an existing summary needs the same `PROJECT` the CSV was
recorded under, which for the committed ones is the default.

## Pickup latency

`latency.sh` dispatches [`probe.yml`](probe.yml), which has to live in `.github/workflows/` of a repository
the runners serve, on its default branch. It is kept here and not in this repository's workflows, where it
would only ever meet GitHub-hosted runners. My fleet serves only the private repositories in its runner group,
so I commit it to one of them for the sweep and delete it afterwards, rather than leave a foreign workflow in
a repository that is not mine to decorate. I used `acme/identity-service`. Be aware that both the commit and
its removal trigger that repository's own CI on its default branch. The GitHub-hosted half ran from a public
copy, [`kokou-egbewatt/runner-pickup-probe`](https://github.com/kokou-egbewatt/runner-pickup-probe), where
those minutes are free and the workflow can stay.

```bash
bench/gha-runners/latency.sh acme/identity-service         fleet-light 30 1
bench/gha-runners/latency.sh acme/identity-service         fleet-light 10 8
bench/gha-runners/latency.sh acme/identity-service         fleet-dind  20 1
bench/gha-runners/latency.sh acme/identity-service         fleet-dind  10 4
bench/gha-runners/latency.sh kokou-egbewatt/runner-pickup-probe ubuntu-24.04 30 1
bench/gha-runners/latency.sh kokou-egbewatt/runner-pickup-probe ubuntu-24.04 10 4
bench/gha-runners/summarize.sh --csv data/gha-runners/latency-*.csv > data/gha-runners/latency.csv
```

The last argument is how many jobs queue at once, and it splits two cases:

- **At or below the number of idle runners**, every job meets a runner already long-polling. That is the
  idle number.
- **Above it**, the extra jobs wait for a runner to finish, restart, and fetch a fresh single-use
  registration. That is the back-to-back number, and the one that sets p95 under real load.

GitHub's timestamps are whole seconds, so each pickup is plus or minus one second.

## Cold versus warm

```bash
FLEET=../runner-fleet LIGHT=4 DIND=2 bench/gha-runners/cache.sh cold acme/media-service    <run> build_n_test
bench/gha-runners/cache.sh                                    warm acme/media-service    <run> build_n_test
FLEET=../runner-fleet LIGHT=4 DIND=2 bench/gha-runners/cache.sh cold acme/web-app <run> "End-to-end smoke"
bench/gha-runners/cache.sh                                    warm acme/web-app <run> "End-to-end smoke"
bench/gha-runners/cache-summary.sh data/gha-runners/cache-round*.csv > data/gha-runners/cache.csv
bench/gha-runners/cache-summary.sh --steps data/gha-runners/cache-round*.csv > data/gha-runners/cache-steps.csv
```

`FLEET` is the path to the fleet's checkout. `ROUND=2` writes `cache-round2.csv` instead of round 1.

Use a run from `develop`. A re-run brings the job's dependents with it, and media-service's `tag` job pushes a tag
on `main`. The script refuses `main`.

**Cold has two halves.** The fleet's own volumes (cargo registry, toolcache, Playwright browsers) are cleared
by recreating the fleet; a restart would keep the container's filesystem. And both jobs restore from GitHub's
cache service too: media-service keeps `target/` there through `Swatinem/rust-cache`, web-app keeps the browsers
and pnpm store through `actions/cache`. Cold deletes every cache entry the repository holds. Clearing one half
and not the other gives a cold run that is half warm.

A cold run stops the whole fleet. Every repository queues until it is back.

## Memory with three dind pairs

```bash
make -C ../runner-fleet up DIND=3
OUT=data/gha-runners/memory-dind3.csv bench/gha-runners/memory.sh 5 &
gh run rerun 38431511901 -R acme/identity-service          # every job: contract-tests and integration-tests together
# once both are in progress, re-run infra's integration job, which brings up a kind cluster
gh run rerun 38175763426 -R acme/infra --job <integration job id>
# when all three have finished
touch data/gha-runners/memory-dind3.csv.stop
bench/gha-runners/memory-summary.sh data/gha-runners/memory-dind3.csv > data/gha-runners/memory.csv
# back to two pairs: the dind pairs are compose profiles, so `up DIND=2` only ever adds
docker compose --profile dind3 rm -sf runner-dind-3 dind-3
make -C ../runner-fleet prune
```

`up DIND=2` will not take the fleet back down to two pairs. The pairs are compose profiles rather
than replicas, and a profile that is not selected is left alone rather than stopped, so the third
pair keeps running and holding its memory until it is removed by name.

Load it with the heaviest dind jobs at once: identity-service's `contract-tests` and `integration-tests`, and
infra's `integration`. Check from the jobs' timestamps that all three overlapped. An idle fleet of
three pairs answers nothing. Report the peak, not the mean: the fleet's configured ceilings add up to more than
the VM has, so the question is whether the peak ever gets there.

Re-run both identity-service jobs from one run. identity-service's concurrency group (`workflow-ref`, cancel-in-progress)
cancels a run's jobs when another run on the same ref is re-run, and the load ends up a job short.

A sidecar's figure in `docker stats` includes the containers its daemon starts, so the job's services are
counted there and not on the runner half.
