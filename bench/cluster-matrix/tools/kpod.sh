#!/usr/bin/env bash
# Run one probe pod on whatever cluster $KUBECONFIG points at, from Git Bash. Shared by 04 onwards.
#   usage: kpod.sh <out dir> <name> [runtimeClass|-] [gpu limit|-] [mounts: none|hostpath] [wait_s=120]
# hostpath mode: /dev/dxg, /usr/lib/wsl/lib and /usr/lib/wsl/drivers from the node, LD_LIBRARY_PATH
# set, privileged so the device cgroup lets /dev/dxg through. No runtime, no toolkit involved.
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="$1"; NAME="$(printf %s "$2" | tr A-Z a-z)"; RC="${3:--}"; GPU="${4:--}"; MODE="${5:-none}"; WAIT="${6:-120}"
mkdir -p "$OUT"
K=kubectl
stamp() { printf '%s,%s\n' "$1" "$(date +%s.%N)" >> "$OUT/timeline.csv"; }

$K get configmap probe-inner >/dev/null 2>&1 || $K create configmap probe-inner --from-file=inner.sh="$(cygpath -w "$HERE/inner.sh")" >/dev/null
until $K get serviceaccount default >/dev/null 2>&1; do sleep 0.5; done
$K delete pod "probe-$NAME" --ignore-not-found --wait=true >/dev/null 2>&1
{
  echo "apiVersion: v1"
  echo "kind: Pod"
  echo "metadata: {name: probe-$NAME}"
  echo "spec:"
  echo "  restartPolicy: Never"
  [ "$RC" != - ] && echo "  runtimeClassName: $RC"
  echo "  containers:"
  echo "  - name: probe"
  echo "    image: docker.io/library/cluster-matrix-probe:01"
  echo "    imagePullPolicy: ${PULL:-Never}"
  echo "    command: [sh, /probe/inner.sh]"
  echo "    env:"
  echo "    - {name: NVIDIA_VISIBLE_DEVICES, value: all}"
  echo "    - {name: NVIDIA_DRIVER_CAPABILITIES, value: 'compute,utility'}"
  [ "$MODE" = hostpath ] && echo "    - {name: LD_LIBRARY_PATH, value: /usr/lib/wsl/lib}"
  [ "$GPU" != - ] && printf '    resources:\n      limits: {nvidia.com/gpu: %s}\n' "$GPU"
  [ "$MODE" = hostpath ] && echo "    securityContext: {privileged: true}"
  echo "    volumeMounts:"
  echo "    - {name: inner, mountPath: /probe}"
  if [ "$MODE" = hostpath ]; then
    echo "    - {name: dxg, mountPath: /dev/dxg}"
    echo "    - {name: wsllib, mountPath: /usr/lib/wsl/lib, readOnly: true}"
    echo "    - {name: wsldrivers, mountPath: /usr/lib/wsl/drivers, readOnly: true}"
  fi
  echo "  volumes:"
  echo "  - {name: inner, configMap: {name: probe-inner}}"
  if [ "$MODE" = hostpath ]; then
    echo "  - {name: dxg, hostPath: {path: /dev/dxg, type: CharDevice}}"
    echo "  - {name: wsllib, hostPath: {path: /usr/lib/wsl/lib, type: Directory}}"
    echo "  - {name: wsldrivers, hostPath: {path: /usr/lib/wsl/drivers, type: Directory}}"
  fi
} > "$OUT/pod-$NAME.yaml"
stamp "probe_${NAME}_applied"
$K apply -f - < "$OUT/pod-$NAME.yaml" 2>&1
t=""
for _ in $(seq 1 $((WAIT * 2))); do
  t=$($K get pod "probe-$NAME" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null)
  [ -n "$t" ] && break
  sleep 0.5
done
stamp "probe_${NAME}_done"
{
  echo "## pod probe-$NAME  runtimeClass=$RC  gpu=$GPU  mounts=$MODE"
  echo "phase=$($K get pod "probe-$NAME" -o jsonpath='{.status.phase}' 2>&1)"
  echo "exitCode=$t"
  echo "reason=$($K get pod "probe-$NAME" -o jsonpath='{.status.containerStatuses[0].state.terminated.reason}{.status.containerStatuses[0].state.waiting.reason}{.status.containerStatuses[0].state.waiting.message}{.status.conditions[?(@.type=="PodScheduled")].message}' 2>&1)"
  echo "## logs"
  $K logs "probe-$NAME" 2>&1
  echo "## events"
  $K get events --field-selector involvedObject.name="probe-$NAME" -o custom-columns=TYPE:.type,REASON:.reason,MSG:.message --no-headers 2>&1
} > "$OUT/probe-$NAME.txt"
lvl=$(grep -o '"level": [0-9]*' "$OUT/probe-$NAME.txt" | grep -o '[0-9]*$')
printf '%-22s level=%-4s %s | %s\n' "$NAME" "${lvl:-none}" \
  "$(grep -oE '^(dxg|libcuda_file|drivers_dir|gpu_mounts)=[0-9]+' "$OUT/probe-$NAME.txt" | tr '\n' ' ')" \
  "$(grep -E 'error while loading|"error": "[^"]|Insufficient|forbidden|not found|failed|Error' "$OUT/probe-$NAME.txt" | head -2 | tr '\n' ' ' | cut -c1-200)"
