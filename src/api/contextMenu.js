/**
 * Context Menu API - Chrome Context Menu Management
 */

import { registerHandlers } from './messaging.js';
import {
  get as getSetting,
  set as setSetting,
  setMultiple as setMultipleSettings
} from './settings.js';

const MENU_SHOW_POPUP = 'show-favorites-in-popup';
const MENU_SETTINGS = 'settings';
const MENU_HELP = 'help';
const MENU_SET_WALLPAPER = 'set-wallpaper';

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

function openHelp(tab) {
  const url = 'chrome://newtab/#help';

  if (tab?.incognito) {
    chrome.windows.create({ url });
    return;
  }

  if (tab?.windowId) {
    chrome.tabs.create({
      url,
      active: true,
      windowId: tab.windowId,
      index: 99999
    });
    return;
  }

  chrome.tabs.create({ url, active: true });
}

/**
 * Create the default extension context menu
 */
export function createDefaultMenu() {
  removeAllMenuItems();

  createMenuItem(MENU_SHOW_POPUP, {
    title: chrome.i18n.getMessage('show_favorites_in_popup') || 'Show Favorites in Popup',
    contexts: ['action'],
    type: 'checkbox',
    checked: getSetting('browser-action') === 'popup'
  });

  createMenuItem(MENU_SETTINGS, {
    title: chrome.i18n.getMessage('settings') || 'Settings',
    contexts: ['action']
  });

  createMenuItem(MENU_HELP, {
    title: chrome.i18n.getMessage('help') || 'Help',
    contexts: ['action']
  });

  createMenuItem(MENU_SET_WALLPAPER, {
    title: chrome.i18n.getMessage('set_wallpaper_') || 'Set wallpaper',
    contexts: ['image']
  });
}

/**
 * Handle context menu clicks
 */
async function onMenuClicked(info, tab) {
  const { menuItemId, checked, srcUrl, wasChecked } = info;

  try {
    switch (menuItemId) {
      case MENU_SHOW_POPUP: {
        const nextChecked = typeof checked === 'boolean' ? checked : !wasChecked;
        const newValue = nextChecked ? 'popup' : 'default';
        await setSetting('browser-action', newValue);
        break;
      }

      case MENU_SETTINGS:
        chrome.tabs.create({
          url: '/page.html?ui=SettingsUI&title=settings#favorites',
          active: true
        });
        break;

      case MENU_HELP:
        openHelp(tab);
        break;

      case MENU_SET_WALLPAPER:
        if (!srcUrl) {
          return;
        }

        await setMultipleSettings({
          'background-type': 'web',
          'background-image-url': srcUrl,
          'background-image-file': ''
        });
        break;

      default:
        if (menuItems.has(menuItemId)) {
          const item = menuItems.get(menuItemId);
          if (item.onClick) {
            item.onClick(info, tab);
          }
        }
    }
  } catch (error) {
    console.error('[ContextMenu] Failed to handle menu click:', error);
  }
}

/**
 * Initialize context menu module
 */
export function initContextMenu() {
  createDefaultMenu();

  chrome.contextMenus.onClicked.addListener(onMenuClicked);

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes['browser-action']) {
      updateMenuItem(MENU_SHOW_POPUP, {
        checked: changes['browser-action'].newValue === 'popup'
      });
    }
  });

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
