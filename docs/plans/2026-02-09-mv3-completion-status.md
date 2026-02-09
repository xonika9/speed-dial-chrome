# MV3 Completion Status (2026-02-09)

## Gate
- `bash scripts/release-gate.sh`: PASS
- `rg -n "chrome\.extension\.|runtime\.getBackgroundPage|tabs\.executeScript\(|\beval\s*\(" src`: no matches

## Runtime State
- Default UI runtime: `module` (`src/ui/bootstrap.js`)
- Root legacy bridge files removed from runtime path:
  - `background.js` -> archived at `docs/legacy/background.legacy.js`
  - `sw.js` -> archived at `docs/legacy/sw.legacy.js`
- Module runtime now composes:
  - compat API (`src/ui/runtime/compat/**`)
  - extracted legacy UI initializers (`src/ui/runtime/legacy-initializers.js`)

## UI Initializer Coverage
- Legacy `init*` extracted: `110`
- Extracted initializers are generated from `docs/legacy/background.legacy.js` via:
  - `node scripts/generate-legacy-ui-runtime.mjs`
- Module registry continues to host native extracted modules in `src/ui/index.js`; missing native registrations are covered at runtime by extracted legacy initializer map.

## Parity Notes
- Added legacy namespace compatibility in module runtime API:
  - `api.i18n`
  - `api.iconsURLMapping` / `api.iconsUrlMapping`
  - `api.feedSubscriptionsBookmarks`
- Added feed event alias broadcast for legacy listeners:
  - `feedSubscriptionsBookmarks/change`

## Remaining Work
- Manual browser smoke acceptance matrix is still required for full functional parity sign-off (`NewtabUI`, `PopupUI`, `SettingsUI`, `FirstrunUI`, feeds/search/news dialogs, restart scenarios).
