/**
 * Settings API - Chrome Storage Wrapper
 * Replaces localStorage with chrome.storage.local
 */

import { registerHandlers } from './messaging.js';

const ICON_URL_MAPPING_DEFAULT = [
  '# Syntax: A > B',
  '# For each bookmark URL starting with A, an icon is loaded from B.',
  '# Lines starting with # are ignored and can be used for comments.',
  '',
  ''
].join('\n');

const SEARCH_URL_MAPPING_DEFAULT = [
  '# Syntax: A > B',
  '# For each bookmark URL starting with A, a search URL is created ',
  '# by appending a search term at the end of B.',
  '# Lines starting with # are ignored and can be used for comments.',
  '',
  'https://www.nytimes.com > https://www.nytimes.com/search?sort=best&query=',
  'https://www.google.de/maps > https://www.google.de/maps/place/',
  'https://www.google.com/maps > https://www.google.com/maps/place/',
  'https://www.youtube.com > https://www.youtube.com/results?search_query=',
  ''
].join('\n');

// Default settings values
const defaults = {
  'theme': 'default_white',
  'browser-action': 'default',
  'new-tab-position': 'last',
  'bookmark-opens-in': 'currentTab',
  'folder-opens-in': 'currentTab',
  'bookmark-opens-in-ctrl': 'newTab',
  'folder-opens-in-ctrl': 'newTab',
  'bookmark-opens-in-shift': 'newWindow',
  'folder-opens-in-shift': 'newWindow',
  'display-embedded-messages': true,
  'display-embedded-search': true,
  'display-dock': true,
  'display-dock-toggle': true,
  'display-add-bookmark-button': true,
  'display-folder-icon': 'default',
  'dock-search': 'google',
  'click-action-apps': 'default',
  'click-action-chrome': 'default',
  'feeds-enabled': false,
  'feeds-expiration-time': 30,
  'feeds-url-mapping': '',
  'feed-subscriptions': {},
  'feed-subscriptions-update': 'on-request',
  'home-folder': '1',
  'root-folder': '1',
  'show-navigation-bar': false,
  'show-last-visited-folder': false,
  'open-bookmarks-in-new-tab': false,
  'folder-color-mode': 'none',
  'icon-view': 'default',
  'icon-size': 'medium',
  'icon-url-mapping': ICON_URL_MAPPING_DEFAULT,
  'icon-folder-thumbnails': true,
  'icon-folder-style': 'Grid 3x3',
  'icon-folder-background-color': 'rgba(255,255,255,0.75)',
  'icon-rules': ['radio.net'],
  'show-favicon': true,
  'show-title': true,
  'title-position': 'bottom',
  'max-columns': 0,
  'columns-max': 25,
  'column-gap': 46,
  'row-gap': 16,
  'background-type': 'theme',
  'background-web': null,
  'background-file': null,
  'background-color': '#ffffff',
  'background-image-url': '',
  'background-image-file': '',
  'background-filter-active': false,
  'background-filter-color': 'rgba(255,255,255,0.7)',
  'background-filter-blend-mode': 'normal',
  'filter-enabled': false,
  'filter-blur': 0,
  'filter-brightness': 100,
  'filter-grayscale': 0,
  'dock-style': 'default',
  'show-dock': false,
  'dock-folder': '2',
  'dock-dblclick': true,
  'dock-background-type': 'theme',
  'dock-background-color': '#606060',
  'show-dash': false,
  'dash-buttons': ['bookmarks', 'history', 'downloads', 'settings', 'extensions', 'games', 'news'],
  'dash-clock': 'DC-1M',
  'search-url-mapping': SEARCH_URL_MAPPING_DEFAULT,
  'search-engine': 'Google',
  'search-preferred-site': 'website',
  'search-dblclick': true,
  'search-site-shortcut-active': false,
  'search-open-folder-shortcut-active': false
};

// In-memory cache for settings
let settingsCache = null;

// Quota limits for certain settings
const quotaLimits = {
  'feeds-url-mapping': 8192,
  'background-image-file': 5242880 // 5MB
};

/**
 * Load all settings from storage into cache
 */
async function loadSettings() {
  if (settingsCache !== null) return settingsCache;

  const result = await chrome.storage.local.get(null);
  settingsCache = { ...defaults, ...result };
  return settingsCache;
}

/**
 * Get a setting value
 */
export function get(key) {
  if (settingsCache === null) {
    console.warn('[Settings] Cache not initialized, returning default');
    return defaults[key];
  }
  return settingsCache[key] !== undefined ? settingsCache[key] : defaults[key];
}

/**
 * Get a setting value (async version)
 */
export async function getAsync(key) {
  await loadSettings();
  return get(key);
}

/**
 * Set a setting value
 */
export async function set(key, value) {
  // Check quota limits
  if (quotaLimits[key] && typeof value === 'string' && value.length > quotaLimits[key]) {
    throw new Error(`Value exceeds quota limit for ${key}`);
  }

  await chrome.storage.local.set({ [key]: value });

  // Update cache
  if (settingsCache !== null) {
    settingsCache[key] = value;
  }

  return value;
}

/**
 * Remove a setting (reset to default)
 */
export async function remove(key) {
  await chrome.storage.local.remove(key);

  // Update cache
  if (settingsCache !== null) {
    delete settingsCache[key];
  }
}

/**
 * Get all settings
 */
export async function getAll() {
  await loadSettings();
  return { ...settingsCache };
}

/**
 * Set multiple settings at once
 */
export async function setMultiple(settings) {
  await chrome.storage.local.set(settings);

  // Update cache
  if (settingsCache !== null) {
    Object.assign(settingsCache, settings);
  }

  return settings;
}

/**
 * Reset all settings to defaults
 */
export async function resetAll() {
  await chrome.storage.local.clear();
  settingsCache = { ...defaults };
  return settingsCache;
}

/**
 * Export settings as JSON
 */
export async function exportSettings() {
  await loadSettings();
  return JSON.stringify(settingsCache, null, 2);
}

/**
 * Import settings from JSON
 */
export async function importSettings(json) {
  const settings = JSON.parse(json);
  await chrome.storage.local.set(settings);
  settingsCache = { ...defaults, ...settings };
  return settingsCache;
}

/**
 * Get default value for a setting
 */
export function getDefault(key) {
  return defaults[key];
}

/**
 * Check if a setting has been modified from default
 */
export function isModified(key) {
  if (settingsCache === null) return false;
  return settingsCache[key] !== undefined && settingsCache[key] !== defaults[key];
}

/**
 * Initialize settings module
 */
export async function initSettings() {
  // Load settings into cache
  await loadSettings();

  // Listen for storage changes
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    for (const [key, { newValue }] of Object.entries(changes)) {
      if (settingsCache !== null) {
        if (newValue === undefined) {
          delete settingsCache[key];
        } else {
          settingsCache[key] = newValue;
        }
      }
    }
  });

  // Register message handlers
  registerHandlers({
    getSetting: async ({ key }) => get(key),
    getSettingAsync: async ({ key }) => getAsync(key),
    setSetting: async ({ key, value }) => set(key, value),
    removeSetting: async ({ key }) => remove(key),
    getAllSettings: async () => getAll(),
    setMultipleSettings: async ({ settings }) => setMultiple(settings),
    resetAllSettings: async () => resetAll(),
    exportSettings: async () => exportSettings(),
    importSettings: async ({ json }) => importSettings(json),
    getDefaultSetting: async ({ key }) => getDefault(key),
    isSettingModified: async ({ key }) => isModified(key)
  });

  console.log('[Settings] Module initialized');
}

export default {
  get,
  getAsync,
  set,
  remove,
  getAll,
  setMultiple,
  resetAll,
  exportSettings,
  importSettings,
  getDefault,
  isModified,
  initSettings
};
