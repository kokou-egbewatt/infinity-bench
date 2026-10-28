#!/usr/bin/env bash
# Peak MiB per fleet container, the fleet's largest single sample, and the VM's peak use,
# from memory.sh output.
#   bench/gha-runners/memory-summary.sh data/gha-runners/memory-dind3.csv
#   PROJECT=my-ci bench/gha-runners/memory-summary.sh <csv>   for a differently named fleet
set -euo pipefail

project=${PROJECT:-runner-fleet}

echo name,peak_mib
tail -n +2 "$1" | awk -F, -v pfx="$project-" '
  $2 == "container" && index($3, pfx) == 1 {
    n = substr($3, length(pfx) + 1); if (n !~ /^light-/) sub(/-1$/, "", n)
    if ($4 > pk[n]) pk[n] = $4
    fleet[$1] += $4
  }
  $2 == "vm" && $3 == "used"  { if ($4 > vm) vm = $4 }
  $2 == "vm" && $3 == "total" { tot = $4 }
  END {
    for (n in pk) printf "%s,%.0f\n", n, pk[n] / 1048576 | "sort"
    close("sort")
    for (t in fleet) if (fleet[t] > f) f = fleet[t]
    printf "fleet total,%.0f\n", f / 1048576
    printf "VM used of %.0f,%.0f\n", tot / 1048576, vm / 1048576
  }'
