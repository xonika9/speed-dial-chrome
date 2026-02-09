# MV3 Senior Code Review (2026-02-09)

## Findings

### [P1] `waitUntilReady` сигнализирует ready до завершения критической инициализации
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:35`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:46`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:51`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/background.js:64`
- **Почему это проблема:** `resolveAPIReady()` вызывается до завершения оставшихся `init*`; при падении после `resolve` вызов `rejectAPIReady()` уже не влияет на `apiReadyPromise`. В итоге bootstrap получает `ready`, когда часть handlers может быть не готова/упала.
- **Минимальный фикс:** перенос `resolveAPIReady()` в конец блока инициализации обязательных модулей; для не-критичных модулей — явное разделение на `required/optional` с отдельным логированием и без нарушения ready-контракта.

### [P1] Gate `settings-defaults-check` даёт false-negative и пропускает реальные runtime-ключи
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/settings-defaults-check.mjs:10`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/legacy-initializers.js:2357`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/api/settings.js:30`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/docs/legacy/background.legacy.js:2800`
- **Почему это проблема:** проверка смотрит только literal-вызовы API и не покрывает динамические ключи (`this.element.bindingKey` + `data-binding-key`). Фактически отсутствуют legacy-defaults: `icon-folder-thumbnails`, `icon-folder-style`, `icon-folder-background-color`, `icon-rules` (подтверждено анализом кода).
- **Минимальный фикс:** расширить checker на извлечение `data-binding-key` (с фильтрацией не-settings ключей вроде `settings`), добавить отсутствующие defaults и зафиксировать это в gate.

### [P2] В `compat/settings` возможен двойной dispatch одного и того же settings-события
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:30`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:116`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:127`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/src/ui/runtime/compat/settings.js:138`
- **Почему это проблема:** после добавления `storage.onChanged` события диспатчатся и из storage-пути, и из `set/setMultiple/remove`; при определённом порядке async-событий возможны дубли и лишние реактивные перерендеры.
- **Минимальный фикс:** оставить единый источник событий (предпочтительно `storage.onChanged`) либо добавить dedupe-маркер/версию мутации.

### [P2] `runtime-parity-check` smoke не валидирует реальный bootstrap/runtime-message путь
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/runtime-parity-check.mjs:190`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/runtime-parity-check.mjs:201`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/runtime-parity-check.mjs:231`
- **Файл/строка:** `/Users/xonika/Documents/projects/speed-dial-chrome/scripts/runtime-parity-check.mjs:235`
- **Почему это проблема:** мок `sendMessage` возвращает `{}` почти для любых action, поэтому тест не падает при отсутствии/ошибке handlers и не проверяет handshake (`waitUntilReady`) или реальную message-router интеграцию.
- **Минимальный фикс:** сделать unknown-action ошибкой в smoke, добавить интеграционный сценарий через реальный router/handlers (минимум `waitUntilReady` + `getAllSettings` + `loadUIRuntime`).

## Open Questions / Assumptions
- Предположение: файл отчёта нужно **перезаписать** по пути `/Users/xonika/Documents/projects/speed-dial-chrome/docs/mv3-senior-code-review-2026-02-09.md`.
- Предположение: `bookmarklet` через `chrome.scripting.executeScript` — осознанно разрешённый кейс (allowlist валиден по политике проекта).
- Вопрос к продукту: должны ли legacy visual defaults (`icon-folder-*`, `icon-rules`) строго совпадать с историческими значениями на clean install.

## Change Summary
- Выполнено: `git status --short` (пустой вывод, рабочее дерево чистое).
- Выполнено: `git log --oneline -n 15` (последние MV3 fix-коммиты присутствуют: `ce2164c`, `06ec1b2`, `af6920a`, `2e08e7c`, `d52f49e`).
- Выполнено: `git diff --stat origin/main...HEAD` (81 файл, 18063 insertions, 161 deletions).
- Выполнено: `bash /Users/xonika/Documents/projects/speed-dial-chrome/scripts/release-gate.sh` (PASS).
- Дополнительно: точечный анализ `src/background.js`, `src/page-init.js`, `src/api/settings.js`, `src/ui/runtime/compat/settings.js`, `scripts/settings-defaults-check.mjs`, `scripts/policy-scan.sh`, `scripts/runtime-parity-check.mjs`.

## Public APIs / Interfaces / Types
- `waitUntilReady` должен стать контрактом “все обязательные handlers зарегистрированы и работоспособны”.
- `settings-defaults-check` должен покрывать динамические ключи (`data-binding-key`) как часть публичного quality-gate.
- `compat/settings` event-contract: один источник `settings/*` событий без дублей.
- `runtime-parity-check` contract: smoke обязан фейлиться на неизвестных runtime-action.

## Test Cases / Acceptance Scenarios
- Cold-start: страница с `page-init` не продолжает bootstrap до реальной готовности всех required handlers.
- Negative path: искусственно уронить один required init-модуль и убедиться, что `waitUntilReady` не возвращает ready.
- Defaults gate: добавить временный `data-binding-key` без default и убедиться, что `settings-defaults-check` падает.
- Settings sync: одно изменение ключа генерирует ровно одно `settings/<key>` событие на view.
- Runtime smoke: unknown action в smoke-моке приводит к падению проверки.

## Итог по severity
- `P0: 0`
- `P1: 2`
- `P2: 2`
- `P3: 0`
