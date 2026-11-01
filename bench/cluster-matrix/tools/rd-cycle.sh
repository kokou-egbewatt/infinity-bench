#!/usr/bin/env bash
# Step 07 timing, from Git Bash: Rancher Desktop factory reset (k3s cache removed) -> start pinned to
# Kubernetes 1.36.5 -> probe image -> hostpath-patched plugin -> rationed hostpath level-50 pod.
#   usage: rd-cycle.sh <out dir> <cycle no>
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"; T=/mnt/c${HERE#/c}; T=${T%/tools}
O="$1"; i="$2"; CSV="$O/cycles.csv"
RDCTL="$LOCALAPPDATA/Programs/Rancher Desktop/resources/resources/win32/bin/rdctl.exe"
t() { date +%s.%N; }
d() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
export KUBECONFIG="$(cygpath -w ~/.kube/config)"
wsl -d Ubuntu -- sleep 1800 & KEEP=$!

"$RDCTL" factory-reset --remove-kubernetes-cache > "$O/cycle$i-reset.log" 2>&1
for _ in $(seq 1 120); do tasklist | grep -qi "rancher desktop" || break; sleep 1; done
b=$(wsl -d Ubuntu -- bash "$T/tools/vram.sh" 20); vb=${b#vram_mib=}; vb=${vb%% *}; mb=${b##*wsl_mem_mib=}

t0=$(t)
# rdctl start stays attached to the app, so it runs in the background
"$RDCTL" start --container-engine.name=containerd --kubernetes.enabled --kubernetes.version=1.36.5 \
  --application.start-in-background --no-modal-dialogs > "$O/cycle$i-start.log" 2>&1 &
for _ in $(seq 1 1800); do
  kubectl --context rancher-desktop get nodes 2>/dev/null | grep -q ' Ready' && break; sleep 0.5
done
t1=$(t)
"$RDCTL" shell nerdctl --namespace k8s.io load -i "$T/probe/probe-01.tar" > "$O/cycle$i-import.log" 2>&1
t2=$(t)
kubectl config use-context rancher-desktop >/dev/null
kubectl -n kube-system delete ds nvidia-device-plugin-daemonset --ignore-not-found --wait=true >/dev/null 2>&1
kubectl apply -f - < "$HERE/../../../data/cluster-matrix/2026-10-29/03-k3s/raw/nvidia-device-plugin-v0.18.2.yml" >/dev/null
kubectl -n kube-system patch ds nvidia-device-plugin-daemonset --type=strategic --patch-file "$(cygpath -w "$HERE/../../../data/cluster-matrix/2026-10-29/04-k3d/raw/plugin-hostpath-patch.yaml")" >/dev/null
node=$(kubectl get nodes -o jsonpath='{.items[0].metadata.name}')
for _ in $(seq 1 600); do a=$(kubectl get node "$node" -o jsonpath='{.status.allocatable.nvidia\.com/gpu}' 2>/dev/null); [ -n "$a" ] && [ "$a" != 0 ] && break; sleep 0.5; done
t3=$(t)
bash "$HERE/kpod.sh" "$O" "cycle$i" - 1 hostpath 120 > "$O/cycle$i-kpod.txt" 2>&1
t4=$(t)
lvl=$(grep -o '"level": [0-9]*' "$O/probe-cycle$i.txt" | grep -o '[0-9]*$')
v=$(kubectl get node "$node" -o jsonpath='{.status.nodeInfo.kubeletVersion}')
u=$(wsl -d Ubuntu -- bash "$T/tools/vram.sh" 20); vu=${u#vram_mib=}; vu=${vu%% *}; mu=${u##*wsl_mem_mib=}
[ -f "$CSV" ] || echo "cycle,start_to_ready_s,import_s,plugin_s,pod_s,to_level50_s,level,k8s,vram_before,vram_up,mem_before,mem_up" > "$CSV"
echo "$i,$(d $t0 $t1),$(d $t1 $t2),$(d $t2 $t3),$(d $t3 $t4),$(d $t0 $t4),${lvl:-none},$v,$vb,$vu,$mb,$mu" | tee -a "$CSV"
kill $KEEP 2>/dev/null
