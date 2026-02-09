import { initCustomElement } from '../base/custom-element.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:inline-block;box-sizing:border-box;box-sizing:content-box !important}#canvas{width:100%;height:100%}</style><canvas id="canvas" width="0" height="0"></canvas>`
);

function getRuntimeApi(win) {
  return win.api || window.api || null;
}

export function initBookmarkIcon(win) {
  if (win.BookmarkIcon) {
    return win.BookmarkIcon;
  }

  const CustomElement = initCustomElement(win);

  class BookmarkIcon extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._canvas = shadowRoot.getElementById('canvas');
    }

    loadIcon() {
      const runtimeApi = getRuntimeApi(win);
      const icons = runtimeApi?.icons;
      const iconsUtil = runtimeApi?.iconsUtil;

      if (!icons?.getIconImageBitmap || !iconsUtil?.renderIcon) {
        return Promise.resolve();
      }

      return icons.getIconImageBitmap(this.dataset.url, this.dataset.id)
        .then(imageBitmap => {
          iconsUtil.renderIcon(imageBitmap, this._canvas, 160);
        });
    }
  }

  win.defineCustomElement('a-bookmark-icon', BookmarkIcon, template);
  win.BookmarkIcon = BookmarkIcon;
  return BookmarkIcon;
}

export default {
  initBookmarkIcon
};
