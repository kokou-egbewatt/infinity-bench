#!/usr/bin/env bash
# Step 10: the blog's GPU cluster. Runs as root inside Ubuntu.
O="$1"
t0=$(date +%s.%N)
curl -sfL https://get.k3s.io | K3S_NODE_NAME=gpu-lab K3S_KUBECONFIG_MODE=644 sh - > "$O/install.log" 2>&1
until [ "$(k3s kubectl get node gpu-lab -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null)" = "True" ]; do sleep 0.5; done
t1=$(date +%s.%N)
echo "install to Ready: $(awk -v a=$t0 -v b=$t1 'BEGIN{printf "%.1f", b-a}') s"
k3s --version | head -1
ls -l /etc/rancher/k3s/k3s.yaml
k3s kubectl get runtimeclass nvidia -o custom-columns=NAME:.metadata.name,HANDLER:.handler --no-headers
