#!/usr/bin/env bash
# Pickup latency: started_at - created_at for each probe job.
#   bench/gha-runners/latency.sh <owner/repo> <runs-on label> [runs] [width]
# width = jobs queued at once. Above the idle runner count it measures back-to-back
# pickup (runner restart + new JIT config). Timestamps are whole seconds.
set -euo pipefail

repo=${1:?owner/repo}; target=${2:?runs-on label}; runs=${3:-20}; width=${4:-1}
settle=${SETTLE:-60}  # let runners re-register between runs
out=${OUT:-data/gha-runners/latency-$(date -u +%Y%m%dT%H%M%SZ)-${target}-w${width}.csv}

export REPO=$repo TARGET=$target WIDTH=$width
matrix="[$(seq -s, 1 "$width")]"
mkdir -p "$(dirname "$out")"
echo "repo,target,width,run_id,job_id,created_at,started_at,pickup_s,runner_name" >"$out"

latest() {
  gh run list -R "$repo" -w probe.yml -e workflow_dispatch -L1 --json databaseId --jq '.[0].databaseId // 0'
}

for i in $(seq 1 "$runs"); do
  before=$(latest)
  gh workflow run probe.yml -R "$repo" -f target="$target" -f matrix="$matrix"
  # dispatch returns no run id
  id=$before
  for _ in $(seq 1 30); do id=$(latest); [ "$id" != "$before" ] && break; sleep 2; done
  [ "$id" != "$before" ] || { echo "run $i never appeared" >&2; exit 1; }
  echo "run $i/$runs: $id" >&2
  gh run watch "$id" -R "$repo" --interval 5 >/dev/null 2>&1 || true
  gh api --paginate "repos/$repo/actions/runs/$id/jobs?per_page=100" --jq '
    .jobs[] | select(.conclusion == "success")
    | [env.REPO, env.TARGET, env.WIDTH, .run_id, .id, .created_at, .started_at,
       ((.started_at | fromdate) - (.created_at | fromdate)), .runner_name]
    | @csv' >>"$out"
  [ "$i" -lt "$runs" ] && sleep "$settle"
done

echo "$out"
"$(dirname "$0")/summarize.sh" "$out"
