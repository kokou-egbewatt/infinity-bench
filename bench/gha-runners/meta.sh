#!/usr/bin/env bash
# The setup a result came from. Keep it next to the results.
#   bench/gha-runners/meta.sh > data/gha-runners/$(date -u +%F)/meta.txt
set -uo pipefail

# Compose project the fleet runs under, and the prefix on its container and volume names.
# Override it for a fleet named something else:
#   PROJECT=my-ci bench/gha-runners/meta.sh
project=${PROJECT:-runner-fleet}

echo "date_utc:      $(date -u +%FT%TZ)"
echo "project:       $project"
echo "docker:        $(docker version --format '{{.Server.Version}}')"
echo "vm_cpus:       $(docker info --format '{{.NCPU}}')"
echo "vm_memory:     $(docker info --format '{{.MemTotal}}')"
echo "vm_kernel:     $(docker info --format '{{.KernelVersion}}')"
echo "runner_image:  $(docker image inspect "${project}-runner:local" --format '{{.Id}}' 2>/dev/null)"
echo "fleet_commit:  $(git -C "${FLEET:-.}" rev-parse HEAD 2>/dev/null)"
echo "containers:"
docker ps --filter label="com.docker.compose.project=$project" \
  --format '  {{.Names}}  {{.Status}}' | sort
