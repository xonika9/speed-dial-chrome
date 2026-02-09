import { initCustomElement } from '../base/custom-element.js';
import { initDialogUI } from '../base/dialog-ui.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:block;width:100%;height:100%}</style><slot></slot><!-- <a-dialog-ui> -->`
);

export function initMultiviewUI(win) {
  if (win.MultiviewUI) {
    return win.MultiviewUI;
  }

  const CustomElement = initCustomElement(win);
  const DialogUI = initDialogUI(win);

  class MultiviewUI extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      win.addEventListener('hashchange', this._onHashChange.bind(this));
    }

    bind() {
      this.updateViewId();
      return this.updateView();
    }

    updateViewId() {
      this.viewId = location.hash.slice(1).split('?').shift();
    }

    updateView() {
      while (this.firstChild) {
        this.firstChild.remove();
      }

      const view = this.createView(this.viewId);
      this.appendChild(view);

      if (view.documentTitle) {
        document.title = view.documentTitle;
      }

      return view.isReady;
    }

    _onHashChange(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      DialogUI.CancelAll();

      const oldViewId = this.viewId;
      this.updateViewId();
      if (this.viewId !== oldViewId) {
        this.updateView();
      } else {
        win.dispatchEvent(new CustomEvent(`hashchange#${this.viewId}`));
      }
    }
  }

  win.defineCustomElement('a-multiview-ui', MultiviewUI, template);
  win.MultiviewUI = MultiviewUI;
  return MultiviewUI;
}

export default {
  initMultiviewUI
};
