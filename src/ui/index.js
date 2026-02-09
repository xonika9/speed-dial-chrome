/**
 * UI module runtime entrypoint.
 *
 * As components are extracted from legacy sources, register them here.
 */

import { initButton } from './base/button.js';
import { initCustomElement } from './base/custom-element.js';
import { initDeck } from './base/deck.js';
import { initDialogSelectorUI } from './base/dialog-selector-ui.js';
import { initDialogUI } from './base/dialog-ui.js';
import {
  initGridview,
  initGridview01Base,
  initGridview02Grid,
  initGridview03Selection,
  initGridview04SelectionKeyboard,
  initGridview05SelectionMouse,
  initGridview06DND,
  initGridview07Clipboard,
  initGridview08ChildActive
} from './base/gridview.js';
import { initIcon } from './base/icon.js';
import { initOption } from './base/option.js';
import { initSelector } from './base/selector.js';
import { initTextfield } from './base/textfield.js';
import { initTopbar } from './base/topbar.js';
import { initBookmark } from './bookmarks/bookmark.js';
import { initBookmarkIcon } from './bookmarks/bookmark-icon.js';
import {
  initBookmarksGridview,
  initBookmarksGridview01Base,
  initBookmarksGridview02Model,
  initBookmarksGridview03Clipboard,
  initBookmarksGridview04DND,
  initBookmarksGridview05Links,
  initBookmarksGridview06FolderSetting,
  initBookmarksGridview07Layout,
  initBookmarksGridview08Edit,
  initBookmarksGridview09Badges,
  initBookmarksGridview10Icons
} from './bookmarks/bookmarks-gridview.js';
import {
  initBookmarksMainview,
  initBookmarksMainview01LastVisitedFolder,
  initBookmarksMainview02LocationHash,
  initBookmarksMainview03ScrollPosition
} from './bookmarks/bookmarks-mainview.js';
import { initBookmarksNavbar } from './bookmarks/bookmarks-navbar.js';
import { initMenu } from './layout/menu.js';
import { initMultiviewUI } from './layout/multiview-ui.js';
import { initPopover } from './layout/popover.js';
import { initSidebar } from './layout/sidebar.js';
import { initTopbarSearchField } from './layout/topbar-search-field.js';

const moduleUIInitializers = Object.create(null);

/**
 * Register a module UI initializer.
 *
 * @param {string} uiName - Either "NewtabUI" or "initNewtabUI"
 * @param {Function} initializer - Legacy-compatible initializer: (window) => UIClass
 */
export function registerModuleUIInitializer(uiName, initializer) {
  if (typeof uiName !== 'string' || uiName.length === 0) {
    throw new Error('uiName must be a non-empty string');
  }

  if (typeof initializer !== 'function') {
    throw new Error(`initializer for ${uiName} must be a function`);
  }

  moduleUIInitializers[uiName] = initializer;
}

/**
 * Returns a shallow copy of currently registered module UI initializers.
 */
export function getModuleUIInitializers() {
  return { ...moduleUIInitializers };
}

registerModuleUIInitializer('initCustomElement', initCustomElement);
registerModuleUIInitializer('initIcon', initIcon);
registerModuleUIInitializer('initButton', initButton);
registerModuleUIInitializer('initTextfield', initTextfield);
registerModuleUIInitializer('initSelector', initSelector);
registerModuleUIInitializer('initOption', initOption);
registerModuleUIInitializer('initDeck', initDeck);
registerModuleUIInitializer('initTopbar', initTopbar);
registerModuleUIInitializer('initDialogUI', initDialogUI);
registerModuleUIInitializer('initDialogSelectorUI', initDialogSelectorUI);
registerModuleUIInitializer('initGridview01Base', initGridview01Base);
registerModuleUIInitializer('initGridview02Grid', initGridview02Grid);
registerModuleUIInitializer('initGridview03Selection', initGridview03Selection);
registerModuleUIInitializer('initGridview04SelectionKeyboard', initGridview04SelectionKeyboard);
registerModuleUIInitializer('initGridview05SelectionMouse', initGridview05SelectionMouse);
registerModuleUIInitializer('initGridview06DND', initGridview06DND);
registerModuleUIInitializer('initGridview07Clipboard', initGridview07Clipboard);
registerModuleUIInitializer('initGridview08ChildActive', initGridview08ChildActive);
registerModuleUIInitializer('initGridview', initGridview);
registerModuleUIInitializer('initBookmarkIcon', initBookmarkIcon);
registerModuleUIInitializer('initBookmark', initBookmark);
registerModuleUIInitializer('initBookmarksGridview01Base', initBookmarksGridview01Base);
registerModuleUIInitializer('initBookmarksGridview02Model', initBookmarksGridview02Model);
registerModuleUIInitializer('initBookmarksGridview03Clipboard', initBookmarksGridview03Clipboard);
registerModuleUIInitializer('initBookmarksGridview04DND', initBookmarksGridview04DND);
registerModuleUIInitializer('initBookmarksGridview05Links', initBookmarksGridview05Links);
registerModuleUIInitializer('initBookmarksGridview06FolderSetting', initBookmarksGridview06FolderSetting);
registerModuleUIInitializer('initBookmarksGridview07Layout', initBookmarksGridview07Layout);
registerModuleUIInitializer('initBookmarksGridview08Edit', initBookmarksGridview08Edit);
registerModuleUIInitializer('initBookmarksGridview09Badges', initBookmarksGridview09Badges);
registerModuleUIInitializer('initBookmarksGridview10Icons', initBookmarksGridview10Icons);
registerModuleUIInitializer('initBookmarksGridview', initBookmarksGridview);
registerModuleUIInitializer('initBookmarksMainview01LastVisitedFolder', initBookmarksMainview01LastVisitedFolder);
registerModuleUIInitializer('initBookmarksMainview02LocationHash', initBookmarksMainview02LocationHash);
registerModuleUIInitializer('initBookmarksMainview03ScrollPosition', initBookmarksMainview03ScrollPosition);
registerModuleUIInitializer('initBookmarksMainview', initBookmarksMainview);
registerModuleUIInitializer('initBookmarksNavbar', initBookmarksNavbar);
registerModuleUIInitializer('initPopover', initPopover);
registerModuleUIInitializer('initMenu', initMenu);
registerModuleUIInitializer('initTopbarSearchField', initTopbarSearchField);
registerModuleUIInitializer('initSidebar', initSidebar);
registerModuleUIInitializer('initMultiviewUI', initMultiviewUI);

export const UI_RUNTIME_VERSION = 'module-bootstrap';
