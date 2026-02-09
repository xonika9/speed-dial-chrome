/**
 * UI Loader - API Proxy for Page Context
 * Replaces legacy background-page coupling with messaging
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
    async getChildren(id = '1', callback) {
      const result = apiProxy.sendMessage('getBookmarkChildren', { id });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback([]));
      }
      return result;
    },
    async getSingle(id, callback) {
      const result = apiProxy.sendMessage('getBookmark', { id });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback(null));
      }
      return result;
    },
    async getSubTree(id, callback) {
      const result = apiProxy.sendMessage('getBookmarkSubTree', { id })
        .then(node => (node ? [node] : []));
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback([]));
      }
      return result;
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
    async safecreate(bookmark, callback) {
      const result = apiProxy.sendMessage('createBookmarkSafe', bookmark)
        .then(response => response?.bookmark || null);
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback(null));
      }
      return result;
    },
    async safecreatemany(parentId, index, bookmarks, callback) {
      const result = apiProxy.sendMessage('safeCreateManyBookmarks', { parentId, index, bookmarks });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback([]));
      }
      return result;
    },
    async update(id, changes) {
      return apiProxy.sendMessage('updateBookmark', { id, changes });
    },
    async move(id, destination) {
      return apiProxy.sendMessage('moveBookmark', { id, destination });
    },
    async moveMany(ids, parentId, index, callback) {
      const result = apiProxy.sendMessage('moveManyBookmarks', { ids, parentId, index });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback(0));
      }
      return result;
    },
    async reorderByTitle(parentId, callback) {
      const result = apiProxy.sendMessage('reorderBookmarksByTitle', { parentId });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback(null));
      }
      return result;
    },
    async remove(id) {
      return apiProxy.sendMessage('removeBookmark', { id });
    },
    async removeTree(id) {
      return apiProxy.sendMessage('removeBookmarkTree', { id });
    },
    async getRecent(count = 10) {
      return apiProxy.sendMessage('getRecentBookmarks', { count });
    },
    async getAllURLS(idOrArray, callback) {
      const result = apiProxy.sendMessage('getAllBookmarkUrls', { idOrArray });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback([]));
      }
      return result;
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
    async getIconImageBitmap(url, id, callback) {
      const result = apiProxy.sendMessage('getBookmarkIcon', {
        bookmark: { id, url },
        options: { size: 160 }
      });
      if (typeof callback === 'function') {
        result.then(callback).catch(() => callback(null));
      }
      return result;
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

  feedSubscriptions: {
    async add(url, lastReadItemPublished) {
      return apiProxy.sendMessage('addFeedSubscriptionState', { url, lastReadItemPublished });
    },
    async reset(urlOrArray, lastReadItemPublished) {
      return apiProxy.sendMessage('resetFeedSubscriptionState', { urlOrArray, lastReadItemPublished });
    },
    async remove(url) {
      return apiProxy.sendMessage('removeFeedSubscriptionState', { url });
    },
    async removeAll() {
      return apiProxy.sendMessage('removeAllFeedSubscriptions');
    },
    async exists(url) {
      return apiProxy.sendMessage('feedSubscriptionExists', { url });
    },
    async count() {
      return apiProxy.sendMessage('countFeedSubscriptions');
    },
    async getURLS() {
      return apiProxy.sendMessage('getFeedSubscriptionUrls');
    }
  },

  feedSubscriptionsStats: {
    async getChildrenUnreadItems() {
      return apiProxy.sendMessage('getFeedChildrenUnreadItems');
    },
    async getUnreadItems(bookmarkId) {
      return apiProxy.sendMessage('getFeedUnreadItems', { bookmarkId });
    },
    async getUnreadItemsByURL(url) {
      return apiProxy.sendMessage('getFeedUnreadItemsByURL', { url });
    }
  },

  search: {
    async getEngineTemplate(engineName) {
      return apiProxy.sendMessage('getSearchEngineTemplate', { engineName });
    },
    async getTemplate(url) {
      return apiProxy.sendMessage('getSearchTemplate', { url });
    },
    async clearCache(urls) {
      return apiProxy.sendMessage('clearSearchCache', { urls });
    },
    async countCached() {
      return apiProxy.sendMessage('countSearchCache');
    }
  },

  iconsUrlMapping: {
    async getAll() {
      return apiProxy.sendMessage('getIconsUrlMapping');
    },
    async resolve(url) {
      return apiProxy.sendMessage('resolveIconsUrlMapping', { url });
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

// Export the API proxy
window.api = apiProxy;
window.apiProxy = apiProxy;
window.addEventListener = addEventListener;
window.removeEventListener = removeEventListener;

console.log('[Loader] UI Loader initialized');
