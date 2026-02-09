import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:inline-block;vertical-align:top;margin-bottom:.5em;cursor:pointer}span::before{content:' ';display:inline-block;vertical-align:middle;width:16px;height:16px;border:1px solid #e8e8e8;margin:0 10px 0 0;background-color:white;background-repeat:no-repeat}:host(.-selected) span::before{background-color:#3367D6}::slotted(:not([slot=ui])){pointer-events:none}:host(:not(.-selected)) ::slotted([slot=ui]){filter:grayscale(100%);pointer-events:none;opacity:.5}:host-context(a-selector:not([data-multiple])):host(.-selected){pointer-events:none}:host-context(a-selector:not([data-multiple])):host(.-selected) ::slotted([slot=ui]){pointer-events:all}:host(.-selected) span::before{background-image:url(ui/option/option_checkmark.svg)}:host-context(a-selector:not([data-multiple])) span::before{border-radius:30px}:host-context(a-selector:not([data-multiple])):host(.-selected) span::before{background-image:url(ui/option/option_radio.svg)}:host-context([data-bidi=rtl]) span::before{margin:0 0 0 10px}</style><span tabindex="0"></span><slot></slot><slot name="ui"></slot>`
);

export function initOption(win) {
  if (win.Option) {
    return win.Option;
  }

  const CustomElement = initCustomElement(win);

  class Option extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.addEventListener('click', this);
      this.addEventListener('keyup', this);
      this.addEventListener('keydown', this);
      if (this.dataset.value) {
        this.value = this.dataset.value;
      }
    }

    handleEvent(event) {
      switch (event.type) {
        case 'click':
          if (event.target === this) {
            this.toggle();
          }
          break;
        case 'keyup':
          if (event.keyCode === 32) {
            this.toggle();
          }
          break;
        case 'keydown':
          if (event.keyCode === 32) {
            event.preventDefault();
          }
          break;
        default:
          break;
      }
    }

    toggle() {
      this.checked = !this.checked;
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    get checked() {
      return this.classList.contains('-selected');
    }

    set checked(value) {
      if (value) {
        this.classList.add('-selected');
      } else {
        this.classList.remove('-selected');
      }
    }

    get value() {
      return this.checked ? 'true' : 'false';
    }

    set value(value) {
      this.checked = (value === 'true');
    }
  }

  win.defineCustomElement('a-option', Option, template);
  win.Option = Option;
  return Option;
}

export default {
  initOption
};
