#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[release-gate] Running policy scan..."
bash scripts/policy-scan.sh

echo "[release-gate] Verifying themes list..."
node scripts/generate-theme-list.mjs --check

echo "[release-gate] Verifying legacy UI runtime extraction..."
node scripts/generate-legacy-ui-runtime.mjs --check

echo "[release-gate] Verifying root legacy runtime artifacts are removed..."
if [[ -e background.js || -e sw.js ]]; then
  echo "[release-gate] FAILED: root legacy artifacts background.js/sw.js must not exist"
  exit 1
fi

if rg -n "\"background\\.js\"|'background\\.js'|/sw\\.js" src/ui src/page-init.js page.html; then
  echo "[release-gate] FAILED: runtime still references legacy bridge paths"
  exit 1
fi

echo "[release-gate] Verifying runtime initializer parity..."
node scripts/runtime-parity-check.mjs

echo "[release-gate] Verifying settings defaults coverage..."
node scripts/settings-defaults-check.mjs

echo "[release-gate] Running UI extraction checks..."
node scripts/ui-extraction-check.mjs

echo "[release-gate] OK"
