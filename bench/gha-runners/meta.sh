#!/usr/bin/env bash
# The setup a result came from. Keep it next to the results.
#   bench/gha-runners/meta.sh > data/gha-runners/meta-$(date -u +%Y%m%d).txt
set -uo pipefail
echo "date_utc:      $(date -u +%FT%TZ)"
echo "docker:        $(docker version --format '{{.Server.Version}}')"
echo "vm_cpus:       $(docker info --format '{{.NCPU}}')"
echo "vm_memory:     $(docker info --format '{{.MemTotal}}')"
echo "vm_kernel:     $(docker info --format '{{.KernelVersion}}')"
echo "runner_image:  $(docker image inspect runner-fleet-runner:local --format '{{.Id}}' 2>/dev/null)"
echo "fleet_commit:  $(git -C "${FLEET:-.}" rev-parse HEAD 2>/dev/null)"
echo "containers:"
docker ps --filter label=com.docker.compose.project=runner-fleet \
  --format '  {{.Names}}  {{.Status}}' | sort
