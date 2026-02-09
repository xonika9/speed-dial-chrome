export function createSettingsWindowCompat() {
  return {
    show(section = 'favorites') {
      const url = `/page.html?ui=SettingsUI&title=settings#${section}`;
      chrome.tabs.create({
        url,
        active: true
      });
    }
  };
}

export default {
  createSettingsWindowCompat
};
