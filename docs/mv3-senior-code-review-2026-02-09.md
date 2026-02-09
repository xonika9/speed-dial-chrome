# MV3 Senior Code Review (2026-02-09)

## Findings

### [P1] Гонка инициализации SW: `ping` не гарантирует готовность handlers, из-за этого возможны флапающие падения bootstrap
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/page-init.js:76`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/page-init.js:117`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:14`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:32`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:55`
- **Почему:** страница ждёт только `ping`, но `needsMigration`/`getAllSettings` вызываются до гарантированной регистрации `initMigration`/`initSettings`; при cold start это даёт `Unknown action`.
- **Минимальный фикс:** добавить явный readiness-handshake (`waitUntilReady`) и ждать его в `page-init` перед миграцией/загрузкой runtime, либо регистрировать критичные handlers до async-инициализации.

### [P1] Несовместимые defaults в settings: runtime активно читает legacy-ключи, которых нет в `defaults`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/api/settings.js:9`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/legacy-initializers.js:1466`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/legacy-initializers.js:2870`
- **Почему:** в `defaults` нет ключей вроде `root-folder`, `show-dock`, `columns-max`, `search-engine`, `icon-url-mapping` и т.д., но legacy/runtime код их ожидает; это даёт `undefined`-поведение (особенно на чистой установке и для пользователей без явно сохранённых старых ключей).
- **Минимальный фикс:** вернуть/добавить legacy defaults (как минимум для всех ключей, читаемых runtime), плюс добавить gate-проверку «используемые settings key ⊆ defaults key».

### [P2] Потеря межвьюшечной синхронизации настроек (event/cache desync)
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:4`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:56`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/api/settings.js:194`
- **Почему:** compat-settings диспатчит `settings/*` только для локального `set()`, но не подписан на `chrome.storage.onChanged`; background settings тоже не бродкастит `settings/*` как раньше. Изменения из других контекстов могут не обновлять UI/кеш текущей страницы.
- **Минимальный фикс:** в compat-settings добавить подписку на `chrome.storage.onChanged` (обновление cache + `eventBus.dispatch("settings/<key>")`), либо бродкастить эти события из background и обновлять cache на клиенте.

### [P2] Gate-проверка security/compliance неполная относительно заявленного критерия `executeScript`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/release-gate.sh:31`, `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/policy-scan.sh:12`, `/Users/xonika/Documents/projects/speed-dial-chrome/src/api/browser.js:110`
- **Почему:** gate ловит только `tabs.executeScript`, но не `chrome.scripting.executeScript`; при этом runtime-path реально содержит `executeScript` (bookmarklet path).
- **Минимальный фикс:** расширить паттерны (`scripting\.executeScript\(`, при необходимости `new Function`) и явно зафиксировать allowlist/исключение для bookmarklet-флоу.

### [P3] `runtime-parity-check` даёт завышенную уверенность: проверяет покрытие имён, но не проверяет реальную исполняемость пути
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/runtime-parity-check.mjs:37`
- **Почему:** скрипт сравнивает только наборы init-имён; не ловит проблемы вроде «runtime загрузился, но API не ready/не резолвится в page bootstrap».
- **Минимальный фикс:** добавить smoke-check, который валидирует загрузку runtime API (минимум `loadUIRuntime + api.ui.initNewtabUI` в headless/интеграционном сценарии).

## Open Questions / Assumptions
1. Предположил, что clean install обязателен к поддержке (не только upgrade-path с уже заполненным `chrome.storage.local`).
2. Предположил, что требование “проверить `executeScript`” означает policy-level контроль, а не автоматическое разрешение bookmarklet-исключения.
3. Предположил, что popup/несколько extension-view должны получать те же settings/event-обновления, как в legacy runtime.

## Change Summary
- `git status --short`: рабочее дерево чистое (только `## mv3-migration...origin/mv3-migration [ahead 1]`).
- `git diff --stat` и `git diff` (относительно рабочего дерева): пусто.
- Для ревью анализировался branch diff относительно `origin/main...mv3-migration`.
- Прогнан gate: `bash /Users/xonika/Documents/projects/speed-dial-chrome/scripts/release-gate.sh` (PASS), но выявлены перечисленные архитектурные и quality-gate риски.
