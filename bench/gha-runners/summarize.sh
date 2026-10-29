#!/usr/bin/env bash
# p50, p95, max pickup per target and width (nearest-rank).
#   bench/gha-runners/summarize.sh [--csv] data/gha-runners/latency-*.csv
set -euo pipefail

csv=0
[ "${1:-}" = --csv ] && { csv=1; shift; }

if [ "$csv" = 1 ]; then
  echo target,width,n,p50_s,p95_s,max_s
else
  printf '%-16s %5s %5s %5s %5s %5s\n' target width n p50 p95 max
fi
tail -q -n +2 "$@" | tr -d '"' | awk -F, '{ print $2 "," $3 "," $8 }' |
  sort -t, -k1,1 -k2,2n -k3,3n |
  awk -F, -v csv="$csv" '
    function rank(p,   r, c) { r = p * n; c = int(r); if (c < r) c++; if (c < 1) c = 1; return v[c] }
    function flush() {
      if (!n) return
      if (csv) printf "%s,%s,%d,%d,%d,%d\n", t, w, n, rank(.50), rank(.95), v[n]
      else printf "%-16s %5s %5d %5d %5d %5d\n", t, w, n, rank(.50), rank(.95), v[n]
      n = 0
    }
    $1 != t || $2 != w { flush(); t = $1; w = $2 }
    { v[++n] = $3 }
    END { flush() }'
