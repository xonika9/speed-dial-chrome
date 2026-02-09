/**
 * Feed Subscriptions Stats API
 * Minimal parity layer for unread counters used by UI components.
 */

import { registerHandlers } from './messaging.js';

const unreadByBookmarkId = new Map();
const unreadByUrl = new Map();

export function getChildrenUnreadItems() {
  let total = 0;
  for (const value of unreadByBookmarkId.values()) {
    total += Number(value || 0);
  }
  return total;
}

export function getUnreadItems(bookmarkId) {
  return Number(unreadByBookmarkId.get(String(bookmarkId)) || 0);
}

export function getUnreadItemsByURL(url) {
  return Number(unreadByUrl.get(url) || 0);
}

export function setUnreadItemsByURL(url, value) {
  unreadByUrl.set(url, Number(value || 0));
}

export function setUnreadItemsByBookmarkId(bookmarkId, value) {
  unreadByBookmarkId.set(String(bookmarkId), Number(value || 0));
}

export function clearUnreadStats() {
  unreadByBookmarkId.clear();
  unreadByUrl.clear();
}

export function initFeedSubscriptionsStats() {
  registerHandlers({
    getFeedChildrenUnreadItems: async () => getChildrenUnreadItems(),
    getFeedUnreadItems: async ({ bookmarkId }) => getUnreadItems(bookmarkId),
    getFeedUnreadItemsByURL: async ({ url }) => getUnreadItemsByURL(url),
    setFeedUnreadItemsByURL: async ({ url, value }) => {
      setUnreadItemsByURL(url, value);
      return { success: true };
    },
    setFeedUnreadItemsByBookmarkId: async ({ bookmarkId, value }) => {
      setUnreadItemsByBookmarkId(bookmarkId, value);
      return { success: true };
    },
    clearFeedUnreadStats: async () => {
      clearUnreadStats();
      return { success: true };
    }
  });

  console.log('[FeedSubscriptionsStats] Module initialized');
}

export default {
  getChildrenUnreadItems,
  getUnreadItems,
  getUnreadItemsByURL,
  setUnreadItemsByURL,
  setUnreadItemsByBookmarkId,
  clearUnreadStats,
  initFeedSubscriptionsStats
};
