import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate('<style></style>');

function getRuntimeApi(win) {
  return win.api || window.api || null;
}

function isPromise(value) {
  return Boolean(value && typeof value.then === 'function');
}

function readSyncSetting(runtimeApi, key, fallback = false) {
  const value = runtimeApi?.settings?.get?.(key);
  return isPromise(value) ? fallback : value;
}

function getInitializer(win, name) {
  if (typeof win[name] === 'function') {
    return win[name];
  }

  const runtimeApi = getRuntimeApi(win);
  if (typeof runtimeApi?.ui?.[name] === 'function') {
    return runtimeApi.ui[name];
  }

  return null;
}

export function initBookmarksMainview01LastVisitedFolder(win) {
  if (win.BookmarksMainview01LastVisitedFolder) {
    return win.BookmarksMainview01LastVisitedFolder;
  }

  const initBookmarksGridview =
    getInitializer(win, 'initBookmarksGridview') ||
    getInitializer(win, 'initBookmarksGridview03Clipboard');
  if (typeof initBookmarksGridview !== 'function') {
    throw new Error(
      'initBookmarksGridview or initBookmarksGridview03Clipboard is required for initBookmarksMainview01LastVisitedFolder'
    );
  }

  const BookmarksGridview = initBookmarksGridview(win);

  class BookmarksMainview01LastVisitedFolder extends BookmarksGridview {
    determineFolderId() {
      const runtimeApi = getRuntimeApi(win);
      return (readSyncSetting(runtimeApi, 'show-last-visited-folder', false) &&
        localStorage.getItem('navigation/last-visited-folder'))
        ? localStorage.getItem('navigation/last-visited-folder')
        : super.determineFolderId();
    }

    loadBookmarks() {
      return super.loadBookmarks().then(() => {
        localStorage.setItem('navigation/last-visited-folder', this.folderId);
      });
    }
  }

  win.BookmarksMainview01LastVisitedFolder = BookmarksMainview01LastVisitedFolder;
  return BookmarksMainview01LastVisitedFolder;
}

export function initBookmarksMainview02LocationHash(win) {
  if (win.BookmarksMainview02LocationHash) {
    return win.BookmarksMainview02LocationHash;
  }

  const BookmarksMainview01LastVisitedFolder = initBookmarksMainview01LastVisitedFolder(win);

  class BookmarksMainview02LocationHash extends BookmarksMainview01LastVisitedFolder {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onHashChange = this._onHashChange.bind(this);
    }

    bind() {
      addEventListener('hashchange#bookmarks', this._onHashChange);
      return super.bind();
    }

    unbind() {
      super.unbind();
      removeEventListener('hashchange#bookmarks', this._onHashChange);
    }

    _onHashChange() {
      this.loadBookmarks();
    }

    _parseQuery() {
      let t = location.hash.split('?');
      t = t[1] || '';
      t = t.split('&');
      this._queryId = t[0];
      this._queryHighlightId = t[1];
    }

    determineFolderId() {
      this._parseQuery();
      return this._queryId || super.determineFolderId();
    }

    loadBookmarks() {
      return super.loadBookmarks().then(() => {
        history.replaceState(history.state, null, `#bookmarks?${this.determineFolderId()}`);
        if (this._queryHighlightId) {
          this.highlightBookmark(this._queryHighlightId);
        }
      });
    }
  }

  win.BookmarksMainview02LocationHash = BookmarksMainview02LocationHash;
  return BookmarksMainview02LocationHash;
}

export function initBookmarksMainview03ScrollPosition(win) {
  if (win.BookmarksMainview03ScrollPosition) {
    return win.BookmarksMainview03ScrollPosition;
  }

  const BookmarksMainview02LocationHash = initBookmarksMainview02LocationHash(win);

  class BookmarksMainview03ScrollPosition extends BookmarksMainview02LocationHash {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onScroll = this._onScroll.bind(this);
      this._rememberScrollPos = this._rememberScrollPos.bind(this);
    }

    bind() {
      this.addEventListener('scroll', this._onScroll);
      return super.bind();
    }

    unbind() {
      super.unbind();
      this.removeEventListener('scroll', this._onScroll);
    }

    _resetScrollPos() {
      const state = history.state;
      if (state && state[`scrollTop-${this.id}`]) {
        this.scrollTop = state[`scrollTop-${this.id}`];
      }
    }

    _rememberScrollPos() {
      const state = history.state || {};
      state[`scrollTop-${this.id}`] = this.scrollTop;
      history.replaceState(state, null);
    }

    _onScroll() {
      clearTimeout(this.__onScrollThrottleTimout);
      this.__onScrollThrottleTimout = setTimeout(this._rememberScrollPos, 500);
    }

    loadBookmarks() {
      return super.loadBookmarks().then(() => this._resetScrollPos());
    }
  }

  win.BookmarksMainview03ScrollPosition = BookmarksMainview03ScrollPosition;
  return BookmarksMainview03ScrollPosition;
}

export function initBookmarksMainview(win) {
  if (win.BookmarksMainview) {
    return win.BookmarksMainview;
  }

  const BookmarksMainview03ScrollPosition = initBookmarksMainview03ScrollPosition(win);
  const runtimeApi = getRuntimeApi(win);

  class BookmarksMainview extends BookmarksMainview03ScrollPosition {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.tabIndex = -1;
      this._onFocus = this._onFocus.bind(this);
      this._onDblClick = this._onDblClick.bind(this);
    }

    _onFocus() {
      this.beginSelection(0);
    }

    _onDblClick() {
      if (readSyncSetting(runtimeApi, 'search-dblclick', false)) {
        location.hash = '#search';
      }
    }

    bind() {
      const p = super.bind();
      document.body.addEventListener('focus', this._onFocus);
      this.addEventListener('dblclick', this._onDblClick);
      return p;
    }

    unbind() {
      super.unbind();
      document.body.removeEventListener('focus', this._onFocus);
      this.removeEventListener('dblclick', this._onDblClick);
    }
  }

  win.defineCustomElement('a-bookmarks-mainview', BookmarksMainview, template);
  win.BookmarksMainview = BookmarksMainview;
  return BookmarksMainview;
}

export default {
  initBookmarksMainview01LastVisitedFolder,
  initBookmarksMainview02LocationHash,
  initBookmarksMainview03ScrollPosition,
  initBookmarksMainview
};
