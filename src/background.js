/**
 * MV3 Service Worker - Entry Point
 * Favorites Chrome Extension
 */

import { initMessaging, registerHandler, registerHandlers, broadcast } from './api/messaging.js';
import { initSettings, get as getSetting, set as setSetting } from './api/settings.js';
import { initBookmarks } from './api/bookmarks.js';
import { initOffscreen } from './api/offscreen.js';
import { initIcons } from './api/icons.js';
import { initMigration } from './api/migration.js';
import { initTheme } from './api/theme.js';
import { initBrowser } from './api/browser.js';
import { initExtensionEvent } from './api/extensionEvent.js';
import { initFeeds } from './api/feeds.js';
import { initFeedSubscriptions } from './api/feedSubscriptions.js';
import { initFeedSubscriptionsStats } from './api/feedSubscriptionsStats.js';
import { initSearch } from './api/search.js';
import { initIconsUrlMapping } from './api/iconsUrlMapping.js';
import { initContextMenu } from './api/contextMenu.js';
import { initRemoteCache, handleRemoteCacheFetch } from './api/remoteCache.js';

console.log('[MV3] Service worker started');

// Initialize messaging system first (synchronous)
initMessaging();

let resolveAPIReady;
let rejectAPIReady;
const apiReadyPromise = new Promise((resolve, reject) => {
  resolveAPIReady = resolve;
  rejectAPIReady = reject;
});

registerHandler('waitUntilReady', async () => {
  await apiReadyPromise;
  return { ready: true };
});

// Initialize async modules
async function initializeAPIs() {
  try {
    // Core modules (order matters for dependencies)
    await initSettings();
    initMigration();
    resolveAPIReady();

    initExtensionEvent();
    initBookmarks();
    initOffscreen();
    await initIcons();
    initTheme();
    initBrowser();
    initFeeds();
    initFeedSubscriptions();
    initFeedSubscriptionsStats();
    initSearch();
    initIconsUrlMapping();
    initContextMenu();
    initRemoteCache();

    console.log('[MV3] All APIs initialized');
  } catch (error) {
    rejectAPIReady(error);
    console.error('[MV3] Failed to initialize APIs:', error);
  }
}

// Start initialization
initializeAPIs();

// Keep track of service worker lifecycle
self.addEventListener('install', () => {
  console.log('[MV3] Service worker installing...');
  // Skip waiting to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[MV3] Service worker activated');
  // Claim clients immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  const responsePromise = handleRemoteCacheFetch(event.request);
  if (responsePromise) {
    event.respondWith(responsePromise);
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('[MV3] Extension installed:', details.reason);

  if (details.reason === 'install') {
    // First install - open welcome page
    chrome.tabs.create({
      url: '/page.html?ui=FirstrunUI&title=Favorites&withIcon',
      active: true
    });
  } else if (details.reason === 'update') {
    console.log('[MV3] Updated from version:', details.previousVersion);
  }
});

chrome.runtime.onStartup.addListener(() => {
  console.log('[MV3] Browser started');
});

// API namespace for compatibility and exports
const api = {
  SERVER_URL: (chrome.runtime.id === 'kjkbcegjfanmgocnecnngfcmmojheiam')
    ? 'https://api.web-accessories.com'
    : 'http://localhost',
  settings: {
    get: getSetting,
    set: setSetting
  }
};

// Export for module usage
export { api, registerHandler, registerHandlers, broadcast };
