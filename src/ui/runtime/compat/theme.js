import { withOptionalCallback } from './utils.js';

export function createThemeCompat(sendMessage, eventBus) {
  return {
    getCSS(callback) {
      const result = sendMessage('getThemeCSS');
      return withOptionalCallback(result, callback);
    },
    getCombinedStyles(callback) {
      const result = sendMessage('getCombinedStyles');
      return withOptionalCallback(result, callback);
    },
    list(callback) {
      const result = sendMessage('listThemes');
      return withOptionalCallback(result, callback);
    },
    apply(themeName, callback) {
      const result = sendMessage('applyTheme', { themeName }).then(value => {
        eventBus.dispatch('settings/theme', { theme: themeName });
        return value;
      });
      return withOptionalCallback(result, callback);
    }
  };
}

export default {
  createThemeCompat
};
