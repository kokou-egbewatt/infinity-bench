#!/usr/bin/env bash
# One bare-host (L0) probe run inside WSL, no container.
B="$(dirname "$0")/../probe/bin/gpu_probe"
chmod +x "$B"
echo "## ldd"; ldd "$B"
echo "## run: gpu_probe 2048 0"; "$B" 2048 0; echo "exit=$?"
