export function createHelpDocCompat(browser) {
  return {
    show(_win = window, topic = '') {
      const topicSuffix = topic ? `?${encodeURIComponent(topic)}` : '';
      location.hash = `#help${topicSuffix}`;
    },
    showInWindow(windowId) {
      chrome.tabs.create({
        url: 'chrome://newtab/#help',
        active: true,
        windowId
      });
    },
    showInNewWindow() {
      chrome.windows.create({ url: 'chrome://newtab/#help' });
    },
    support() {
      return browser.openInNewTab('https://www.web-accessories.com/support', window, true);
    }
  };
}

export default {
  createHelpDocCompat
};
