#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SETTINGS_FILE = path.join(ROOT, 'src', 'api', 'settings.js');
const SRC_DIR = path.join(ROOT, 'src');

const SETTINGS_USAGE_PATTERNS = [
  /\bapi\.settings\.(?:get|getAsync|set|setMultiple|remove|readSync)\(\s*['"]([^'"]+)['"]/g,
  /\bsettings\.(?:get|getAsync|set|setMultiple|remove|readSync)\(\s*['"]([^'"]+)['"]/g,
  /\bgetSetting\(\s*['"]([^'"]+)['"]/g
];

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function parseDefaultKeys(settingsSource) {
  const defaultsBlock = settingsSource.match(/const defaults = \{([\s\S]*?)\n\};/);
  if (!defaultsBlock) {
    throw new Error('Unable to parse defaults object from src/api/settings.js');
  }

  return new Set(
    Array.from(defaultsBlock[1].matchAll(/['"]([^'"]+)['"]\s*:/g), match => match[1])
  );
}

function collectSourceFiles(dirPath, output = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(fullPath, output);
      continue;
    }

    if (entry.isFile() && /\.(js|mjs)$/.test(entry.name)) {
      output.push(fullPath);
    }
  }
  return output;
}

function collectUsedSettingKeys(files) {
  const keys = new Set();

  for (const file of files) {
    const source = readText(file);
    for (const pattern of SETTINGS_USAGE_PATTERNS) {
      for (const match of source.matchAll(pattern)) {
        keys.add(match[1]);
      }
    }
  }

  return keys;
}

const BINDING_KEY_PATTERN = /data-binding-key="([^"]+)"/g;
const NON_SETTINGS_BINDING_KEYS = new Set(['settings']);

function collectBindingSettingKeys(files) {
  const keys = new Set();
  for (const file of files) {
    const source = readText(file);
    for (const match of source.matchAll(BINDING_KEY_PATTERN)) {
      let key = match[1];
      if (key.endsWith('/synced')) {
        key = key.slice(0, -'/synced'.length);
      }
      if (NON_SETTINGS_BINDING_KEYS.has(key)) {
        continue;
      }
      keys.add(key);
    }
  }
  return keys;
}

function main() {
  const defaults = parseDefaultKeys(readText(SETTINGS_FILE));
  const sourceFiles = collectSourceFiles(SRC_DIR);
  const usedKeys = collectUsedSettingKeys(sourceFiles);
  const bindingKeys = collectBindingSettingKeys(sourceFiles);

  const allKeys = new Set([...usedKeys, ...bindingKeys]);
  const missing = Array.from(allKeys).filter(key => !defaults.has(key)).sort();

  if (missing.length > 0) {
    console.error('[settings-defaults-check] FAILED');
    console.error('Settings keys used in runtime but missing in defaults:');
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }

  console.log('[settings-defaults-check] OK');
  console.log(`- defaults keys: ${defaults.size}`);
  console.log(`- used keys (API calls): ${usedKeys.size}`);
  console.log(`- used keys (data-binding-key): ${bindingKeys.size}`);
  console.log(`- total unique keys: ${allKeys.size}`);
}

main();
