/**
 * Icons URL Mapping API - resolves explicit icon URL mapping rules.
 */

import { registerHandlers } from './messaging.js';
import { get as getSetting } from './settings.js';

function parseURLMapping(text) {
  const mapping = {};
  const lines = String(text || '').split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split('>');
    if (parts.length !== 2) {
      continue;
    }

    mapping[parts[0].trim()] = parts[1].trim();
  }

  return mapping;
}

export function getMapping() {
  return parseURLMapping(getSetting('icon-url-mapping'));
}

export function resolve(url) {
  const mapping = getMapping();
  for (const [prefix, mapped] of Object.entries(mapping)) {
    if (url.startsWith(prefix)) {
      return mapped;
    }
  }
  return null;
}

export function initIconsUrlMapping() {
  registerHandlers({
    getIconsUrlMapping: async () => getMapping(),
    resolveIconsUrlMapping: async ({ url }) => resolve(url)
  });

  console.log('[IconsUrlMapping] Module initialized');
}

export default {
  getMapping,
  resolve,
  initIconsUrlMapping
};
