import { withOptionalCallback } from './utils.js';

export function createI18nCompat() {
  let dateFormatShort = null;
  let dateFormatLong = null;
  let timeFormat = null;

  function getUILanguage() {
    return chrome.i18n.getUILanguage();
  }

  return {
    formatDateShort(date) {
      if (!dateFormatShort) {
        dateFormatShort = new Intl.DateTimeFormat(getUILanguage(), {
          weekday: 'long',
          month: 'long',
          day: 'numeric'
        });
      }

      const uiLang = getUILanguage();
      let out;
      if (uiLang.startsWith('en')) {
        const parts = dateFormatShort.formatToParts(date);
        out = [
          parts[0]?.value || '',
          ', ',
          parts[4]?.value || '',
          '. ',
          parts[2]?.value || ''
        ].join('');
      } else {
        out = dateFormatShort.format(date);
      }

      return out.charAt(0).toUpperCase() + out.slice(1);
    },
    formatDateLong(date) {
      if (!dateFormatLong) {
        dateFormatLong = new Intl.DateTimeFormat(getUILanguage(), {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }

      const out = dateFormatLong.format(date);
      return out.charAt(0).toUpperCase() + out.slice(1);
    },
    formatTime(date) {
      if (!timeFormat) {
        timeFormat = new Intl.DateTimeFormat(getUILanguage(), {
          hour: 'numeric',
          minute: 'numeric'
        });
      }

      return timeFormat.format(date);
    }
  };
}

export function createFeedSubscriptionsBookmarksCompat(bookmarks, feedSubscriptions) {
  return {
    getBookmarks() {
      const urls = feedSubscriptions.getURLS();
      return urls.map(url => ({ url, title: url }));
    },
    getURLS() {
      return feedSubscriptions.getURLS();
    },
    getNodes(callback) {
      const urls = feedSubscriptions.getURLS();
      const result = Promise.all(
        urls.map(url => bookmarks.search(url)
          .then(nodes => Array.isArray(nodes) ? nodes : [])
          .then(nodes => nodes.find(node => node && node.url === url) || null))
      ).then(nodes => nodes.filter(Boolean));

      return withOptionalCallback(result, callback);
    }
  };
}

export function createIconsURLMappingCompat(settings, stringUtil, uri, iconsUtil) {
  const ICONS_MIN_SIZE = 16;
  const ICONS_MAX_SIZE = 1600;
  const MAX_URL_LENGTH = 300;

  return {
    setCustomURLMapping(url, iconURL, callback) {
      const result = Promise.resolve().then(async () => {
        const normalizedIconURL = typeof iconURL === 'string' ? iconURL.trim() : '';
        let iconUrlMapping = stringUtil.removeURLMapping(settings.get('icon-url-mapping'), url);

        if (!normalizedIconURL) {
          await settings.set('icon-url-mapping', iconUrlMapping);
          return null;
        }

        if (!uri.isValid(normalizedIconURL)) {
          throw new Error('URL not valid!');
        }

        if (normalizedIconURL.length > MAX_URL_LENGTH) {
          throw new Error(`URL too long! (> ${MAX_URL_LENGTH})`);
        }

        const image = await iconsUtil.loadIcon(normalizedIconURL);
        if (image) {
          if (Math.min(image.width, image.height) < ICONS_MIN_SIZE) {
            throw new Error(`Icon too small! Min size: ${ICONS_MIN_SIZE}px by ${ICONS_MIN_SIZE}px!`);
          }
          if (Math.max(image.width, image.height) > ICONS_MAX_SIZE) {
            throw new Error(`Icon too big! Max size: ${ICONS_MAX_SIZE}px by ${ICONS_MAX_SIZE}px!`);
          }
        }

        iconUrlMapping = stringUtil.addURLMapping(iconUrlMapping, url, normalizedIconURL);
        await settings.set('icon-url-mapping', iconUrlMapping);
        return normalizedIconURL;
      });

      return withOptionalCallback(result, callback);
    },
    getCustomURLMapping(url) {
      const mapping = stringUtil.parseURLMapping(settings.get('icon-url-mapping'));
      return mapping[url];
    }
  };
}

export default {
  createI18nCompat,
  createFeedSubscriptionsBookmarksCompat,
  createIconsURLMappingCompat
};
