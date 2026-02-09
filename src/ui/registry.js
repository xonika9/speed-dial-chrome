/**
 * UI Registry
 *
 * Merges module-extracted UI initializers with an optional legacy fallback API.
 */

import { getModuleUIInitializers } from './index.js';

export function toInitializerName(name) {
  if (name.startsWith('init')) {
    return name;
  }
  return `init${name}`;
}

function buildModuleInitializerMap() {
  const initializers = getModuleUIInitializers();
  const map = Object.create(null);

  for (const [name, initializer] of Object.entries(initializers)) {
    if (typeof initializer !== 'function') {
      continue;
    }

    map[toInitializerName(name)] = initializer;
  }

  return map;
}

export function listModuleInitializers() {
  return Object.keys(buildModuleInitializerMap());
}

export function hasModuleInitializer(name) {
  const initializerName = toInitializerName(name);
  const initializers = buildModuleInitializerMap();
  return typeof initializers[initializerName] === 'function';
}

/**
 * Build runtime API for selected UI runtime mode.
 */
export function createRuntimeAPI({ fallbackApi = null, allowFallback = false } = {}) {
  const moduleUI = buildModuleInitializerMap();
  const fallbackUI = fallbackApi?.ui && typeof fallbackApi.ui === 'object' ? fallbackApi.ui : {};

  const api = fallbackApi ? { ...fallbackApi } : {};
  api.ui = allowFallback
    ? { ...fallbackUI, ...moduleUI }
    : { ...moduleUI };

  return {
    api,
    moduleInitializers: Object.keys(moduleUI),
    fallbackEnabled: Boolean(allowFallback)
  };
}

export default {
  createRuntimeAPI,
  listModuleInitializers,
  hasModuleInitializer,
  toInitializerName
};
