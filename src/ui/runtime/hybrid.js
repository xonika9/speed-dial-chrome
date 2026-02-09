/**
 * Hybrid UI runtime loader (module registry + legacy fallback).
 */

import { createRuntimeAPI } from '../registry.js';
import { createCompatRuntimeAPI } from './compat/index.js';
import { createLegacyInitializerAPI } from './legacy-initializers-loader.js';

export async function loadHybridRuntime() {
  const compatRuntime = await createCompatRuntimeAPI(window);
  const legacyInitializerApi = await createLegacyInitializerAPI();
  const fallbackApi = {
    ...compatRuntime.api,
    ui: legacyInitializerApi.ui
  };
  const runtimeAPI = createRuntimeAPI({
    fallbackApi,
    allowFallback: true
  });

  for (const [namespace, value] of Object.entries(compatRuntime.api)) {
    if (runtimeAPI.api[namespace] === undefined) {
      runtimeAPI.api[namespace] = value;
    }
  }

  return {
    runtime: 'hybrid',
    eventBus: compatRuntime.eventBus,
    ...runtimeAPI
  };
}

export default {
  loadHybridRuntime
};
