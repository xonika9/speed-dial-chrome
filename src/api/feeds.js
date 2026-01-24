/**
 * Feeds API - RSS Feed Fetching and Parsing
 * Uses offscreen document for DOMParser operations
 */

import { registerHandlers, broadcast } from './messaging.js';
import { get as getSetting, set as setSetting } from './settings.js';
import { parseXML } from './offscreen.js';

// Feed cache
const feedCache = new Map();

/**
 * Parse URL mapping text
 */
function parseURLMapping(text) {
  const mapping = {};
  const lines = (text || '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('>');
    if (parts.length !== 2) continue;

    mapping[parts[0].trim()] = parts[1].trim();
  }

  return mapping;
}

/**
 * Find mapped feed URL
 */
function findMappedFeedURL(url, mapping) {
  for (const pattern in mapping) {
    if (url.startsWith(pattern)) {
      return mapping[pattern];
    }
  }
  return null;
}

/**
 * Parse RSS/Atom feed from XML document
 */
function parseFeedDocument(doc) {
  const items = [];

  // Try RSS format first
  const rssItems = findElements(doc, 'item');
  if (rssItems.length > 0) {
    for (const item of rssItems) {
      items.push({
        title: getElementText(item, 'title'),
        link: getElementText(item, 'link'),
        description: getElementText(item, 'description'),
        pubDate: getElementText(item, 'pubDate'),
        guid: getElementText(item, 'guid')
      });
    }
    return {
      type: 'rss',
      title: getElementText(doc, 'title'),
      link: getElementText(doc, 'link'),
      description: getElementText(doc, 'description'),
      items
    };
  }

  // Try Atom format
  const atomEntries = findElements(doc, 'entry');
  if (atomEntries.length > 0) {
    for (const entry of atomEntries) {
      const linkEl = findElement(entry, 'link');
      items.push({
        title: getElementText(entry, 'title'),
        link: linkEl ? linkEl.attributes.href : '',
        description: getElementText(entry, 'content') || getElementText(entry, 'summary'),
        pubDate: getElementText(entry, 'updated') || getElementText(entry, 'published'),
        guid: getElementText(entry, 'id')
      });
    }
    return {
      type: 'atom',
      title: getElementText(doc, 'title'),
      link: getAtomLink(doc),
      description: getElementText(doc, 'subtitle'),
      items
    };
  }

  return { type: 'unknown', items: [] };
}

/**
 * Helper functions for navigating serialized XML
 */
function findElements(node, tagName) {
  const results = [];
  if (!node || !node.children) return results;

  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === tagName) {
      results.push(child);
    }
    results.push(...findElements(child, tagName));
  }
  return results;
}

function findElement(node, tagName) {
  if (!node || !node.children) return null;

  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === tagName) {
      return child;
    }
    const found = findElement(child, tagName);
    if (found) return found;
  }
  return null;
}

function getElementText(node, tagName) {
  const element = findElement(node, tagName);
  if (!element || !element.children) return '';

  return element.children
    .filter(c => c.type === 'text')
    .map(c => c.content)
    .join('')
    .trim();
}

function getAtomLink(doc) {
  const links = findElements(doc, 'link');
  for (const link of links) {
    if (link.attributes && link.attributes.rel === 'alternate') {
      return link.attributes.href || '';
    }
  }
  if (links.length > 0 && links[0].attributes) {
    return links[0].attributes.href || '';
  }
  return '';
}

/**
 * Fetch and parse a feed
 */
export async function fetchFeed(url, options = {}) {
  const { bypassCache = false, timeout = 30000 } = options;

  // Check cache
  const cacheKey = url;
  const expirationTime = 1000 * 60 * Number(getSetting('feeds-expiration-time') || 30);

  if (!bypassCache && feedCache.has(cacheKey)) {
    const cached = feedCache.get(cacheKey);
    if (Date.now() - cached.timestamp < expirationTime) {
      return cached.data;
    }
  }

  // Check URL mapping
  const urlMapping = parseURLMapping(getSetting('feeds-url-mapping'));
  const feedUrl = findMappedFeedURL(url, urlMapping) || url;

  try {
    // Fetch the feed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(feedUrl, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();

    // Parse XML using offscreen document
    const doc = await parseXML(text, 'text/xml');
    const feed = parseFeedDocument(doc);

    // Cache the result
    const result = {
      ...feed,
      url: feedUrl,
      fetchedAt: Date.now()
    };

    feedCache.set(cacheKey, {
      timestamp: Date.now(),
      data: result
    });

    return result;
  } catch (error) {
    console.error(`[Feeds] Failed to fetch ${feedUrl}:`, error);
    throw error;
  }
}

/**
 * Get feed subscriptions
 */
export function getSubscriptions() {
  return getSetting('feed-subscriptions') || {};
}

/**
 * Add a feed subscription
 */
export async function addSubscription(url, options = {}) {
  const subscriptions = getSubscriptions();
  subscriptions[url] = {
    ...options,
    addedAt: Date.now()
  };
  await setSetting('feed-subscriptions', subscriptions);
  return subscriptions;
}

/**
 * Remove a feed subscription
 */
export async function removeSubscription(url) {
  const subscriptions = getSubscriptions();
  delete subscriptions[url];
  await setSetting('feed-subscriptions', subscriptions);
  return subscriptions;
}

/**
 * Update all subscribed feeds
 */
export async function updateSubscriptions() {
  const subscriptions = getSubscriptions();
  const results = {};

  for (const url of Object.keys(subscriptions)) {
    try {
      results[url] = await fetchFeed(url, { bypassCache: true });
    } catch (error) {
      results[url] = { error: error.message };
    }
  }

  broadcast({ action: 'feedsUpdated', results }).catch(() => {});
  return results;
}

/**
 * Clear feed cache
 */
export function clearCache() {
  feedCache.clear();
}

/**
 * Initialize feeds module
 */
export function initFeeds() {
  // Set up periodic updates if configured
  const updateMode = getSetting('feed-subscriptions-update');

  if (updateMode === 'in-background') {
    // Create alarm for background updates
    chrome.alarms.create('updateFeeds', {
      periodInMinutes: Number(getSetting('feeds-expiration-time') || 30)
    });

    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === 'updateFeeds') {
        updateSubscriptions().catch(console.error);
      }
    });
  }

  // Register message handlers
  registerHandlers({
    fetchFeed: async ({ url, options }) => fetchFeed(url, options),

    getSubscriptions: async () => getSubscriptions(),

    addFeedSubscription: async ({ url, options }) => addSubscription(url, options),

    removeFeedSubscription: async ({ url }) => removeSubscription(url),

    updateFeedSubscriptions: async () => updateSubscriptions(),

    clearFeedCache: async () => {
      clearCache();
      return { success: true };
    }
  });

  console.log('[Feeds] Module initialized');
}

export default {
  fetchFeed,
  getSubscriptions,
  addSubscription,
  removeSubscription,
  updateSubscriptions,
  clearCache,
  initFeeds
};
