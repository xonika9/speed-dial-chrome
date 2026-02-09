import { initCustomElement } from '../base/custom-element.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:none;position:fixed;z-index:1000000;min-width:100px;left:0;box-shadow:2px 2px 4px 3px rgba(0,0,0,0.15)}:host(.-visible){display:block}</style>`
);

const PAGE_OFFSET = 20;
const POINTER_OFFSET = 10;

export function initPopover(win) {
  if (win.Popover) {
    return win.Popover;
  }

  const CustomElement = initCustomElement(win);

  class Popover extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._onMousedownOrResizeOrWheel = this._onMousedownOrResizeOrWheel.bind(this);
      this._mouseInside = false;
      this.addEventListener('mouseenter', () => {
        this._mouseInside = true;
      });
      this.addEventListener('mouseleave', () => {
        this._mouseInside = false;
      });
    }

    show(x, y) {
      this.style.left = '0px';
      this.style.top = '0px';
      this.style.opacity = '0';
      this.classList.add('-visible');

      requestAnimationFrame(() => {
        const rect = this.getBoundingClientRect();

        if ((x + rect.width) > (document.documentElement.clientWidth - PAGE_OFFSET)) {
          this.style.left = `${document.documentElement.clientWidth - rect.width - rect.x - POINTER_OFFSET}px`;
        } else {
          this.style.left = `${x - rect.x + POINTER_OFFSET}px`;
        }

        if ((y + rect.height) > (document.documentElement.clientHeight - PAGE_OFFSET)) {
          this.style.top = `${document.documentElement.clientHeight - rect.height - rect.y - POINTER_OFFSET}px`;
        } else {
          this.style.top = `${y - rect.y + POINTER_OFFSET}px`;
        }

        win.addEventListener('mousedown', this._onMousedownOrResizeOrWheel);
        win.addEventListener('resize', this._onMousedownOrResizeOrWheel);
        win.addEventListener('wheel', this._onMousedownOrResizeOrWheel, { passive: true, capture: true });
        this.style.opacity = null;
      });
    }

    _onMousedownOrResizeOrWheel(event) {
      switch (event.type) {
        case 'wheel':
        case 'mousedown':
          if (!this._mouseInside) {
            this.hide();
          }
          break;
        default:
          this.hide();
          break;
      }
    }

    hide() {
      this.classList.remove('-visible');
      win.removeEventListener('mousedown', this._onMousedownOrResizeOrWheel);
      win.removeEventListener('resize', this._onMousedownOrResizeOrWheel);
      win.removeEventListener('wheel', this._onMousedownOrResizeOrWheel, { passive: true, capture: true });
    }
  }

  win.defineCustomElement('a-popover', Popover, template);
  win.Popover = Popover;
  return Popover;
}

export default {
  initPopover
};
