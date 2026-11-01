#!/usr/bin/env bash
# The VRAM noise floor.
#
# Every later VRAM claim is a whole-card before/after delta, because no vantage
# point on WSL2 attributes memory per process (docs/gpu-debug.md). A delta is only
# meaningful above the floor measured here, so this runs first and gates the rest.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

SAMPLES=${SAMPLES:-30}
INTERVAL=${INTERVAL:-2}
LABEL=${1:-live}

echo "sampling whole-card memory.used: $SAMPLES samples, ${INTERVAL}s apart, label=$LABEL"
tmp=$(mktemp)
for i in $(seq 1 "$SAMPLES"); do
  vram_used >> "$tmp"
  printf '\r  %d/%d' "$i" "$SAMPLES"
  [ "$i" -lt "$SAMPLES" ] && sleep "$INTERVAL"
done
echo

min=$(sort -n "$tmp" | head -1)
max=$(sort -n "$tmp" | tail -1)
med=$(median < "$tmp")
# IQR via nearest-rank, which needs no interpolation and no extra tooling.
q1=$(sort -n "$tmp" | awk -v n="$SAMPLES" 'NR==int(n*0.25)+1 {print; exit}')
q3=$(sort -n "$tmp" | awk -v n="$SAMPLES" 'NR==int(n*0.75)+1 {print; exit}')
spread=$((max - min))
iqr=$((q3 - q1))

printf 'median %s MiB  IQR %s MiB  range %s-%s MiB  spread %s MiB\n' "$med" "$iqr" "$min" "$max" "$spread"

csv_append "$OUT_DIR/noise-floor.csv" \
  "run_id,label,samples,interval_s,median_mib,iqr_mib,min_mib,max_mib,spread_mib,conditions" \
  "$(run_id),$LABEL,$SAMPLES,$INTERVAL,$med,$iqr,$min,$max,$spread,$(csv_escape "$(gpu_conditions)")"
rm -f "$tmp"
echo "floor recorded. a VRAM delta below ${spread} MiB is not measurable on this machine."
