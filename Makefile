# Run from Git Bash. `make` lists the targets.
SHELL := /bin/bash
.SHELLFLAGS := -eu -o pipefail -c
.DEFAULT_GOAL := help

.PHONY: help setup check cluster-check env vram-accounting dev site preview clean \
	ci-version-gate ci-changelog ci-doc-links

help: ## list the targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-18s %s\n", $$1, $$2}'

setup: ## install the bench and site dependencies
	cd bench && uv sync
	cd site && pnpm install --frozen-lockfile

check: ## ruff and pytest for bench/, then astro check and the site tests
	cd bench && uv run ruff check . && uv run ruff format --check . && uv run pytest -q
	cd site && pnpm check && pnpm test

cluster-check: ## gpu-lab is the context, has the nvidia RuntimeClass and namespace, and the GPU is free
	bash bench/run.sh cluster-check

env: ## print the env.json a harness run would record, from a pod on gpu-lab
	bash bench/run.sh env

vram-accounting: ## measure what the desktop holds on the GPU; asks you to close and reopen apps
	bash bench/run.sh vram-accounting

dev: ## the site with drafts, at localhost:4321
	cd site && pnpm dev

site: ## build the site into site/dist, the way the deploy does
	cd site && pnpm build

preview: ## serve site/dist
	cd site && pnpm preview

clean: ## remove build output and caches, and any finished harness pod
	rm -rf site/dist site/.astro bench/.pytest_cache bench/.ruff_cache
	find bench -name __pycache__ -type d -prune -exec rm -rf {} +
	-kubectl --context gpu-lab -n infinity-bench delete pod -l app.kubernetes.io/part-of=infinity-bench \
		--field-selector=status.phase!=Running --ignore-not-found

ci-version-gate: ## the version and changelog gate CI runs
	bash ci/scripts/version-gate.sh

ci-changelog: ## the CHANGELOG.md structure check CI runs
	bash ci/scripts/changelog-integrity.sh

ci-doc-links: ## the relative link check CI runs
	bash ci/scripts/check-doc-links.sh
