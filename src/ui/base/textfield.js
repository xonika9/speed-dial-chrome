import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{min-width:300px;height:30px;display:inline-block;background-color:white;vertical-align:top;font-size:12px;padding:0 10px;line-height:30px;border:1px solid #ccc}input{margin:0;width:100%;height:30px;min-width:0;border:none;outline:none;background-color:transparent;font-family:inherit}input::selection{background-color:#CAE2F9;color:#212B3B}input[type=url]{direction:ltr}</style><input autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></input>`
);

export function initTextfield(win) {
  if (win.Textfield) {
    return win.Textfield;
  }

  const CustomElement = initCustomElement(win);

  class Textfield extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._input = shadowRoot.querySelector('input');
      this._input.onchange = () => {
        this.dispatchEvent(new Event('change', { bubbles: true }));
      };

      if (this.dataset.value) {
        this.value = this.dataset.value;
      }
      if (this.dataset.placeholder) {
        this.placeholder = this.dataset.placeholder;
      }
      if (this.dataset.type) {
        this.type = this.dataset.type;
      }
      if (this.dataset.required) {
        this.required = this.dataset.required;
      }
    }

    get placeholder() {
      return this._input.placeholder;
    }

    set placeholder(value) {
      this._input.placeholder = value;
    }

    get value() {
      return this._input.value;
    }

    set value(value) {
      this._input.value = value;
    }

    get type() {
      return this._input.type;
    }

    set type(value) {
      this._input.type = value;
    }

    set required(value) {
      this._input.required = value;
    }

    get required() {
      return this._input.required;
    }

    reportValidity() {
      return this._input.reportValidity();
    }
  }

  win.defineCustomElement('a-textfield', Textfield, template);
  win.Textfield = Textfield;
  return Textfield;
}

export default {
  initTextfield
};
