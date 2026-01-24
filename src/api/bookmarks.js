/**
 * Bookmarks API - Chrome Bookmarks Wrapper with Caching
 */

import { registerHandlers, broadcast } from './messaging.js';

// Bookmark cache
const cache = new Map();
const CACHE_TTL = 60000; // 1 minute

/**
 * Clear cache entry or entire cache
 */
function clearCache(id = null) {
  if (id) {
    cache.delete(id);
  } else {
    cache.clear();
  }
}

/**
 * Get cached value or fetch new
 */
async function getCached(id, fetcher) {
  const cached = cache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetcher();
  cache.set(id, { data, timestamp: Date.now() });
  return data;
}

/**
 * Get bookmark children
 */
export async function getChildren(id = '1') {
  return getCached(`children:${id}`, async () => {
    const results = await chrome.bookmarks.getChildren(id);
    return results || [];
  });
}

/**
 * Get a single bookmark
 */
export async function getSingle(id) {
  return getCached(`single:${id}`, async () => {
    const results = await chrome.bookmarks.get(id);
    return results?.[0] || null;
  });
}

/**
 * Get bookmark subtree
 */
export async function getSubTree(id = '0') {
  return getCached(`subtree:${id}`, async () => {
    const results = await chrome.bookmarks.getSubTree(id);
    return results?.[0] || null;
  });
}

/**
 * Get full bookmark tree
 */
export async function getTree() {
  return getCached('tree', async () => {
    const results = await chrome.bookmarks.getTree();
    return results || [];
  });
}

/**
 * Get path to bookmark (ancestors)
 */
export async function getPath(id) {
  const path = [];
  let currentId = id;

  while (currentId && currentId !== '0') {
    const bookmark = await getSingle(currentId);
    if (!bookmark) break;

    path.unshift(bookmark);
    currentId = bookmark.parentId;
  }

  return path;
}

/**
 * Search bookmarks
 */
export async function search(query) {
  if (typeof query === 'string') {
    return chrome.bookmarks.search(query);
  }
  return chrome.bookmarks.search(query);
}

/**
 * Create a bookmark
 */
export async function create(bookmark) {
  clearCache();
  const result = await chrome.bookmarks.create(bookmark);
  return result;
}

/**
 * Create bookmark safely (check if exists first)
 */
export async function createSafe(bookmark) {
  // Check if bookmark with same URL exists in target folder
  if (bookmark.url && bookmark.parentId) {
    const children = await getChildren(bookmark.parentId);
    const existing = children.find(b => b.url === bookmark.url);
    if (existing) {
      return { exists: true, bookmark: existing };
    }
  }

  const result = await create(bookmark);
  return { exists: false, bookmark: result };
}

/**
 * Update a bookmark
 */
export async function update(id, changes) {
  clearCache(id);
  clearCache();
  const result = await chrome.bookmarks.update(id, changes);
  return result;
}

/**
 * Move a bookmark
 */
export async function move(id, destination) {
  clearCache();
  const result = await chrome.bookmarks.move(id, destination);
  return result;
}

/**
 * Remove a bookmark
 */
export async function remove(id) {
  clearCache();
  await chrome.bookmarks.remove(id);
  return { success: true };
}

/**
 * Remove a bookmark tree (folder with contents)
 */
export async function removeTree(id) {
  clearCache();
  await chrome.bookmarks.removeTree(id);
  return { success: true };
}

/**
 * Get recent bookmarks
 */
export async function getRecent(count = 10) {
  return chrome.bookmarks.getRecent(count);
}

/**
 * Check if bookmark is a folder
 */
export function isFolder(bookmark) {
  return !bookmark.url;
}

/**
 * Get folder contents count
 */
export async function getFolderCount(id) {
  const children = await getChildren(id);
  return {
    total: children.length,
    folders: children.filter(b => isFolder(b)).length,
    bookmarks: children.filter(b => !isFolder(b)).length
  };
}

/**
 * Initialize bookmarks module
 */
export function initBookmarks() {
  // Listen for bookmark changes and broadcast
  chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    clearCache();
    broadcast({ action: 'bookmarkCreated', id, bookmark }).catch(() => {});
  });

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    clearCache();
    broadcast({ action: 'bookmarkRemoved', id, removeInfo }).catch(() => {});
  });

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    clearCache(id);
    broadcast({ action: 'bookmarkChanged', id, changeInfo }).catch(() => {});
  });

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    clearCache();
    broadcast({ action: 'bookmarkMoved', id, moveInfo }).catch(() => {});
  });

  chrome.bookmarks.onChildrenReordered.addListener((id, reorderInfo) => {
    clearCache();
    broadcast({ action: 'bookmarksReordered', id, reorderInfo }).catch(() => {});
  });

  // Register message handlers
  registerHandlers({
    getBookmarkChildren: async ({ id }) => getChildren(id),
    getBookmark: async ({ id }) => getSingle(id),
    getBookmarkSubTree: async ({ id }) => getSubTree(id),
    getBookmarkTree: async () => getTree(),
    getBookmarkPath: async ({ id }) => getPath(id),
    searchBookmarks: async ({ query }) => search(query),
    createBookmark: async (bookmark) => create(bookmark),
    createBookmarkSafe: async (bookmark) => createSafe(bookmark),
    updateBookmark: async ({ id, changes }) => update(id, changes),
    moveBookmark: async ({ id, destination }) => move(id, destination),
    removeBookmark: async ({ id }) => remove(id),
    removeBookmarkTree: async ({ id }) => removeTree(id),
    getRecentBookmarks: async ({ count }) => getRecent(count),
    getBookmarkFolderCount: async ({ id }) => getFolderCount(id),
    clearBookmarkCache: async () => {
      clearCache();
      return { success: true };
    }
  });

  console.log('[Bookmarks] Module initialized');
}

export default {
  getChildren,
  getSingle,
  getSubTree,
  getTree,
  getPath,
  search,
  create,
  createSafe,
  update,
  move,
  remove,
  removeTree,
  getRecent,
  isFolder,
  getFolderCount,
  clearCache,
  initBookmarks
};
