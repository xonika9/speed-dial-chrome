/**
 * Context Menu API - Chrome Context Menu Management
 */

import { registerHandlers } from './messaging.js';
import { get as getSetting } from './settings.js';

// Track created menu items
const menuItems = new Map();

/**
 * Create a context menu item
 */
export function createMenuItem(id, options) {
  const { title, contexts = ['all'], parentId, type = 'normal', checked, enabled = true } = options;

  const createProperties = {
    id,
    title,
    contexts,
    type,
    enabled
  };

  if (parentId) createProperties.parentId = parentId;
  if (type === 'checkbox' && checked !== undefined) createProperties.checked = checked;

  chrome.contextMenus.create(createProperties, () => {
    if (chrome.runtime.lastError) {
      console.warn(`[ContextMenu] Failed to create ${id}:`, chrome.runtime.lastError.message);
    } else {
      menuItems.set(id, { ...options, id });
    }
  });

  return id;
}

/**
 * Update a context menu item
 */
export function updateMenuItem(id, options) {
  chrome.contextMenus.update(id, options, () => {
    if (chrome.runtime.lastError) {
      console.warn(`[ContextMenu] Failed to update ${id}:`, chrome.runtime.lastError.message);
    } else if (menuItems.has(id)) {
      menuItems.set(id, { ...menuItems.get(id), ...options });
    }
  });
}

/**
 * Remove a context menu item
 */
export function removeMenuItem(id) {
  chrome.contextMenus.remove(id, () => {
    if (chrome.runtime.lastError) {
      console.warn(`[ContextMenu] Failed to remove ${id}:`, chrome.runtime.lastError.message);
    }
    menuItems.delete(id);
  });
}

/**
 * Remove all context menu items
 */
export function removeAllMenuItems() {
  chrome.contextMenus.removeAll(() => {
    menuItems.clear();
  });
}

/**
 * Create the default extension context menu
 */
export function createDefaultMenu() {
  // Remove any existing items first
  removeAllMenuItems();

  // Parent menu
  createMenuItem('favorites-menu', {
    title: chrome.i18n.getMessage('extension_name') || 'Favorites',
    contexts: ['page', 'frame', 'selection', 'link', 'editable', 'image', 'video', 'audio']
  });

  // Open in popup option
  const browserAction = getSetting('browser-action');
  createMenuItem('open-popup', {
    title: chrome.i18n.getMessage('menu_open_popup') || 'Open as Popup',
    contexts: ['action'],
    type: 'checkbox',
    checked: browserAction === 'popup'
  });

  // Settings
  createMenuItem('open-settings', {
    title: chrome.i18n.getMessage('settings') || 'Settings',
    parentId: 'favorites-menu',
    contexts: ['page', 'frame']
  });

  // Separator
  createMenuItem('separator-1', {
    type: 'separator',
    parentId: 'favorites-menu',
    contexts: ['page', 'frame']
  });

  // Add bookmark
  createMenuItem('add-bookmark', {
    title: chrome.i18n.getMessage('menu_add_bookmark') || 'Add this page to Favorites',
    parentId: 'favorites-menu',
    contexts: ['page', 'frame']
  });

  // Add link as bookmark
  createMenuItem('add-link-bookmark', {
    title: chrome.i18n.getMessage('menu_add_link') || 'Add link to Favorites',
    parentId: 'favorites-menu',
    contexts: ['link']
  });
}

/**
 * Handle context menu clicks
 */
function onMenuClicked(info, tab) {
  const { menuItemId, linkUrl, pageUrl, selectionText, checked } = info;

  switch (menuItemId) {
    case 'open-popup':
      // Toggle popup mode
      const newValue = checked ? 'popup' : 'default';
      chrome.storage.local.set({ 'browser-action': newValue });
      break;

    case 'open-settings':
      chrome.tabs.create({
        url: '/page.html?ui=SettingsUI&title=settings',
        active: true
      });
      break;

    case 'add-bookmark':
      // Open bookmark editor for current page
      chrome.tabs.create({
        url: `/page.html?ui=AddBookmarkUI&url=${encodeURIComponent(pageUrl)}&title=${encodeURIComponent(tab?.title || '')}`,
        active: true
      });
      break;

    case 'add-link-bookmark':
      // Open bookmark editor for link
      if (linkUrl) {
        chrome.tabs.create({
          url: `/page.html?ui=AddBookmarkUI&url=${encodeURIComponent(linkUrl)}`,
          active: true
        });
      }
      break;

    default:
      // Check for custom handlers
      if (menuItems.has(menuItemId)) {
        const item = menuItems.get(menuItemId);
        if (item.onClick) {
          item.onClick(info, tab);
        }
      }
  }
}

/**
 * Initialize context menu module
 */
export function initContextMenu() {
  // Create default menu
  createDefaultMenu();

  // Listen for clicks
  chrome.contextMenus.onClicked.addListener(onMenuClicked);

  // Update menu when settings change
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['browser-action']) {
      updateMenuItem('open-popup', {
        checked: changes['browser-action'].newValue === 'popup'
      });
    }
  });

  // Register message handlers
  registerHandlers({
    createContextMenuItem: async ({ id, options }) => {
      createMenuItem(id, options);
      return { success: true };
    },

    updateContextMenuItem: async ({ id, options }) => {
      updateMenuItem(id, options);
      return { success: true };
    },

    removeContextMenuItem: async ({ id }) => {
      removeMenuItem(id);
      return { success: true };
    },

    removeAllContextMenuItems: async () => {
      removeAllMenuItems();
      return { success: true };
    },

    refreshContextMenu: async () => {
      createDefaultMenu();
      return { success: true };
    }
  });

  console.log('[ContextMenu] Module initialized');
}

export default {
  createMenuItem,
  updateMenuItem,
  removeMenuItem,
  removeAllMenuItems,
  createDefaultMenu,
  initContextMenu
};
