import { withOptionalCallback } from './utils.js';

const SEARCH_ENGINES = {
  Google: 'https://www.google.com/search?q=',
  Bing: 'https://www.bing.com/search?q=',
  Duckduckgo: 'https://duckduckgo.com/?q='
};

export function createFeedsCompat(sendMessage, settings, eventBus, stringUtil) {
  const feeds = {
    fetch(url, options, callback) {
      const result = sendMessage('fetchFeed', { url, options });
      return withOptionalCallback(result, callback);
    },
    getSubscriptions(callback) {
      const result = sendMessage('getSubscriptions');
      return withOptionalCallback(result, callback);
    },
    addSubscription(url, options, callback) {
      const result = sendMessage('addFeedSubscription', { url, options })
        .then(value => {
          eventBus.dispatch('feedSubscriptions/added', [url]);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return value;
        });
      return withOptionalCallback(result, callback);
    },
    removeSubscription(url, callback) {
      const result = sendMessage('removeFeedSubscription', { url })
        .then(value => {
          eventBus.dispatch('feedSubscriptions/removed', [url]);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return value;
        });
      return withOptionalCallback(result, callback);
    },
    updateSubscriptions(callback) {
      const result = sendMessage('updateFeedSubscriptions')
        .then(value => {
          eventBus.dispatch('feedSubscriptions/updated', value);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return value;
        });
      return withOptionalCallback(result, callback);
    }
  };

  const feedSubscriptions = {
    add(url, lastReadItemPublished = 0, callback) {
      const current = settings.get('feed-subscriptions') || {};
      const nextValue = { ...current, [url]: lastReadItemPublished };
      const result = settings.set('feed-subscriptions', nextValue)
        .then(() => {
          eventBus.dispatch('feedSubscriptions/added', [url]);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return nextValue;
        });
      return withOptionalCallback(result, callback);
    },
    reset(urlOrArray, lastReadItemPublished = 0, callback) {
      const urls = Array.isArray(urlOrArray) ? urlOrArray : [urlOrArray];
      const current = settings.get('feed-subscriptions') || {};
      const nextValue = { ...current };
      urls.forEach(url => {
        if (Object.prototype.hasOwnProperty.call(nextValue, url)) {
          nextValue[url] = lastReadItemPublished;
        }
      });
      const result = settings.set('feed-subscriptions', nextValue)
        .then(() => {
          eventBus.dispatch('feedSubscriptions/updated', urls);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return nextValue;
        });
      return withOptionalCallback(result, callback);
    },
    remove(url, callback) {
      const current = settings.get('feed-subscriptions') || {};
      const nextValue = { ...current };
      delete nextValue[url];
      const result = settings.set('feed-subscriptions', nextValue)
        .then(() => {
          eventBus.dispatch('feedSubscriptions/removed', [url]);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return nextValue;
        });
      return withOptionalCallback(result, callback);
    },
    removeAll(callback) {
      const result = settings.set('feed-subscriptions', {})
        .then(() => {
          eventBus.dispatch('feedSubscriptions/removed', null);
          eventBus.dispatch('feedSubscriptionsStats/change');
          return {};
        });
      return withOptionalCallback(result, callback);
    },
    exists(url) {
      const subscriptions = settings.get('feed-subscriptions') || {};
      return Object.prototype.hasOwnProperty.call(subscriptions, url);
    },
    count() {
      const subscriptions = settings.get('feed-subscriptions') || {};
      return Object.keys(subscriptions).length;
    },
    getURLS() {
      const subscriptions = settings.get('feed-subscriptions') || {};
      return Object.keys(subscriptions);
    },
    getLastReadItemPublished(url) {
      const subscriptions = settings.get('feed-subscriptions') || {};
      return subscriptions[url] || 0;
    },
    getMaxNumberOfSubscriptions() {
      return 35;
    }
  };

  const feedSubscriptionsStats = {
    getChildrenUnreadItems() {
      return 0;
    },
    getUnreadItems() {
      return 0;
    },
    getUnreadItemsByURL() {
      return 0;
    }
  };

  const search = {
    getEngineTemplate(engine) {
      return SEARCH_ENGINES[engine] || SEARCH_ENGINES.Google;
    },
    getTemplate(url) {
      const mapping = stringUtil.parseURLMapping(settings.get('search-url-mapping') || '');
      const mappingEntries = Object.entries(mapping);
      for (const [prefix, template] of mappingEntries) {
        if (url.startsWith(prefix)) {
          return Promise.resolve(template);
        }
      }
      return Promise.resolve(search.getEngineTemplate(settings.get('search-engine') || 'Google'));
    },
    clearCache() {
      eventBus.dispatch('search/invalidate');
    },
    countCached() {
      return 0;
    }
  };

  return { feeds, feedSubscriptions, feedSubscriptionsStats, search };
}

export default {
  createFeedsCompat
};
