/**
 * UI Loader - API Proxy for Page Context
 * Replaces chrome.extension.getBackgroundPage() with messaging
 */

// API Proxy that sends messages to service worker
const apiProxy = {
  // Pending message ID counter
  _messageId: 0,

  /**
   * Send message to service worker and get response
   */
  async sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      });
    });
  },

  // Settings API
  settings: {
    async get(key) {
      return apiProxy.sendMessage('getSetting', { key });
    },
    async getAsync(key) {
      return apiProxy.sendMessage('getSettingAsync', { key });
    },
    async set(key, value) {
      return apiProxy.sendMessage('setSetting', { key, value });
    },
    async remove(key) {
      return apiProxy.sendMessage('removeSetting', { key });
    },
    async getAll() {
      return apiProxy.sendMessage('getAllSettings');
    },
    async setMultiple(settings) {
      return apiProxy.sendMessage('setMultipleSettings', { settings });
    },
    async resetAll() {
      return apiProxy.sendMessage('resetAllSettings');
    },
    async export() {
      return apiProxy.sendMessage('exportSettings');
    },
    async import(json) {
      return apiProxy.sendMessage('importSettings', { json });
    }
  },

  // Bookmarks API
  bookmarks: {
    async getChildren(id = '1') {
      return apiProxy.sendMessage('getBookmarkChildren', { id });
    },
    async getSingle(id) {
      return apiProxy.sendMessage('getBookmark', { id });
    },
    async getSubTree(id) {
      return apiProxy.sendMessage('getBookmarkSubTree', { id });
    },
    async getTree() {
      return apiProxy.sendMessage('getBookmarkTree');
    },
    async getPath(id) {
      return apiProxy.sendMessage('getBookmarkPath', { id });
    },
    async search(query) {
      return apiProxy.sendMessage('searchBookmarks', { query });
    },
    async create(bookmark) {
      return apiProxy.sendMessage('createBookmark', bookmark);
    },
    async createSafe(bookmark) {
      return apiProxy.sendMessage('createBookmarkSafe', bookmark);
    },
    async update(id, changes) {
      return apiProxy.sendMessage('updateBookmark', { id, changes });
    },
    async move(id, destination) {
      return apiProxy.sendMessage('moveBookmark', { id, destination });
    },
    async remove(id) {
      return apiProxy.sendMessage('removeBookmark', { id });
    },
    async removeTree(id) {
      return apiProxy.sendMessage('removeBookmarkTree', { id });
    },
    async getRecent(count = 10) {
      return apiProxy.sendMessage('getRecentBookmarks', { count });
    }
  },

  // Icons API
  icons: {
    getFaviconUrl(pageUrl, size = 32) {
      const url = new URL(chrome.runtime.getURL('/_favicon/'));
      url.searchParams.set('pageUrl', pageUrl);
      url.searchParams.set('size', size.toString());
      return url.toString();
    },
    async generateLetterIcon(url, options) {
      return apiProxy.sendMessage('generateLetterIcon', { url, options });
    },
    async generateFolderIcon(options) {
      return apiProxy.sendMessage('generateFolderIcon', { options });
    },
    async getBookmarkIcon(bookmark, options) {
      return apiProxy.sendMessage('getBookmarkIcon', { bookmark, options });
    },
    async clearCache() {
      return apiProxy.sendMessage('clearIconCache');
    }
  },

  // Theme API
  theme: {
    async getCSS() {
      return apiProxy.sendMessage('getThemeCSS');
    },
    async getCombinedStyles() {
      return apiProxy.sendMessage('getCombinedStyles');
    },
    async apply(themeName) {
      return apiProxy.sendMessage('applyTheme', { themeName });
    },
    async list() {
      return apiProxy.sendMessage('listThemes');
    }
  },

  // Browser API
  browser: {
    async openUrl(url, options) {
      return apiProxy.sendMessage('openUrl', { url, options });
    },
    async openBookmark(bookmark, modifiers) {
      return apiProxy.sendMessage('openBookmark', { bookmark, modifiers });
    },
    async getCurrentTab() {
      return apiProxy.sendMessage('getCurrentTab');
    },
    async createTab(options) {
      return apiProxy.sendMessage('createTab', { options });
    }
  },

  // Extension Event API
  extensionEvent: {
    async dispatch(eventName, data, waitForResponse = false) {
      return apiProxy.sendMessage('dispatchEvent', { eventName, data, waitForResponse });
    },
    async getViewCount() {
      return apiProxy.sendMessage('getViewCount');
    }
  },

  // Feeds API
  feeds: {
    async fetch(url, options) {
      return apiProxy.sendMessage('fetchFeed', { url, options });
    },
    async getSubscriptions() {
      return apiProxy.sendMessage('getSubscriptions');
    },
    async addSubscription(url, options) {
      return apiProxy.sendMessage('addFeedSubscription', { url, options });
    },
    async removeSubscription(url) {
      return apiProxy.sendMessage('removeFeedSubscription', { url });
    },
    async updateSubscriptions() {
      return apiProxy.sendMessage('updateFeedSubscriptions');
    }
  },

  // Migration API
  migration: {
    async needsMigration() {
      return apiProxy.sendMessage('needsMigration');
    },
    async migrateFromPage(localStorageData) {
      return apiProxy.sendMessage('migrateFromPage', { localStorageData });
    },
    async getStatus() {
      return apiProxy.sendMessage('getMigrationStatus');
    }
  }
};

// Event listeners for messages from service worker
const eventListeners = new Map();

/**
 * Listen for extension events
 */
function addEventListener(eventName, callback) {
  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set());
  }
  eventListeners.get(eventName).add(callback);
}

/**
 * Remove event listener
 */
function removeEventListener(eventName, callback) {
  if (eventListeners.has(eventName)) {
    eventListeners.get(eventName).delete(callback);
  }
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'extensionEvent') {
    const { eventName, data } = message;
    const listeners = eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('[Loader] Event listener error:', error);
        }
      });
    }
    sendResponse({ received: true });
    return true;
  }

  // Handle other broadcast messages
  const listeners = eventListeners.get(message.action);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('[Loader] Broadcast listener error:', error);
      }
    });
  }
});

/**
 * Check if running in MV3
 */
function isMV3() {
  return chrome.runtime.getManifest().manifest_version === 3;
}

/**
 * Perform localStorage migration if needed
 */
async function performMigrationIfNeeded() {
  if (!isMV3()) return;

  const needsMigration = await apiProxy.migration.needsMigration();
  if (!needsMigration) return;

  console.log('[Loader] Performing localStorage migration...');

  // Collect data from localStorage
  const localStorageData = {};
  const keysToMigrate = [
    'style/theme',
    'style/background',
    'style/background-filter',
    'style/dock',
    'navigation/last-visited-folder',
    'news-ui/color-scheme',
    'popover-bookmark-editor/folder'
  ];

  for (const key of keysToMigrate) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      localStorageData[key] = value;
    }
  }

  // Send to service worker for migration
  const result = await apiProxy.migration.migrateFromPage(localStorageData);
  console.log('[Loader] Migration complete:', result);
}

// Export the API proxy
window.api = apiProxy;
window.apiProxy = apiProxy;
window.addEventListener = addEventListener;
window.removeEventListener = removeEventListener;

// Perform migration on load
performMigrationIfNeeded().catch(console.error);

console.log('[Loader] UI Loader initialized');
