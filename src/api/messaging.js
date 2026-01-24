/**
 * Messaging API - Message Router for Service Worker
 * Handles communication between extension components
 */

// Message handlers registry
const handlers = new Map();

/**
 * Register a message handler
 */
export function registerHandler(action, handler) {
  handlers.set(action, handler);
}

/**
 * Register multiple handlers at once
 */
export function registerHandlers(handlerMap) {
  for (const [action, handler] of Object.entries(handlerMap)) {
    handlers.set(action, handler);
  }
}

/**
 * Handle incoming messages
 */
async function handleMessage(message, sender) {
  const { action, ...data } = message;

  if (!action) {
    return { error: 'No action specified' };
  }

  // Special ping handler for connection testing
  if (action === 'ping') {
    return { pong: true, timestamp: Date.now() };
  }

  const handler = handlers.get(action);
  if (!handler) {
    console.warn(`[Messaging] No handler for action: ${action}`);
    return { error: `Unknown action: ${action}` };
  }

  try {
    const result = await handler(data, sender);
    return result;
  } catch (error) {
    console.error(`[Messaging] Handler error for ${action}:`, error);
    return { error: error.message };
  }
}

/**
 * Broadcast message to all extension tabs
 */
export async function broadcast(message) {
  const tabs = await chrome.tabs.query({});
  const extensionOrigin = chrome.runtime.getURL('');

  const extensionTabs = tabs.filter(tab =>
    tab.url && tab.url.startsWith(extensionOrigin)
  );

  const results = await Promise.allSettled(
    extensionTabs.map(tab =>
      chrome.tabs.sendMessage(tab.id, message).catch(() => null)
    )
  );

  return results;
}

/**
 * Send message to a specific tab
 */
export async function sendToTab(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch (error) {
    console.warn(`[Messaging] Failed to send to tab ${tabId}:`, error);
    return null;
  }
}

/**
 * Initialize messaging module
 */
export function initMessaging() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle async response
    handleMessage(message, sender)
      .then(sendResponse)
      .catch(error => {
        console.error('[Messaging] Error:', error);
        sendResponse({ error: error.message });
      });

    // Return true to indicate async response
    return true;
  });

  console.log('[Messaging] Module initialized');
}

export default {
  registerHandler,
  registerHandlers,
  broadcast,
  sendToTab,
  initMessaging
};
