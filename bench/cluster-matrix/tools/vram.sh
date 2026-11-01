#!/usr/bin/env bash
# Median whole-card memory.used over N one-second samples, plus WSL VM memory. Runs inside WSL.
#   usage: vram.sh [n=20]
source "$(dirname "$0")/../probe/lib.sh"
set +eu
n="${1:-20}"
v=$(for _ in $(seq 1 "$n"); do vram_used; sleep 1; done | median)
m=$(free -m | awk 'NR==2{print $3}')
echo "vram_mib=$v wsl_mem_mib=$m"
