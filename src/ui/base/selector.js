import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{outline:none;display:inline-block}::slotted(*){cursor:pointer}</style><slot></slot>`
);

export function initSelector(win) {
  if (win.Selector) {
    return win.Selector;
  }

  const CustomElement = initCustomElement(win);

  class Selector extends CustomElement {
    init(shadowRoot) {
      super.init(shadowRoot);
      this.addEventListener('click', this, true);
      this.addEventListener('keydown', this);
      if (this.dataset.multiple) {
        this.multiple = (this.dataset.multiple === 'true');
      }
      if (this.dataset.value) {
        this.value = this.dataset.value;
      }
    }

    get items() {
      return Array.from(this.querySelectorAll('*[data-option]'));
    }

    getSelected() {
      return this.items
        .filter(item => item.classList.contains('-selected'))
        .map(item => item.dataset.option);
    }

    setSelected(values) {
      this.items.forEach(item => {
        if (values.includes(item.dataset.option)) {
          item.classList.add('-selected');
          item.tabIndex = 0;
          if (this.contains(this.querySelector('*:focus'))) {
            item.focus();
          }
        } else {
          item.classList.remove('-selected');
          item.tabIndex = -1;
        }
      });
    }

    get value() {
      const values = this.getSelected();
      return this.multiple ? JSON.stringify(values) : values[0];
    }

    set value(value) {
      const values = this.multiple ? JSON.parse(value) : [`${value}`];
      this.setSelected(values);
    }

    handleEvent(event) {
      switch (event.type) {
        case 'click': {
          if (!event.target.dataset.option) {
            return;
          }

          const item = event.target;
          if (!item.classList.contains('-selected')) {
            this.setSelected(this.multiple ? this.getSelected().concat(item.dataset.option) : [item.dataset.option]);
            this.dispatchEvent(new Event('change', { bubbles: true }));
            event.stopPropagation();
          } else if (this.multiple) {
            this.setSelected(this.getSelected().filter(v => v !== item.dataset.option));
            this.dispatchEvent(new Event('change', { bubbles: true }));
            event.stopPropagation();
          }
          break;
        }

        case 'keydown': {
          if (event.keyCode === 32) {
            event.preventDefault();
          }

          if (this.multiple) {
            return;
          }

          if (![37, 38, 39, 40].includes(event.keyCode)) {
            return;
          }

          event.preventDefault();
          const items = this.items;
          let selectedIndex = -1;

          for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('-selected')) {
              selectedIndex = i;
              break;
            }
          }

          switch (event.keyCode) {
            case 37:
            case 38:
              selectedIndex = ((selectedIndex - 1) < 0) ? items.length - 1 : selectedIndex - 1;
              break;
            case 39:
            case 40:
              selectedIndex = (selectedIndex + 1) % items.length;
              break;
            default:
              break;
          }

          this.value = items[selectedIndex].dataset.option;
          this.dispatchEvent(new Event('change', { bubbles: true }));
          break;
        }

        default:
          break;
      }
    }
  }

  win.defineCustomElement('a-selector', Selector, template);
  win.Selector = Selector;
  return Selector;
}

export default {
  initSelector
};
