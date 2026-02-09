import { createBookmarksCompat } from './bookmarks.js';
import { createBrowserCompat } from './browser.js';
import { initCompatEventBus } from './event-bus.js';
import { createFeedsCompat } from './feeds.js';
import { createHelpDocCompat } from './help.js';
import { createIconsCompat } from './icons.js';
import {
  createFeedSubscriptionsBookmarksCompat,
  createI18nCompat,
  createIconsURLMappingCompat
} from './legacy-namespaces.js';
import { createSettingsCompat } from './settings.js';
import { createSettingsWindowCompat } from './settings-window.js';
import {
  createClipboardUtil,
  createDataExport,
  createDataImport,
  createDndUtil,
  createMessageSender,
  createStringUtil,
  createUriUtil
} from './utils.js';
import { createThemeCompat } from './theme.js';

export async function createCompatRuntimeAPI(win = window) {
  const eventBus = initCompatEventBus(win);
  const sendMessage = createMessageSender();

  const settings = createSettingsCompat(sendMessage, eventBus);
  await settings.ready();

  const bookmarks = createBookmarksCompat(sendMessage, eventBus);
  const browser = createBrowserCompat(sendMessage);
  const { icons, iconsUtil } = createIconsCompat(sendMessage, eventBus);
  const theme = createThemeCompat(sendMessage, eventBus);
  const stringUtil = createStringUtil();
  const uri = createUriUtil();
  const i18n = createI18nCompat();
  const { feeds, feedSubscriptions, feedSubscriptionsStats, search } = createFeedsCompat(
    sendMessage,
    settings,
    eventBus,
    stringUtil
  );
  const feedSubscriptionsBookmarks = createFeedSubscriptionsBookmarksCompat(bookmarks, feedSubscriptions);
  const iconsURLMapping = createIconsURLMappingCompat(settings, stringUtil, uri, iconsUtil);

  const clipboardutil = createClipboardUtil();
  const dndutil = createDndUtil();
  const dataExport = createDataExport();
  const dataImport = createDataImport(bookmarks);
  const helpDoc = createHelpDocCompat(browser);
  const settingsWindow = createSettingsWindowCompat();

  const extensionEvent = {
    dispatch(eventName, detail = null, waitForResponse = false) {
      eventBus.dispatch(eventName, detail);
      return sendMessage('dispatchEvent', {
        eventName,
        data: detail,
        waitForResponse
      }).catch(error => {
        console.warn(`[Compat] Failed to broadcast "${eventName}"`, error);
        return null;
      });
    }
  };

  return {
    eventBus,
    api: {
      settings,
      bookmarks,
      browser,
      icons,
      iconsUtil,
      theme,
      feeds,
      feedSubscriptions,
      feedSubscriptionsBookmarks,
      feedSubscriptionsStats,
      search,
      iconsURLMapping,
      iconsUrlMapping: iconsURLMapping,
      helpDoc,
      settingsWindow,
      extensionEvent,
      clipboardutil,
      dataExport,
      dataImport,
      dndutil,
      i18n,
      stringUtil,
      uri,
      ui: {}
    }
  };
}

export default {
  createCompatRuntimeAPI
};
