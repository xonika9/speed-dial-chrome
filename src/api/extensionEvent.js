/**
 * Extension Event API - Event Broadcasting System
 * Replaces chrome.extension.getViews() with message-based broadcasting
 */

import { registerHandlers } from './messaging.js';

/**
 * Dispatch an event to all extension views
 * In MV3, we can't use getViews(), so we query tabs and send messages
 */
export async function dispatch(eventName, data = null, waitForResponse = true) {
  // Get all extension tabs
  const tabs = await chrome.tabs.query({});
  const extensionOrigin = chrome.runtime.getURL('');

  const extensionTabs = tabs.filter(tab =>
    tab.url && tab.url.startsWith(extensionOrigin)
  );

  const message = {
    action: 'extensionEvent',
    eventName,
    data
  };

  if (waitForResponse) {
    // Send to all and wait for responses
    const results = await Promise.allSettled(
      extensionTabs.map(tab =>
        chrome.tabs.sendMessage(tab.id, message).catch(() => null)
      )
    );
    return results;
  } else {
    // Fire and forget
    extensionTabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, message).catch(() => {});
    });
    return null;
  }
}

/**
 * Dispatch a settings change event
 */
export async function dispatchSettingChange(settingName, value) {
  return dispatch(`settings/${settingName}`, { value }, false);
}

/**
 * Dispatch a bookmark event
 */
export async function dispatchBookmarkEvent(eventType, data) {
  return dispatch(`bookmarks/${eventType}`, data, false);
}

/**
 * Dispatch a browser event
 */
export async function dispatchBrowserEvent(eventType, data) {
  return dispatch(`browser/${eventType}`, data, false);
}

/**
 * Dispatch a session event
 */
export async function dispatchSessionEvent(eventType, data) {
  return dispatch(`session/${eventType}`, data, false);
}

/**
 * Get count of open extension views
 */
export async function getViewCount() {
  const tabs = await chrome.tabs.query({});
  const extensionOrigin = chrome.runtime.getURL('');

  return tabs.filter(tab =>
    tab.url && tab.url.startsWith(extensionOrigin)
  ).length;
}

/**
 * Initialize extension event module
 */
export function initExtensionEvent() {
  registerHandlers({
    dispatchEvent: async ({ eventName, data, waitForResponse }) =>
      dispatch(eventName, data, waitForResponse),

    dispatchSettingChange: async ({ settingName, value }) =>
      dispatchSettingChange(settingName, value),

    dispatchBookmarkEvent: async ({ eventType, data }) =>
      dispatchBookmarkEvent(eventType, data),

    dispatchBrowserEvent: async ({ eventType, data }) =>
      dispatchBrowserEvent(eventType, data),

    dispatchSessionEvent: async ({ eventType, data }) =>
      dispatchSessionEvent(eventType, data),

    getViewCount: async () => getViewCount(),

    // Broadcast action - used by other modules
    broadcast: async ({ action, ...data }) => {
      await dispatch(action, data, false);
      return { success: true };
    }
  });

  console.log('[ExtensionEvent] Module initialized');
}

export default {
  dispatch,
  dispatchSettingChange,
  dispatchBookmarkEvent,
  dispatchBrowserEvent,
  dispatchSessionEvent,
  getViewCount,
  initExtensionEvent
};
