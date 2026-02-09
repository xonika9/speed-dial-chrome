# MV3 Code Review Prompt + Manual Browser Test

## 1) Prompt for a New Chat (Code Review)

Скопируй и отправь этот промпт в новом чате:

```text
Сделай полноценный code review этого репозитория как senior reviewer.

Контекст:
- Проект: Chrome extension (Favorites), миграция на Manifest V3.
- Ветка: mv3-migration.
- Цель: подтвердить, что переход к MV3-only runtime корректный и без регрессий.
- Важные изменения: module runtime default, compat layer, extracted legacy initializers, удаление root background.js/sw.js (они перенесены в docs/legacy).

Что нужно от тебя:
1) Сначала запусти и проанализируй:
   - git status --short
   - git diff --stat
   - git diff
2) Проверь архитектурные риски, функциональные регрессии и runtime pitfalls:
   - UI runtime bootstrap (legacy/hybrid/module)
   - page init и fallback маршрутизации ui=
   - compat API/event bus
   - service worker handlers и события
   - migration path localStorage -> chrome.storage.local
   - offscreen compatibility
   - remote cache поведение
3) Проверь compliance/security:
   - отсутствие MV2 API на runtime path
   - eval / executeScript / getBackgroundPage / chrome.extension.*
4) Проверь качество gate-проверок:
   - scripts/release-gate.sh
   - scripts/runtime-parity-check.mjs
   - scripts/ui-extraction-check.mjs
5) Если находишь проблему — укажи:
   - severity (P0/P1/P2/P3)
   - файл и строку
   - почему это проблема
   - минимальный фикс

Формат ответа:
- Сначала Findings (по убыванию severity, без воды).
- Потом “Open Questions / Assumptions”.
- Потом короткий “Change Summary”.
- Если критичных проблем нет, явно напиши: “No critical findings”.
```

## 2) Manual Browser Test (MV3-only)

## Подготовка
1. Открой `chrome://extensions/`.
2. Включи `Developer mode`.
3. Нажми `Load unpacked` и выбери папку:
   - `/Users/xonika/Documents/projects/speed-dial-chrome`
4. Убедись, что extension загрузился без ошибок.
5. Нажми `service worker` в карточке расширения и открой консоль.

## Smoke Matrix

### A. Clean install / Newtab
1. Открой новую вкладку.
2. Проверь, что загружается UI без белого экрана и без runtime exceptions в консоли.
3. В DevTools страницы проверь `document.documentElement.dataset.uiRuntime`:
   - ожидается `module` (или явно зафиксированный fallback при диагностике).

Ожидаемо:
- Newtab открывается стабильно.
- Нет ошибок вида “Unknown UI initializer … and initNewtabUI fallback is unavailable”.

### B. UI routes
Открой вручную:
1. `chrome-extension://<EXTENSION_ID>/page.html?theme&ui=NewtabUI`
2. `chrome-extension://<EXTENSION_ID>/page.html?theme&ui=PopupUI`
3. `chrome-extension://<EXTENSION_ID>/page.html?theme&ui=SettingsUI`
4. `chrome-extension://<EXTENSION_ID>/page.html?theme&ui=FirstrunUI`
5. Негативный тест: `chrome-extension://<EXTENSION_ID>/page.html?theme&ui=UnknownUI`

Ожидаемо:
- 1–4 открываются.
- Для `UnknownUI` происходит fallback на `NewtabUI` + warning в консоли.

### C. Context menu + popup toggle
1. ПКМ на странице new tab -> пункты меню расширения.
2. Проверь действия: Settings, Help, Set wallpaper, toggle popup mode.
3. Кликни по иконке extension в toolbar после toggle.

Ожидаемо:
- Меню создается и клики обрабатываются.
- Popup режим переключается и сохраняется.

### D. Bookmarks flow
1. Создай закладку/папку.
2. Отредактируй, удали, перемести.
3. Проверь drag/drop и reorder by title.

Ожидаемо:
- Операции работают без ошибок.
- UI обновляется после изменений.

### E. Settings + Theme persistence
1. Открой SettingsUI.
2. Сменить тему.
3. Закрыть и снова открыть вкладку.
4. Перезапустить Chrome и повторно открыть new tab.

Ожидаемо:
- Тема применяется сразу и сохраняется после рестарта браузера.

### F. Feeds / Search / Icons
1. Открой News/Search флоу.
2. Добавь/обнови feed subscription.
3. Проверь рендер превью иконок/контента.

Ожидаемо:
- Нет падений на compat namespace (`i18n`, `iconsURLMapping`, `feedSubscriptionsBookmarks`).
- События обновления отражаются в UI.

### G. Restart resilience
1. Полностью перезапусти Chrome.
2. Снова открой new tab и popup.

Ожидаемо:
- Service worker оживает и функции доступны без ручного вмешательства.

## Проверка консоли (обязательно)
1. Консоль service worker (`chrome://extensions` -> `service worker`).
2. Консоль страницы new tab.

Ожидаемо:
- Нет критичных Uncaught ошибок.
- Допустимы только ожидаемые warning/debug сообщения.

## Быстрый gate перед релизом
```bash
cd /Users/xonika/Documents/projects/speed-dial-chrome
bash scripts/release-gate.sh
```

Ожидаемо:
- Скрипт заканчивается `OK`.
