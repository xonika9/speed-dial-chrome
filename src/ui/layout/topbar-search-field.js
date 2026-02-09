import { initTextfield } from '../base/textfield.js';
import { createLocalizedTemplate } from '../base/template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:flex;flex-direction:row;align-items:center;background-color:rgba(0,0,0,0.2);border:none;padding:0 0 0 40px;border-radius:3px;height:40px;position:relative;color:white}:host::before{content:"";width:40px;height:100%;-webkit-mask-image:url(ui/topbar-search-field/topbar-search-field-search-icon.svg);background-repeat:no-repeat;background-position:center;background-color:currentColor;top:0;left:0;opacity:.5;position:absolute;z-index:1000}:host(:focus)::before{opacity:1}input{color:inherit}input::-webkit-input-placeholder{color:inherit;opacity:.5}input::selection{background-color:rgba(150,150,150,0.5);color:white}#clear-btn{width:42px;height:100%;display:none;-webkit-mask-image:url(ui/topbar-search-field/topbar-search-field-icon-close.svg);background-repeat:no-repeat;background-position:center;background-color:currentColor;cursor:pointer;opacity:.5}#clear-btn:hover{opacity:1}#clear-btn.visible{display:inline-block}</style><span id="clear-btn"></span>`
);

export function initTopbarSearchField(win) {
  if (win.TopbarSearchField) {
    return win.TopbarSearchField;
  }

  const Textfield = initTextfield(win);

  class TopbarSearchField extends Textfield {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._input.addEventListener('focusin', this);
      this._input.addEventListener('change', this);
      this._input.addEventListener('input', this);
      this._clearBtn = shadowRoot.getElementById('clear-btn');
      this._clearBtn.addEventListener('click', this);
      if (this.dataset.value) {
        this.value = this.dataset.value;
      }
    }

    handleEvent(event) {
      switch (event.type) {
        case 'focusin':
          this._input.select();
          break;
        case 'input':
        case 'change':
          this.updateClearBtn();
          break;
        case 'click':
          this._input.value = '';
          this._input.dispatchEvent(new Event('change'));
          break;
        default:
          break;
      }
    }

    updateClearBtn() {
      if (this._input.value.length) {
        this._clearBtn.classList.add('visible');
      } else {
        this._clearBtn.classList.remove('visible');
      }
    }

    set value(value) {
      this._input.value = value;
      this.updateClearBtn();
    }

    get value() {
      return this._input.value;
    }
  }

  win.defineCustomElement('a-topbar-search-field', TopbarSearchField, template);
  win.TopbarSearchField = TopbarSearchField;
  return TopbarSearchField;
}

export default {
  initTopbarSearchField
};
