/**
 * UI Runtime Bootstrap
 * Controls UI runtime selection using chrome.storage local flag: "ui-runtime".
 */

import { loadLegacyRuntime } from './runtime/legacy.js';
import { loadHybridRuntime } from './runtime/hybrid.js';
import { loadModuleRuntime } from './runtime/module.js';

const UI_RUNTIME_KEY = 'ui-runtime';
const DEFAULT_UI_RUNTIME = 'module';
const DEFAULT_UI_ROUTE = 'NewtabUI';
const HYBRID_ALLOWED_ROUTES = new Set([
  'NewtabUI',
  'PopupUI',
  'SettingsUI',
  'FirstrunUI'
]);

const RUNTIME_LOADERS = {
  legacy: loadLegacyRuntime,
  hybrid: loadHybridRuntime,
  module: loadModuleRuntime
};

export const UI_RUNTIMES = Object.freeze(Object.keys(RUNTIME_LOADERS));
export const HYBRID_ROUTES = Object.freeze(Array.from(HYBRID_ALLOWED_ROUTES));

async function getConfiguredRuntime() {
  const result = await chrome.storage.local.get(UI_RUNTIME_KEY);
  const runtime = result[UI_RUNTIME_KEY];
  return runtime in RUNTIME_LOADERS ? runtime : DEFAULT_UI_RUNTIME;
}

function normalizeUIRoute(uiRoute) {
  const value = (typeof uiRoute === 'string' && uiRoute.trim()) ? uiRoute.trim() : DEFAULT_UI_ROUTE;
  return value.startsWith('init') ? value.slice(4) : value;
}

function resolveRuntimeForRoute(configuredRuntime, requestedUI) {
  const normalizedUI = normalizeUIRoute(requestedUI);

  if (configuredRuntime === 'hybrid' && !HYBRID_ALLOWED_ROUTES.has(normalizedUI)) {
    return {
      resolvedRuntime: 'legacy',
      reason: `hybrid-route-guard:${normalizedUI}`
    };
  }

  return {
    resolvedRuntime: configuredRuntime,
    reason: 'configured'
  };
}

export async function loadUIRuntime({ requestedUI = DEFAULT_UI_ROUTE } = {}) {
  const configuredRuntime = await getConfiguredRuntime();
  const { resolvedRuntime, reason } = resolveRuntimeForRoute(configuredRuntime, requestedUI);
  const loader = RUNTIME_LOADERS[resolvedRuntime];

  if (typeof loader !== 'function') {
    throw new Error(`Unsupported UI runtime: ${resolvedRuntime}`);
  }

  const runtimeResult = await loader();
  return {
    ...runtimeResult,
    configuredRuntime,
    resolvedRuntime,
    runtimeResolutionReason: reason,
    requestedUI: normalizeUIRoute(requestedUI)
  };
}

export async function setUIRuntime(runtime) {
  if (!(runtime in RUNTIME_LOADERS)) {
    throw new Error(`Unsupported UI runtime: ${runtime}`);
  }

  await chrome.storage.local.set({ [UI_RUNTIME_KEY]: runtime });
  return { success: true, runtime };
}

export async function getUIRuntime() {
  const runtime = await getConfiguredRuntime();
  return { runtime };
}

export default {
  UI_RUNTIMES,
  HYBRID_ROUTES,
  loadUIRuntime,
  setUIRuntime,
  getUIRuntime
};
