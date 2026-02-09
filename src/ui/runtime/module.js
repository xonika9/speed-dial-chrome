/**
 * Module-only UI runtime loader.
 */

import { createRuntimeAPI } from '../registry.js';
import { createCompatRuntimeAPI } from './compat/index.js';
import { createLegacyInitializerAPI } from './legacy-initializers-loader.js';

export async function loadModuleRuntime() {
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

  return {
    runtime: 'module',
    eventBus: compatRuntime.eventBus,
    ...runtimeAPI
  };
}

export default {
  loadModuleRuntime
};
