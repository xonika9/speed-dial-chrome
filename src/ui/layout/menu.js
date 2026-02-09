import { initPopover } from './popover.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>:host{font-family:'Roboto';font-size:13px;line-height:200%;min-width:100px;color:black;background-color:white;border-radius:2px;white-space:nowrap;text-align:left;padding:10px 0}::slotted(a-menuitem){display:block;position:relative}::slotted(hr){border:0;height:1px;background-color:#eee}::slotted(a-menuitem:not([data-action]))::after{content:'▸';display:block;top:0;position:absolute}::slotted(a-menuitem:hover){background-color:#F0F0F0}::slotted(a-menuitem:active){background-color:#e0e0e0}:host-context([data-bidi=rtl]) ::slotted(a-menuitem){padding-right:19px;padding-left:40px}:host-context([data-bidi=rtl]) ::slotted(a-menuitem:not([data-action]))::after{left:15px}:host-context(:not([data-bidi=rtl])) ::slotted(a-menuitem){padding-left:19px;padding-right:40px}:host-context(:not([data-bidi=rtl])) ::slotted(a-menuitem:not([data-action]))::after{right:15px}</style><slot></slot>`
);

export function initMenu(win) {
  if (win.Menu) {
    return win.Menu;
  }

  const Popover = initPopover(win);

  class Menu extends Popover {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.addEventListener('mousedown', this);
      this.addEventListener('mouseup', this);
      this.addEventListener('mouseover', this);
      this.addEventListener('contextmenu', this);
      this.addEventListener('click', this);
    }

    handleEvent(event) {
      switch (event.type) {
        case 'mousedown':
          event.stopPropagation();
          event.preventDefault();
          this.rightButtonEnabled = true;
          break;

        case 'mouseup':
          if (((event.which === 1) || this.rightButtonEnabled) && (event.target.dataset.action !== undefined)) {
            if (this._callback) {
              this._callback(event);
            }
            this.hide();
          }
          break;

        case 'mouseover': {
          if (this._submenu && (event.target.parentNode === this)) {
            this._submenu.hide();
            delete this._submenu;
          }

          const submenu = (event.target.tagName === 'A-MENUITEM') ? event.target.querySelector('A-MENU') : null;
          if (submenu) {
            const rect = event.target.getBoundingClientRect();
            submenu.show(rect.right - 10, rect.top - 10);
            this._submenu = submenu;
          }
          break;
        }

        case 'contextmenu':
          event.preventDefault();
          break;

        case 'click':
          event.stopImmediatePropagation();
          this.hide();
          break;

        default:
          break;
      }
    }

    show(x, y, callback) {
      document.fonts.load('normal 1em Roboto').then(() => {
        super.show(x, y);
        this.rightButtonEnabled = false;
        this._callback = callback;
      });
    }
  }

  win.defineCustomElement('a-menu', Menu, template);
  win.Menu = Menu;
  return Menu;
}

export default {
  initMenu
};
