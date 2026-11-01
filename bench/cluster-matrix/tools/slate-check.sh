#!/usr/bin/env bash
# Is the machine back to a blank slate? Run from Git Bash; diff two runs to see what a candidate left.
# GPU memory moves with the desktop, so it is printed last and ignored when comparing.
export MSYS_NO_PATHCONV=1
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "## WSL distros"
wsl -l -v | iconv -f UTF-16LE -t UTF-8 | tr -d '\r' | sed 's/^[ *]*//' | awk 'NR>1 && NF {print $1}' | sort

echo "## Ubuntu"
wsl -d Ubuntu -u root -- bash "$(wslpath -u "$here/slate-wsl.sh" 2>/dev/null || echo "/mnt/c${here#/c}/slate-wsl.sh")"

echo "## Docker containers (all)"
docker ps -a --format '{{.Names}} {{.Image}} {{.State}}' | sort
echo "## Docker networks"
docker network ls --format '{{.Name}}' | sort
echo "## Docker volumes"
docker volume ls -q | sort
echo "## Docker images (cluster tooling)"
docker images --format '{{.Repository}}:{{.Tag}}' | grep -Ei 'kind|k3d|k3s|rancher|minikube|kicbase|gpu_probe|cluster-matrix' | sort || true
echo "## Docker Desktop Kubernetes"
grep -ho '"KubernetesEnabled": *[a-z]*' "$APPDATA/Docker/settings-store.json" 2>/dev/null || echo unknown

echo "## kubeconfig"
kubectl config get-contexts -o name 2>&1
echo "## ~/.kube"; ls -A ~/.kube 2>/dev/null | grep -v "^retired-" || true
echo "## tools"
for t in kind k3d minikube rdctl; do printf '%s: ' "$t"; command -v "$t" >/dev/null && echo present || echo absent; done
# any minikube command recreates an empty ~/.minikube, so only ask it when the folder is already there
if [ -d ~/.minikube ]; then
  minikube profile list -o json 2>/dev/null | grep -o '"Name":"[^"]*"' || echo "minikube profiles: none"
  printf 'minikube dir: '; du -sh ~/.minikube | cut -f1
else
  echo "minikube dir: absent"
fi
echo "## leftovers"
ls -d "$LOCALAPPDATA/rancher-desktop" ~/.rd ~/.kind ~/.k3d "/c/Program Files/Rancher Desktop" 2>/dev/null || true

echo "## Driver"
nvidia-smi.exe --query-gpu=driver_version --format=csv,noheader
nvidia-smi.exe | sed -n 3p | tr -s ' '

echo "## GPU (not compared)"
nvidia-smi.exe --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader
