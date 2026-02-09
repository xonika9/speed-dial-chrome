/**
 * Search API - Search template resolution and cache.
 */

import { registerHandlers } from './messaging.js';
import { get as getSetting } from './settings.js';

const SEARCH_ENGINES = {
  Google: 'https://www.google.com/search?q=',
  Bing: 'https://www.bing.com/search?q=',
  Duckduckgo: 'https://duckduckgo.com/?q='
};

const templateCache = new Map();

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

function getEngineTemplate(engineName) {
  return SEARCH_ENGINES[engineName] || SEARCH_ENGINES.Google;
}

function findMappedTemplate(url, mapping) {
  for (const [prefix, template] of Object.entries(mapping)) {
    if (url.startsWith(prefix)) {
      return template;
    }
  }
  return null;
}

export async function getTemplate(url) {
  if (templateCache.has(url)) {
    return templateCache.get(url);
  }

  const urlMapping = parseURLMapping(getSetting('search-url-mapping'));
  const mappedTemplate = findMappedTemplate(url, urlMapping);

  const template = mappedTemplate || getEngineTemplate(getSetting('search-engine'));
  templateCache.set(url, template);
  return template;
}

export function clearCache(urls = null) {
  if (!urls) {
    templateCache.clear();
    return;
  }

  const keys = Array.isArray(urls) ? urls : [urls];
  keys.forEach(key => templateCache.delete(key));
}

export function countCached() {
  return templateCache.size;
}

export function initSearch() {
  registerHandlers({
    getSearchEngineTemplate: async ({ engineName }) => getEngineTemplate(engineName),
    getSearchTemplate: async ({ url }) => getTemplate(url),
    clearSearchCache: async ({ urls }) => {
      clearCache(urls);
      return { success: true };
    },
    countSearchCache: async () => countCached()
  });

  console.log('[Search] Module initialized');
}

export default {
  getTemplate,
  clearCache,
  countCached,
  initSearch
};
