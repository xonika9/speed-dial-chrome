import { withOptionalCallback } from './utils.js';

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

export function createBrowserCompat(sendMessage) {
  return {
    openUrl(url, options, callback) {
      const result = sendMessage('openUrl', { url, options });
      return withOptionalCallback(result, callback);
    },
    openBookmark(bookmark, modifiers, callback) {
      const result = sendMessage('openBookmark', { bookmark, modifiers });
      return withOptionalCallback(result, callback);
    },
    openInCurrentTab(url, callback) {
      const result = sendMessage('openUrl', {
        url,
        options: { disposition: 'currentTab' }
      });
      return withOptionalCallback(result, callback);
    },
    openInNewTab(urlOrUrls, _win, active = false, callback) {
      const urls = toArray(urlOrUrls).filter(Boolean);
      const result = Promise.all(
        urls.map((url, index) => sendMessage('openUrl', {
          url,
          options: {
            disposition: index === 0 && active ? 'newTab' : 'background',
            active: Boolean(active && index === 0)
          }
        }))
      ).then(() => ({ success: true, opened: urls.length }));
      return withOptionalCallback(result, callback);
    },
    openInNewWindow(urlOrUrls, incognito = false, callback) {
      const urls = toArray(urlOrUrls).filter(Boolean);
      const result = sendMessage('openUrl', {
        url: urls[0],
        options: {
          disposition: incognito ? 'newIncognito' : 'newWindow'
        }
      }).then(() => ({ success: true, opened: urls.length }));
      return withOptionalCallback(result, callback);
    },
    openInPopupWindow(name, url, width = 900, height = 700, type = 'popup') {
      void name;
      return chrome.windows.create({ url, width, height, type });
    }
  };
}

export default {
  createBrowserCompat
};
