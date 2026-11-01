# Shared helpers. Sourced, never run.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/data/cluster-matrix}"
SMI_WIN=/mnt/c/Windows/System32/nvidia-smi.exe

# Whole-card memory.used in MiB. Sampled from WSL2, which measures identically to
# Windows (verified: five rounds, exact agreement, docs/dev-machine.md).
vram_used() { nvidia-smi --query-gpu=memory.used --format=csv,noheader | awk '{print $1}'; }

# Conditions that invalidate a timing: thermal throttle, or someone else on the card.
gpu_conditions() {
  nvidia-smi --query-gpu=temperature.gpu,clocks.sm,power.draw,utilization.gpu,clocks_throttle_reasons.active \
    --format=csv,noheader | tr -d ' '
}

# median of stdin
median() { sort -n | awk '{v[NR]=$1} END {print (NR%2) ? v[(NR+1)/2] : (v[NR/2]+v[NR/2+1])/2}'; }

# CSV field escape: double the quotes, wrap. Error text contains commas and newlines.
csv_escape() { printf '"%s"' "$(printf '%s' "$1" | sed 's/"/""/g')"; }

# Append a row, writing the header first if the file is new.
csv_append() {
  local file="$1" header="$2" row="$3"
  [ -f "$file" ] || printf '%s\n' "$header" > "$file"
  printf '%s\n' "$row" >> "$file"
}

run_id() { date -u +%Y%m%dT%H%M%SZ; }
