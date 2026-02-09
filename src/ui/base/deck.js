import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:block}::slotted(*:not(.-selected)){display:none !important}</style><slot></slot>`
);

export function initDeck(win) {
  if (win.Deck) {
    return win.Deck;
  }

  const CustomElement = initCustomElement(win);

  class Deck extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      if (this.dataset.value) {
        this.value = this.dataset.value;
      }
    }

    set value(value) {
      for (const child of this.children) {
        if (child.dataset.option === value) {
          child.classList.add('-selected');
        } else {
          child.classList.remove('-selected');
        }
      }
    }

    get value() {
      for (const child of this.children) {
        if (child.classList.contains('-selected')) {
          return child.dataset.option;
        }
      }
      return undefined;
    }
  }

  win.defineCustomElement('a-deck', Deck, template);
  win.Deck = Deck;
  return Deck;
}

export default {
  initDeck
};
