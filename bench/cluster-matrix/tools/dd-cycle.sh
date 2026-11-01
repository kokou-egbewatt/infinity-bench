#!/usr/bin/env bash
# Step 08 timing, from Git Bash: Docker Desktop Kubernetes (kind mode) from images removed to a
# rationed level-50 pod, using the WSL driver bundle for the plugin and the pod.
#   usage: dd-cycle.sh <out dir> <cycle no>
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; T=/mnt/c${HERE#/c}; T=${T%/tools}
O="$1"; i="$2"; S="$APPDATA/Docker/settings-store.json"; CSV="$O/cycles.csv"
IMAGES="kindest/node:v1.35.5 docker/desktop-cloud-provider-kind:v0.6.0 docker/desktop-containerd-registry-mirror:v0.0.4 envoyproxy/envoy:v1.36.7"
t() { date +%s.%N; }
d() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
status() { docker desktop kubernetes status --format json 2>/dev/null | grep -oE '"status": *"[a-z]+"' | grep -oE '[a-z]+"$' | tr -d '"'; }
wsl -d Ubuntu -- sleep 1800 & KEEP=$!
export KUBECONFIG="$(cygpath -w ~/.kube/config)"

# from wherever it is: reset, disable, remove images
[ "$(status)" = running ] && docker desktop kubernetes reset-cluster > "$O/cycle$i-reset.log" 2>&1
sed -i 's/"KubernetesEnabled": *true/"KubernetesEnabled": false/' "$S"
docker desktop restart > /dev/null 2>&1
docker rmi $IMAGES > "$O/cycle$i-rmi.log" 2>&1
b=$(wsl -d Ubuntu -- bash "$T/tools/vram.sh" 20); vb=${b#vram_mib=}; vb=${vb%% *}; mb=${b##*wsl_mem_mib=}

sed -i 's/"KubernetesEnabled": *false/"KubernetesEnabled": true/' "$S"
t0=$(t); docker desktop restart > /dev/null 2>&1
for _ in $(seq 1 1800); do [ "$(status)" = running ] && break; sleep 0.5; done
t1=$(t)
for _ in $(seq 1 600); do kubectl get nodes 2>/dev/null | grep -q ' Ready' && break; sleep 0.5; done
t2=$(t)
kubectl apply -f - < "$HERE/../../../data/cluster-matrix/2026-10-29/03-k3s/raw/nvidia-device-plugin-v0.18.2.yml" >/dev/null
kubectl -n kube-system patch ds nvidia-device-plugin-daemonset --type=strategic --patch-file "$(cygpath -w "$HERE/../../../data/cluster-matrix/2026-10-29/08-docker-desktop/raw/plugin-bundle-patch.yaml")" >/dev/null
for _ in $(seq 1 600); do a=$(kubectl get node desktop-control-plane -o jsonpath='{.status.allocatable.nvidia\.com/gpu}' 2>/dev/null); [ -n "$a" ] && [ "$a" != 0 ] && break; sleep 0.5; done
t3=$(t)
kubectl create configmap probe-inner --from-file=inner.sh="$(cygpath -w "$HERE/inner.sh")" >/dev/null 2>&1
until kubectl get serviceaccount default >/dev/null 2>&1; do sleep 0.5; done
sed 's/name: probe-a-bundle/name: probe-cycle'"$i"'/; s/^  restartPolicy: Never/  restartPolicy: Never\n  # rationed: asks the scheduler for the GPU/' "$HERE/../../../data/cluster-matrix/2026-10-29/08-docker-desktop/raw/pod-a-bundle.yaml" \
  | sed 's/^    securityContext: {privileged: true}/    resources: {limits: {nvidia.com\/gpu: 1}}\n    securityContext: {privileged: true}/' > "$O/pod-cycle$i.yaml"
kubectl apply -f - < "$O/pod-cycle$i.yaml" >/dev/null
for _ in $(seq 1 600); do s=$(kubectl get pod "probe-cycle$i" -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null); [ -n "$s" ] && break; sleep 0.5; done
t4=$(t)
kubectl logs "probe-cycle$i" -c probe > "$O/probe-cycle$i.txt" 2>&1
lvl=$(grep -o '"level": [0-9]*' "$O/probe-cycle$i.txt" | grep -o '[0-9]*$')
u=$(wsl -d Ubuntu -- bash "$T/tools/vram.sh" 20); vu=${u#vram_mib=}; vu=${vu%% *}; mu=${u##*wsl_mem_mib=}
[ -f "$CSV" ] || echo "cycle,restart_to_running_s,to_ready_s,plugin_s,pod_s,to_level50_s,level,vram_before,vram_up,mem_before,mem_up" > "$CSV"
echo "$i,$(d $t0 $t1),$(d $t1 $t2),$(d $t2 $t3),$(d $t3 $t4),$(d $t0 $t4),${lvl:-none},$vb,$vu,$mb,$mu" | tee -a "$CSV"
kill $KEEP 2>/dev/null
