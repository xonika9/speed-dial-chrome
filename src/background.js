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
import { initContextMenu } from './api/contextMenu.js';

console.log('[MV3] Service worker started');

// Initialize messaging system first (synchronous)
initMessaging();

// Initialize async modules
async function initializeAPIs() {
  try {
    // Core modules (order matters for dependencies)
    await initSettings();
    initMigration();
    initExtensionEvent();
    initBookmarks();
    initOffscreen();
    await initIcons();
    initTheme();
    initBrowser();
    initFeeds();
    initContextMenu();

    console.log('[MV3] All APIs initialized');
  } catch (error) {
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
