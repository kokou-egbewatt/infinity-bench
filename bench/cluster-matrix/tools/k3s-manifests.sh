#!/usr/bin/env bash
# Step 10: install the device plugin (with the RuntimeClass) and the admission policy through k3s's
# auto-deploy folder, so both come back on every k3s start. Runs as root inside Ubuntu.
# T is the repo root, as WSL sees it.
T="$1"; M=/var/lib/rancher/k3s/server/manifests; K="k3s kubectl"
for _ in $(seq 1 60); do $K get runtimeclass nvidia >/dev/null 2>&1 && break; sleep 1; done
echo "runtimeclass: $($K get runtimeclass nvidia -o jsonpath='{.metadata.name} -> {.handler}')"
$K patch --local -f "$T/data/cluster-matrix/2026-10-29/03-k3s/raw/nvidia-device-plugin-v0.18.2.yml" --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/runtimeClassName","value":"nvidia"}]' -o yaml > "$M/nvidia-device-plugin.yaml"
cp "$T/bench/cluster-matrix/gpu-admission-policy.yaml" "$M/gpu-admission-policy.yaml"
grep -n runtimeClassName "$M/nvidia-device-plugin.yaml"
t0=$(date +%s.%N)
for _ in $(seq 1 240); do
  a=$($K get node gpu-lab -o jsonpath='{.status.allocatable.nvidia\.com/gpu}' 2>/dev/null)
  [ -n "$a" ] && [ "$a" != 0 ] && break; sleep 0.5
done
echo "allocatable=$a after $(awk -v a=$t0 -v b=$(date +%s.%N) 'BEGIN{printf "%.1f", b-a}') s"
for _ in $(seq 1 60); do $K get validatingadmissionpolicybinding gpu-request-and-runtimeclass-together >/dev/null 2>&1 && break; sleep 1; done
$K get validatingadmissionpolicy,validatingadmissionpolicybinding --no-headers
$K get addons -n kube-system --no-headers 2>/dev/null | grep -E 'nvidia|gpu'
k3s ctr images import "$T/bench/cluster-matrix/probe/probe-01.tar" | tail -1
