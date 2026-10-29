#!/usr/bin/env bash
# Pickup latency: started_at - created_at for each probe job.
#   bench/gha-runners/latency.sh <owner/repo> <runs-on label> [runs] [width]
# width = jobs queued at once. Above the idle runner count it measures back-to-back
# pickup (runner restart + new JIT config). Timestamps are whole seconds.
set -euo pipefail

repo=${1:?owner/repo}; target=${2:?runs-on label}; runs=${3:-20}; width=${4:-1}
settle=${SETTLE:-60}  # let runners re-register between runs
# Raw output goes in a folder named for the run, so re-measuring never overwrites an earlier
# campaign. Override with RUN=2026-10-28 to add to one.
run=${RUN:-$(date -u +%F)}
out=${OUT:-data/gha-runners/$run/latency-${target}-w${width}.csv}

export REPO=$repo TARGET=$target WIDTH=$width
matrix="[$(seq -s, 1 "$width")]"
mkdir -p "$(dirname "$out")"
echo "repo,target,width,run_id,job_id,created_at,started_at,pickup_s,runner_name" >"$out"

latest() {
  gh run list -R "$repo" -w probe.yml -e workflow_dispatch -L1 --json databaseId --jq '.[0].databaseId // 0'
}

# One CSV row per successful job in a run.
jobs_csv() {
  gh api --paginate "repos/$repo/actions/runs/$1/jobs?per_page=100" --jq '
    .jobs[] | select(.conclusion == "success")
    | [env.REPO, env.TARGET, env.WIDTH, .run_id, .id, .created_at, .started_at,
       ((.started_at | fromdate) - (.created_at | fromdate)), .runner_name]
    | @csv'
}

rows=$(mktemp); trap 'rm -f "$rows"' EXIT

for i in $(seq 1 "$runs"); do
  before=$(latest)
  gh workflow run probe.yml -R "$repo" -f target="$target" -f matrix="$matrix"
  # dispatch returns no run id
  id=$before
  for _ in $(seq 1 30); do id=$(latest); [ "$id" != "$before" ] && break; sleep 2; done
  [ "$id" != "$before" ] || { echo "run $i never appeared" >&2; exit 1; }
  echo "run $i/$runs: $id" >&2
  gh run watch "$id" -R "$repo" --interval 5 >/dev/null 2>&1 || true
  # watch returns early on a transient error, leaving jobs still queued. Appending then
  # drops them, and a sweep quietly missing its slowest samples reports a better tail than
  # it measured. Wait for all $width to land, and fail rather than record a short run.
  for _ in $(seq 1 60); do
    jobs_csv "$id" >"$rows"
    [ "$(wc -l <"$rows")" -eq "$width" ] && break
    sleep 5
  done
  [ "$(wc -l <"$rows")" -eq "$width" ] || {
    echo "run $i ($id): $(wc -l <"$rows") of $width jobs succeeded" >&2
    exit 1
  }
  cat "$rows" >>"$out"
  [ "$i" -lt "$runs" ] && sleep "$settle"
done

echo "$out"
"$(dirname "$0")/summarize.sh" "$out"
