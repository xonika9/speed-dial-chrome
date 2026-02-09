import { initCustomElement } from '../base/custom-element.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  "<style>:host{display:inline-block;cursor:pointer;width:calc(var(--bookmark-icon-size) + 40px);height:calc(var(--bookmark-icon-size) + 60px);transition:filter 200ms, transform 200ms}:host *{pointer-events:none}:host #icon{display:block;width:var(--bookmark-icon-size, 80px);height:var(--bookmark-icon-size, 80px);margin:20px auto 0 auto;filter:var(--theme-icon-filter);border-radius:var(--theme-icon-border-radius)}:host img#icon:not([src]){visibility:hidden}:host #label{display:-webkit-box;text-align:center;line-height:15px;margin:7px auto 0 auto;text-overflow:ellipsis;overflow:hidden;width:auto;padding:0 0 2px 0;box-sizing:border-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;color:var(--theme-text-color);text-shadow:var(--theme-text-shadow)}:host #badge{display:block;position:absolute;z-index:1000;right:6px;top:6px;min-width:28px;min-height:28px;padding:0 7px 0 8px;color:white;border-radius:100px;font-family:'Helvetica Neue',Arial;text-align:center;font-size:14px;line-height:28px;white-space:nowrap;box-shadow:0 0 3px 1px rgba(0,0,0,0.15);box-sizing:border-box;transform-origin:center;pointer-events:auto;color:transparent;transform:scale(0);background-color:transparent}:host(.-selected){background-color:rgba(51,103,214,0.25);box-shadow:inset 0 0 3px rgba(0,0,0,0.6);border-radius:3px}:host(.signal-drag-open){cursor:wait}:host(.signal-drag-open) #icon{transition:all .15s .2s;width:calc(var(--bookmark-icon-size, 80px) + 22px);height:calc(var(--bookmark-icon-size, 80px) + 22px)}:host(.loading){cursor:progress}:host(.-active){filter:brightness(.8)}:host(.-active) #icon{filter:none}:host([data-badge]) #badge{color:white;transform:scale(1);background-color:#D8072B}:host([data-badge]) #badge:hover{transform:translate3d(0, 0, 0) scale(1.25)}:host([data-badge=\"0\"]) #badge{background-color:#066ccb;background-image:url(ui/bookmark/bookmark-feed.svg);background-repeat:no-repeat;background-position:center}:host-context(:not(.-busy)) #badge{transition:transform .15s,color .3s .25s}:host-context(a-bookmarks-dock) #label{-webkit-line-clamp:1}:host-context(.dnd) #badge{pointer-events:none}</style><canvas id=\"icon\"></canvas><span id=\"label\"></span><span id=\"badge\"></span>"
);

function getRuntimeApi(win) {
  return win.api || window.api || null;
}

function renderRuntimeIcon(win, source, canvas, size) {
  const runtimeApi = getRuntimeApi(win);
  const iconsUtil = runtimeApi?.iconsUtil;

  if (!iconsUtil?.renderIcon) {
    return;
  }

  iconsUtil.renderIcon(source, canvas, size);
}

export function initBookmark(win) {
  if (win.Bookmark) {
    return win.Bookmark;
  }

  const CustomElement = initCustomElement(win);

  class Bookmark extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._icon = shadowRoot.getElementById('icon');
      this._label = shadowRoot.getElementById('label');
      this._badge = shadowRoot.getElementById('badge');

      if (this.dataset.label) {
        this.label = this.dataset.label;
      }
      if (this.dataset.badge) {
        this.badge = this.dataset.badge;
      }
      if (this.dataset.icon) {
        this.icon = this.dataset.icon;
      }

      this.tabIndex = -1;
    }

    loadIcon() {
      const runtimeApi = getRuntimeApi(win);
      const icons = runtimeApi?.icons;

      if (!icons?.getIconImageBitmap) {
        return Promise.resolve();
      }

      this.busy = true;
      return icons.getIconImageBitmap(this.url, this.id)
        .then(imageBitmap => {
          renderRuntimeIcon(win, imageBitmap, this._icon);
          this.busy = false;
        });
    }

    set icon(iconURL) {
      const image = new Image();
      image.onload = () => {
        renderRuntimeIcon(win, image, this._icon);
        this.busy = false;
      };
      image.src = iconURL;
    }

    set label(text) {
      this._label.textContent = text;
      this.setAttribute('title', text);
    }

    get label() {
      return this._label.textContent;
    }

    set title(text) {
      this.label = text;
    }

    get title() {
      return this.label;
    }

    set badge(str) {
      if (str == null) {
        delete this.dataset.badge;
        this._badge.onclick = null;
        this._badge.onmousedown = null;
      } else {
        this.dataset.badge = str;
        if (!this._badge.onclick) {
          this._badge.onclick = event => {
            if (!this.dispatchEvent(new Event('badgeclick', { bubbles: true, cancelable: true }))) {
              event.stopPropagation();
            }
          };
          this._badge.onmousedown = event => event.stopPropagation();
        }
      }

      this._badge.textContent = str || '';
    }

    set id(text) {
      this.dataset.id = text;
    }

    get id() {
      return this.dataset.id;
    }

    get href() {
      return this.url ? this.url : `chrome://newtab/#bookmarks?${this.id}`;
    }

    destroy() {
      this._icon.width = 0;
      this._icon.height = 0;
      this._icon.remove();
      this._label.remove();
      this._badge.remove();
    }
  }

  Bookmark.Create = function createBookmark(node) {
    const bookmark = new Bookmark();
    bookmark.dataset.id = node.id;
    bookmark.dataset.label = node.title || '';
    bookmark.url = node.url;
    return bookmark;
  };

  win.defineCustomElement('a-bookmark', Bookmark, template);
  win.Bookmark = Bookmark;
  return Bookmark;
}

export default {
  initBookmark
};
