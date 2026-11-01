#!/usr/bin/env bash
# Step 03 timing: cold install -> Ready -> image -> level-50 pod -> uninstall, N times, all inside
# one wsl.exe session so the distro cannot idle out mid-run. Runs as root inside Ubuntu.
#   usage: k3s-cycle.sh <out dir> [n=3]
O="$1"; N="${2:-3}"; HERE="$(cd "$(dirname "$0")" && pwd)"; K="k3s kubectl"
TAR="$HERE/../probe/probe-01.tar"
CSV="$O/cycles.csv"
t() { date +%s.%N; }
d() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.1f", b-a}'; }
clean() {
  [ -x /usr/local/bin/k3s-uninstall.sh ] && /usr/local/bin/k3s-uninstall.sh >/dev/null 2>&1
  rm -rf /etc/rancher /var/lib/rancher
}
clean
[ -f "$CSV" ] || echo "cycle,install_s,ready_s,import_s,probe_s,to_level50_s,level,uninstall_s,mem_before_mib,mem_at_l50_mib,disk_before_mib,disk_at_l50_mib,rancher_mib" > "$CSV"
for i in $(seq "${START:-1}" $(( ${START:-1} + N - 1 ))); do
  mb=$(free -m | awk 'NR==2{print $3}'); db=$(df -BM --output=used / | tail -1 | tr -dc 0-9)
  t0=$(t)
  curl -sfL https://get.k3s.io | K3S_NODE_NAME=gpu-lab sh - > "$O/cycle$i-install.log" 2>&1
  t1=$(t)
  until [ "$($K get node gpu-lab -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ]; do sleep 0.2; done
  t2=$(t)
  k3s ctr images import "$TAR" > "$O/cycle$i-import.log" 2>&1
  $K create configmap probe-inner --from-file=inner.sh="$HERE/inner.sh" >/dev/null
  t3=$(t)
  until $K get serviceaccount default >/dev/null 2>&1; do sleep 0.2; done
  cat <<YAML | $K apply -f - >/dev/null
apiVersion: v1
kind: Pod
metadata: {name: probe}
spec:
  restartPolicy: Never
  runtimeClassName: nvidia
  containers:
  - name: probe
    image: docker.io/library/cluster-matrix-probe:01
    imagePullPolicy: Never
    command: [sh, /probe/inner.sh]
    env:
    - {name: NVIDIA_VISIBLE_DEVICES, value: all}
    - {name: NVIDIA_DRIVER_CAPABILITIES, value: 'compute,utility'}
    volumeMounts: [{name: inner, mountPath: /probe}]
  volumes: [{name: inner, configMap: {name: probe-inner}}]
YAML
  # the service account token controller can lag a fresh cluster; retry until the pod exists
  for _ in $(seq 1 600); do
    s=$($K get pod probe -o jsonpath='{.status.containerStatuses[0].state.terminated.exitCode}' 2>/dev/null)
    [ -n "$s" ] && break; sleep 0.2
  done
  t4=$(t)
  $K logs probe > "$O/cycle$i-probe.txt" 2>&1
  lvl=$(grep -o '"level": [0-9]*' "$O/cycle$i-probe.txt" | grep -o '[0-9]*$')
  ma=$(free -m | awk 'NR==2{print $3}'); da=$(df -BM --output=used / | tail -1 | tr -dc 0-9)
  rm_=$(du -sm /var/lib/rancher | cut -f1)
  t5=$(t); clean; t6=$(t)
  echo "$i,$(d $t0 $t1),$(d $t1 $t2),$(d $t2 $t3),$(d $t3 $t4),$(d $t0 $t4),${lvl:-none},$(d $t5 $t6),$mb,$ma,$db,$da,$rm_" | tee -a "$CSV"
  sleep 10
done
