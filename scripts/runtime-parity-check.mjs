#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const LEGACY_INITIALIZER_GLOBAL_KEY = '__MV3_LEGACY_INITIALIZERS__';
const UI_RUNTIME_KEY = 'ui-runtime';

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function collectInitCoverage() {
  const legacySource = read('docs/legacy/background.legacy.js');
  const moduleIndex = read('src/ui/index.js');
  const legacyNamesModule = read('src/ui/runtime/legacy-initializer-names.js');

  const legacyInitNames = new Set(
    Array.from(
      legacySource.matchAll(/function\s+(init[A-Za-z0-9_]+)\s*\(window\)/g),
      match => match[1]
    )
  );

  const moduleRegistryNames = new Set(
    Array.from(
      moduleIndex.matchAll(/registerModuleUIInitializer\(\s*['"]([^'"]+)['"]/g),
      match => match[1]
    )
  );

  const extractedLegacyNames = new Set(
    Array.from(
      legacyNamesModule.matchAll(/"(init[A-Za-z0-9_]+)"/g),
      match => match[1]
    )
  );

  const uncovered = [];
  for (const initName of legacyInitNames) {
    if (!moduleRegistryNames.has(initName) && !extractedLegacyNames.has(initName)) {
      uncovered.push(initName);
    }
  }

  return {
    legacyInitNames,
    moduleRegistryNames,
    extractedLegacyNames,
    uncovered
  };
}

function createTemplateElement() {
  const content = {
    querySelectorAll() {
      return [];
    }
  };

  return {
    content,
    set innerHTML(value) {
      this._innerHTML = value;
    },
    get innerHTML() {
      return this._innerHTML || '';
    }
  };
}

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true
  });
}

const EXPECTED_BOOTSTRAP_ACTIONS = new Set(['getAllSettings']);

async function runRuntimeBootstrapSmokeCheck() {
  const exercisedActions = new Set();

  const backups = {
    window: globalThis.window,
    location: globalThis.location,
    document: globalThis.document,
    chrome: globalThis.chrome,
    HTMLElement: globalThis.HTMLElement,
    customElements: globalThis.customElements,
    CustomEvent: globalThis.CustomEvent
  };

  const had = {
    window: Object.prototype.hasOwnProperty.call(globalThis, 'window'),
    location: Object.prototype.hasOwnProperty.call(globalThis, 'location'),
    document: Object.prototype.hasOwnProperty.call(globalThis, 'document'),
    chrome: Object.prototype.hasOwnProperty.call(globalThis, 'chrome'),
    HTMLElement: Object.prototype.hasOwnProperty.call(globalThis, 'HTMLElement'),
    customElements: Object.prototype.hasOwnProperty.call(globalThis, 'customElements'),
    CustomEvent: Object.prototype.hasOwnProperty.call(globalThis, 'CustomEvent')
  };

  try {
    const windowObject = {
      location: { hash: '' },
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return true;
      }
    };
    windowObject.window = windowObject;

    const storageData = {
      [UI_RUNTIME_KEY]: 'module'
    };

    const documentObject = {
      head: {
        appendChild(element) {
          windowObject[LEGACY_INITIALIZER_GLOBAL_KEY] = {
            initNewtabUI: () => class DummyLegacyNewtabUI extends HTMLElement {
              constructor() {
                super();
                this.isReady = Promise.resolve();
              }
            }
          };

          if (typeof element.onload === 'function') {
            element.onload();
          }

          return element;
        }
      },
      createElement(tagName) {
        if (tagName === 'template') {
          return createTemplateElement();
        }

        return {
          tagName: String(tagName).toUpperCase(),
          async: false,
          onerror: null,
          onload: null,
          set src(value) {
            this._src = value;
          },
          get src() {
            return this._src;
          }
        };
      },
      importNode(node) {
        return node;
      }
    };

    setGlobal('window', windowObject);
    setGlobal('location', windowObject.location);
    setGlobal('document', documentObject);
    setGlobal('HTMLElement', class HTMLElement {});
    setGlobal('customElements', {
      define() {},
      get() {
        return undefined;
      }
    });
    setGlobal('CustomEvent', class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    });
    setGlobal('chrome', {
      i18n: {
        getMessage(key) {
          return key;
        }
      },
      runtime: {
        onMessage: {
          addListener() {}
        },
        getURL(filePath) {
          return filePath;
        },
        sendMessage(message, callback) {
          const { action } = message;
          exercisedActions.add(action);

          if (action === 'getAllSettings') {
            callback({ ...storageData });
            return;
          }
          if (action === 'dispatchEvent') {
            callback({ received: true });
            return;
          }
          callback({ error: `[runtime-parity-smoke] Unexpected action "${action}"` });
        }
      },
      storage: {
        local: {
          async get(key) {
            if (key == null) {
              return { ...storageData };
            }

            if (typeof key === 'string') {
              return { [key]: storageData[key] };
            }

            if (Array.isArray(key)) {
              return Object.fromEntries(key.map(item => [item, storageData[item]]));
            }

            return { ...storageData };
          },
          async set(values) {
            Object.assign(storageData, values);
          }
        },
        onChanged: {
          addListener() {}
        }
      }
    });

    const bootstrapModuleURL = `${pathToFileURL(path.join(ROOT, 'src/ui/bootstrap.js')).href}?runtime-parity-smoke=${Date.now()}`;
    const bootstrapModule = await import(bootstrapModuleURL);
    const runtimeInfo = await bootstrapModule.loadUIRuntime({ requestedUI: 'NewtabUI' });

    if (!runtimeInfo?.api?.ui || typeof runtimeInfo.api.ui.initNewtabUI !== 'function') {
      throw new Error('loadUIRuntime did not expose api.ui.initNewtabUI');
    }

    const unexercised = Array.from(EXPECTED_BOOTSTRAP_ACTIONS)
      .filter(a => !exercisedActions.has(a));
    if (unexercised.length > 0) {
      throw new Error('Bootstrap smoke did not exercise expected actions: ' + unexercised.join(', '));
    }

    return {
      runtime: runtimeInfo.runtime,
      resolvedRuntime: runtimeInfo.resolvedRuntime,
      exercisedActions: Array.from(exercisedActions)
    };
  } finally {
    for (const key of Object.keys(backups)) {
      if (had[key]) {
        setGlobal(key, backups[key]);
      } else {
        delete globalThis[key];
      }
    }
  }
}

async function main() {
  const coverage = collectInitCoverage();

  if (coverage.uncovered.length > 0) {
    console.error('[runtime-parity-check] FAILED');
    console.error('Missing runtime coverage for init functions:');
    coverage.uncovered.sort().forEach(name => console.error(`- ${name}`));
    process.exit(1);
  }

  let smokeInfo;
  try {
    smokeInfo = await runRuntimeBootstrapSmokeCheck();
  } catch (error) {
    console.error('[runtime-parity-check] FAILED');
    console.error(`Runtime bootstrap smoke-check failed: ${error.message}`);
    process.exit(1);
  }

  console.log('[runtime-parity-check] OK');
  console.log(`- legacy init count: ${coverage.legacyInitNames.size}`);
  console.log(`- module registry count: ${coverage.moduleRegistryNames.size}`);
  console.log(`- extracted legacy count: ${coverage.extractedLegacyNames.size}`);
  console.log(`- covered at runtime: ${coverage.legacyInitNames.size}`);
  console.log(`- smoke runtime: ${smokeInfo.runtime}`);
  console.log(`- smoke resolved runtime: ${smokeInfo.resolvedRuntime}`);
  console.log(`- smoke exercised actions: ${smokeInfo.exercisedActions.join(', ')}`);
}

main();
