import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:block;width:100%;background-color:#3367D6;color:white;overflow:hidden;display:flex;align-items:center;transition:box-shadow .25s;min-height:56px;height:56px}:host(.shadow){box-shadow:0 1px 3px 3px rgba(0,0,0,0.1)}*{white-space:nowrap}#center{overflow:hidden;text-align:center;flex:1}#left{padding-left:8px}#right{text-align:right;padding-right:5px}::slotted(h1),::slotted(.message){margin:0;font-weight:500;font-size:16px;text-overflow:ellipsis;overflow:hidden}::slotted(*){vertical-align:middle}::slotted(a-button){border:none}:host-context(dialog) ::slotted(h1){font-size:14px;margin-top:3px}:host-context(:not([data-bidi=rtl])) ::slotted(h1[slot=left]){margin-left:12px}:host-context([data-bidi=rtl]) ::slotted(h1[slot=left]){margin-right:12px}</style><div id="left"><slot name="left"></slot></div><div id="center"><slot name="center"></slot></div><div id="right"><slot name="right"></slot></div>`
);

export function initTopbar(win) {
  if (win.Topbar) {
    return win.Topbar;
  }

  const CustomElement = initCustomElement(win);

  class Topbar extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.tabIndex = -1;
    }
  }

  win.defineCustomElement('a-topbar', Topbar, template);
  win.Topbar = Topbar;
  return Topbar;
}

export default {
  initTopbar
};
