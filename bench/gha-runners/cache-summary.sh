#!/usr/bin/env bash
# Median and range per job, cold against warm, from cache.sh output. --steps lists the
# steps instead, keeping those that take MIN seconds (default 10) or more in any round or mode.
#   bench/gha-runners/cache-summary.sh [--steps] data/gha-runners/cache-round*.csv
set -euo pipefail

steps=0
[ "${1:-}" = --steps ] && { steps=1; shift; }

echo round,repo,step,cold_n,cold_median_s,cold_range_s,warm_n,warm_median_s,warm_range_s
for f in "$@"; do
  round=$(basename "$f" | sed -n 's/.*round\([0-9]*\).*/\1/p')
  tail -n +2 "$f" | tr -d '"' | sed "s/^/${round:-?},/"
done | awk -F, -v steps="$steps" -v min="${MIN:-10}" '
  function median(k, m,   i, j, x, a, n) {
    n = cnt[k, m]
    for (i = 1; i <= n; i++) a[i] = val[k, m, i]
    for (i = 2; i <= n; i++) { x = a[i]; for (j = i - 1; j >= 1 && a[j] > x; j--) a[j + 1] = a[j]; a[j + 1] = x }
    lo[k, m] = a[1]; hi[k, m] = a[n]
    return n % 2 ? a[(n + 1) / 2] : (a[n / 2] + a[n / 2 + 1]) / 2
  }
  # fields shift by one: $1 is the round
  (steps && $9 != "(whole job)") || (!steps && $9 == "(whole job)") {
    k = $1 SUBSEP $3 SUBSEP $9
    if (!(k in seen)) { seen[k] = 1; order[++nk] = k }
    val[k, $2, ++cnt[k, $2]] = $10
  }
  END {
    for (i = 1; i <= nk; i++) {
      k = order[i]; split(k, p, SUBSEP)
      c[k] = median(k, "cold"); w[k] = median(k, "warm")
      if (c[k] >= min || w[k] >= min) keep[p[2], p[3]] = 1
    }
    for (i = 1; i <= nk; i++) {
      k = order[i]; split(k, p, SUBSEP)
      if (steps && !((p[2], p[3]) in keep)) continue
      printf "%s,%s,%s,%d,%g,%d-%d,%d,%g,%d-%d\n", p[1], p[2], p[3], cnt[k, "cold"], c[k], lo[k, "cold"], hi[k, "cold"], cnt[k, "warm"], w[k], lo[k, "warm"], hi[k, "warm"]
    }
  }'
