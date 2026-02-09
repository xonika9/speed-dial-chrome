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

function normalizeInsertIndex(parentNodes, index) {
  if (!Number.isInteger(index)) {
    return parentNodes.length;
  }
  if (index < 0) {
    return 0;
  }
  if (index > parentNodes.length) {
    return parentNodes.length;
  }
  return index;
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
 * Create many bookmarks safely with legacy-compatible behavior.
 */
export async function safeCreateMany(parentId, index, bookmarks = []) {
  if (parentId === undefined || parentId === null) {
    throw new Error('parentId is mandatory');
  }

  if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
    return [];
  }

  const parentNodes = await chrome.bookmarks.getChildren(parentId);
  const startIndex = normalizeInsertIndex(parentNodes || [], index);
  const createdTopLevelNodes = [];

  const createChildren = async (folderId, children) => {
    if (!Array.isArray(children) || children.length === 0) {
      return;
    }
    await safeCreateMany(folderId, 0, children);
  };

  for (let i = 0; i < bookmarks.length; i++) {
    const bookmark = bookmarks[i] || {};
    const properties = {
      parentId,
      index: startIndex + i,
      title: bookmark.title || ''
    };

    if (bookmark.url) {
      properties.url = bookmark.url;
    }

    const createdNode = await chrome.bookmarks.create(properties);
    createdTopLevelNodes.push(createdNode);

    if (!createdNode.url && Array.isArray(bookmark.children) && bookmark.children.length > 0) {
      await createChildren(createdNode.id, bookmark.children);
    }
  }

  clearCache();
  return createdTopLevelNodes;
}

/**
 * Move a set of bookmarks while preserving order.
 */
export async function moveMany(ids = [], parentId, index) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return 0;
  }

  const siblings = await chrome.bookmarks.getChildren(parentId);
  let destinationIndex = normalizeInsertIndex(siblings || [], index);
  let movedNodes = 0;

  for (const id of ids) {
    const moved = await chrome.bookmarks.move(id, {
      parentId,
      index: destinationIndex
    });
    if (moved) {
      movedNodes += 1;
      destinationIndex += 1;
    }
  }

  clearCache();
  return movedNodes;
}

/**
 * Reorder children of a folder by title.
 */
export async function reorderByTitle(parentId) {
  const children = await chrome.bookmarks.getChildren(parentId);
  const sorted = [...children].sort((a, b) =>
    (a.title || '').toLowerCase().localeCompare((b.title || '').toLowerCase())
  );

  for (let i = 0; i < sorted.length; i++) {
    await chrome.bookmarks.move(sorted[i].id, { parentId, index: i });
  }

  clearCache();
  return { success: true };
}

/**
 * Collect all URLs recursively from one or many bookmark tree roots.
 */
export async function getAllURLs(idOrArray) {
  const ids = Array.isArray(idOrArray) ? idOrArray : [idOrArray];
  const urls = [];

  const collectUrls = node => {
    if (!node) {
      return;
    }

    if (node.url) {
      urls.push(node.url);
    }

    if (Array.isArray(node.children)) {
      node.children.forEach(collectUrls);
    }
  };

  for (const id of ids) {
    const tree = await chrome.bookmarks.getSubTree(id);
    if (tree && tree[0]) {
      collectUrls(tree[0]);
    }
  }

  return urls;
}

const LEGACY_BOOKMARK_ACTIONS = {
  created: 'bookmarkCreated',
  removed: 'bookmarkRemoved',
  changed: 'bookmarkChanged',
  moved: 'bookmarkMoved',
  childrenReordered: 'bookmarksReordered'
};

function dispatchBookmarkBroadcast(eventType, payload) {
  const action = `bookmarks/${eventType}`;
  const legacyAction = LEGACY_BOOKMARK_ACTIONS[eventType];

  broadcast({ action, ...payload }).catch(() => {});
  broadcast({ action: 'bookmarks/change', ...payload }).catch(() => {});

  if (legacyAction) {
    broadcast({ action: legacyAction, ...payload }).catch(() => {});
  }
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
    dispatchBookmarkBroadcast('created', { id, bookmark });
  });

  chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    clearCache();
    dispatchBookmarkBroadcast('removed', { id, removeInfo });
  });

  chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    clearCache(id);
    dispatchBookmarkBroadcast('changed', { id, changeInfo });
  });

  chrome.bookmarks.onMoved.addListener((id, moveInfo) => {
    clearCache();
    dispatchBookmarkBroadcast('moved', { id, moveInfo });
  });

  chrome.bookmarks.onChildrenReordered.addListener((id, reorderInfo) => {
    clearCache();
    dispatchBookmarkBroadcast('childrenReordered', { id, reorderInfo });
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
    safeCreateManyBookmarks: async ({ parentId, index, bookmarks }) =>
      safeCreateMany(parentId, index, bookmarks),
    moveManyBookmarks: async ({ ids, parentId, index }) => moveMany(ids, parentId, index),
    reorderBookmarksByTitle: async ({ parentId }) => reorderByTitle(parentId),
    getAllBookmarkUrls: async ({ idOrArray }) => getAllURLs(idOrArray),
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
  safeCreateMany,
  update,
  move,
  moveMany,
  reorderByTitle,
  remove,
  removeTree,
  getAllURLs,
  getRecent,
  isFolder,
  getFolderCount,
  clearCache,
  initBookmarks
};
