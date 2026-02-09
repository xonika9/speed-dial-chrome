import { initCustomElement } from '../base/custom-element.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>@keyframes slidein{to{transform:translateX(0)}}:host{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background-color:rgba(0,0,0,0.5);overflow:hidden}:host(.-visible){display:block}#container{position:absolute;background-color:var(--sidebar-background-color, white);min-width:300px;bottom:0;top:0;left:0;animation:slidein .2s;animation-fill-mode:forwards;transform:translateX(-100%)}#container{display:flex;flex-direction:column}#header{display:block}#content{display:block;overflow-y:auto;flex:1;height:100%}::slotted(*){min-height:56px;border-bottom:1px solid var(--sidebar-border-color, #eee);font-size:13px;font-weight:500;margin:0;line-height:1.5em}::slotted(h1){font-weight:normal;font-size:16px;padding:20px 24px 10px 24px}:host-context([data-bidi=rtl]) #container{left:auto;right:0;transform:translateX(100%)}</style><div id="container"><slot id="header" name="header"></slot><slot id="content"></slot></div>`
);

export function initSidebar(win) {
  if (win.Sidebar) {
    return win.Sidebar;
  }

  const CustomElement = initCustomElement(win);

  class Sidebar extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.addEventListener('click', this._onClick.bind(this), true);
    }

    show() {
      this.classList.add('-visible');
    }

    hide() {
      this.classList.remove('-visible');
    }

    _onClick(event) {
      if (!event.defaultPrevented) {
        this.hide();
      }
    }
  }

  win.defineCustomElement('a-sidebar', Sidebar, template);
  win.Sidebar = Sidebar;
  return Sidebar;
}

export default {
  initSidebar
};
