import { isAsyncValue, withOptionalCallback } from './utils.js';

export function createSettingsCompat(sendMessage, eventBus) {
  let cache = Object.create(null);
  let initialized = false;
  let initPromise = null;
  let storageListenerAttached = false;

  async function handleStorageChange(changes, areaName) {
    if (areaName !== 'local') {
      return;
    }

    await ensureCache();

    const removedKeys = [];

    for (const [key, change] of Object.entries(changes || {})) {
      if (!change || !Object.prototype.hasOwnProperty.call(change, 'newValue')) {
        removedKeys.push(key);
        continue;
      }

      const nextValue = change.newValue;
      if (Object.is(cache[key], nextValue)) {
        continue;
      }

      cache[key] = nextValue;
      eventBus.dispatch(`settings/${key}`, nextValue);
    }

    if (removedKeys.length === 0) {
      return;
    }

    const settingsSnapshot = await sendMessage('getAllSettings');
    cache = { ...(settingsSnapshot || {}) };
    initialized = true;

    for (const key of removedKeys) {
      const nextValue = Object.prototype.hasOwnProperty.call(cache, key)
        ? cache[key]
        : undefined;
      eventBus.dispatch(`settings/${key}`, nextValue);
    }
  }

  function attachStorageListener() {
    if (storageListenerAttached) {
      return;
    }

    if (!chrome?.storage?.onChanged?.addListener) {
      return;
    }

    chrome.storage.onChanged.addListener((changes, areaName) => {
      handleStorageChange(changes, areaName).catch(error => {
        console.warn('[Compat][settings] Failed to sync storage change', error);
      });
    });
    storageListenerAttached = true;
  }

  async function ensureCache() {
    attachStorageListener();

    if (initialized) {
      return cache;
    }

    if (!initPromise) {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('[Compat][settings] Timed out waiting for settings (10s)')), 10000)
      );

      initPromise = Promise.race([
        sendMessage('getAllSettings'),
        timeout
      ])
        .then(settings => {
          cache = { ...(settings || {}) };
          initialized = true;
          return cache;
        })
        .finally(() => {
          initPromise = null;
        });
    }

    return initPromise;
  }

  function readFromCache(key, fallback = undefined) {
    if (!initialized) {
      return fallback;
    }
    return Object.prototype.hasOwnProperty.call(cache, key) ? cache[key] : fallback;
  }

  const settings = {
    async ready() {
      await ensureCache();
      return true;
    },
    get(key, callback) {
      const result = readFromCache(key, undefined);
      if (typeof callback === 'function') {
        callback(result);
      }
      return result;
    },
    getAsync(key, callback) {
      const result = ensureCache().then(() => readFromCache(key, undefined));
      return withOptionalCallback(result, callback);
    },
    set(key, value, callback) {
      const result = sendMessage('setSetting', { key, value })
        .then(() => value);
      return withOptionalCallback(result, callback);
    },
    setMultiple(values, callback) {
      const result = sendMessage('setMultipleSettings', { settings: values })
        .then(() => values);
      return withOptionalCallback(result, callback);
    },
    remove(key, callback) {
      const result = sendMessage('removeSetting', { key })
        .then(() => true);
      return withOptionalCallback(result, callback);
    },
    getAll(callback) {
      const result = ensureCache().then(() => ({ ...cache }));
      return withOptionalCallback(result, callback);
    },
    resetAll(callback) {
      const result = sendMessage('resetAllSettings')
        .then(settingsSnapshot => {
          cache = { ...(settingsSnapshot || {}) };
          initialized = true;
          // events dispatched by storage.onChanged listener
          return { ...cache };
        });
      return withOptionalCallback(result, callback);
    },
    export(callback) {
      const result = sendMessage('exportSettings');
      return withOptionalCallback(result, callback);
    },
    import(json, callback) {
      const result = sendMessage('importSettings', { json })
        .then(settingsSnapshot => {
          cache = { ...(settingsSnapshot || {}) };
          initialized = true;
          // events dispatched by storage.onChanged listener
          return { ...cache };
        });
      return withOptionalCallback(result, callback);
    },
    readSync(key, fallback = undefined) {
      const value = settings.get(key, null);
      return isAsyncValue(value) ? fallback : value;
    }
  };

  return settings;
}

export default {
  createSettingsCompat
};
