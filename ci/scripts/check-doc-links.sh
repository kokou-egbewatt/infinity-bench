#!/usr/bin/env bash
# Every relative Markdown link in a tracked .md file resolves to a file in this repo.
# External links are not checked: someone else's site being down is not this repo being wrong.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Counted lexically: realpath and pwd disagree on Windows (C:/ vs /c/).
climbs_out() {
  local depth=0 seg IFS='/'
  for seg in $1; do
    case "$seg" in
      "" | .) ;;
      ..) depth=$((depth - 1)); ((depth < 0)) && return 0 ;;
      *) depth=$((depth + 1)) ;;
    esac
  done
  return 1
}

broken=0
checked=0

while IFS= read -r doc; do
  dir="$(dirname "$doc")"
  while IFS= read -r target; do
    [[ -z "$target" ]] && continue
    case "$target" in
      http://* | https://* | mailto:* | \#*) continue ;;
    esac
    checked=$((checked + 1))
    path="$dir/${target%%#*}"
    if climbs_out "$path"; then
      echo "❌ $doc -> $target"
      echo "   leaves the repository; link to https://github.com/kokou-egbewatt/<repo>/blob/main/<path>"
      broken=$((broken + 1))
    elif [[ ! -e "$path" ]]; then
      echo "❌ $doc -> $target"
      broken=$((broken + 1))
    fi
  done < <(tr -d '\r' < "$doc" | grep -oE '\]\([^)]+\)' | sed -E 's/^\]\(//; s/\)$//; s/[[:space:]]+"[^"]*"$//')
done < <(git ls-files '*.md')

if [[ "$broken" -gt 0 ]]; then
  echo
  echo "$broken broken link(s)."
  exit 1
fi

echo "✅ $checked relative link(s) resolve."
