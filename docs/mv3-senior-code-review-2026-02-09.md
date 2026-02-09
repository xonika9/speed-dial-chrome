# MV3 Senior Code Review — `mv3-migration` vs `origin/main`

**Date:** 2026-02-09
**Branch:** `mv3-migration` (81 files, +18 123 / −161 vs `origin/main`)
**Reviewer scope:** bootstrap/SW readiness, settings defaults, settings sync, security policy, runtime parity

---

## Executive Summary

The MV3 migration replaces the legacy MV2 background page monolith with a service-worker entry point (`src/background.js`), a message-driven API layer (`src/api/*`), and a compatibility runtime (`src/ui/runtime/compat/*`) that lets 110 legacy UI initializers run unchanged. The architecture is sound: messaging is well-factored, the compat shim faithfully reproduces the legacy `api.*` surface, and a comprehensive gate (`release-gate.sh`) enforces parity, defaults coverage, and policy constraints.

The findings below identify 10 issues — 3 at P1, 4 at P2, 3 at P3 — none of which are release-blockers on their own, but the P1 items can produce hard-to-diagnose runtime failures under real-world service-worker lifecycle conditions.

All checks pass at time of review:

```
bash scripts/release-gate.sh → OK
git status --short → (clean)
git diff --stat origin/main...HEAD → 81 files, 18123+/161-
```

---

## P1 — High (3 findings)

### 1. `apiReadyPromise` rejection swallowed during polling

| Field | Value |
|---|---|
| **Files** | `src/page-init.js:76-93`, `src/background.js:28-38` |
| **Symptom** | If a required API init fails (e.g. `initSettings()` throws), `rejectAPIReady(error)` fires in the SW. But `waitForMessageResponse()` on the page side catches *all* errors — including the rejection propagated as `{ error: "..." }` — and retries up to 50 times, discarding the actual error message each iteration. After 5 s the user sees only the generic timeout: `"Service worker did not become ready in time"`. |

**Root cause:** `waitForMessageResponse` (line 76) has a bare `catch {}` that swallows every response error including the meaningful rejection reason. When `waitUntilReady` awaits the rejected `apiReadyPromise`, the handler in `messaging.js:49` catches the error and returns `{ error: error.message }`. Back on the page, `sendRuntimeMessage` *does* reject with that message (line 59–61), but the outer `catch` at line 85 eats it.

```js
// src/page-init.js:85
} catch {
  // Service worker can still be starting up.    ← masks real failures
}
```

**Impact:** Developers and users cannot distinguish "SW still booting" from "SW fatally broken" — both produce the same 5-second hang → generic error.

**Suggested fix:** Propagate the error type. If the response contains `{ error }` matching a known fatal pattern (e.g. the rejection from `waitUntilReady`), break out of the retry loop immediately and surface the original message.

---

### 2. `getAll()` drops defaults for removed keys

| Field | Value |
|---|---|
| **Files** | `src/api/settings.js:165-172` (remove), `src/api/settings.js:177-180` (getAll), `src/ui/runtime/compat/settings.js:36-38` (handleStorageChange) |
| **Symptom** | After `remove(key)`, `getAll()` returns a snapshot that lacks the default value for that key. The compat layer replaces its entire cache with this snapshot (`cache = { ...(settingsSnapshot || {}) }`), permanently losing the default. |

**Root cause:** `remove()` deletes the key from `settingsCache` (line 170). `getAll()` returns `{ ...settingsCache }` (line 179) without re-merging `defaults`. Meanwhile `get(key)` *does* fall through to `defaults[key]` (line 132), so the inconsistency is only visible through `getAll()`.

The compat layer's `handleStorageChange` path for removed keys calls `sendMessage('getAllSettings')` and replaces its cache wholesale (line 37–38). Since `getAllSettings` delegates to `getAll()`, the default is missing from the compat cache too.

```js
// src/api/settings.js:177-180
export async function getAll() {
  await loadSettings();
  return { ...settingsCache };   // ← no defaults merge after remove()
}
```

**Impact:** Any UI component reading a removed-then-defaulted setting via `settings.get(key)` from the compat layer will receive `undefined` instead of the default until the next full page reload (which re-runs `loadSettings` with the defaults merge).

**Suggested fix:** Change `getAll()` to return `{ ...defaults, ...settingsCache }`, mirroring the initial `loadSettings` merge.

---

### 3. `style/preload-images` missing from `onChanged` filter

| Field | Value |
|---|---|
| **File** | `src/page-init.js:257` |
| **Symptom** | The `storage.onChanged` listener that triggers live theme updates watches 4 style keys but omits `style/preload-images`. When the theme module updates this key, the page does not re-run `updateThemeStyle()`, so background image preloads become stale until the next navigation. |

```js
// src/page-init.js:257
const styleKeys = ['style/theme', 'style/background', 'style/background-filter', 'style/dock'];
//                  ← 'style/preload-images' is absent
```

`updateThemeStyle()` itself (line 148–187) *does* read `style/preload-images` and preloads images based on its value. The initial call works; only the live-update path is broken.

**Impact:** Theme switches that change background images will briefly show the old background (or a flash of the default) because the preload step is skipped.

**Suggested fix:** Add `'style/preload-images'` to the `styleKeys` array on line 257.

---

## P2 — Medium (4 findings)

### 4. `settings.ready()` has no timeout

| Field | Value |
|---|---|
| **File** | `src/ui/runtime/compat/settings.js:66-86` (ensureCache), `src/ui/runtime/compat/index.js:30` |
| **Symptom** | `ensureCache()` sends `getAllSettings` to the SW and awaits the response with no timeout or retry limit. If the SW message handler is unresponsive (e.g. stuck in an `await`), the entire UI bootstrap hangs indefinitely at `await settings.ready()` (compat/index.js:30). |

**Impact:** Unrecoverable blank-page state. No error is ever thrown, so the user sees a blank new-tab with no console error.

**Suggested fix:** Wrap the `sendMessage` call in a `Promise.race` with a reasonable timeout (e.g. 10 s) that rejects with a descriptive error.

---

### 5. `loadSettings()` leaks non-setting storage keys

| Field | Value |
|---|---|
| **File** | `src/api/settings.js:116-122` |
| **Symptom** | `loadSettings()` calls `chrome.storage.local.get(null)` which returns *all* keys — including `style/*`, `mv3-migration-complete`, `ui-runtime`, and `navigation/*` runtime keys. These are merged over defaults and become part of `settingsCache`. `getAllSettings` then exposes them to the compat layer, polluting the settings namespace. |

```js
// src/api/settings.js:119-120
const result = await chrome.storage.local.get(null);
settingsCache = { ...defaults, ...result };    // ← all storage keys included
```

**Impact:** Compat code iterating `getAll()` keys (e.g. `resetAll` dispatching events for every key) will dispatch spurious events for non-setting keys like `style/theme` or `mv3-migration-complete`. Not a correctness bug today, but a latent source of confusion and wasted event dispatches.

**Suggested fix:** Filter `result` to only keys present in `defaults` before merging, or load settings using an explicit key list: `chrome.storage.local.get(Object.keys(defaults))`.

---

### 6. `ui.isReady` await has no timeout

| Field | Value |
|---|---|
| **File** | `src/page-init.js:242` |
| **Symptom** | After DOM attachment, `initUI()` awaits `ui.isReady` (a Promise on the UI component instance). If the component's initialization logic never resolves this promise (e.g. a dependency error inside `init()` or `bind()`), the page hangs after the DOM is already visible — background is loaded but no interactive UI. |

```js
// src/page-init.js:242
await ui.isReady;    // ← no timeout, no error path
```

**Impact:** Silent hang with partial page render. The `bootstrap().catch()` error handler at line 274 never fires because the promise neither resolves nor rejects.

**Suggested fix:** Add a timeout wrapper. Consider whether `isReady` rejection should be surfaced differently from timeout (the former is a code bug, the latter might be a performance issue).

---

### 7. Double dispatch of settings events on `set`/`import`/`resetAll`

| Field | Value |
|---|---|
| **Files** | `src/ui/runtime/compat/settings.js:30` (storage.onChanged path), `src/ui/runtime/compat/settings.js:131-156` (resetAll/import paths) |
| **Symptom** | When `settings.set(key, value)` is called: (1) the background writes to `chrome.storage.local`, (2) `storage.onChanged` fires on the page and the compat handler dispatches `settings/{key}`, and (3) `set()` itself returns after the background write — no duplicate here. However, `resetAll()` and `import()` explicitly dispatch events for every key *and* the `storage.onChanged` listener also fires for all changed keys, producing duplicate `settings/{key}` events. |

```js
// resetAll - explicit dispatch (line 135-137)
Object.keys(cache).forEach(key => {
  eventBus.dispatch(`settings/${key}`, cache[key]);
});

// + storage.onChanged handler also dispatches for each changed key (line 30)
eventBus.dispatch(`settings/${key}`, nextValue);
```

**Impact:** UI components re-render twice for every setting during import/reset. Functionally correct but doubles the work and can cause visible flickering on slower devices.

**Suggested fix:** Remove the explicit dispatch loops from `resetAll` and `import`, relying solely on `storage.onChanged` as the single event source. Alternatively, debounce the storage listener during bulk operations.

---

## P3 — Low (3 findings)

### 8. Optional module failures not surfaced to page code

| Field | Value |
|---|---|
| **File** | `src/background.js:56-68` |
| **Symptom** | The `try/catch` around optional module inits (line 56–68) logs the error but provides no mechanism for page code to query which optional modules failed. If a user triggers a feature backed by a failed optional module, they get a generic `"Unknown action: <action>"` error from the message router. |

**Impact:** Poor debuggability. A failed `initFeeds()` produces a generic error when the user opens the news panel, with no indication that the module never initialized.

**Suggested fix:** Consider registering a `getModuleStatus` handler that returns the init state of each module. Page-side code could then show a meaningful "Feeds unavailable" message.

---

### 9. Redundant `waitForServiceWorker()` call in `initUI()`

| Field | Value |
|---|---|
| **Files** | `src/page-init.js:195`, `src/page-init.js:246` |
| **Symptom** | `bootstrap()` calls `waitForServiceWorker()` at line 246. Then `initUI()` calls it again at line 195. Since `initUI()` is only called from `bootstrap()` after the first wait completes, the second call is redundant. |

**Impact:** ~100 ms wasted on the success path (one extra ping + waitUntilReady roundtrip). No correctness issue.

**Suggested fix:** Remove the `waitForServiceWorker()` call from `initUI()` since `bootstrap()` already guarantees SW readiness. If `initUI()` needs to be callable independently in the future, add a comment documenting the precondition instead.

---

### 10. Policy scan does not cover `executeScript` bracket-notation or variable references

| Field | Value |
|---|---|
| **File** | `scripts/policy-scan.sh:12-13` |
| **Symptom** | The scan checks for `tabs.executeScript(` and `scripting.executeScript(` but does not catch alternative call patterns such as `chrome.tabs['executeScript']`, `const fn = chrome.scripting.executeScript; fn(...)`, or dynamic property access. |

```bash
# scripts/policy-scan.sh:12-13
"tabs\\.executeScript\\("
"scripting\\.executeScript\\("
```

**Impact:** A contributor could inadvertently bypass the policy gate using bracket notation. Low probability given the codebase style, but the gate's purpose is to catch exactly these cases.

**Suggested fix:** Add patterns for bracket-notation access (`tabs\[['"]executeScript['"]\]`) and consider a broader `executeScript` keyword grep with an allowlist filter.

---

## Verification Checklist

| Check | Result |
|---|---|
| `git status --short` | Clean (no uncommitted changes) |
| `git log --oneline -n 15` | All MV3 fix commits present (`ce88e0d` through `ce4fbf0`) |
| `git diff --stat origin/main...HEAD` | 81 files, 18 123 insertions, 161 deletions |
| `bash scripts/release-gate.sh` | **OK** — all sub-checks pass |
| Runtime parity | 110/110 legacy inits covered, smoke passes with `module` runtime |
| Settings defaults | 71 default keys, 54 unique used keys, all covered |
| Policy scan | OK — no forbidden patterns |

---

## Severity Summary

| Severity | Count | IDs |
|---|---|---|
| **P1** | 3 | #1, #2, #3 |
| **P2** | 4 | #4, #5, #6, #7 |
| **P3** | 3 | #8, #9, #10 |
| **Total** | **10** | |

---

## Recommended Fix Order

1. **#2** (getAll defaults) — Smallest change, highest data-correctness impact. One-line fix in `getAll()`.
2. **#3** (preload-images key) — One-line addition to the styleKeys array.
3. **#1** (error swallowing) — Requires careful retry-logic rework but prevents the hardest-to-debug failure mode.
4. **#7** (double dispatch) — Remove explicit dispatch loops from `resetAll`/`import` now that `storage.onChanged` is the canonical event source.
5. **#4** (settings.ready timeout) — Add `Promise.race` timeout wrapper.
6. **#6** (ui.isReady timeout) — Same pattern as #4.
7. **#5** (storage key leakage) — Filter `loadSettings` to defaults keys.
8. **#8–#10** — Address as time permits; none affect correctness.
