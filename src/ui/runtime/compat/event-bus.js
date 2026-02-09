function isCustomEventName(eventName) {
  return typeof eventName === 'string' && (
    eventName.startsWith('hashchange#') ||
    eventName.includes('/')
  );
}

export function initCompatEventBus(win = window) {
  if (win.__mv3CompatEventBus) {
    return win.__mv3CompatEventBus;
  }

  const listeners = new Map();
  const nativeAddEventListener = win.addEventListener.bind(win);
  const nativeRemoveEventListener = win.removeEventListener.bind(win);
  const nativeDispatchEvent = win.dispatchEvent.bind(win);

  function addCustomEventListener(eventName, listener) {
    let invoker = null;
    if (typeof listener === 'function') {
      invoker = listener;
    } else if (listener && typeof listener.handleEvent === 'function') {
      invoker = event => listener.handleEvent(event);
    }

    if (!invoker) {
      return;
    }

    if (!listeners.has(eventName)) {
      listeners.set(eventName, new Map());
    }

    listeners.get(eventName).set(listener, invoker);
  }

  function removeCustomEventListener(eventName, listener) {
    const bucket = listeners.get(eventName);
    if (!bucket) {
      return;
    }

    bucket.delete(listener);

    if (bucket.size === 0) {
      listeners.delete(eventName);
    }
  }

  function dispatchCustomEvent(eventName, detail = null) {
    const event = new CustomEvent(eventName, { detail });
    const bucket = listeners.get(eventName);

    if (!bucket) {
      return event;
    }

    for (const listener of bucket.values()) {
      try {
        listener(event);
      } catch (error) {
        console.error(`[CompatEventBus] Listener failed for "${eventName}"`, error);
      }
    }

    return event;
  }

  function dispatchAliasedEvents(action, detail) {
    switch (action) {
      case 'bookmarkCreated':
        dispatchCustomEvent('bookmarks/created', detail);
        dispatchCustomEvent('bookmarks/change', detail);
        return;
      case 'bookmarkRemoved':
        dispatchCustomEvent('bookmarks/removed', detail);
        dispatchCustomEvent('bookmarks/change', detail);
        return;
      case 'bookmarkChanged':
        dispatchCustomEvent('bookmarks/changed', detail);
        dispatchCustomEvent('bookmarks/change', detail);
        return;
      case 'bookmarkMoved':
        dispatchCustomEvent('bookmarks/moved', detail);
        dispatchCustomEvent('bookmarks/change', detail);
        return;
      case 'bookmarksReordered':
        dispatchCustomEvent('bookmarks/childrenReordered', detail);
        dispatchCustomEvent('bookmarks/change', detail);
        return;
      default:
        dispatchCustomEvent(action, detail);
    }
  }

  const aliasedActionNames = new Set([
    'bookmarkCreated',
    'bookmarkRemoved',
    'bookmarkChanged',
    'bookmarkMoved',
    'bookmarksReordered'
  ]);

  function getHashRouteEventName() {
    const hash = win.location.hash || '';
    const route = hash.replace(/^#/, '').split('?')[0];
    if (!route) {
      return null;
    }
    return `hashchange#${route}`;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || typeof message !== 'object') {
      return false;
    }

    if (message.action === 'extensionEvent') {
      dispatchCustomEvent(message.eventName, message.data);
      sendResponse({ received: true });
      return true;
    }

    if (typeof message.action === 'string') {
      const shouldHandle = isCustomEventName(message.action) || aliasedActionNames.has(message.action);
      if (!shouldHandle) {
        return false;
      }
      const { action, ...detail } = message;
      dispatchAliasedEvents(action, detail);
      sendResponse({ received: true });
      return true;
    }

    return false;
  });

  nativeAddEventListener('hashchange', () => {
    const routeEventName = getHashRouteEventName();
    if (routeEventName) {
      dispatchCustomEvent(routeEventName);
    }
  });

  win.addEventListener = function patchedAddEventListener(eventName, listener, options) {
    if (isCustomEventName(eventName)) {
      addCustomEventListener(eventName, listener);
      return;
    }
    return nativeAddEventListener(eventName, listener, options);
  };

  win.removeEventListener = function patchedRemoveEventListener(eventName, listener, options) {
    if (isCustomEventName(eventName)) {
      removeCustomEventListener(eventName, listener);
      return;
    }
    return nativeRemoveEventListener(eventName, listener, options);
  };

  win.dispatchEvent = function patchedDispatchEvent(event) {
    if (event && isCustomEventName(event.type)) {
      dispatchCustomEvent(event.type, event.detail);
      return true;
    }
    return nativeDispatchEvent(event);
  };

  const bus = {
    addEventListener: addCustomEventListener,
    removeEventListener: removeCustomEventListener,
    dispatch: dispatchCustomEvent
  };

  win.__mv3CompatEventBus = bus;
  return bus;
}

export default {
  initCompatEventBus
};
