import { initCustomElement } from '../base/custom-element.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>@keyframes blink{50%{opacity:0}}:host{width:100%;min-height:56px;height:56px;text-align:center;overflow:hidden;white-space:nowrap;background-color:var(--theme-overlay-color);position:relative;padding:0 25px;color:var(--theme-text-color);text-shadow:var(--theme-text-shadow)}#container{display:inline-flex;margin:0 auto;max-width:100%;overflow:hidden;height:20px;margin-top:20px;line-height:20px}#list{flex:1;overflow:hidden;-webkit-mask-image:linear-gradient(to right, transparent, black 10px, black 50%, transparent 50%),linear-gradient(to left, transparent, black 10px, black 50%, transparent 50%)}#list span{display:inline-block;text-decoration:none;white-space:nowrap;overflow:hidden}#list span:after{display:block;content:attr(name);font-weight:bold;overflow:hidden;height:0;visibility:hidden}#list .link,#list .current{margin:0 10px;max-width:150px;text-overflow:ellipsis}#list .link{cursor:pointer;opacity:.9}#list .link.dragtarget{animation:blink .5s steps(5, start) infinite}#list .link:hover{opacity:1;text-decoration:underline}#list .current{font-weight:bold}#list .separator{font-size:1.2em}#list .badge{background-image:url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="7" height="8"><circle style="fill:%23D8072B" cx="3" cy="3" r="3" /></svg>');background-position:right center;background-repeat:no-repeat;padding-right:12px}.btn{width:20px;height:20px;margin-left:6px;background-color:currentColor;cursor:pointer;display:none}#scroll-left-btn,#scroll-right-btn{-webkit-mask-image:url('ui/bookmarks-navbar/bookmarks-navbar-scroll-icon.svg');visibility:hidden}#scroll-left-btn{transform:scaleX(-1)}#search-btn{-webkit-mask-image:url("data:image/svg+xml;charset=UTF-8,%3Csvg%0A%20%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%0A%20%20version%3D%221.1%22%0A%20%20viewBox%3D%220%200%2020%2020%22%0A%20%20width%3D%2220%22%0A%20%20height%3D%2220%22%0A%20%20%3E%0A%20%3Cpath%0A%20%20%20d%3D%22m%208.5162275%2C3.6701235%20c%20-2.722289%2C0%20-4.945915%2C2.22214%20-4.945915%2C4.944426%200%2C2.7222925%202.223626%2C4.9459115%204.945915%2C4.9459115%201.075005%2C0%202.0693685%2C-0.351251%202.8826325%2C-0.93853%20l%203.992483%2C3.707945%201.038344%2C-1.118788%20-3.944812%2C-3.661766%20c%200.610593%2C-0.822685%200.977263%2C-1.8364785%200.977263%2C-2.9347725%200%2C-2.722286%20-2.223627%2C-4.944426%20-4.9459105%2C-4.944426%20z%20m%200%2C1.525488%20c%201.8978505%2C0%203.4204255%2C1.521088%203.4204255%2C3.418938%200%2C1.8978495%20-1.522576%2C3.4204265%20-3.4204255%2C3.4204265%20-1.897852%2C0%20-3.420427%2C-1.522577%20-3.420427%2C-3.4204265%200%2C-1.89785%201.522575%2C-3.418938%203.420427%2C-3.418938%20z%22%0A%20%20%20style%3D%22fill%3A%23ffffff%22%0A%2F%3E%0A%3C%2Fsvg%3E%0A")}</style><div id="container">	<div id="scroll-left-btn" class="btn"></div>	<div id="list"></div>	<div id="scroll-right-btn" class="btn"></div>	<div id="search-btn" class="btn"></div></div>`
);

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

export function initBookmarksNavbar(win) {
  if (win.BookmarksNavbar) {
    return win.BookmarksNavbar;
  }

  const CustomElement = initCustomElement(win);

  class BookmarksNavbar extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.update = this.update.bind(this);
      this._listEl = shadowRoot.getElementById('list');
      this._searchBtn = shadowRoot.getElementById('search-btn');
      this._scrollLeftBtn = shadowRoot.getElementById('scroll-left-btn');
      this._scrollRightBtn = shadowRoot.getElementById('scroll-right-btn');
      this.updateScrollButtons = this.updateScrollButtons.bind(this);
      this.updateScrollButtonsThrottled = this.updateScrollButtonsThrottled.bind(this);
      shadowRoot.addEventListener('click', this.onClick.bind(this));
      shadowRoot.addEventListener('dragenter', event => {
        if (event.target.nodeId !== undefined) {
          event.target.classList.add('dragtarget');
          const nodeId = event.target.nodeId;
          event.target.dragOp = setTimeout(() => {
            location.hash = `#bookmarks?${nodeId}`;
          }, 1200);
        } else if (event.target.id === 'scroll-left-btn') {
          event.target.classList.add('dragtarget');
          event.target.dragOp = setInterval(() => this.scrollToLeft(), 750);
        } else if (event.target.id === 'scroll-right-btn') {
          event.target.classList.add('dragtarget');
          event.target.dragOp = setInterval(() => this.scrollToRight(), 750);
        }
      });
      shadowRoot.addEventListener('dragleave', event => {
        if (event.target.dragOp) {
          event.target.classList.remove('dragtarget');
          clearInterval(event.target.dragOp);
          clearTimeout(event.target.dragOp);
          delete event.target.dragOp;
        }
      });
      this._listEl.addEventListener('scroll', this.updateScrollButtonsThrottled);
    }

    determineCurrentFolderId() {
      const runtimeApi = getRuntimeApi(win);
      let t = location.hash.split('?');
      t = t[1] || '';
      t = t.split('&');
      let id = t[0];
      if (id) {
        return id;
      }
      if (readSyncSetting(runtimeApi, 'show-last-visited-folder', false) &&
          localStorage.getItem('navigation/last-visited-folder')) {
        return localStorage.getItem('navigation/last-visited-folder');
      }
      id = readSyncSetting(runtimeApi, this.bindingKey, null);
      if (id) {
        return id;
      }
      return '1';
    }

    determineRootFolderId() {
      const runtimeApi = getRuntimeApi(win);
      return readSyncSetting(runtimeApi, this.bindingKey, null);
    }

    render(nodes, offset, separator) {
      offset = offset || 0;
      let currentEl;
      const oldElements = Array.from(this._listEl.children);
      const runtimeApi = getRuntimeApi(win);

      if (nodes) {
        for (let i = offset; i < nodes.length; i++) {
          const node = nodes[i];
          let link = oldElements.shift();
          if (!link) {
            link = document.createElement('span');
            this._listEl.appendChild(link);
          }
          if (node.id === this.folderId) {
            currentEl = link;
            link.className = 'current';
          } else {
            link.className = 'link';
          }
          const label = (node.id === '0') ? chrome.i18n.getMessage('bookmarks') : (node.title || 'Untitled');
          link.textContent = label;
          link.setAttribute('name', label);
          link.nodeId = node.id;
          const unreadItems = runtimeApi?.feedSubscriptionsStats?.getUnreadItems
            ? runtimeApi.feedSubscriptionsStats.getUnreadItems(node.id)
            : 0;
          if (unreadItems) {
            link.classList.add('badge');
            link.title = `${node.title} (${unreadItems})`;
          } else {
            link.title = '';
          }
          if (separator && (i < (nodes.length - 1))) {
            let separatorEl = oldElements.shift();
            if (!separatorEl) {
              separatorEl = document.createElement('span');
              this._listEl.appendChild(separatorEl);
            }
            separatorEl.className = 'separator';
            separatorEl.textContent = separator;
            separatorEl.setAttribute('name', '');
          }
        }
      }

      for (let i = 0; i < oldElements.length; i++) {
        oldElements[i].remove();
      }
      if (currentEl) {
        currentEl.scrollIntoView();
      }
    }

    update() {
      const runtimeApi = getRuntimeApi(win);
      this.folderId = this.determineCurrentFolderId();
      this._rootFolderId = this.determineRootFolderId();
      const showSiblingsInRoot = readSyncSetting(runtimeApi, 'show-navigation-bar', false);
      let rootNode;
      if (!showSiblingsInRoot && (this.folderId === this._rootFolderId)) {
        this._listEl.innerHTML = '';
        this.style.display = 'none';
      } else {
        this.style.display = null;
        runtimeApi.bookmarks
          .getSingle(this._rootFolderId)
          .then(_rootNode => {
            if (!_rootNode) {
              throw new Error('No root');
            }
            rootNode = _rootNode;
            return runtimeApi.bookmarks.getPath(this.folderId);
          })
          .then(path => {
            if (!path || !path.length) {
              throw new Error('No path');
            }
            if (showSiblingsInRoot && (path[path.length - 1].parentId === rootNode.parentId)) {
              this.showSearchBtn(true);
              return runtimeApi.bookmarks
                .getChildren(rootNode.parentId)
                .then(siblings => this.render(siblings ? siblings.filter(node => (node.url === undefined)) : null));
            }

            let offset = 0;
            for (let i = 0; i < path.length; i++) {
              if (
                (showSiblingsInRoot && (path[i].parentId === rootNode.parentId)) ||
                (path[i].id === rootNode.id)
              ) {
                break;
              }
              offset++;
            }
            const isOutsideHierarchy = (offset === path.length);
            this.showSearchBtn(false);
            if (isOutsideHierarchy) {
              this.render([rootNode, path[path.length - 1]], 0, '↳');
            } else {
              this.render(path, offset, '/');
            }
          })
          .catch(() => {
            const nodes = [];
            if (rootNode) {
              nodes.push(rootNode);
            }
            nodes.push({
              title: '( Deleted )',
              id: this.folderId
            });
            this.showSearchBtn(false);
            this.render(nodes, 0, '↯');
          })
          .finally(() => this.updateScrollButtons());
      }
    }

    showSearchBtn(show) {
      this._searchBtn.style.display = show ? 'block' : null;
    }

    updateScrollButtons() {
      const isScrollable = (this._listEl.scrollWidth > this._listEl.clientWidth);
      const canScrollLeft = this._listEl.scrollLeft > 0;
      const canScrollRight = ((this._listEl.scrollWidth - this._listEl.scrollLeft) > this._listEl.clientWidth);
      this._scrollRightBtn.style.display = isScrollable ? 'block' : null;
      this._scrollLeftBtn.style.display = isScrollable ? 'block' : null;
      this._scrollLeftBtn.style.visibility = canScrollLeft ? 'visible' : null;
      this._scrollRightBtn.style.visibility = canScrollRight ? 'visible' : null;
    }

    updateScrollButtonsThrottled() {
      clearTimeout(this._updateScrollButtonsTimeout);
      this._updateScrollButtonsTimeout = setTimeout(this.updateScrollButtons, 150);
    }

    open(id) {
      location.hash = `#bookmarks?${id}`;
    }

    scrollToLeft() {
      this._listEl.scrollBy({ left: -(this._listEl.clientWidth - 75), behavior: 'smooth' });
    }

    scrollToRight() {
      this._listEl.scrollBy({ left: +(this._listEl.clientWidth - 75), behavior: 'smooth' });
    }

    onClick(event) {
      switch (event.target.id) {
        case 'scroll-left-btn':
          this.scrollToLeft();
          break;
        case 'scroll-right-btn':
          this.scrollToRight();
          break;
        case 'search-btn':
          location.hash = '#search';
          break;
        default:
          if (event.target.nodeId) {
            this.open(event.target.nodeId);
          }
          break;
      }
    }

    bind() {
      addEventListener(`settings/${this.bindingKey}`, this.update);
      addEventListener('settings/show-navigation-bar', this.update);
      addEventListener('bookmarks/change', this.update);
      addEventListener('hashchange#bookmarks', this.update);
      addEventListener('feedSubscriptionsStats/change', this.update);
      addEventListener('resize', this.updateScrollButtonsThrottled);
      this.update();
    }

    unbind() {
      this._listEl.removeEventListener('scroll', this.updateScrollButtonsThrottled);
      removeEventListener(`settings/${this.bindingKey}`, this.update);
      removeEventListener('settings/show-navigation-bar', this.update);
      removeEventListener('bookmarks/change', this.update);
      removeEventListener('hashchange#bookmarks', this.update);
      removeEventListener('feedSubscriptionsStats/change', this.update);
      removeEventListener('resize', this.updateScrollButtonsThrottled);
    }
  }

  win.defineCustomElement('a-bookmarks-navbar', BookmarksNavbar, template);
  win.BookmarksNavbar = BookmarksNavbar;
  return BookmarksNavbar;
}

export default {
  initBookmarksNavbar
};
