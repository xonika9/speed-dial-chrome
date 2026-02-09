/**
 * Page Initialization Script (MV3 runtime)
 */

// fixes already defined class Option, ugly ....
delete window.Option;

const html = document.documentElement;
const parameters = {};
const MIGRATION_EXTRA_KEYS = [
  'navigation/last-visited-folder',
  'news-ui/color-scheme',
  'popover-bookmark-editor/folder'
];

for (const token of location.search.replace(/^\?/, '').split('&')) {
  if (!token) {
    continue;
  }
  const [key, value] = token.split('=');
  parameters[key] = value || true;
}

parameters.ui = parameters.ui || 'NewtabUI';

if (parameters.title) {
  document.title = chrome.i18n.getMessage(parameters.title) || parameters.title;
}

if (parameters.withIcon) {
  const icon = document.head.querySelector("link[rel='shortcut icon']");
  if (icon) {
    icon.remove();
  }
}

if (parameters.style) {
  html.style = parameters.style;
}

if (performance.now() < 60) {
  html.classList.add('visible');
}

html.dataset.bidi = parameters.bidi ? chrome.i18n.getMessage('@@bidi_dir') : 'ltr';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (response && response.error) {
        reject(new Error(response.error));
        return;
      }

      resolve(response);
    });
  });
}

function sendRuntimeMessageNoThrow(message) {
  chrome.runtime.sendMessage(message, () => {
    // Ignore errors for fire-and-forget events.
    void chrome.runtime.lastError;
  });
}

async function waitForMessageResponse(message, predicate, timeoutMessage) {
  const maxAttempts = 50;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await sendRuntimeMessage(message);
      if (predicate(response)) {
        return;
      }
    } catch {
      // Service worker can still be starting up.
    }

    await sleep(100);
  }

  throw new Error(timeoutMessage);
}

async function waitForServiceWorker() {
  await waitForMessageResponse(
    { action: 'ping' },
    response => Boolean(response && response.pong),
    'Service worker is not responding to ping'
  );

  await waitForMessageResponse(
    { action: 'waitUntilReady' },
    response => Boolean(response && response.ready),
    'Service worker did not become ready in time'
  );
}

function collectLocalStorageData() {
  const result = {};
  const keySet = new Set(MIGRATION_EXTRA_KEYS);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('style/')) {
      keySet.add(key);
    }
  }

  for (const key of keySet) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      result[key] = value;
    }
  }

  return result;
}

async function runMigrationIfNeeded() {
  const needsMigration = await sendRuntimeMessage({ action: 'needsMigration' });
  if (!needsMigration) {
    return false;
  }

  const localStorageData = collectLocalStorageData();
  await sendRuntimeMessage({
    action: 'migrateFromPage',
    localStorageData
  });

  return true;
}

/**
 * Update theme styles from chrome.storage
 */
async function updateThemeStyle() {
  const result = await chrome.storage.local.get([
    'style/theme',
    'style/background',
    'style/background-filter',
    'style/dock',
    'style/preload-images'
  ]);

  document.getElementById('style-theme').textContent = result['style/theme'] || '';
  document.getElementById('style-background').textContent = result['style/background'] || '';
  document.getElementById('style-background-filter').textContent = result['style/background-filter'] || '';
  document.getElementById('style-dock').textContent = result['style/dock'] || '';

  const imagesNeeded = (result['style/preload-images'] || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const imagesLoaded = (html.dataset.preloadedImages || '')
    .split(' ')
    .map(s => s.trim())
    .filter(Boolean);

  const imagesNotLoaded = imagesNeeded.filter(src => !imagesLoaded.includes(src));

  if (imagesNotLoaded.length > 0) {
    await Promise.all(imagesNotLoaded.map(src => new Promise(resolve => {
      const image = new Image();
      image.onerror = image.onload = resolve;
      image.src = src;
    })));

    html.dataset.preloadedImages = imagesNeeded.join(' ');

    if (html.classList.contains('visible')) {
      await sleep(200); // give some time for bgr-transitions
    }
  }
}

async function loadConfiguredUIRuntime(requestedUI) {
  const bootstrapModule = await import(chrome.runtime.getURL('src/ui/bootstrap.js'));
  return bootstrapModule.loadUIRuntime({ requestedUI });
}

async function initUI() {
  await waitForServiceWorker();

  const runtimeInfo = await loadConfiguredUIRuntime(parameters.ui);
  const { api } = runtimeInfo;
  window.api = api;

  html.dataset.uiRuntime = runtimeInfo.resolvedRuntime || runtimeInfo.runtime;

  if (runtimeInfo.configuredRuntime && runtimeInfo.resolvedRuntime &&
      runtimeInfo.configuredRuntime !== runtimeInfo.resolvedRuntime) {
    console.warn(
      `[MV3 Init] Runtime fallback: configured=${runtimeInfo.configuredRuntime},` +
      ` resolved=${runtimeInfo.resolvedRuntime}, reason=${runtimeInfo.runtimeResolutionReason}`
    );
  }

  const requestedInitializerName = 'init' + parameters.ui;
  const requestedInitializer = api?.ui?.[requestedInitializerName];
  const initializer = (typeof requestedInitializer === 'function')
    ? requestedInitializer
    : api?.ui?.initNewtabUI;

  if (typeof initializer !== 'function') {
    throw new Error(`Unknown UI initializer: ${parameters.ui} (and initNewtabUI fallback is unavailable)`);
  }

  if (initializer !== requestedInitializer) {
    console.warn(`[MV3 Init] Unknown UI "${parameters.ui}", falling back to "NewtabUI"`);
  }

  const ui = new (initializer(window))();
  document.body.appendChild(ui);

  sendRuntimeMessageNoThrow({
    action: 'dispatchEvent',
    eventName: 'session/view-created',
    waitForResponse: false
  });

  window.addEventListener('beforeunload', () => {
    sendRuntimeMessageNoThrow({
      action: 'dispatchEvent',
      eventName: 'session/view-removed',
      waitForResponse: false
    });
  });

  await ui.isReady;
}

async function bootstrap() {
  await waitForServiceWorker();
  await runMigrationIfNeeded();

  if (parameters.theme) {
    await updateThemeStyle();

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') {
        return;
      }

      const styleKeys = ['style/theme', 'style/background', 'style/background-filter', 'style/dock'];
      if (styleKeys.some(key => key in changes)) {
        updateThemeStyle().catch(console.error);
      }
    });
  }

  html.classList.add('background-ready');

  await initUI();

  if (!html.classList.contains('visible')) {
    void html.clientWidth;
    html.classList.add('visible');
  }
}

bootstrap().catch(error => {
  console.log('parameters', parameters);
  console.error(error);
});
