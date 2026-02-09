import { initCustomElement } from './custom-element.js';
import { createLocalizedTemplate } from './template.js';

const template = createLocalizedTemplate(
  `<style>:host{display:inline-block;width:40px;height:40px;background-repeat:no-repeat;background-size:cover;background-position:center;vertical-align:top;filter:invert(var(--icon-invert, 0%))}:host(:not([data-icon])){display:none}:host([data-icon=close]){background-image:url('ui/icon/icon-close.svg')}:host([data-icon=menu]){background-image:url('ui/icon/icon-menu.svg')}:host([data-icon=contextmenu]){background-image:url('ui/icon/icon-contextmenu.svg')}:host([data-icon=reload]){background-image:url('ui/icon/icon-reload.svg')}:host([data-icon=settings]){background-image:url('ui/icon/icon-settings.svg')}:host([data-icon=loading]){background-image:url('ui/icon/icon-loading.svg')}</style><!-- Icon -->`
);

export function initIcon(win) {
  if (win.Icon) {
    return win.Icon;
  }

  const CustomElement = initCustomElement(win);

  class Icon extends CustomElement {}

  win.defineCustomElement('a-icon', Icon, template);
  win.Icon = Icon;
  return Icon;
}

export default {
  initIcon
};
