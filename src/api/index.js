/**
 * API Index - Re-exports all API modules
 */

export * from './messaging.js';
export * from './settings.js';
export * from './bookmarks.js';
export * from './offscreen.js';
export * from './icons.js';
export * from './migration.js';
export * from './theme.js';
export * from './browser.js';
export * from './extensionEvent.js';
export * from './feeds.js';
export * from './contextMenu.js';

// Default export with all init functions
import { initMessaging } from './messaging.js';
import { initSettings } from './settings.js';
import { initBookmarks } from './bookmarks.js';
import { initOffscreen } from './offscreen.js';
import { initIcons } from './icons.js';
import { initMigration } from './migration.js';
import { initTheme } from './theme.js';
import { initBrowser } from './browser.js';
import { initExtensionEvent } from './extensionEvent.js';
import { initFeeds } from './feeds.js';
import { initContextMenu } from './contextMenu.js';

export default {
  initMessaging,
  initSettings,
  initBookmarks,
  initOffscreen,
  initIcons,
  initMigration,
  initTheme,
  initBrowser,
  initExtensionEvent,
  initFeeds,
  initContextMenu
};
