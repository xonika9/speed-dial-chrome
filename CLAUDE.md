# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Use web-search to find actual data.

Use context7 mcp to find tech documentation.

## Browser Automation with dev-browser

**IMPORTANT**: Always use the `dev-browser` skill for browser automation and testing. Do NOT use chrome-devtools MCP tools.

### Browser Modes

Ask the user which mode to use if unclear:

**Standalone Mode** (default): Launches a new Chromium browser
```bash
cd /Users/xonika/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser && ./server.sh &
```
Add `--headless` flag if user requests it. Wait for "Ready" message.

**Extension Mode**: Connects to user's existing browser (Chrome/Edge/etc.) with dev-browser extension
```bash
cd /Users/xonika/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser && npm run start-extension &
```
Wait for "Extension connected" message. User will confirm when ready.

### Controlling the Browser

Scripts work the same in both modes:
```bash
cd /Users/xonika/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser && npx tsx <<'EOF'
import { connect, waitForPageLoad } from "@/client.js";

const client = await connect();
const page = await client.page("pagename");

await page.goto("https://example.com");
await waitForPageLoad(page);

console.log({ title: await page.title(), url: page.url() });
await client.disconnect();
EOF
```

### Key Guidelines

- **Always run scripts from the dev-browser skill directory**: `/Users/xonika/.claude/plugins/cache/dev-browser-marketplace/dev-browser/66682fb0513a/skills/dev-browser`
- **Use named pages**: `client.page("name")` to organize browser tabs (e.g., "login", "checkout", "testing")
- **Page state persists**: Scripts are stateless, but pages remain open between executions
- **Element discovery**: Use `client.getAISnapshot("pagename")` to get accessibility tree with element references
- **Visual feedback**: Take screenshots with `page.screenshot({ path: "tmp/screenshot.png" })`
- **Small focused scripts**: Write one script per action, evaluate state, then decide next step

## Project Overview

Favorites is a Chrome browser extension (Manifest V3) that replaces the new tab page with a customizable bookmarks interface. It displays bookmarks as visual icons and includes features like search, news feeds, wallpapers, and games.

**Current architecture state**: MV3-only runtime. `src/background.js` is the MV3 service worker and UI bootstraps from `src/ui/**` plus extracted legacy initializers in `src/ui/runtime/legacy-initializers.js` (no root `background.js` bridge load).

## Development

### Loading the Extension

Since there is no build system, development involves:
1. Load the unpacked extension in Chrome at `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select this directory
4. After making changes, click the reload button on the extension card

### Debugging

**For the new tab page**: Open `page.html` in a new tab and use Chrome DevTools (F12)

**For background scripts**: Go to `chrome://extensions/` → click "service worker" or "background page" under the extension

**Keyboard shortcuts (debug mode only)**:
- F6: Reload background page and all extension views

### Content Security Policy

The manifest defines a strict CSP with script hashes. If modifying `page.html` inline scripts, you must update the SHA-256 hashes in `manifest.json` under `content_security_policy`.

## Architecture

### Entry Points

- **`page.html`**: Main new tab page loader. Parses URL parameters, runs one-time migration from `localStorage` to `chrome.storage.local`, applies theme styles from storage, then initializes the UI component specified by `ui`.

- **`src/background.js`**: MV3 service worker entry point. Initializes message-driven API modules (`src/api/*`) and handles extension lifecycle/events.

- **`src/ui/runtime/legacy-initializers.js`**: Generated classic script containing extracted legacy `init*` UI blocks used for runtime parity while module-native extraction continues.

- **`docs/legacy/background.legacy.js`**: Archived legacy UI monolith source used only to regenerate `src/ui/runtime/legacy-initializers.js`.

- **`src/offscreen/offscreen.html` + `src/offscreen/offscreen.js`**: Offscreen document for DOM/canvas operations that cannot run in service worker.

- **`docs/legacy/sw.legacy.js`**: Archived legacy worker reference; remote cache behavior is implemented in `src/api/remoteCache.js` and wired from `src/background.js`.

Archived legacy monolith (`docs/legacy/background.legacy.js`) defines:
  - API modules via `defineAPI(name, definition)`
  - Custom Web Components via inline HTML templates
  - Initialization functions like `initNewtabUI(window)`

### Module System

The codebase uses a custom module system built around `defineAPI()`:

```javascript
defineAPI("moduleName", {
  await: ["otherModule"],  // Optional dependencies
  init() { /* initialization code */ },
  sessionListeners: { /* Chrome API listeners that wait for init */ },
  listeners: { /* Chrome API listeners that run immediately */ }
})
```

Key API modules:
- `api.bookmarks` - Chrome Bookmarks API wrapper with caching
- `api.settings` - Extension settings persistence
- `api.theme` - Theme CSS generation and management
- `api.icons` - Icon loading and caching (uses chrome://favicon or web service)
- `api.feeds` - RSS feed fetching and parsing
- `api.extensionEvent` - Event bus for view creation/removal
- `api.ui` - Reference to the window object where UI components are registered

### UI Component Architecture

UI components are defined as Web Components with Shadow DOM. Legacy-extracted components in `src/ui/runtime/legacy-initializers.js` follow this pattern:

```javascript
// Template HTML is inlined as a string
{const t = document.createElement("template");
t.innerHTML = `<style>...</style><div>...</div>`;
for(const el of t.content.querySelectorAll("[data-i18n]"))
  el.textContent = chrome.i18n.getMessage(el.dataset.i18n);

function initComponentNameUI(window) {
  if(window.ComponentNameUI) return window.ComponentNameUI;
  // Init dependencies first
  initDependencyUI(window);
  with(window) {
    class ComponentNameUI extends BaseClass {
      init(shadowRoot) { /* initialization */ }
      bind() { /* attach event listeners */ }
      unbind() { /* cleanup */ }
    }
    defineCustomElement("a-component-name-ui", ComponentNameUI, t);
    return window.ComponentNameUI = ComponentNameUI;
  }
}
window.api.ui["initComponentNameUI"] = initComponentNameUI;}}
```

**Key UI Components**:
- `NewtabUI` - Main new tab view container (MultiviewUI subclass)
- `BookmarksUI` - Displays bookmark grid/folder
- `DashUI` - Settings/dashboard view
- `DialogUI` - Base dialog class
- `MenuUI` - Context menus

**Theming**: Themes are CSS files in `/themes/` loaded from `/themes/<theme>/style.css`. The canonical theme list is `data/themes.json` (generated by `scripts/generate-theme-list.mjs`).

### Internationalization

- Strings defined in `_locales/[locale]/messages.json`
- Access via `chrome.i18n.getMessage("key")`
- HTML templates use `data-i18n="key"` attributes that are replaced at component initialization

### Storage

- **Chrome Storage**: Primary storage via `chrome.storage.local` (settings, migrated style keys, runtime flags)
- **localStorage**: Legacy source only for one-time MV3 migration
- **Migration flag**: `mv3-migration-complete` in `chrome.storage.local`

### Permissions

**Mandatory**: bookmarks, storage, unlimitedStorage, activeTab, contextMenus, alarms, favicon, offscreen, scripting

**Optional** (requested on-demand): host permissions for RSS feeds (`http://*/`, `https://*/`), clipboardRead, clipboardWrite

### Web Service Integration

The extension optionally queries `https://api.web-accessories.com` to:
- Determine website icon URLs
- Find search page URLs
- Discover RSS feed URLs

**Note**: Server logs are retained for 14 days (see README.txt for privacy policy)

### Important Constants

- Extension ID: `kjkbcegjfanmgocnecnngfcmmojheiam` (production)
- Server URL switches between production and localhost based on extension ID
- Minimum Chrome version: 109

### MV3 Release Gates

Run this before release:

```bash
bash /Users/xonika/Documents/projects/speed-dial-chrome/scripts/release-gate.sh
```

Theme maintenance rule:
- If anything changes under `/themes/*`, regenerate `data/themes.json` via:
```bash
node /Users/xonika/Documents/projects/speed-dial-chrome/scripts/generate-theme-list.mjs
```

## File Structure Notes

- `/themes/` - 60 theme directories with CSS files (not loaded as stylesheets, but read as text)
- `/ui/` - Contains subdirectories with static assets (SVG icons, etc.) - UI components are NOT separate files
- `/_locales/` - i18n message files for 40+ languages
- `/wallpapers/` - Background images
- `/data/` - Static data like games.json

## Code Patterns

### Custom Elements

All UI components extend `CustomElement` base class which provides:
- `init(shadowRoot)` - Called once when component is created
- `bind()` - Called when attached to DOM, attach event listeners here
- `unbind()` - Cleanup before removal

### Event Dispatching

Components dispatch custom events using `dispatchEvent(new Event('name', { bubbles: true }))`

### Shadow DOM

Styles are encapsulated via Shadow DOM. Themes use CSS custom properties (variables) to allow dynamic theming.
