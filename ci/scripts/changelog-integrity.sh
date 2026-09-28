#!/usr/bin/env bash
# CHANGELOG.md is structurally sound, and its newest entry is the version in site/package.json.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHANGELOG="$ROOT_DIR/CHANGELOG.md"

# CR stripped everywhere: under act a Windows checkout mixes line endings, and two values
# then print the same and compare unequal.
SHIPPED=$(tr -d '\r' < "$ROOT_DIR/site/package.json" | grep -m1 -E '^\s*"version":' | sed -E 's/.*"version":\s*"([^"]+)".*/\1/')
mapfile -t VERSIONS < <(tr -d '\r' < "$CHANGELOG" | grep -oE '^## \[[0-9]+\.[0-9]+\.[0-9]+\]' | sed -E 's/^## \[(.*)\]/\1/')

if [[ ${#VERSIONS[@]} -eq 0 ]]; then
  echo "❌ No released version headings in CHANGELOG.md."
  exit 1
fi

DUPLICATES=$(printf '%s\n' "${VERSIONS[@]}" | sort | uniq -d)
if [[ -n "$DUPLICATES" ]]; then
  echo "❌ CHANGELOG.md uses a version more than once:"
  printf '   %s\n' $DUPLICATES
  exit 1
fi

SORTED=$(printf '%s\n' "${VERSIONS[@]}" | sort -V -r)
if [[ "$(printf '%s\n' "${VERSIONS[@]}")" != "$SORTED" ]]; then
  echo "❌ CHANGELOG.md versions are not newest first:"
  echo "   found:    $(printf '%s ' "${VERSIONS[@]}")"
  echo "   expected: $(echo "$SORTED" | tr '\n' ' ')"
  exit 1
fi

# One step in one component, lower components reset: after 0.3.0 comes 0.4.0, 0.3.1 or 1.0.0.
for ((i = 0; i < ${#VERSIONS[@]} - 1; i++)); do
  NEWER="${VERSIONS[i]}"
  OLDER="${VERSIONS[i + 1]}"
  IFS=. read -r MA MI PA <<<"$OLDER"
  if [[ "$NEWER" != "$((MA + 1)).0.0" && "$NEWER" != "$MA.$((MI + 1)).0" && "$NEWER" != "$MA.$MI.$((PA + 1))" ]]; then
    echo "❌ CHANGELOG.md skips a version: $OLDER is followed by $NEWER"
    echo "   Expected one of: $((MA + 1)).0.0, $MA.$((MI + 1)).0, $MA.$MI.$((PA + 1))"
    exit 1
  fi
done

if [[ "$SHIPPED" != "${VERSIONS[0]}" ]]; then
  echo "❌ site/package.json and the newest CHANGELOG.md entry disagree:"
  echo "   site/package.json: $SHIPPED"
  echo "   CHANGELOG.md:      ${VERSIONS[0]}"
  exit 1
fi

echo "✅ CHANGELOG.md is sound: ${#VERSIONS[@]} entries, newest first, no duplicates or gaps, newest is ${VERSIONS[0]}."
