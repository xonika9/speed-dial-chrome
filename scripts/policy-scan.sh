#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CHECK_PATH="src"

PATTERNS=(
  "chrome\\.extension\\."
  "runtime\\.getBackgroundPage"
  "tabs\\.executeScript\\("
  "\\beval\\s*\\("
)

failed=0

for pattern in "${PATTERNS[@]}"; do
  matches="$(rg -n -e "$pattern" "$CHECK_PATH" || true)"
  if [[ -n "$matches" ]]; then
    echo "[policy-scan] Forbidden pattern found: $pattern"
    echo "$matches"
    echo
    failed=1
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "[policy-scan] FAILED"
  exit 1
fi

echo "[policy-scan] OK"
