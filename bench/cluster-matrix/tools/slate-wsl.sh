#!/usr/bin/env bash
# Runs inside the Ubuntu distro as root; called by slate-check.sh.
ls -d /usr/local/bin/k3s* /usr/local/bin/kubectl /usr/local/bin/k3d /usr/local/bin/kind \
  /etc/rancher /var/lib/rancher /var/lib/kubelet /run/k3s /etc/systemd/system/k3s* 2>/dev/null || true
printf 'k8s processes: '; pgrep -lf 'k3s|kubelet|containerd' | awk '{print $2}' | sort -u | tr '\n' ' '; echo
printf 'k8s mounts: '; mount | grep -cE 'k3s|kubelet|rancher'
printf 'cni interfaces: '; ip -br link | grep -cE 'cni|flannel|veth|kube'
printf 'iptables k8s rules: '; { iptables-save 2>/dev/null; iptables-legacy-save 2>/dev/null; } | grep -cE 'KUBE|CNI|FLANNEL'
printf 'toolkit: '; dpkg-query -W -f '${Version}\n' nvidia-container-toolkit 2>/dev/null || echo none
printf 'disk used /: '; df --output=used -BM / | tail -1 | tr -d ' '
