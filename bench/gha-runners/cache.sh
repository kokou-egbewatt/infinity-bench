#!/usr/bin/env bash
# Cold vs warm: re-run one job of an existing run, record per-step seconds.
#   bench/gha-runners/cache.sh cold|warm <owner/repo> <run_id> <job name>
# Cold recreates the fleet without its cache volumes (FLEET=path to the fleet checkout,
# LIGHT/DIND as normally run) and deletes the repo's GitHub caches. It stops every
# job on the fleet. Runs from main are refused: re-runs bring dependents, e.g. a tag job.
set -euo pipefail

mode=${1:?cold or warm}; repo=${2:?owner/repo}; run=${3:?run id}; job=${4:?job name}
# Volume prefix, which is the compose project name. Wrong value means cold is not cold:
# the volumes are not found, nothing is removed, and the run is warm with a cold label.
project=${PROJECT:-runner-fleet}
# Raw output goes in a folder named for the run, so re-measuring never overwrites an earlier
# campaign. Override with RUN=2026-10-28 to add to one.
run=${RUN:-$(date -u +%F)}
out=${OUT:-data/gha-runners/$run/cache-round${ROUND:-1}.csv}
export MODE=$mode REPO=$repo JOB=$job

branch=$(gh api "repos/$repo/actions/runs/$run" --jq .head_branch)
[ "$branch" != main ] || { echo "run $run is from main, and re-running it re-runs whatever depends on the job" >&2; exit 1; }

if [ "$mode" = cold ]; then
  : "${FLEET:?set FLEET to the fleet checkout, cold recreates the fleet}"
  # Cold has to actually clear the caches. A wrong prefix finds no volumes, removes nothing,
  # and yields a warm run wearing a cold label, so fail here instead of recording that.
  docker volume ls -q | grep -q "^${project}_" || {
    echo "no volumes named ${project}_*: set PROJECT to the fleet's compose project name" >&2
    exit 1
  }
  make -C "$FLEET" down
  # `toolcache` is here for fleets that still share one. From fleet 0.5.6 the tool cache is
  # per runner, inside the container and seeded by the image, so there is no volume to drop
  # and a cold run starts with the pinned toolchains already present. Cold is cold for the
  # package and build caches either way, but it no longer re-downloads Go, Node, uv or
  # Python, which is why cold setup times are not comparable across that version.
  for v in toolcache cargo-registry cargo-target gomod gobuild uvcache pnpmstore playwright; do
    docker volume rm "${project}_$v" >/dev/null 2>&1 || true
  done
  gh cache delete --all -R "$repo" || true
  # LIGHT is passed only when set, so the fleet returns to the shape it was measured in.
  # Without it the Makefile default (LIGHT=2) silently shrinks the fleet mid-measurement.
  make -C "$FLEET" up ${LIGHT:+LIGHT="$LIGHT"} DIND="${DIND:-1}"
fi

job_id=$(gh api "repos/$repo/actions/runs/$run/jobs?filter=latest&per_page=100" \
  --jq '.jobs[] | select(.name == env.JOB) | .id' | head -1)
[ -n "$job_id" ] || { echo "no job named '$job' in run $run" >&2; exit 1; }

before=$(gh api "repos/$repo/actions/runs/$run" --jq .run_attempt)
gh run rerun "$run" -R "$repo" --job "$job_id"
# wait for the new attempt, or watch returns on the old one
for _ in $(seq 1 60); do
  [ "$(gh api "repos/$repo/actions/runs/$run" --jq .run_attempt)" -gt "$before" ] && break
  sleep 5
done
gh run watch "$run" -R "$repo" --interval 10 >/dev/null 2>&1 || true

attempt=$(gh api "repos/$repo/actions/runs/$run" --jq .run_attempt)
export ATTEMPT=$attempt
# watch returns early on a transient error. An unfinished job has a null completed_at, which
# makes the timings below a jq error on a line whose exit status `tee` hides, so the cycle
# records nothing and the round is quietly a cycle short. Wait for the conclusion instead.
for _ in $(seq 1 120); do
  concl=$(gh api "repos/$repo/actions/runs/$run/attempts/$attempt/jobs?per_page=100" \
    --jq '.jobs[] | select(.name == env.JOB) | .conclusion // empty' | head -1)
  [ -n "$concl" ] && break
  sleep 10
done
[ -n "$concl" ] || { echo "job '$job' in run $run attempt $attempt never finished" >&2; exit 1; }

mkdir -p "$(dirname "$out")"
[ -s "$out" ] || echo "mode,repo,run_id,attempt,job,runner_name,conclusion,step,seconds" >"$out"
gh api "repos/$repo/actions/runs/$run/attempts/$attempt/jobs?per_page=100" --jq '
  .jobs[] | select(.name == env.JOB) | . as $j
  | ( [env.MODE, env.REPO, $j.run_id, env.ATTEMPT, $j.name, $j.runner_name, $j.conclusion,
       "(whole job)", (($j.completed_at | fromdate) - ($j.started_at | fromdate))] ),
    ( $j.steps[] | select(.started_at and .completed_at)
      | [env.MODE, env.REPO, $j.run_id, env.ATTEMPT, $j.name, $j.runner_name, $j.conclusion,
         .name, ((.completed_at | fromdate) - (.started_at | fromdate))] )
  | @csv' | tee -a "$out"
