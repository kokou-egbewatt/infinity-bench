#!/usr/bin/env bash
# Step 03 tuning: the NVIDIA device plugin, as published, then with runtimeClassName: nvidia.
O="$1"; K="k3s kubectl"; V=v0.18.2
stamp() { printf '%s,%s\n' "$1" "$(date +%s.%N)" >> "$O/timeline.csv"; }
wait_alloc() { for _ in $(seq 1 "$1"); do a=$($K get node gpu-lab -o jsonpath='{.status.allocatable.nvidia\.com/gpu}'); [ -n "$a" ] && [ "$a" != 0 ] && { echo "allocatable=$a"; return 0; }; sleep 1; done; echo "allocatable='${a}' after $1 s"; return 1; }
curl -sfL -o "$O/nvidia-device-plugin-$V.yml" "https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/$V/deployments/static/nvidia-device-plugin.yml"
echo "## manifest: $(sha256sum "$O/nvidia-device-plugin-$V.yml")"
echo "## A. as published"
stamp plugin_published_applied
$K apply -f "$O/nvidia-device-plugin-$V.yml"
$K -n kube-system rollout status ds/nvidia-device-plugin-daemonset --timeout=180s
stamp plugin_published_running
wait_alloc 60
stamp plugin_published_checked
echo "## plugin logs (published)"; $K -n kube-system logs ds/nvidia-device-plugin-daemonset --tail=30
echo "## B. runtimeClassName: nvidia"
stamp plugin_rc_applied
$K -n kube-system patch ds nvidia-device-plugin-daemonset --type=json -p '[{"op":"add","path":"/spec/template/spec/runtimeClassName","value":"nvidia"}]'
$K -n kube-system rollout status ds/nvidia-device-plugin-daemonset --timeout=180s
wait_alloc 120 && stamp plugin_rc_allocatable
echo "## plugin logs (runtimeClass)"; $K -n kube-system logs ds/nvidia-device-plugin-daemonset --tail=30
