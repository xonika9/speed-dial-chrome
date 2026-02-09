/**
 * Shared template helpers for extracted UI modules.
 */

export function createLocalizedTemplate(html) {
  const template = document.createElement('template');
  template.innerHTML = html;

  for (const el of template.content.querySelectorAll('[data-i18n]')) {
    el.textContent = chrome.i18n.getMessage(el.dataset.i18n) || el.dataset.i18n;
  }

  for (const el of template.content.querySelectorAll('[title^="i18n:"]')) {
    const key = el.title.slice(5);
    el.title = chrome.i18n.getMessage(key) || key;
  }

  for (const el of template.content.querySelectorAll('[data-placeholder^="i18n:"]')) {
    const key = el.dataset.placeholder.slice(5);
    el.dataset.placeholder = chrome.i18n.getMessage(key) || key;
  }

  return template;
}
