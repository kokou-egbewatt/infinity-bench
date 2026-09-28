#!/usr/bin/env bash
# A change to anything that ships needs a version bump in site/package.json and a new
# CHANGELOG.md entry. Same logic on GitHub, under act, and from a terminal.
set -euo pipefail

VERSION_FILE=site/package.json
SHIPPED_PATHS=(site bench deploy data ci .github Makefile)

if git show-ref --verify --quiet refs/remotes/origin/main; then
  BASE=origin/main
else
  echo "❌ origin/main not found. Fetch it (actions/checkout needs fetch-depth: 0)."
  exit 1
fi

# --ignore-cr-at-eol: a Windows worktree is CRLF against an LF index, and a Linux container
# under act would otherwise read every file as rewritten.
if git diff --ignore-cr-at-eol -s --exit-code "$BASE" -- "${SHIPPED_PATHS[@]}"; then
  echo "✅ Nothing shipped changed against $BASE. Skipping version and changelog checks."
  exit 0
fi

echo "📦 Shipped files changed against $BASE."
if git diff --ignore-cr-at-eol "$BASE" -- "$VERSION_FILE" | grep -qE '^\+\s*"version":'; then
  echo "✅ Version updated in $VERSION_FILE."
else
  echo "❌ Version NOT updated in $VERSION_FILE."
  exit 1
fi

if git diff --ignore-cr-at-eol "$BASE" -- CHANGELOG.md | grep -q '^+## \['; then
  echo "✅ CHANGELOG.md has a new entry."
else
  echo "❌ CHANGELOG.md has no new entry."
  exit 1
fi
