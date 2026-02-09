#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

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
    moduleIndex.matchAll(/registerModuleUIInitializer\(\s*['\"]([^'\"]+)['\"]/g),
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

if (uncovered.length > 0) {
  console.error('[runtime-parity-check] FAILED');
  console.error('Missing runtime coverage for init functions:');
  uncovered.sort().forEach(name => console.error(`- ${name}`));
  process.exit(1);
}

console.log('[runtime-parity-check] OK');
console.log(`- legacy init count: ${legacyInitNames.size}`);
console.log(`- module registry count: ${moduleRegistryNames.size}`);
console.log(`- extracted legacy count: ${extractedLegacyNames.size}`);
console.log(`- covered at runtime: ${legacyInitNames.size}`);
