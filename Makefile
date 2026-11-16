# Run from Git Bash. `make` lists the targets.
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

.PHONY: help setup check env vram-accounting ci-version-gate ci-changelog ci-doc-links

help: ## list the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

setup: ## install the bench and site dependencies
	cd bench && uv sync
	cd site && pnpm install --frozen-lockfile

check: ## ruff and pytest for bench/
	cd bench && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

env: ## print the env.json a harness run would record, from a pod on gpu-lab
	bash bench/run.sh env

vram-accounting: ## measure what the desktop holds on the GPU; asks you to close and reopen apps
	bash bench/run.sh vram-accounting

ci-version-gate: ## the CI checks, from a terminal
	bash ci/scripts/version-gate.sh
ci-changelog:
	bash ci/scripts/changelog-integrity.sh
ci-doc-links:
	bash ci/scripts/check-doc-links.sh
