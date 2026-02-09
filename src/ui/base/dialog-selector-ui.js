import { initButton } from './button.js';
import { initDialogUI } from './dialog-ui.js';
import { initTopbar } from './topbar.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style></style><a-topbar><h1 slot="left"></h1><a-button slot="right" data-icon="close" data-action="cancel"></a-button></a-topbar>`
);

export function initDialogSelectorUI(win) {
  if (win.DialogSelectorUI) {
    return win.DialogSelectorUI;
  }

  const DialogUI = initDialogUI(win);
  initTopbar(win);
  initButton(win);

  class DialogSelectorUI extends DialogUI {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._selector = shadowRoot.querySelector('a-selector');
      if (this._selector) {
        this._selector.addEventListener('change', () => {
          this.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }
      this.titleEL = shadowRoot.querySelector('h1');
    }

    getValues() {
      return {
        selected: this._selector ? this._selector.value : undefined
      };
    }

    setValues(values) {
      this.titleEL.textContent = values.title;
      if (this._selector) {
        this._selector.value = values.selected;
      }
    }
  }

  win.defineCustomElement('a-dialog-selector-ui', DialogSelectorUI, template);
  win.DialogSelectorUI = DialogSelectorUI;
  return DialogSelectorUI;
}

export default {
  initDialogSelectorUI
};
