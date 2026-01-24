/**
 * Settings API - Chrome Storage Wrapper
 * Replaces localStorage with chrome.storage.local
 */

import { registerHandlers } from './messaging.js';

// Default settings values
const defaults = {
  'theme': 'suspended',
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
  'folder-color-mode': 'none',
  'icon-view': 'default',
  'icon-size': 'medium',
  'show-favicon': true,
  'show-title': true,
  'title-position': 'bottom',
  'max-columns': 0,
  'background-type': 'theme',
  'background-color': '#ffffff',
  'background-image-url': '',
  'background-image-file': '',
  'filter-enabled': false,
  'filter-blur': 0,
  'filter-brightness': 100,
  'filter-grayscale': 0,
  'dock-style': 'default'
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
