/**
 * Loads extracted legacy UI initializers as a classic script.
 *
 * The generated script exports legacy init* functions through:
 *   window.__MV3_LEGACY_INITIALIZERS__
 */

const LEGACY_INITIALIZER_SCRIPT_PATH = 'src/ui/runtime/legacy-initializers.js';
const LEGACY_INITIALIZER_GLOBAL_KEY = '__MV3_LEGACY_INITIALIZERS__';

let loadPromise = null;

function loadClassicScript(url) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.async = false;
    script.onerror = () => reject(new Error(`Failed to load ${url}`));
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
}

export async function loadLegacyInitializers() {
  const alreadyLoaded = window[LEGACY_INITIALIZER_GLOBAL_KEY];
  if (alreadyLoaded && typeof alreadyLoaded === 'object') {
    return alreadyLoaded;
  }

  if (!loadPromise) {
    const url = chrome.runtime.getURL(LEGACY_INITIALIZER_SCRIPT_PATH);
    loadPromise = loadClassicScript(url)
      .then(() => {
        const initializers = window[LEGACY_INITIALIZER_GLOBAL_KEY];
        if (!initializers || typeof initializers !== 'object') {
          throw new Error('Legacy initializer script loaded without expected exports');
        }
        return initializers;
      })
      .catch(error => {
        loadPromise = null;
        throw error;
      });
  }

  return loadPromise;
}

export async function createLegacyInitializerAPI() {
  const ui = await loadLegacyInitializers();
  return { ui };
}

export default {
  loadLegacyInitializers,
  createLegacyInitializerAPI
};
