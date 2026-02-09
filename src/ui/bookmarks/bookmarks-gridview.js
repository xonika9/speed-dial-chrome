import { createLocalizedTemplate } from '../base/template.js';

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

function getUnreadItems(runtimeApi, id) {
  const getUnreadItemsFn = runtimeApi?.feedSubscriptionsStats?.getUnreadItems;
  if (typeof getUnreadItemsFn !== 'function') {
    return 0;
  }
  return getUnreadItemsFn(id);
}

function getBookmarkSingle(runtimeApi, id, callback) {
  const getSingle = runtimeApi?.bookmarks?.getSingle;
  if (typeof getSingle !== 'function') {
    if (typeof callback === 'function') {
      callback(null);
    }
    return Promise.resolve(null);
  }

  let result;
  try {
    result = getSingle(id, callback);
  } catch (error) {
    if (typeof callback === 'function') {
      callback(null);
    }
    return Promise.reject(error);
  }

  if (isPromise(result) && typeof callback === 'function') {
    return result.then(node => {
      callback(node);
      return node;
    });
  }

  return Promise.resolve(result);
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

function resolveBookmarkClass(win) {
  if (win.Bookmark) {
    return win.Bookmark;
  }

  const initBookmark = getInitializer(win, 'initBookmark');
  if (typeof initBookmark === 'function') {
    return initBookmark(win);
  }

  return null;
}

function openBookmarkInCurrentTab(runtimeApi, bookmark) {
  if (runtimeApi?.browser?.openInCurrentTab) {
    return runtimeApi.browser.openInCurrentTab(bookmark.url);
  }

  if (runtimeApi?.browser?.openUrl) {
    return runtimeApi.browser.openUrl(bookmark.url, { disposition: 'currentTab' });
  }

  return null;
}

function openBookmarkInNewTab(runtimeApi, bookmark, active) {
  if (runtimeApi?.browser?.openInNewTab) {
    return runtimeApi.browser.openInNewTab(bookmark.href, window, active);
  }

  if (runtimeApi?.browser?.openUrl) {
    return runtimeApi.browser.openUrl(bookmark.href, {
      disposition: active ? 'newTab' : 'background',
      active: Boolean(active)
    });
  }

  return null;
}

function openBookmarkInNewWindow(runtimeApi, bookmark, incognito) {
  if (runtimeApi?.browser?.openInNewWindow) {
    return runtimeApi.browser.openInNewWindow(bookmark.href, incognito);
  }

  if (runtimeApi?.browser?.openUrl) {
    return runtimeApi.browser.openUrl(bookmark.href, {
      disposition: incognito ? 'newIncognito' : 'newWindow'
    });
  }

  return null;
}

export function initBookmarksGridview01Base(win) {
  if (win.BookmarksGridview01Base) {
    return win.BookmarksGridview01Base;
  }

  const initGridview = getInitializer(win, 'initGridview');
  if (typeof initGridview !== 'function') {
    throw new Error('initGridview is required for initBookmarksGridview01Base');
  }

  const Gridview = initGridview(win);
  const Bookmark = resolveBookmarkClass(win);
  if (!Bookmark?.Create) {
    throw new Error('Bookmark.Create is required for initBookmarksGridview01Base');
  }

  class BookmarksGridview01Base extends Gridview {
    init(shadowRoot) {
      super.init(shadowRoot);
    }

    updateBookmarkIcon(bookmark) {
      bookmark.loadIcon();
    }

    updateAllBookmarkIcons() {
      return Promise.all(Array.from(this.children).map(bookmark => bookmark.loadIcon()));
    }

    updateBookmark(bookmark, node) {
      if (node.title) {
        bookmark.title = node.title || '';
      }
      if (node.id) {
        bookmark.id = node.id;
      }
      if (node.url) {
        bookmark.url = node.url;
      }
      this.updateBookmarkIcon(bookmark);
    }

    addBookmark(node) {
      const bookmark = new Bookmark.Create(node);
      bookmark.draggable = true;
      this.insertBefore(bookmark, this.children[node.index]);
      this.updateBookmarkIcon(bookmark);
    }

    removeBookmark(bookmark) {
      this.removeChild(bookmark);
    }

    getBookmark(id) {
      return this.querySelector(`[data-id='${id}']`);
    }

    hasBookmark(id) {
      return !!this.getBookmark(id);
    }

    moveBookmark(bookmark, newIndex) {
      const oldIndex = Array.prototype.indexOf.call(this.children, bookmark);
      if (oldIndex === newIndex) {
        return;
      }
      const bookmarkRef = this.children[oldIndex < newIndex ? newIndex + 1 : newIndex];
      this.insertBefore(bookmark, bookmarkRef);
    }

    openBookmarkInCurrentTab(bookmark) {
      const runtimeApi = getRuntimeApi(win);
      if (bookmark.url) {
        openBookmarkInCurrentTab(runtimeApi, bookmark);
      } else {
        location.hash = `#bookmarks?${bookmark.id}`;
      }
    }

    openBookmarkInNewTab(bookmark, active) {
      const runtimeApi = getRuntimeApi(win);
      openBookmarkInNewTab(runtimeApi, bookmark, active);
    }

    openBookmarkInNewWindow(bookmark, incognito) {
      const runtimeApi = getRuntimeApi(win);
      openBookmarkInNewWindow(runtimeApi, bookmark, incognito);
    }

    openBookmark(bookmark) {
      const runtimeApi = getRuntimeApi(win);
      const openInNewTab = readSyncSetting(runtimeApi, 'open-bookmarks-in-new-tab', false);
      if (openInNewTab) {
        if (bookmark.url) {
          this.openBookmarkInNewTab(bookmark, true);
        } else {
          location.hash = `#bookmarks?${bookmark.id}`;
        }
      } else {
        this.openBookmarkInCurrentTab(bookmark);
      }
    }

    highlightBookmark(id) {
      const bookmark = this.getBookmark(id);
      if (bookmark) {
        bookmark.scrollIntoViewIfNeeded();
        bookmark.classList.add('-highlight');
      }
    }

    determineFolderId() {
      return '1';
    }

    clear() {
      while (this.firstChild) {
        const bookmark = this.firstChild;
        bookmark.remove();
        bookmark.destroy();
      }
    }

    loadBookmarks() {
      const runtimeApi = getRuntimeApi(win);
      const folderId = this.determineFolderId();
      if (folderId === this.folderId) {
        return Promise.resolve();
      }
      this.folderId = folderId;
      this.clear();
      return runtimeApi.bookmarks.getChildren(folderId)
        .then(nodes => {
          if (!nodes) {
            this.error = chrome.i18n.getMessage('deleted');
            return;
          }
          const documentFragment = document.createDocumentFragment();
          for (const node of nodes) {
            const bookmark = Bookmark.Create(node);
            bookmark.draggable = true;
            documentFragment.appendChild(bookmark);
          }
          this.appendChild(documentFragment);
          this.error = null;
        });
    }
  }

  win.BookmarksGridview01Base = BookmarksGridview01Base;
  return BookmarksGridview01Base;
}

export function initBookmarksGridview02Model(win) {
  if (win.BookmarksGridview02Model) {
    return win.BookmarksGridview02Model;
  }

  const BookmarksGridview01Base = initBookmarksGridview01Base(win);

  class BookmarksGridview02Model extends BookmarksGridview01Base {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onBookmarkCreated = this._onBookmarkCreated.bind(this);
      this._onBookmarkRemoved = this._onBookmarkRemoved.bind(this);
      this._onBookmarkChanged = this._onBookmarkChanged.bind(this);
      this._onBookmarkMoved = this._onBookmarkMoved.bind(this);
      this._onChildrenReordered = this._onChildrenReordered.bind(this);
    }

    bind() {
      super.bind();
      addEventListener('bookmarks/created', this._onBookmarkCreated);
      addEventListener('bookmarks/removed', this._onBookmarkRemoved);
      addEventListener('bookmarks/changed', this._onBookmarkChanged);
      addEventListener('bookmarks/moved', this._onBookmarkMoved);
      addEventListener('bookmarks/childrenReordered', this._onChildrenReordered);
    }

    unbind() {
      super.unbind();
      removeEventListener('bookmarks/created', this._onBookmarkCreated);
      removeEventListener('bookmarks/removed', this._onBookmarkRemoved);
      removeEventListener('bookmarks/changed', this._onBookmarkChanged);
      removeEventListener('bookmarks/moved', this._onBookmarkMoved);
      removeEventListener('bookmarks/childrenReordered', this._onChildrenReordered);
    }

    _onBookmarkCreated(event) {
      const runtimeApi = getRuntimeApi(win);
      if (!runtimeApi?.bookmarks) {
        return;
      }
      const id = event.detail.id;
      const node = event.detail.bookmark;
      if (node.parentId === this.folderId) {
        this.addBookmark(node, getUnreadItems(runtimeApi, id));
        this.clearSelection();
      } else if (this.hasBookmark(node.parentId)) {
        this.updateBookmarkIcon(this.getBookmark(node.parentId));
      }
    }

    _onBookmarkRemoved(event) {
      const id = event.detail.id;
      const node = event.detail.removeInfo;
      if (id === this.folderId) {
        this.loadBookmarks();
      } else if (this.hasBookmark(id)) {
        this.removeBookmark(this.getBookmark(id));
        this.clearSelection();
      } else if (this.hasBookmark(node.parentId)) {
        this.updateBookmarkIcon(this.getBookmark(node.parentId));
      }
    }

    _onBookmarkChanged(event) {
      const runtimeApi = getRuntimeApi(win);
      if (!runtimeApi?.bookmarks) {
        return;
      }
      const id = event.detail.id;
      const node = event.detail.changeInfo;
      if (this.hasBookmark(id)) {
        this.updateBookmark(this.getBookmark(id), node);
      } else {
        getBookmarkSingle(runtimeApi, id, bookmarkNode => {
          if (bookmarkNode && this.hasBookmark(bookmarkNode.parentId)) {
            this.updateBookmarkIcon(this.getBookmark(bookmarkNode.parentId));
          }
        }).catch(() => {});
      }
    }

    _onBookmarkMoved(event) {
      const runtimeApi = getRuntimeApi(win);
      if (!runtimeApi?.bookmarks) {
        return;
      }
      const id = event.detail.id;
      const node = event.detail.moveInfo;
      if ((node.parentId === this.folderId) && (node.oldParentId === this.folderId)) {
        this.moveBookmark(this.getBookmark(id), node.index);
      } else if ((node.parentId !== this.folderId) && (node.oldParentId === this.folderId)) {
        this.removeBookmark(this.getBookmark(id));
      } else if ((node.parentId === this.folderId) && (node.oldParentId !== this.folderId)) {
        getBookmarkSingle(runtimeApi, id, bookmarkNode => {
          if (bookmarkNode) {
            this.addBookmark(bookmarkNode, getUnreadItems(runtimeApi, id));
          }
        }).catch(() => {});
      }
      if (this.hasBookmark(node.parentId)) {
        this.updateBookmarkIcon(this.getBookmark(node.parentId));
      }
      if (this.hasBookmark(node.oldParentId)) {
        this.updateBookmarkIcon(this.getBookmark(node.oldParentId));
      }
    }

    _onChildrenReordered(event) {
      const id = event.detail.id;
      const reorderInfo = event.detail.reorderInfo;
      if (id === this.folderId) {
        if (!Array.isArray(reorderInfo?.childIds)) {
          return;
        }
        reorderInfo.childIds.forEach((childId, i) => {
          this.moveBookmark(this.getBookmark(childId), i);
        });
        this.clearSelection();
      } else if (this.hasBookmark(id)) {
        this.updateBookmarkIcon(this.getBookmark(id));
      }
    }
  }

  win.BookmarksGridview02Model = BookmarksGridview02Model;
  return BookmarksGridview02Model;
}

export function initBookmarksGridview03Clipboard(win) {
  if (win.BookmarksGridview03Clipboard) {
    return win.BookmarksGridview03Clipboard;
  }

  const BookmarksGridview02Model = initBookmarksGridview02Model(win);
  const DT_TS = 'web-accessories.com/ts';

  class BookmarksGridview03Clipboard extends BookmarksGridview02Model {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onGridviewCopyOrCut = this._onGridviewCopyOrCut.bind(this);
      this._onGridviewPaste = this._onGridviewPaste.bind(this);
    }

    bind() {
      super.bind();
      this.addEventListener('gridview-copy', this._onGridviewCopyOrCut);
      this.addEventListener('gridview-cut', this._onGridviewCopyOrCut);
      this.addEventListener('gridview-paste', this._onGridviewPaste);
    }

    unbind() {
      super.unbind();
      this.removeEventListener('gridview-copy', this._onGridviewCopyOrCut);
      this.removeEventListener('gridview-cut', this._onGridviewCopyOrCut);
      this.removeEventListener('gridview-paste', this._onGridviewPaste);
    }

    _onGridviewCopyOrCut(event) {
      const runtimeApi = getRuntimeApi(win);
      runtimeApi.dataExport.exportToEventData(event.detail.clipboardData, event.detail.elements);
      const ts = Date.now();
      event.detail.clipboardData.setData(DT_TS, ts);
      Promise.all(event.detail.elements.map(element =>
        element.url
          ? {
            url: element.url,
            title: element.title,
            id: element.id
          }
          : new Promise((resolve, reject) => runtimeApi.bookmarks.getSubTree(
            element.id,
            nodes => ((nodes && nodes.length) ? resolve(nodes[0]) : reject())
          ))
      ))
        .then(nodes => {
          runtimeApi.clipboardutil.setData(ts, nodes);
          if (event.type === 'gridview-cut') {
            nodes.forEach(node => runtimeApi.bookmarks.removeTree(node.id));
            setTimeout(() => this.focus(), 100);
          }
        });
    }

    _onGridviewPaste(event) {
      const runtimeApi = getRuntimeApi(win);
      const callback = nodesCreated => {
        if (nodesCreated.length) {
          setTimeout(() => {
            const firstBookmarkCreated = this.getBookmark(nodesCreated[0].id);
            if (firstBookmarkCreated) {
              firstBookmarkCreated.focus();
            }
          }, 200);
        }
      };
      if (
        event.detail.clipboardData.types.includes(DT_TS) &&
        (event.detail.clipboardData.getData(DT_TS) === runtimeApi.clipboardutil.getTS())
      ) {
        runtimeApi.bookmarks.safecreatemany(this.folderId, event.detail.index, runtimeApi.clipboardutil.getData(), callback);
      } else {
        runtimeApi.dataImport.importFromEventData(event.detail.clipboardData, this.folderId, event.detail.index, callback);
      }
    }
  }

  win.BookmarksGridview03Clipboard = BookmarksGridview03Clipboard;
  return BookmarksGridview03Clipboard;
}

export function initBookmarksGridview04DND(win) {
  if (win.BookmarksGridview04DND) {
    return win.BookmarksGridview04DND;
  }

  const BookmarksGridview03Clipboard = initBookmarksGridview03Clipboard(win);
  const DRAG_OVER_FOLDER_OPEN_TIMEOUT = 700;
  const DRAG_OVER_FOLDER_MOVE_TIMEOUT = 150;

  class BookmarksGridview04DND extends BookmarksGridview03Clipboard {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onGridviewDragover = this._onGridviewDragover.bind(this);
      this._onGridviewDrop = this._onGridviewDrop.bind(this);
      this._onGridviewDragenter = this._onGridviewDragenter.bind(this);
      this._onGridviewDragleave = this._onGridviewDragleave.bind(this);
      this._onGridviewDragstart = this._onGridviewDragstart.bind(this);
      this._onGridviewDragend = this._onGridviewDragend.bind(this);
      this._hideDraggedBookmarks = this._hideDraggedBookmarks.bind(this);
    }

    bind() {
      super.bind();
      this.addEventListener('gridview-dragover', this._onGridviewDragover);
      this.addEventListener('gridview-drop', this._onGridviewDrop);
      this.addEventListener('gridview-dragenter', this._onGridviewDragenter);
      this.addEventListener('gridview-dragleave', this._onGridviewDragleave);
      this.addEventListener('gridview-dragstart', this._onGridviewDragstart);
      this.addEventListener('gridview-dragend', this._onGridviewDragend);
    }

    unbind() {
      super.unbind();
      this.removeEventListener('gridview-dragover', this._onGridviewDragover);
      this.removeEventListener('gridview-drop', this._onGridviewDrop);
      this.removeEventListener('gridview-dragenter', this._onGridviewDragenter);
      this.removeEventListener('gridview-dragleave', this._onGridviewDragleave);
      this.removeEventListener('gridview-dragstart', this._onGridviewDragstart);
      this.removeEventListener('gridview-dragend', this._onGridviewDragend);
    }

    cancelFolderOpenEffect() {
      if (this._folderBookmark) {
        this._folderBookmark.classList.remove('signal-drag-open');
        this._folderBookmark = null;
      }
    }

    doFolderOpenEffect(folder) {
      this._folderBookmark = folder;
      this._folderBookmark.classList.add('signal-drag-open');
    }

    _onGridviewDragover(event) {
      const x = event.detail.x;
      const y = event.detail.y;
      this.cancelFolderOpenEffect();
      const childAtIndex = this.getChildAtGridIndex(event.detail.index);

      if (childAtIndex && !childAtIndex.url) {
        const center = this.indexToPoint(event.detail.index);
        const isOverFolderCenter = (Math.abs(x - center.x) < 40) && (Math.abs(y - center.y) < 40);
        if ((this._oldDragX !== x) || (this._oldDragY !== y)) {
          this._holdOverFolderStart = Date.now();
          this._holdOverFolderDT = 0;
        } else {
          this._holdOverFolderDT = Date.now() - this._holdOverFolderStart;
        }

        if (isOverFolderCenter) {
          this.doFolderOpenEffect(childAtIndex);
          event.preventDefault();
          if (this._holdOverFolderDT > DRAG_OVER_FOLDER_OPEN_TIMEOUT) {
            this.openBookmarkInCurrentTab(childAtIndex);
          }
        } else if (this._holdOverFolderDT < DRAG_OVER_FOLDER_MOVE_TIMEOUT) {
          event.preventDefault();
        }
      }

      this._oldDragX = x;
      this._oldDragY = y;
    }

    _onGridviewDrop(event) {
      const runtimeApi = getRuntimeApi(win);
      this.cancelFolderOpenEffect();
      const childAtIndex = this.getChildAtGridIndex(event.detail.index);
      let index;
      let parentId;

      if (childAtIndex && !childAtIndex.url) {
        index = Number.MAX_VALUE;
        parentId = childAtIndex.id;
      } else {
        index = this.getDOMDragOverIndex(event.detail.index);
        parentId = this.folderId;
      }

      if (runtimeApi?.dndutil?.hasData?.()) {
        runtimeApi.bookmarks.moveMany(
          runtimeApi.dndutil.getData(),
          parentId,
          index,
          nMoved => {
            if (!nMoved) {
              this.showAllChildren();
              this.update();
            }
          }
        );
        event.preventDefault();
      } else {
        const importResult = runtimeApi?.dataImport?.importFromEventData?.(event.detail.dataTransfer, parentId, index);
        if (importResult !== undefined) {
          event.preventDefault();
        }
      }
    }

    _hideDraggedBookmarks() {
      const runtimeApi = getRuntimeApi(win);
      if (runtimeApi?.dndutil?.hasData?.()) {
        const draggedItems = runtimeApi.dndutil.getData();
        this.hideChildren(bookmark => draggedItems.includes(bookmark.id));
      }
    }

    _onGridviewDragenter() {
      this._hideDraggedBookmarks();
    }

    _onGridviewDragleave() {
      this.showAllChildren();
      this.update();
      this.cancelFolderOpenEffect();
    }

    _onGridviewDragstart(event) {
      const runtimeApi = getRuntimeApi(win);
      runtimeApi?.dataExport?.exportToEventData?.(event.detail.dataTransfer, event.detail.elements);
      runtimeApi?.dndutil?.setData?.(event.detail.elements.map(bookmark => bookmark.id));
    }

    _onGridviewDragend(event) {
      const runtimeApi = getRuntimeApi(win);
      event.preventDefault();
      runtimeApi?.dndutil?.clearData?.();
    }

    loadBookmarks() {
      return super.loadBookmarks().then(this._hideDraggedBookmarks);
    }
  }

  win.BookmarksGridview04DND = BookmarksGridview04DND;
  return BookmarksGridview04DND;
}

export function initBookmarksGridview05Links(win) {
  if (win.BookmarksGridview05Links) {
    return win.BookmarksGridview05Links;
  }

  const BookmarksGridview04DND = initBookmarksGridview04DND(win);

  class BookmarksGridview05Links extends BookmarksGridview04DND {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onClick = this._onClick.bind(this);
      this._onMouseup = this._onMouseup.bind(this);
      this._onKeydown = this._onKeydown.bind(this);
    }

    bind() {
      super.bind();
      this.addEventListener('click', this._onClick);
      this.addEventListener('mouseup', this._onMouseup);
      this.addEventListener('keydown', this._onKeydown);
    }

    unbind() {
      super.unbind();
      this.removeEventListener('click', this._onClick);
      this.removeEventListener('mouseup', this._onMouseup);
      this.removeEventListener('keydown', this._onKeydown);
    }

    _onClick(event) {
      if (event.target.tagName === 'A-BOOKMARK') {
        if (event.detail > 1) {
          return;
        }
        if (event.ctrlKey || event.metaKey) {
          this.openBookmarkInNewTab(event.target);
        } else if (event.shiftKey) {
          this.openBookmarkInNewWindow(event.target);
        } else {
          this.openBookmark(event.target);
        }
        event.stopPropagation();
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    }

    _onMouseup(event) {
      if ((event.target.tagName === 'A-BOOKMARK') && (event.which === 2)) {
        event.preventDefault();
        this.openBookmarkInNewTab(event.target);
      }
    }

    _onKeydown(event) {
      if (event.keyCode === 13) {
        const selectedChildren = this.getSelectedChildren();
        if (selectedChildren.length) {
          if (selectedChildren.length > 1) {
            for (const child of selectedChildren) {
              this.openBookmarkInNewTab(child);
            }
          } else {
            this.openBookmarkInCurrentTab(selectedChildren[0]);
          }
        }
      }
    }
  }

  win.BookmarksGridview05Links = BookmarksGridview05Links;
  return BookmarksGridview05Links;
}

export function initBookmarksGridview06FolderSetting(win) {
  if (win.BookmarksGridview06FolderSetting) {
    return win.BookmarksGridview06FolderSetting;
  }

  const BookmarksGridview05Links = initBookmarksGridview05Links(win);

  class BookmarksGridview06FolderSetting extends BookmarksGridview05Links {
    determineFolderId() {
      const runtimeApi = getRuntimeApi(win);
      return readSyncSetting(runtimeApi, this.bindingKey, null) || super.determineFolderId();
    }
  }

  win.BookmarksGridview06FolderSetting = BookmarksGridview06FolderSetting;
  return BookmarksGridview06FolderSetting;
}

export function initBookmarksGridview07Layout(win) {
  if (win.BookmarksGridview07Layout) {
    return win.BookmarksGridview07Layout;
  }

  const BookmarksGridview06FolderSetting = initBookmarksGridview06FolderSetting(win);

  class BookmarksGridview07Layout extends BookmarksGridview06FolderSetting {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._disableLayoutSettings = this.dataset.disableLayoutSettings ? (this.dataset.disableLayoutSettings === 'true') : false;
      this._onLayoutSettingChange = this._onLayoutSettingChange.bind(this);
    }

    bind() {
      super.bind();
      this._loadLayoutParameters();
      addEventListener('settings/icon-size', this._onLayoutSettingChange);
      addEventListener('settings/column-gap', this._onLayoutSettingChange);
      addEventListener('settings/row-gap', this._onLayoutSettingChange);
      addEventListener('settings/columns-max', this._onLayoutSettingChange);
    }

    unbind() {
      super.unbind();
      removeEventListener('settings/icon-size', this._onLayoutSettingChange);
      removeEventListener('settings/column-gap', this._onLayoutSettingChange);
      removeEventListener('settings/row-gap', this._onLayoutSettingChange);
      removeEventListener('settings/columns-max', this._onLayoutSettingChange);
    }

    _loadLayoutParameters() {
      const runtimeApi = getRuntimeApi(win);
      const BOOKMARK_MIN_GAP = 4;
      const iconSize = Number(readSyncSetting(runtimeApi, 'icon-size', 80)) || 80;
      this.style.setProperty('--bookmark-icon-size', `${iconSize}px`);
      let columnWidth = iconSize + 40 + BOOKMARK_MIN_GAP;
      let rowHeight = iconSize + 60 + BOOKMARK_MIN_GAP;
      let columnsMax = 1000;
      if (!this._disableLayoutSettings) {
        columnWidth += Number(readSyncSetting(runtimeApi, 'column-gap', 0)) || 0;
        rowHeight += Number(readSyncSetting(runtimeApi, 'row-gap', 0)) || 0;
        columnsMax = Number(readSyncSetting(runtimeApi, 'columns-max', 1000)) || 1000;
      }
      this.columnWidth = columnWidth;
      this.rowHeight = rowHeight;
      this.columnsMax = columnsMax;
    }

    _onLayoutSettingChange() {
      this._loadLayoutParameters();
      this.update();
    }
  }

  win.BookmarksGridview07Layout = BookmarksGridview07Layout;
  return BookmarksGridview07Layout;
}

export function initBookmarksGridview08Edit(win) {
  if (win.BookmarksGridview08Edit) {
    return win.BookmarksGridview08Edit;
  }

  const BookmarksGridview07Layout = initBookmarksGridview07Layout(win);

  class BookmarksGridview08Edit extends BookmarksGridview07Layout {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onKeyDown = this._onKeyDown.bind(this);
      this.addEventListener('keydown', this._onKeyDown);
    }

    _focusBookmark(id) {
      setTimeout(() => {
        const bookmark = this.getBookmark(id);
        if (bookmark) {
          bookmark.focus();
        }
      }, 300);
    }

    createBookmark(index, title, url) {
      const runtimeApi = getRuntimeApi(win);
      let nextTitle = title;
      let nextUrl = url;

      if (!nextTitle && !nextUrl) {
        nextTitle = prompt(chrome.i18n.getMessage('name') || 'Name', '');
        nextUrl = prompt(chrome.i18n.getMessage('url') || 'URL', '');
      }

      if (nextTitle || nextUrl) {
        runtimeApi?.bookmarks?.safecreate?.(
          { parentId: this.folderId, url: nextUrl, title: nextTitle, index },
          node => node?.id && this._focusBookmark(node.id)
        );
      }
    }

    createFolder(index) {
      const runtimeApi = getRuntimeApi(win);
      const title = prompt(chrome.i18n.getMessage('name') || 'Folder name', '') || '';
      if (title) {
        runtimeApi?.bookmarks?.safecreate?.(
          { parentId: this.folderId, title, index },
          node => node?.id && this._focusBookmark(node.id)
        );
      }
    }

    edit(bookmark) {
      const runtimeApi = getRuntimeApi(win);
      if (!bookmark) {
        return;
      }
      const title = prompt(chrome.i18n.getMessage('name') || 'Name', bookmark.title || '');
      if (title == null) {
        return;
      }
      if (bookmark.url) {
        const url = prompt(chrome.i18n.getMessage('url') || 'URL', bookmark.url || '');
        if (url == null) {
          return;
        }
        runtimeApi?.bookmarks?.update?.(bookmark.id, { title, url });
      } else {
        runtimeApi?.bookmarks?.update?.(bookmark.id, { title });
      }
    }

    deleteBookmarks(bookmarks = null) {
      const runtimeApi = getRuntimeApi(win);
      const targetBookmarks = bookmarks || this.getSelectedChildren();
      if (!targetBookmarks.length) {
        return;
      }

      const title = chrome.i18n.getMessage('delete') || 'Delete';
      const message = (targetBookmarks.length === 1)
        ? `${title}: ${targetBookmarks[0].title || ''}`
        : `${title}: ${targetBookmarks.length}`;

      if (confirm(message)) {
        targetBookmarks.forEach(bookmark => runtimeApi?.bookmarks?.removeTree?.(bookmark.id));
      }
    }

    reorderByTitle() {
      const runtimeApi = getRuntimeApi(win);
      const title = chrome.i18n.getMessage('reorder_by_title') || 'Reorder by title';
      if (confirm(title)) {
        runtimeApi?.bookmarks?.reorderByTitle?.(this.folderId);
      }
    }

    _onKeyDown(event) {
      if ([8, 46].includes(event.keyCode)) {
        this.deleteBookmarks();
      }
    }
  }

  win.BookmarksGridview08Edit = BookmarksGridview08Edit;
  return BookmarksGridview08Edit;
}

export function initBookmarksGridview09Badges(win) {
  if (win.BookmarksGridview09Badges) {
    return win.BookmarksGridview09Badges;
  }

  const BookmarksGridview08Edit = initBookmarksGridview08Edit(win);

  class BookmarksGridview09Badges extends BookmarksGridview08Edit {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onFeedSubscriptionsStatsChange = this._onFeedSubscriptionsStatsChange.bind(this);
      this.updateBookmarkBadges = this.updateBookmarkBadges.bind(this);
      this.addEventListener('badgeclick', this.onBadgeClick.bind(this));
    }

    onBadgeClick(event) {
      const runtimeApi = getRuntimeApi(win);
      if (event.target.url) {
        if (readSyncSetting(runtimeApi, 'open-bookmarks-in-new-tab', false)) {
          runtimeApi?.browser?.openInNewTab?.(`chrome://newtab/#news?${event.target.id}`, window, true);
        } else {
          runtimeApi?.browser?.openInCurrentTab?.(`chrome://newtab/#news?${event.target.id}`);
        }
        event.preventDefault();
      }
    }

    updateBookmarkBadges() {
      const runtimeApi = getRuntimeApi(win);
      for (const bookmark of this.children) {
        bookmark.badge = bookmark.url
          ? (runtimeApi?.feedSubscriptions?.exists?.(bookmark.url)
            ? runtimeApi?.feedSubscriptionsStats?.getUnreadItems?.(bookmark.id)
            : null)
          : (runtimeApi?.feedSubscriptionsStats?.getUnreadItems?.(bookmark.id) || null);
      }
    }

    loadBookmarks() {
      return super.loadBookmarks().then(this.updateBookmarkBadges);
    }

    _onFeedSubscriptionsStatsChange() {
      this.updateBookmarkBadges();
    }

    bind() {
      super.bind();
      addEventListener('feedSubscriptionsStats/change', this._onFeedSubscriptionsStatsChange);
    }

    unbind() {
      super.unbind();
      removeEventListener('feedSubscriptionsStats/change', this._onFeedSubscriptionsStatsChange);
    }
  }

  win.BookmarksGridview09Badges = BookmarksGridview09Badges;
  return BookmarksGridview09Badges;
}

export function initBookmarksGridview10Icons(win) {
  if (win.BookmarksGridview10Icons) {
    return win.BookmarksGridview10Icons;
  }

  const BookmarksGridview09Badges = initBookmarksGridview09Badges(win);

  class BookmarksGridview10Icons extends BookmarksGridview09Badges {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onIconsInvalidate = this._onIconsInvalidate.bind(this);
      this._screenResolutionQuery = matchMedia('screen and (min-resolution: 1.5dppx)');
    }

    bind() {
      super.bind();
      addEventListener('icons/invalidate', this._onIconsInvalidate);
      addEventListener('settings/icon-size', this._onIconsInvalidate);
      if (this._screenResolutionQuery.addEventListener) {
        this._screenResolutionQuery.addEventListener('change', this._onIconsInvalidate);
      } else {
        this._screenResolutionQuery.addListener(this._onIconsInvalidate);
      }
    }

    unbind() {
      super.unbind();
      removeEventListener('icons/invalidate', this._onIconsInvalidate);
      removeEventListener('settings/icon-size', this._onIconsInvalidate);
      if (this._screenResolutionQuery.removeEventListener) {
        this._screenResolutionQuery.removeEventListener('change', this._onIconsInvalidate);
      } else {
        this._screenResolutionQuery.removeListener(this._onIconsInvalidate);
      }
    }

    _onIconsInvalidate() {
      this.updateAllBookmarkIcons();
    }
  }

  win.BookmarksGridview10Icons = BookmarksGridview10Icons;
  return BookmarksGridview10Icons;
}

const bookmarksGridviewTemplate = createLocalizedTemplate('<style>:host(.-busy) #container{opacity:0}</style>');

export function initBookmarksGridview(win) {
  if (win.BookmarksGridview) {
    return win.BookmarksGridview;
  }

  const BookmarksGridview10Icons = initBookmarksGridview10Icons(win);

  class BookmarksGridview extends BookmarksGridview10Icons {
    bind() {
      super.bind();
      return this.loadBookmarks();
    }

    unbind() {
      super.unbind();
      this.clear();
      this.folderId = null;
    }

    loadBookmarks() {
      this.busy = true;
      return super.loadBookmarks()
        .then(() => new Promise(resolve => {
          setTimeout(resolve, 1000);
          this.updateAllBookmarkIcons().then(resolve);
        }))
        .catch(console.log)
        .then(() => {
          this.busy = false;
          this.focus();
        });
    }

    get offsetWidth() {
      return window.innerWidth;
    }

    set offsetWidth(_) {}
  }

  win.defineCustomElement('a-bookmarks-gridview', BookmarksGridview, bookmarksGridviewTemplate);
  win.BookmarksGridview = BookmarksGridview;
  return BookmarksGridview;
}

export default {
  initBookmarksGridview01Base,
  initBookmarksGridview02Model,
  initBookmarksGridview03Clipboard,
  initBookmarksGridview04DND,
  initBookmarksGridview05Links,
  initBookmarksGridview06FolderSetting,
  initBookmarksGridview07Layout,
  initBookmarksGridview08Edit,
  initBookmarksGridview09Badges,
  initBookmarksGridview10Icons,
  initBookmarksGridview
};
