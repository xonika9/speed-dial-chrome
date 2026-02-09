import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{font-family:'Roboto';display:flex;flex-direction:column;min-height:200px;max-height:100vh;min-width:340px;max-width:100vw;color:#333}.content,.form,.text{flex:1;overflow:auto}.form h1,.form h2{font-size:12px;font-weight:normal;margin:0 0 8px 0}.form h1:not(:first-child),.form h2:not(:first-child){margin-top:2em}.form,.text{padding:30px 30px 10px 30px}.form:last-child,.text:last-child{padding-bottom:30px}.buttons{align-items:flex-start;flex-shrink:0;display:flex;flex-direction:row;padding:30px 25px 30px 25px}.buttons>*{margin-left:5px;margin-right:5px;width:100%}</style>`
);

function ensureShowDialog(win) {
  if (typeof win.showDialog === 'function') {
    return;
  }

  win.showDialog = function showDialog(dialogUI, values, callback, cancelCallback) {
    const dialog = document.createElement('dialog');

    dialog.addEventListener('click', event => {
      if (event.target !== dialog) {
        return;
      }

      const rect = dialog.getBoundingClientRect();
      const { clientX: x, clientY: y } = event;
      if ((x < rect.left) || (y < rect.top) || (x > rect.right) || (y > rect.bottom)) {
        dialog.dispatchEvent(new Event('cancel'));
        dialog.close();
      }
    });

    let ui;
    if (typeof dialogUI === 'string') {
      ui = document.createElement(dialogUI);
    } else if (dialogUI instanceof HTMLElement) {
      ui = dialogUI;
    } else {
      ui = new dialogUI();
    }

    dialog.appendChild(ui);
    document.body.appendChild(dialog);

    Promise.all([
      document.fonts.load('normal 1em Roboto'),
      document.fonts.load('500 1em Roboto')
    ])
      .then(() => ui.setValues(values))
      .then(() => {
        const finalize = () => {
          dialog.remove();
          dialog.removeEventListener('close', onClose);
          dialog.removeEventListener('cancel', onCancel);
          document.body.style.overflow = null;
        };

        const onClose = () => {
          ui.closeCallback();
          finalize();
          if (callback) {
            callback(ui.getValues());
          }
        };

        const onCancel = () => {
          ui.closeCallback(true);
          finalize();
          if (cancelCallback) {
            cancelCallback();
          }
        };

        dialog.addEventListener('close', onClose);
        dialog.addEventListener('cancel', onCancel);
        document.body.style.overflow = 'hidden';
        dialog.showModal();
        ui.focus();
      });

    return ui;
  };
}

export function initDialogUI(win) {
  if (win.DialogUI) {
    return win.DialogUI;
  }

  const CustomElement = initCustomElement(win);
  ensureShowDialog(win);

  class DialogUI extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      shadowRoot.addEventListener('keydown', event => {
        if (event.keyCode === 13) {
          this.ok();
        }
      });
    }

    setValues(values) {
      void values;
    }

    getValues() {
      return {};
    }

    closeCallback(isCancel) {
      void isCancel;
    }

    get dialog() {
      const dialog = this.parentNode;
      return (dialog instanceof HTMLDialogElement) ? dialog : null;
    }

    ok() {
      this.dialog.close();
    }

    cancel() {
      this.dialog.dispatchEvent(new Event('cancel'));
      this.dialog.close();
    }

    show(values, callback, cancelCallback) {
      win.showDialog(this, values, callback, cancelCallback);
    }
  }

  DialogUI.CancelAll = function CancelAll() {
    document.querySelectorAll('dialog').forEach(dialog => dialog.dispatchEvent(new Event('cancel')));
  };

  win.defineCustomElement('a-dialog-ui', DialogUI, template);
  win.DialogUI = DialogUI;
  return DialogUI;
}

export default {
  initDialogUI
};
