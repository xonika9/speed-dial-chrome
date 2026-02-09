import { initCustomElement } from './custom-element.js';
import { initIcon } from './icon.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:inline-block;background-color:#3367D6;border:1px solid rgba(0,0,0,0.05);border-radius:3px;font-weight:500;text-align:center;cursor:pointer;white-space:nowrap;color:rgba(255,255,255,0.93)}:host(:not(:empty)){padding:8px 20px}:host(:hover){color:white}:host(:active){filter:brightness(90%)}:host(.invert){background-color:white;color:#3367D6;border-color:#3367D6}*{pointer-events:none}</style><!--require<a-icon>--><span tabindex="0"><a-icon id="icon"></a-icon><slot tabindex="0"></slot></span>`
);

export function initButton(win) {
  if (win.Button) {
    return win.Button;
  }

  const CustomElement = initCustomElement(win);
  initIcon(win);

  class Button extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this._label = shadowRoot.querySelector('span');
      this.addEventListener('keydown', this);
      this._icon = shadowRoot.getElementById('icon');
      if (this.dataset.icon) {
        this.icon = this.dataset.icon;
      }
    }

    get label() {
      return this.textContent;
    }

    set label(text) {
      while (this.childNodes.length) {
        this.firstChild.remove();
      }
      this.appendChild(document.createTextNode(text));
    }

    set icon(name) {
      this._icon.dataset.icon = name;
    }

    get icon() {
      return this._icon.dataset.name;
    }

    handleEvent(event) {
      if (event.type !== 'keydown') {
        return;
      }

      if (event.keyCode === 13 || event.keyCode === 32) {
        event.preventDefault();
        this.click();
      }
    }
  }

  win.defineCustomElement('a-button', Button, template);
  win.Button = Button;
  return Button;
}

export default {
  initButton
};
