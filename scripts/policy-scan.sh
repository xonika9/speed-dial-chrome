#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_PATH="src"

PATTERNS=(
  "chrome\\.extension\\."
  "runtime\\.getBackgroundPage"
  "tabs\\.executeScript\\("
  "scripting\\.executeScript\\("
  "tabs\\[.executeScript"
  "scripting\\[.executeScript"
  "new\\s+Function\\s*\\("
  "\\beval\\s*\\("
)

failed=0

for pattern in "${PATTERNS[@]}"; do
  matches="$(rg -n -e "$pattern" "$CHECK_PATH" || true)"
  if [[ -z "$matches" ]]; then
    continue
  fi

  disallowed_matches="$matches"
  if [[ "$pattern" == "scripting\\.executeScript\\(" ]]; then
    disallowed_matches="$(printf '%s\n' "$matches" | rg -v "^src/api/browser\\.js:.*policy-scan-allow: bookmarklet-executeScript" || true)"
  fi

  if [[ -z "$disallowed_matches" ]]; then
    continue
  fi

  echo "[policy-scan] Forbidden pattern found: $pattern"
  echo "$disallowed_matches"
  echo
  failed=1
done

if [[ "$failed" -ne 0 ]]; then
  echo "[policy-scan] FAILED"
  exit 1
fi

echo "[policy-scan] OK"
