/**
 * Browser API - Tab and Window Operations
 * Uses chrome.scripting for MV3 compatibility
 */

import { registerHandlers } from './messaging.js';
import { get as getSetting } from './settings.js';

const POPUP_PAGE_URL = 'page.html?theme&ui=PopupUI&style=width:800px;height:600px;overflow:hidden;';

/**
 * Open URL in tab based on settings
 */
export async function openUrl(url, options = {}) {
  const {
    disposition = 'currentTab',
    active = true
  } = options;

  switch (disposition) {
    case 'currentTab':
      await chrome.tabs.update({ url });
      break;

    case 'newTab':
      await chrome.tabs.create({ url, active });
      break;

    case 'newWindow':
      await chrome.windows.create({ url });
      break;

    case 'newIncognito':
      await chrome.windows.create({ url, incognito: true });
      break;

    case 'background':
      await chrome.tabs.create({ url, active: false });
      break;

    default:
      await chrome.tabs.create({ url, active });
  }

  return { success: true };
}

/**
 * Open bookmark based on settings and modifiers
 */
export async function openBookmark(bookmark, modifiers = {}) {
  const { ctrl, shift, middle } = modifiers;

  let disposition;
  if (shift) {
    disposition = bookmark.url
      ? getSetting('bookmark-opens-in-shift')
      : getSetting('folder-opens-in-shift');
  } else if (ctrl || middle) {
    disposition = bookmark.url
      ? getSetting('bookmark-opens-in-ctrl')
      : getSetting('folder-opens-in-ctrl');
  } else {
    disposition = bookmark.url
      ? getSetting('bookmark-opens-in')
      : getSetting('folder-opens-in');
  }

  if (bookmark.url) {
    // Check if it's a javascript: bookmark
    if (bookmark.url.startsWith('javascript:')) {
      return executeBookmarklet(bookmark.url);
    }
    return openUrl(bookmark.url, { disposition });
  }

  // It's a folder - open all bookmarks
  const children = await chrome.bookmarks.getChildren(bookmark.id);
  const urls = children.filter(b => b.url).map(b => b.url);

  for (const url of urls) {
    await chrome.tabs.create({ url, active: false });
  }

  return { success: true, opened: urls.length };
}

/**
 * Execute a javascript: bookmarklet
 */
export async function executeBookmarklet(code) {
  // Get current active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab) {
    return { success: false, error: 'No active tab' };
  }

  // Check if we can execute on this tab
  if (tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('about:')) {
    return { success: false, error: 'Cannot execute on this page' };
  }

  // Extract the actual code from javascript: URL
  const scriptCode = decodeURIComponent(code.replace(/^javascript:/i, ''));

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (code) => {
        try {
          const script = document.createElement('script');
          script.textContent = code;
          (document.head || document.documentElement).appendChild(script);
          script.remove();
        } catch (e) {
          console.error('Bookmarklet error:', e);
        }
      },
      args: [scriptCode],
      world: 'MAIN'
    });

    return { success: true };
  } catch (error) {
    console.error('[Browser] Bookmarklet execution failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get current tab info
 */
export async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab || null;
}

/**
 * Get all tabs in current window
 */
export async function getWindowTabs() {
  return chrome.tabs.query({ currentWindow: true });
}

/**
 * Create new tab
 */
export async function createTab(options = {}) {
  const position = getSetting('new-tab-position');

  if (position === 'afterCurrent') {
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (currentTab) {
      options.index = currentTab.index + 1;
    }
  }

  return chrome.tabs.create(options);
}

/**
 * Close tab
 */
export async function closeTab(tabId) {
  await chrome.tabs.remove(tabId);
  return { success: true };
}

/**
 * Reload tab
 */
export async function reloadTab(tabId, bypassCache = false) {
  await chrome.tabs.reload(tabId, { bypassCache });
  return { success: true };
}

/**
 * Set action badge
 */
export async function setBadge(text, color = '#666666') {
  await chrome.action.setBadgeText({ text: text?.toString() || '' });
  await chrome.action.setBadgeBackgroundColor({ color });
  return { success: true };
}

/**
 * Set action popup
 */
export async function setPopup(popup) {
  await chrome.action.setPopup({ popup: popup || '' });
  return { success: true };
}

/**
 * Handle action click (toolbar button)
 */
async function onActionClicked(tab) {
  const browserAction = getSetting('browser-action');

  switch (browserAction) {
    case 'popup':
      // Popup is handled by Chrome
      break;

    case 'newTab':
      await chrome.tabs.create({});
      break;

    case 'default':
    default:
      // Open Chrome New Tab so chrome_url_overrides route is applied consistently.
      await chrome.tabs.create({ url: 'chrome://newtab' });
      break;
  }
}

/**
 * Initialize browser module
 */
export function initBrowser() {
  // Handle action click when no popup
  chrome.action.onClicked.addListener(onActionClicked);

  // Update popup based on settings
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['browser-action']) {
      const newValue = changes['browser-action'].newValue;
      if (newValue === 'popup') {
        setPopup(POPUP_PAGE_URL);
      } else {
        setPopup('');
      }
    }
  });

  // Set initial popup state
  const browserAction = getSetting('browser-action');
  if (browserAction === 'popup') {
    setPopup(POPUP_PAGE_URL);
  }

  registerHandlers({
    openUrl: async ({ url, options }) => openUrl(url, options),
    openBookmark: async ({ bookmark, modifiers }) => openBookmark(bookmark, modifiers),
    executeBookmarklet: async ({ code }) => executeBookmarklet(code),
    getCurrentTab: async () => getCurrentTab(),
    getWindowTabs: async () => getWindowTabs(),
    createTab: async ({ options }) => createTab(options),
    closeTab: async ({ tabId }) => closeTab(tabId),
    reloadTab: async ({ tabId, bypassCache }) => reloadTab(tabId, bypassCache),
    setBadge: async ({ text, color }) => setBadge(text, color),
    setPopup: async ({ popup }) => setPopup(popup)
  });

  console.log('[Browser] Module initialized');
}

export default {
  openUrl,
  openBookmark,
  executeBookmarklet,
  getCurrentTab,
  getWindowTabs,
  createTab,
  closeTab,
  reloadTab,
  setBadge,
  setPopup,
  initBrowser
};
