#!/usr/bin/env bash
# Step 05 timing, from Git Bash: kind with the WSL folders mounted (extraMounts), device plugin with hostPath mounts,
# a rationed level-50 pod; then delete. Each cycle starts with the kind node image removed so it pays the
# pull, as k3s paid its download. A held wsl.exe session keeps the WSL VM up for the VRAM samples.
#   usage: k3d-cycle.sh <out dir> [n=3]
export MSYS_NO_PATHCONV=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
O="$1"; N="${2:-3}"; KIND="$HERE/../bin/kind.exe"; CFG="$(cygpath -w "$HERE/../../../data/cluster-matrix/2026-10-29/05-kind/raw/kind-wsl-mounts.yaml")"
T=/mnt/c${HERE#/c}; T=${T%/tools}
CSV="$O/cycles.csv"
IMAGES="$(docker images -q kindest/node)"
t() { date +%s.%N; }
d() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
vram() { wsl -d Ubuntu -- bash "$T/tools/vram.sh" 20; }
export KUBECONFIG="$(cygpath -w "$O")\\kubeconfig-cycle"

wsl -d Ubuntu -- sleep 3600 & KEEP=$!
[ -f "$CSV" ] || echo "cycle,create_s,ready_s,import_s,plugin_s,probe_s,to_level50_s,level,delete_s,vram_before,vram_up,vram_after,mem_before,mem_up,mem_after" > "$CSV"
for i in $(seq 1 "$N"); do
  "$KIND" delete cluster --name cm --kubeconfig "$KUBECONFIG" >/dev/null 2>&1
  docker rmi $(docker images -q kindest/node) >/dev/null 2>&1
  b=$(vram); vb=${b#vram_mib=}; vb=${vb%% *}; mb=${b##*wsl_mem_mib=}
  t0=$(t)
  "$KIND" create cluster --name cm --config "$CFG" --kubeconfig "$KUBECONFIG" --wait 120s > "$O/cycle$i-create.log" 2>&1
  t1=$(t)
  for _ in $(seq 1 600); do kubectl get nodes 2>/dev/null | grep -q ' Ready' && break; sleep 0.2; done
  t2=$(t)
  "$KIND" load docker-image cluster-matrix-probe:01 --name cm > "$O/cycle$i-import.log" 2>&1
  t3=$(t)
  kubectl apply -f - < "$HERE/../../../data/cluster-matrix/2026-10-29/03-k3s/raw/nvidia-device-plugin-v0.18.2.yml" >/dev/null
  kubectl -n kube-system patch ds nvidia-device-plugin-daemonset --type=strategic --patch-file "$(cygpath -w "$HERE/../../../data/cluster-matrix/2026-10-29/04-k3d/raw/plugin-hostpath-patch.yaml")" >/dev/null
  for _ in $(seq 1 600); do a=$(kubectl get node cm-control-plane -o jsonpath='{.status.allocatable.nvidia\.com/gpu}' 2>/dev/null); [ -n "$a" ] && [ "$a" != 0 ] && break; sleep 0.2; done
  t4=$(t)
  bash "$HERE/kpod.sh" "$O" "cycle$i" - 1 hostpath 120 > "$O/cycle$i-kpod.txt" 2>&1
  t5=$(t)
  lvl=$(grep -o '"level": [0-9]*' "$O/probe-cycle$i.txt" | grep -o '[0-9]*$')
  u=$(vram); vu=${u#vram_mib=}; vu=${vu%% *}; mu=${u##*wsl_mem_mib=}
  t6=$(t); "$KIND" delete cluster --name cm --kubeconfig "$KUBECONFIG" > "$O/cycle$i-delete.log" 2>&1; t7=$(t)
  a_=$(vram); va=${a_#vram_mib=}; va=${va%% *}; ma=${a_##*wsl_mem_mib=}
  echo "$i,$(d $t0 $t1),$(d $t1 $t2),$(d $t2 $t3),$(d $t3 $t4),$(d $t4 $t5),$(d $t0 $t5),${lvl:-none},$(d $t6 $t7),$vb,$vu,$va,$mb,$mu,$ma" | tee -a "$CSV"
done
kill $KEEP 2>/dev/null
