#!/usr/bin/env bash
# Memory per container (docker stats) and for the Docker VM (/proc/meminfo), with peaks.
#   bench/gha-runners/memory.sh [interval_s]     stop with Ctrl-C, or `touch <out>.stop` from a script
# Prefer the stop file: on Git Bash a signal during docker.exe kills it before the trap.
set -euo pipefail

interval=${1:-5}
out=${OUT:-data/gha-runners/memory-$(date -u +%Y%m%dT%H%M%SZ).csv}
probe=bench-meminfo
mkdir -p "$(dirname "$out")"
echo "ts,source,name,bytes" >"$out"

summarize() {
  docker rm -f "$probe" >/dev/null 2>&1 || true
  echo; echo "$out, peaks in MiB:"
  tail -n +2 "$out" | awk -F, '
    $2 == "container" { if ($4 > pk[$3]) pk[$3] = $4; if ($3 ~ /^runner-fleet-/) fleet[$1] += $4 }
    $2 == "vm" && $3 == "used"  { if ($4 > vm) vm = $4 }
    $2 == "vm" && $3 == "total" { tot = $4 }
    END {
      for (k in pk) printf "  %-34s %7.0f\n", k, pk[k] / 1048576
      for (t in fleet) if (fleet[t] > f) f = fleet[t]
      printf "  %-34s %7.0f\n", "fleet, highest single sample", f / 1048576
      printf "  %-34s %7.0f of %.0f\n", "VM used (total minus available)", vm / 1048576, tot / 1048576
    }'
}

docker run -d --rm --name "$probe" alpine:3.20 sleep infinity >/dev/null
trap summarize EXIT
trap 'exit 0' INT TERM

stop=$out.stop
rm -f "$stop"
while [ ! -e "$stop" ]; do
  ts=$(date -u +%s)
  docker stats --no-stream --format '{{.Name}},{{.MemUsage}}' | awk -F, -v ts="$ts" '
    function bytes(s,   n, u, m) {
      n = s + 0; u = s; sub(/^[0-9.]+/, "", u); m = 1
      if (u == "KiB" || u == "kB") m = 1024
      else if (u == "MiB" || u == "MB") m = 1048576
      else if (u == "GiB" || u == "GB") m = 1073741824
      else if (u == "TiB" || u == "TB") m = 1099511627776
      return sprintf("%.0f", n * m)
    }
    { split($2, a, " / "); print ts ",container," $1 "," bytes(a[1]) }' >>"$out"
  docker exec "$probe" cat /proc/meminfo | awk -v ts="$ts" '
    /^MemTotal:/ { t = $2 * 1024 } /^MemAvailable:/ { a = $2 * 1024 }
    END { printf "%s,vm,total,%.0f\n%s,vm,used,%.0f\n", ts, t, ts, t - a }' >>"$out"
  sleep "$interval"
done
