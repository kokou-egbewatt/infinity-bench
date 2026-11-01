#!/usr/bin/env bash
# Step 03: k3s in WSL2. Runs inside the Ubuntu distro as root.
#   usage: k3s.sh <phase> <out dir>
#   phases: install | probe <name> [runtimeclass] [gpu-limit] | state | vram <label> | down
source "$(dirname "${BASH_SOURCE[0]}")/../probe/lib.sh"
set +e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PHASE="$1"; OUT="$2"; shift 2
mkdir -p "$OUT"
K="k3s kubectl"
TAR="$HERE/../probe/probe-01.tar"
now() { date +%s.%N; }
stamp() { printf '%s,%s\n' "$1" "$(now)" >> "$OUT/timeline.csv"; }

case "$PHASE" in
install)
  stamp install_start
  curl -sfL https://get.k3s.io | K3S_NODE_NAME=gpu-lab sh - 2>&1 | tee "$OUT/install.log"
  stamp install_done
  until [ "$($K get node gpu-lab -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ]; do sleep 0.5; done
  stamp node_ready
  k3s ctr images import "$TAR" 2>&1 | tee "$OUT/import.log"
  stamp image_imported
  $K create configmap probe-inner --from-file=inner.sh="$HERE/inner.sh" >/dev/null
  ;;
probe)
  # name, runtimeClassName ("" for none), gpu limit ("" for none)
  NAME="$1"; RC="${2:-}"; GPU="${3:-}"
  $K delete pod "probe-$NAME" --ignore-not-found --wait=true >/dev/null 2>&1
  {
    echo "apiVersion: v1"
    echo "kind: Pod"
    echo "metadata: {name: probe-$NAME}"
    echo "spec:"
    echo "  restartPolicy: Never"
    [ -n "$RC" ] && echo "  runtimeClassName: $RC"
    echo "  containers:"
    echo "  - name: probe"
    echo "    image: docker.io/library/cluster-matrix-probe:01"
    echo "    imagePullPolicy: Never"
    echo "    command: [sh, /probe/inner.sh]"
    echo "    env:"
    echo "    - {name: NVIDIA_VISIBLE_DEVICES, value: all}"
    echo "    - {name: NVIDIA_DRIVER_CAPABILITIES, value: 'compute,utility'}"
    [ -n "$GPU" ] && printf '    resources:\n      limits: {nvidia.com/gpu: %s}\n' "$GPU"
    echo "    volumeMounts: [{name: inner, mountPath: /probe}]"
    echo "  volumes: [{name: inner, configMap: {name: probe-inner}}]"
  } > "$OUT/pod-$NAME.yaml"
  stamp "probe_${NAME}_applied"
  $K apply -f "$OUT/pod-$NAME.yaml" 2>&1
  # a passing probe exits 50, so the pod ends Failed; wait on the container's terminated state
  for _ in $(seq 1 240); do
    t=$($K get pod "probe-$NAME" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null)
    [ -n "$t" ] && break
    sleep 0.5
  done
  stamp "probe_${NAME}_done"
  {
    echo "## pod probe-$NAME  runtimeClass=${RC:-none}  gpu=${GPU:-none}"
    echo "phase=$($K get pod "probe-$NAME" -o jsonpath='{.status.phase}')"
    echo "exitCode=$t"
    echo "reason=$($K get pod "probe-$NAME" -o jsonpath='{.status.containerStatuses[0].state.terminated.reason}{.status.containerStatuses[0].state.waiting.reason}{.status.conditions[?(@.type=="PodScheduled")].message}')"
    echo "## logs"
    $K logs "probe-$NAME" 2>&1
    echo "## events"
    $K get events --field-selector involvedObject.name="probe-$NAME" -o custom-columns=TYPE:.type,REASON:.reason,MSG:.message --no-headers 2>&1
  } > "$OUT/probe-$NAME.txt"
  cat "$OUT/probe-$NAME.txt"
  ;;
state)
  {
    echo "## version"; k3s --version
    echo "## node"; $K get node -o wide
    echo "## allocatable nvidia.com/gpu: '$($K get node gpu-lab -o jsonpath='{.status.allocatable.nvidia\.com/gpu}')'"
    echo "## runtimeclasses"; $K get runtimeclass -o custom-columns=NAME:.metadata.name,HANDLER:.handler --no-headers
    echo "## containerd runtimes"; grep -nE 'runtimes\.|BinaryName' /var/lib/rancher/k3s/agent/etc/containerd/config.toml* 2>/dev/null
    echo "## pods"; $K get pods -A -o wide
    echo "## memory (MiB, WSL guest)"; free -m | sed -n 2p
    echo "## disk"; df -BM --output=used / | tail -1; du -sm /var/lib/rancher /usr/local/bin/k3s 2>/dev/null
  } 2>&1 | tee "$OUT/state-$1.txt"
  ;;
vram)
  # median of 20 one-second samples, labelled
  v=$(for _ in $(seq 1 20); do vram_used; sleep 1; done | median)
  csv_append "$OUT/vram.csv" "run_id,label,median_mib" "$(run_id),$1,$v"
  echo "vram $1: $v MiB"
  ;;
down)
  stamp uninstall_start
  /usr/local/bin/k3s-uninstall.sh > "$OUT/uninstall.log" 2>&1
  stamp uninstall_done
  ls -d /etc/rancher /var/lib/rancher 2>/dev/null
  ;;
esac
