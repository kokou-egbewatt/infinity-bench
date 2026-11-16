#!/usr/bin/env bash
# Run a harness as a pod on gpu-lab, from Git Bash on Windows.
#
#   bench/run.sh cluster-check     # only the cluster checks below, no image or pod
#   bench/run.sh env               # print the env.json a run would record
#   bench/run.sh vram-accounting   # build, import, check, run, write into data/vram-accounting/
#   bench/run.sh vram-accounting --config /out/x.yaml   # anything after the name goes to the harness
#
# Refuses a dirty tree (ALLOW_DIRTY=1 records git.dirty: true instead), a context other than
# gpu-lab, and any other pod holding nvidia.com/gpu.
set -euo pipefail
export MSYS_NO_PATHCONV=1
# wsl.exe and kubectl read stdin; keep it on fd 3 for the harness and give them nothing.
exec 3<&0 </dev/null

CONTEXT=gpu-lab
DISTRO=Ubuntu
NS=infinity-bench
ROOT=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
cd "$ROOT"

die() { echo "error: $*" >&2; exit 1; }
wsl_() { wsl.exe -d "$DISTRO" -- "$@" | tr -d '\r'; }

target=${1:-}
case "$target" in
  env | cluster-check) ;;
  vram-accounting) [ -f "bench/$target/harness.py" ] || die "no bench/$target/harness.py" ;;
  *) die "usage: bench/run.sh cluster-check|env|vram-accounting" ;;
esac

# --- the tree the result will point at
GIT_SHA=$(git rev-parse HEAD)
GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_DIRTY=false
if [ "$target" != cluster-check ] && [ -n "$(git status --porcelain)" ]; then
  [ "${ALLOW_DIRTY:-}" = 1 ] || die "uncommitted changes; commit them, or set ALLOW_DIRTY=1 to record git.dirty: true"
  GIT_DIRTY=true
fi

# --- the cluster
[ "$(kubectl config current-context 2>/dev/null)" = "$CONTEXT" ] \
  || die "kubectl context is not $CONTEXT; run task cluster:start in NeuroMesh"
kubectl --context "$CONTEXT" get runtimeclass nvidia >/dev/null 2>&1 \
  || die "no nvidia RuntimeClass; run task cluster:status in NeuroMesh"

gpu_pods() {
  kubectl --context "$CONTEXT" get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name} {.status.phase} {.spec.containers[*].resources.limits.nvidia\.com/gpu}{"\n"}{end}' \
    | awk '$3 != "" && ($2 == "Running" || $2 == "Pending") {print $1}'
}
# a pod from an earlier run may still be going away
kubectl --context "$CONTEXT" -n "$NS" wait --for=delete pod -l app.kubernetes.io/part-of=infinity-bench --timeout=60s >/dev/null 2>&1 || true
CLUSTER_OTHER_GPU_PODS=$(gpu_pods | paste -sd, -)
if [ -n "$CLUSTER_OTHER_GPU_PODS" ]; then
  echo "These pods hold nvidia.com/gpu and would be in every reading:" >&2
  tr , '\n' <<<"$CLUSTER_OTHER_GPU_PODS" | sed 's/^/  /' >&2
  die "scale them to 0 first, for example: kubectl -n <ns> scale deploy/<name> --replicas=0"
fi
if [ "$target" = cluster-check ]; then
  kubectl --context "$CONTEXT" get namespace "$NS" >/dev/null 2>&1 \
    || die "no namespace $NS; kubectl apply -f deploy/namespace.yaml"
  echo "gpu-lab is ready: context, nvidia RuntimeClass, namespace $NS, no other pod on the GPU"
  exit 0
fi

# --- the image, imported straight into k3s's containerd; no registry
IMAGE=infinity-bench:${GIT_SHA:0:12}
echo "building $IMAGE"
docker build -q -t "$IMAGE" bench >/dev/null
echo "importing into k3s"
docker save "$IMAGE" | wsl.exe -d "$DISTRO" -u root -- k3s ctr images import - >/dev/null

# --- what the pod can't see for itself
build=$(cmd.exe /c ver | tr -d '\r' | sed -n 's/.*Version \([0-9.]*\).*/\1/p')
[ "$(cut -d. -f3 <<<"$build")" -ge 22000 ] && HOST_OS="Windows 11 $build" || HOST_OS="Windows 10 $build"
HOST_WSL=$(wsl.exe --version | tr -d '\0\r' | sed -n '1s/[^0-9]*\([0-9.]*\).*/\1/p')
HOST_DISTRO=$(wsl_ lsb_release -ds)
HOST_CPU=$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Processor).Name' | tr -d '\r' | xargs)
HOST_RAM_GB=$(powershell.exe -NoProfile -Command '[math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory/1GB,1).ToString([cultureinfo]::InvariantCulture)' | tr -d '\r')
HOST_WSL_MEMORY_GB=$(wsl_ free -b | awk 'NR==2 {printf "%.1f", $2/2^30}')
CLUSTER_CONTEXT=$CONTEXT
CLUSTER_NODE=$(kubectl --context "$CONTEXT" get nodes -o jsonpath='{.items[0].metadata.name}')
CLUSTER_K3S=$(kubectl --context "$CONTEXT" get nodes -o jsonpath='{.items[0].status.nodeInfo.kubeletVersion}')
CLUSTER_TOOLKIT=$(wsl_ dpkg-query -W nvidia-container-toolkit | awk '{print $2}')  # no -f: wsl.exe expands ${...}
CLUSTER_DEVICE_PLUGIN=$(kubectl --context "$CONTEXT" -n kube-system get ds -o jsonpath='{.items[*].spec.template.spec.containers[*].image}' | tr ' ' '\n' | sed -n 's/.*k8s-device-plugin:\(.*\)/\1/p' | head -1)
CLUSTER_TIME_SLICING=$(kubectl --context "$CONTEXT" get nodes -o jsonpath='{.items[0].status.allocatable.nvidia\.com/gpu}')
# The distro runs on UTC, so the pod gets Windows' offset from Git Bash, e.g. -0500.
UTC_OFFSET=$(date +%z)

if [ "$target" = env ]; then HARNESS=env; OUT=data/.env-check; else HARNESS=$target; OUT=data/$target; fi
mkdir -p "$OUT"
win=$(cd "$OUT" && pwd -W)
OUT_HOST="/mnt/$(tr '[:upper:]' '[:lower:]' <<<"${win:0:1}")${win:2}"
POD="$HARNESS-$(date +%Y%m%d-%H%M%S)"

export POD HARNESS IMAGE UTC_OFFSET OUT_HOST GIT_SHA GIT_DIRTY GIT_BRANCH \
  HOST_OS HOST_WSL HOST_DISTRO HOST_CPU HOST_RAM_GB HOST_WSL_MEMORY_GB \
  CLUSTER_CONTEXT CLUSTER_NODE CLUSTER_K3S CLUSTER_TOOLKIT CLUSTER_DEVICE_PLUGIN \
  CLUSTER_TIME_SLICING CLUSTER_OTHER_GPU_PODS
vars=$(grep -o '\${[A-Z0-9_]*}' deploy/harness-pod.yaml | sort -u | tr -d '\n')
left=$(envsubst "$vars" <deploy/harness-pod.yaml | grep -o '\${[A-Za-z0-9_]*}' || true)
[ -z "$left" ] || die "harness-pod.yaml has placeholders run.sh doesn't fill: $left"

kubectl --context "$CONTEXT" apply -f deploy/namespace.yaml >/dev/null
trap 'kubectl --context "$CONTEXT" -n "$NS" delete pod "$POD" --wait=false >/dev/null 2>&1 || true' EXIT
trap 'exit 130' INT TERM HUP  # so EXIT runs, and the pod goes, when the run is stopped
envsubst "$vars" <deploy/harness-pod.yaml | kubectl --context "$CONTEXT" apply -f - >/dev/null
kubectl --context "$CONTEXT" -n "$NS" wait --for=condition=Ready "pod/$POD" --timeout=120s >/dev/null

if [ "$target" = env ]; then
  kubectl --context "$CONTEXT" -n "$NS" exec "$POD" -- python -m _lib.capture_env
  rmdir "$OUT" 2>/dev/null || true
else
  tty=-i; [ -t 3 ] && tty=-it
  kubectl --context "$CONTEXT" -n "$NS" exec $tty "$POD" -- python "$target/harness.py" "${@:2}" <&3
  echo "results in $OUT/"
fi
