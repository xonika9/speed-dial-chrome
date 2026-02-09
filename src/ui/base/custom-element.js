import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host,*{box-sizing:border-box;outline:none}:host([data-disabled]){filter:grayscale(100%);pointer-events:none;opacity:.5}:host-context(.-busy),:host-context(.-busy) *,:host-context(.-busy)::slotted(*){cursor:wait !important}</style>`
);

const IS_READY = Promise.resolve();

function ensureDefineCustomElement(win) {
  if (typeof win.defineCustomElement === 'function') {
    return win.defineCustomElement;
  }

  const defineCustomElement = function defineCustomElement(name, elementClass, elementTemplate) {
    elementClass._template = elementTemplate;
    elementClass._templates = [];

    let constructor = elementClass;
    while (constructor) {
      if (Object.prototype.hasOwnProperty.call(constructor, '_template')) {
        elementClass._templates.unshift(constructor._template);
      }
      constructor = Object.getPrototypeOf(constructor);
    }

    if (!customElements.get(name)) {
      customElements.define(name, elementClass);
    }
  };

  defineCustomElement.templates = (typeof templates === 'undefined') ? {} : templates;
  win.defineCustomElement = defineCustomElement;
  return defineCustomElement;
}

export function initCustomElement(win) {
  if (win.CustomElement) {
    return win.CustomElement;
  }

  class CustomElement extends HTMLElement {
    init(shadowRoot) {
      if (this.dataset.binding) {
        this.binding = this.dataset.binding;
      }
      if (this.dataset.bindingKey) {
        this.bindingKey = this.dataset.bindingKey;
      }
      if (this.dataset.action) {
        this.action = this.dataset.action;
      }
      if (this.dataset.menu) {
        this.menu = this.dataset.menu;
      }
      if (this.dataset.contextmenu) {
        this.contextmenu = this.dataset.contextmenu;
      }
      this._isInitialized = true;
    }

    set bindingClass(bindingClass) {
      if (this._binding) {
        this._binding.unbind();
      }
      this._binding = new bindingClass(this);
    }

    set binding(name) {
      const getBinding = win.DataBinding && typeof win.DataBinding.Get === 'function'
        ? win.DataBinding.Get.bind(win.DataBinding)
        : null;

      if (!getBinding) {
        console.warn(`[UI] DataBinding is not available for "${name}"`);
        return;
      }

      this.bindingClass = getBinding(name);
    }

    __delegateFocus(event) {
      if (event.type === 'focus') {
        const focusInShadow = this.shadowRoot.querySelector(':focus, .-focus');
        if (!focusInShadow) {
          const focusable = this.shadowRoot.querySelector('input,select,textarea,a,button,[tabindex]');
          if (focusable) {
            focusable.focus();
          }
        }
        this.classList.add('-focus');
      } else {
        this.classList.remove('-focus');
      }
    }

    connectedCallback() {
      if (!this._wasConnected) {
        this._wasConnected = true;

        if (this.constructor._templates.length) {
          const shadowRoot = this.attachShadow({ mode: 'open' });
          this.addEventListener('focus', this.__delegateFocus);
          this.addEventListener('blur', this.__delegateFocus);

          for (const tpl of this.constructor._templates) {
            shadowRoot.appendChild(document.importNode(tpl.content, true));
          }

          this.init(shadowRoot);
          if (!this._isInitialized) {
            throw new Error(`${this.tagName} doesn't call super.init()`);
          }
        }
      }

      this._isReady = this.bind();
    }

    get isReady() {
      return this._isReady || IS_READY;
    }

    disconnectedCallback() {
      this.unbind();
    }

    bind() {
      if (this._binding && !this.standby) {
        this._binding.bind();
      }
    }

    unbind() {
      if (this._binding && !this.standby) {
        this._binding.unbind();
      }
    }

    set disabled(value) {
      if (value) {
        this.dataset.disabled = 'true';
      } else {
        delete this.dataset.disabled;
      }
    }

    get disabled() {
      return this.dataset.disabled !== undefined;
    }

    set busy(value) {
      if (value) {
        this.classList.add('-busy');
      } else {
        this.classList.remove('-busy');
      }
    }

    get busy() {
      return this.classList.contains('-busy');
    }

    _cloneEvent(event) {
      return { target: event.target, clientX: event.clientX, clientY: event.clientY };
    }

    _dispatchActionEvent(name, click, context) {
      if (click.target.dispatchEvent(new CustomEvent('action', {
        bubbles: true,
        cancelable: true,
        detail: { name, click, context }
      }))) {
        const host = this.getRootNode().host;
        if (host && typeof host[name] === 'function') {
          host[name]();
        }
      }
    }

    set action(name) {
      if (this._actionHandler) {
        this.removeEventListener('click', this._actionHandler);
      }

      this._actionHandler = event => this._dispatchActionEvent(name, this._cloneEvent(event));
      this.addEventListener('click', this._actionHandler);
    }

    initMenu(eventType, menuOrId, target) {
      const resolvedTarget = target || this;
      const handlerName = `_menu${eventType}`;

      if (resolvedTarget[handlerName]) {
        resolvedTarget.removeEventListener(eventType, resolvedTarget[handlerName]);
      }

      resolvedTarget[handlerName] = context => {
        context.preventDefault();
        const root = this.getRootNode();
        const menu = (typeof menuOrId === 'string') ? root.getElementById(menuOrId) : menuOrId;
        const clonedContext = this._cloneEvent(context);

        menu.show(clonedContext.clientX, clonedContext.clientY, click => {
          if (click.target.dataset.action) {
            this._dispatchActionEvent(click.target.dataset.action, this._cloneEvent(click), clonedContext);
          }
        });
      };

      resolvedTarget.addEventListener(eventType, resolvedTarget[handlerName]);
    }

    set menu(menuOrId) {
      this.initMenu('click', menuOrId);
    }

    set contextmenu(menuOrId) {
      this.initMenu('contextmenu', menuOrId);
    }
  }

  const defineCustomElement = ensureDefineCustomElement(win);
  defineCustomElement('a-custom-element', CustomElement, template);
  win.CustomElement = CustomElement;
  return CustomElement;
}

export default {
  initCustomElement
};
