/**
 * Feed Subscriptions API - stateful subscriptions storage helpers.
 */

import { registerHandlers, broadcast } from './messaging.js';
import { get as getSetting, set as setSetting } from './settings.js';

const KEY = 'feed-subscriptions';
const SUBSCRIPTION_LIMIT = 35;

function getSubscriptions() {
  return { ...(getSetting(KEY) || {}) };
}

function emitChangeEvents(type, payload) {
  broadcast({ action: `feedSubscriptions/${type}`, ...payload }).catch(() => {});
  broadcast({ action: 'feedSubscriptionsStats/change', ...payload }).catch(() => {});
  broadcast({ action: 'feedSubscriptionsBookmarks/change', ...payload }).catch(() => {});
}

export async function add(url, lastReadItemPublished = 0) {
  const subscriptions = getSubscriptions();
  if (!subscriptions[url] && Object.keys(subscriptions).length >= SUBSCRIPTION_LIMIT) {
    throw new Error(`Too many subscriptions (max ${SUBSCRIPTION_LIMIT})`);
  }

  subscriptions[url] = lastReadItemPublished;
  await setSetting(KEY, subscriptions);
  emitChangeEvents('added', { urls: [url] });
  return subscriptions;
}

export async function reset(urlOrArray, lastReadItemPublished = 0) {
  const urls = Array.isArray(urlOrArray) ? urlOrArray : [urlOrArray];
  const subscriptions = getSubscriptions();

  urls.forEach(url => {
    if (Object.prototype.hasOwnProperty.call(subscriptions, url)) {
      subscriptions[url] = lastReadItemPublished;
    }
  });

  await setSetting(KEY, subscriptions);
  emitChangeEvents('updated', { urls });
  return subscriptions;
}

export async function remove(url) {
  const subscriptions = getSubscriptions();
  delete subscriptions[url];
  await setSetting(KEY, subscriptions);
  emitChangeEvents('removed', { urls: [url] });
  return subscriptions;
}

export async function removeAll() {
  await setSetting(KEY, {});
  emitChangeEvents('removed', { urls: [] });
  return {};
}

export function exists(url) {
  return Object.prototype.hasOwnProperty.call(getSubscriptions(), url);
}

export function count() {
  return Object.keys(getSubscriptions()).length;
}

export function getURLS() {
  return Object.keys(getSubscriptions());
}

export function getLastReadItemPublished(url) {
  const subscriptions = getSubscriptions();
  return subscriptions[url] || 0;
}

export function getMaxNumberOfSubscriptions() {
  return SUBSCRIPTION_LIMIT;
}

export function initFeedSubscriptions() {
  registerHandlers({
    addFeedSubscriptionState: async ({ url, lastReadItemPublished }) => add(url, lastReadItemPublished),
    resetFeedSubscriptionState: async ({ urlOrArray, lastReadItemPublished }) => reset(urlOrArray, lastReadItemPublished),
    removeFeedSubscriptionState: async ({ url }) => remove(url),
    removeAllFeedSubscriptions: async () => removeAll(),
    feedSubscriptionExists: async ({ url }) => exists(url),
    countFeedSubscriptions: async () => count(),
    getFeedSubscriptionUrls: async () => getURLS(),
    getFeedSubscriptionLastRead: async ({ url }) => getLastReadItemPublished(url),
    getFeedSubscriptionLimit: async () => getMaxNumberOfSubscriptions()
  });

  console.log('[FeedSubscriptions] Module initialized');
}

export default {
  add,
  reset,
  remove,
  removeAll,
  exists,
  count,
  getURLS,
  getLastReadItemPublished,
  getMaxNumberOfSubscriptions,
  initFeedSubscriptions
};
