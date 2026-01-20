# План миграции Chrome Extension с Manifest V2 на V3

## Обзор проекта

**Расширение:** Favorites - New Tab Page
**Текущая версия:** Manifest V2 с event page (`persistent: false`)
**Цель:** Миграция на Manifest V3 с service worker

## Принятые решения

| Решение | Выбор |
|---------|-------|
| Совместимость | Только MV3 (без поддержки MV2) |
| Минимальная Chrome | 109+ (для Offscreen API) |
| Архитектура | ES Modules (`import`/`export`) |

## ⚠️ ВАЖНО: Итеративный подход

**Миграция выполняется ПОШАГОВО:**

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Этап N     │ ──▶ │  Проверка    │ ──▶ │  Этап N+1   │
│  (код)      │     │  (тест)      │     │  (код)      │
└─────────────┘     └──────────────┘     └─────────────┘
                          │
                          ▼
                    Ошибки? ─── Да ──▶ Исправить ─┐
                          │                        │
                         Нет                       │
                          │                        │
                          ▼                        │
                    Продолжить ◀───────────────────┘
```

**Правила:**
1. Выполняем ОДИН этап за раз
2. После каждого этапа — загружаем расширение в Chrome и проверяем
3. НЕ переходим к следующему этапу, пока текущий не работает
4. Каждый этап имеет контрольную точку проверки

## Критические проблемы текущей архитектуры

### Проблема 1: DOM API в background.js (БЛОКИРУЮЩАЯ)
`background.js` (~10K строк) **массивно использует DOM API**:
- `document.createElement("template")` — 37+ раз для UI компонентов
- `document.createElement('canvas')` — генерация иконок
- `window.addEventListener`, `window.dispatchEvent`
- Shadow DOM, Custom Elements

**Service workers НЕ имеют доступа к DOM!**

### Проблема 2: Deprecated APIs
- `chrome.extension.getBackgroundPage()` — используется в page.html
- `chrome.extension.getViews()` — для коммуникации
- `chrome.browserAction` → `chrome.action`

### Проблема 3: localStorage
Service workers не имеют доступа к `localStorage`. Используется для:
- `style/theme`, `style/background`
- `navigation/last-visited-folder`

### Проблема 4: Lifecycle management
- `chrome.runtime.onSuspend` / `onSuspendCanceled` — не существуют в MV3
- Состояние хранится в памяти (cache объект)

---

## Стратегия миграции

### Фаза 1: Рефакторинг архитектуры (подготовка)

#### 1.1 Разделение background.js на модули

**Текущая структура (монолит):**
```
background.js (10K+ строк)
├── API модули (defineAPI) — логика без DOM
├── UI компоненты (37 классов) — требуют DOM
└── Инициализация
```

**Целевая структура (ES Modules):**
```
src/
├── background.js          # Service worker entry point
├── api/
│   ├── index.js           # Export all API modules
│   ├── bookmarks.js       # chrome.bookmarks wrapper
│   ├── settings.js        # chrome.storage wrapper
│   ├── icons.js           # Icon generation (delegates to offscreen)
│   ├── theme.js           # Theme management
│   ├── feeds.js           # RSS feeds
│   └── messaging.js       # Message routing
├── ui/
│   ├── index.js           # Export all UI components
│   ├── base/
│   │   ├── CustomElement.js
│   │   └── defineCustomElement.js
│   ├── NewtabUI.js
│   ├── BookmarksUI.js
│   ├── DialogUI.js
│   ├── MenuUI.js
│   └── ...
├── offscreen/
│   ├── offscreen.html     # Offscreen document
│   └── offscreen.js       # Canvas/DOM operations
└── lib/
    └── utils.js           # Shared utilities

page.html                   # New tab page (updated)
manifest.json              # MV3 manifest
```

#### 1.2 Файлы для создания/изменения

| Файл | Действие | Описание |
|------|----------|----------|
| `src/background.js` | Создать | Service worker entry point с imports |
| `src/api/*.js` | Создать | API модули как ES modules |
| `src/ui/*.js` | Создать | UI компоненты как ES modules |
| `src/offscreen/*` | Создать | Offscreen document для DOM |
| `page.html` | Изменить | Загрузка UI через ES modules |
| `manifest.json` | Изменить | Обновить до MV3 |
| `background.js` (старый) | Удалить | После завершения миграции |

---

### Фаза 2: Изменения в manifest.json

```json
{
  "manifest_version": 3,
  "name": "Favorites - New Tab Page",
  "version": "2.0.0",
  "description": "__MSG_extension_description__",

  "background": {
    "service_worker": "src/background.js",
    "type": "module"
  },

  "action": {
    "default_icon": {
      "16": "icon/icon-16.png",
      "24": "icon/icon-24.png",
      "32": "icon/icon-32.png",
      "48": "icon/icon-48.png",
      "64": "icon/icon-64.png",
      "128": "icon/icon-128.png"
    },
    "default_title": "Favorites"
  },

  "chrome_url_overrides": {
    "newtab": "page.html?theme&ui=NewtabUI&title=new_tab"
  },

  "permissions": [
    "activeTab",
    "contextMenus",
    "bookmarks",
    "alarms",
    "storage",
    "unlimitedStorage",
    "offscreen",
    "favicon"
  ],

  "host_permissions": [
    "http://*/",
    "https://*/"
  ],

  "optional_permissions": [
    "clipboardRead",
    "clipboardWrite"
  ],

  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self';"
  },

  "minimum_chrome_version": "109",
  "default_locale": "en",
  "incognito": "spanning"
}
```

**Ключевые изменения:**

| MV2 | MV3 | Комментарий |
|-----|-----|-------------|
| `"manifest_version": 2` | `"manifest_version": 3` | Обязательно |
| `background.scripts` | `background.service_worker` | Один файл, не массив |
| — | `background.type: "module"` | Для ES imports |
| `browser_action` | `action` | Переименование API |
| `chrome://favicon/*` | `"favicon"` permission | Новый Favicon API |
| CSP строка | CSP объект | `extension_pages` ключ |
| `optional_permissions` host | `host_permissions` | Отдельное поле |
| `minimum_chrome_version: 66` | `minimum_chrome_version: 109` | Для Offscreen API |
| — | `"offscreen"` permission | Для DOM-операций |

---

### Фаза 3: Offscreen Document для DOM-операций

#### 3.1 Создать offscreen.html
```html
<!DOCTYPE html>
<html>
<head><title>Offscreen</title></head>
<body>
  <canvas id="icon-canvas"></canvas>
  <script src="offscreen.js"></script>
</body>
</html>
```

#### 3.2 Создать offscreen.js
Обработка операций, требующих DOM:
- Генерация иконок через Canvas
- DOMParser для RSS feeds
- Clipboard операции

#### 3.3 Service Worker → Offscreen коммуникация
```javascript
// В service worker
async function generateIcon(params) {
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['BLOBS', 'DOM_PARSER'],
    justification: 'Icon generation and feed parsing'
  });

  const result = await chrome.runtime.sendMessage({
    target: 'offscreen',
    action: 'generateIcon',
    data: params
  });

  await chrome.offscreen.closeDocument();
  return result;
}
```

---

### Фаза 4: Замена deprecated APIs

| MV2 API | MV3 API |
|---------|---------|
| `chrome.extension.getBackgroundPage()` | `chrome.runtime.sendMessage()` |
| `chrome.extension.getViews()` | `chrome.runtime.sendMessage()` |
| `chrome.browserAction.*` | `chrome.action.*` |
| `chrome.tabs.executeScript()` | `chrome.scripting.executeScript()` |
| `localStorage` | `chrome.storage.local` |

---

### Фаза 5: Переработка page.html

**Текущий flow:**
```javascript
const b = chrome.extension.getBackgroundPage(); // DEPRECATED
b.apiReady.then(() => {
  const ui = new (api.ui["init" + parameters.ui](window))();
});
```

**Новый flow:**
```javascript
// 1. Загрузить UI компоненты напрямую
import { initNewtabUI } from './ui-components.js';

// 2. Получить данные через messaging
const settings = await chrome.runtime.sendMessage({ action: 'getSettings' });
const bookmarks = await chrome.runtime.sendMessage({ action: 'getBookmarks' });

// 3. Инициализировать UI локально
const ui = new NewtabUI();
ui.init(settings, bookmarks);
```

---

### Фаза 6: Миграция localStorage → chrome.storage

```javascript
// До (MV2)
localStorage.getItem('style/theme');
localStorage.setItem('style/background', value);

// После (MV3)
const { theme } = await chrome.storage.local.get('style/theme');
await chrome.storage.local.set({ 'style/background': value });
```

**Миграция существующих данных:**
При первом запуске MV3 версии проверить localStorage через offscreen document и перенести в chrome.storage.

---

### Фаза 7: Тестирование

#### 7.1 Критические тесты
- [ ] Новая вкладка открывается корректно
- [ ] Закладки отображаются
- [ ] Темы применяются
- [ ] Иконки генерируются (через offscreen)
- [ ] RSS feeds загружаются
- [ ] Контекстное меню работает
- [ ] Settings сохраняются

#### 7.2 Service Worker lifecycle
- [ ] Расширение работает после перезапуска браузера
- [ ] Состояние сохраняется при терминации SW
- [ ] Alarms срабатывают корректно

---

## Порядок выполнения задач (ИТЕРАТИВНО)

---

### 🔵 Итерация 1: Создание структуры и минимальный service worker

**Задачи:**
1. Создать директорию `src/` с поддиректориями
2. Создать минимальный `src/background.js` (service worker)
3. Создать минимальный `manifest.json` для MV3

**Результат:**
```javascript
// src/background.js
console.log('Service worker started');

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});
```

**✅ Контрольная точка:**
- [ ] Загрузить расширение в Chrome
- [ ] Открыть chrome://extensions/ → Inspect service worker
- [ ] Увидеть "Service worker started" в консоли
- [ ] Нет ошибок

**Если не работает:** Исправить ошибки manifest.json, проверить путь к service_worker

---

### 🔵 Итерация 2: Базовый API модуль (settings)

**Задачи:**
1. Создать `src/api/settings.js` — обёртка над chrome.storage
2. Подключить в `src/background.js` через import
3. Проверить ES modules работают

**Результат:**
```javascript
// src/api/settings.js
export async function getSetting(key, defaultValue) {
  const result = await chrome.storage.local.get(key);
  return result[key] ?? defaultValue;
}

export async function setSetting(key, value) {
  await chrome.storage.local.set({ [key]: value });
}
```

**✅ Контрольная точка:**
- [ ] Service worker загружается без ошибок
- [ ] `import` работает в service worker
- [ ] Можно вызвать `getSetting` из консоли DevTools

**Если не работает:** Проверить `"type": "module"` в manifest.json

---

### 🔵 Итерация 3: Messaging API

**Задачи:**
1. Создать `src/api/messaging.js`
2. Настроить обработчик `chrome.runtime.onMessage`
3. Проверить page.html может общаться с service worker

**Результат:**
```javascript
// src/api/messaging.js
const handlers = new Map();

export function registerHandler(action, handler) {
  handlers.set(action, handler);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = handlers.get(message.action);
  if (handler) {
    Promise.resolve(handler(message.data, sender))
      .then(sendResponse);
    return true; // async response
  }
});
```

**✅ Контрольная точка:**
- [ ] Из page.html можно отправить сообщение
- [ ] Service worker получает и отвечает
- [ ] Нет ошибок "Could not establish connection"

---

### 🔵 Итерация 4: Миграция api.bookmarks

**Задачи:**
1. Создать `src/api/bookmarks.js`
2. Перенести логику из старого `background.js`
3. Зарегистрировать handler для получения закладок

**✅ Контрольная точка:**
- [ ] `chrome.runtime.sendMessage({action: 'getBookmarks'})` возвращает данные
- [ ] Структура данных соответствует ожидаемой

---

### 🔵 Итерация 5: Offscreen document

**Задачи:**
1. Создать `src/offscreen/offscreen.html`
2. Создать `src/offscreen/offscreen.js`
3. Протестировать создание/удаление offscreen document

**Результат:**
```javascript
// В service worker
async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'src/offscreen/offscreen.html',
      reasons: ['BLOBS', 'DOM_PARSER'],
      justification: 'Canvas and DOM operations'
    });
  }
}
```

**✅ Контрольная точка:**
- [ ] Offscreen document создаётся без ошибок
- [ ] Можно выполнить DOM операцию в offscreen
- [ ] Messaging между SW и offscreen работает

---

### 🔵 Итерация 6: Canvas операции в offscreen

**Задачи:**
1. Перенести генерацию иконок в `offscreen.js`
2. Создать `src/api/icons.js` с делегированием в offscreen
3. Протестировать генерацию иконки

**✅ Контрольная точка:**
- [ ] `generateIcon({...})` возвращает data URL
- [ ] Иконка отображается корректно

---

### 🔵 Итерация 7: Миграция api.theme

**Задачи:**
1. Создать `src/api/theme.js`
2. Заменить localStorage на chrome.storage.local
3. Зарегистрировать handlers

**✅ Контрольная точка:**
- [ ] Тема сохраняется в chrome.storage
- [ ] Тема загружается после перезапуска

---

### 🔵 Итерация 8: Базовый CustomElement

**Задачи:**
1. Создать `src/ui/base/CustomElement.js`
2. Создать `src/ui/base/defineCustomElement.js`
3. Протестировать создание простого компонента

**✅ Контрольная точка:**
- [ ] Custom element регистрируется
- [ ] Можно создать `<a-test-ui>` элемент
- [ ] Shadow DOM работает

---

### 🔵 Итерация 9: Миграция базовых UI компонентов

**Задачи:**
1. Мигрировать `DialogUI`
2. Мигрировать `MenuUI`
3. Мигрировать `MultiviewUI`

**✅ Контрольная точка:**
- [ ] Компоненты рендерятся
- [ ] События работают

---

### 🔵 Итерация 10: Миграция BookmarksUI

**Задачи:**
1. Мигрировать `BookmarksUI`
2. Подключить к api.bookmarks
3. Протестировать отображение закладок

**✅ Контрольная точка:**
- [ ] Закладки отображаются
- [ ] Клик открывает ссылку
- [ ] Папки раскрываются

---

### 🔵 Итерация 11: Миграция NewtabUI

**Задачи:**
1. Мигрировать `NewtabUI`
2. Обновить `page.html` для загрузки через ES modules
3. Убрать `getBackgroundPage()`

**✅ Контрольная точка:**
- [ ] Новая вкладка открывается
- [ ] UI отображается корректно
- [ ] Нет ошибок в консоли

---

### 🔵 Итерация 12: Остальные UI компоненты

**Задачи:**
1. Мигрировать оставшиеся 30+ компонентов
2. По 5-10 компонентов за раз
3. Тестировать после каждой группы

**✅ Контрольная точка:**
- [ ] Все компоненты мигрированы
- [ ] Все функции доступны

---

### 🔵 Итерация 13: Storage migration helper

**Задачи:**
1. Создать скрипт миграции localStorage → chrome.storage
2. Запускать при первом старте MV3 версии
3. Через offscreen document читать старые данные

**✅ Контрольная точка:**
- [ ] Старые настройки пользователя сохраняются
- [ ] Темы переносятся корректно

---

### 🔵 Итерация 14: API chrome.action

**Задачи:**
1. Заменить `chrome.browserAction` → `chrome.action`
2. Обновить все вызовы
3. Проверить popup/badge

**✅ Контрольная точка:**
- [ ] Badge отображается
- [ ] Клик по иконке работает

---

### 🔵 Итерация 15: Полное тестирование

**Задачи:**
1. Пройти весь чек-лист тестирования
2. Исправить найденные баги
3. Удалить старый `background.js`

**✅ Финальная контрольная точка:**
- [ ] Все функции работают
- [ ] Нет deprecated API warnings
- [ ] `chrome.runtime.getManifest().manifest_version === 3`
- [ ] Расширение работает после перезапуска Chrome

---

## Критические файлы

### Основные изменения
- `manifest.json` — полное обновление формата
- `page.html` — новая система инициализации с ES modules

### Новые файлы (создать)
```
src/
├── background.js              # ~200 строк, entry point
├── api/
│   ├── index.js              # Re-export всех API
│   ├── bookmarks.js          # ~300 строк
│   ├── settings.js           # ~150 строк
│   ├── icons.js              # ~200 строк (+ offscreen)
│   ├── theme.js              # ~400 строк
│   ├── feeds.js              # ~250 строк
│   └── messaging.js          # ~100 строк
├── ui/
│   ├── index.js
│   ├── base/CustomElement.js # ~100 строк
│   ├── NewtabUI.js           # ~500 строк
│   ├── BookmarksUI.js        # ~600 строк
│   └── ... (35+ компонентов)
└── offscreen/
    ├── offscreen.html        # ~20 строк
    └── offscreen.js          # ~300 строк
```

### Удалить после миграции
- `background.js` (старый, 10K строк)
- `sw.js` (если функционал интегрирован)

---

## Верификация

### Команды для проверки

```bash
# 1. Загрузить расширение
# Chrome → chrome://extensions/ → Developer mode → Load unpacked

# 2. Проверить service worker
# chrome://extensions/ → Inspect service worker

# 3. Проверить консоль на ошибки
# DevTools → Console (на новой вкладке)
```

### Чек-лист тестирования

**Базовая функциональность:**
- [ ] Новая вкладка открывается без ошибок
- [ ] Закладки отображаются корректно
- [ ] Навигация по папкам работает
- [ ] Иконки сайтов загружаются
- [ ] Темы применяются

**API функции:**
- [ ] Добавление закладки
- [ ] Удаление закладки
- [ ] Перетаскивание (drag & drop)
- [ ] Поиск работает
- [ ] Контекстное меню

**Service Worker lifecycle:**
- [ ] Работает после перезапуска Chrome
- [ ] Состояние сохраняется при терминации SW
- [ ] Alarms срабатывают

**Проверка MV3:**
```javascript
// В DevTools консоли:
chrome.runtime.getManifest().manifest_version // должно быть 3
```
