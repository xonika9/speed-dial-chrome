/**
 * Legacy UI runtime loader.
 *
 * Keeps the "legacy" runtime label for compatibility, while sourcing
 * initializers from extracted legacy UI blocks (without loading background.js).
 */

import { createRuntimeAPI } from '../registry.js';
import { createCompatRuntimeAPI } from './compat/index.js';
import { createLegacyInitializerAPI } from './legacy-initializers-loader.js';

export async function loadLegacyRuntime() {
  const compatRuntime = await createCompatRuntimeAPI(window);
  const legacyInitializerApi = await createLegacyInitializerAPI();

  const runtimeAPI = createRuntimeAPI({
    fallbackApi: {
      ...compatRuntime.api,
      ui: legacyInitializerApi.ui
    },
    allowFallback: true
  });

  return {
    runtime: 'legacy',
    eventBus: compatRuntime.eventBus,
    ...runtimeAPI
  };
}

export default {
  loadLegacyRuntime
};
