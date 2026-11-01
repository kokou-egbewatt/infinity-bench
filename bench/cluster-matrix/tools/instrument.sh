#!/usr/bin/env bash
# Step 01: can whole-card memory.used see a known allocation?
# Runs inside WSL. For each trial: the probe with 0 MiB (CUDA context only), then with ALLOC MiB,
# sampling memory.used before, during the hold, and after release.
#   usage: instrument.sh <probe binary> <out dir> [trials=3] [alloc=2048] [hold=30]
source "$(dirname "${BASH_SOURCE[0]}")/../probe/lib.sh"
BIN="$1"; OUT="$2"; TRIALS="${3:-3}"; ALLOC="${4:-2048}"; HOLD="${5:-30}"
mkdir -p "$OUT"
CSV="$OUT/instrument.csv"

# median of n samples, 1 s apart
sample() { local n="$1"; for _ in $(seq 1 "$n"); do vram_used; sleep 1; done | median; }

for t in $(seq 1 "$TRIALS"); do
  for a in 0 "$ALLOC"; do
    pre=$(sample 10)
    json="$OUT/probe-a${a}-t${t}.json"
    "$BIN" "$a" "$HOLD" > "$json" 2>&1 &
    pid=$!
    # wait for the result line, so sampling starts with the allocation in place
    for _ in $(seq 1 60); do grep -q '"level"' "$json" && break; sleep 0.5; done
    sleep 3
    during=$(sample 10)
    # the probe exits with its level (50 = pass); under set -e a bare `wait` would end the script
    rc=0; wait "$pid" || rc=$?
    sleep 5
    post=$(sample 10)
    level=$(grep -o '"level": [0-9]*' "$json" | grep -o '[0-9]*$')
    csv_append "$CSV" "run_id,trial,alloc_mib,hold_s,exit_code,level,pre_mib,during_mib,post_mib,delta_mib,released_mib" \
      "$(run_id),$t,$a,$HOLD,$rc,$level,$pre,$during,$post,$(awk -v d="$during" -v p="$pre" 'BEGIN{print d-p}'),$(awk -v d="$during" -v p="$post" 'BEGIN{print d-p}')"
    printf 'trial %s alloc %5s MiB: exit %s level %s  pre %s  during %s  post %s\n' "$t" "$a" "$rc" "$level" "$pre" "$during" "$post"
  done
done
echo "conditions after: $(gpu_conditions)"
