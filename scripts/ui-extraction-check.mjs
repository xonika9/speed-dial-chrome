#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SRC_UI_DIR = join(ROOT, 'src', 'ui');
const UI_INDEX_FILE = join(SRC_UI_DIR, 'index.js');

function walkFiles(dir, matcher, out = []) {
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walkFiles(fullPath, matcher, out);
      continue;
    }
    if (matcher(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function checkNodeSyntax(files) {
  const errors = [];
  for (const file of files) {
    const result = spawnSync(process.execPath, ['--check', file], {
      encoding: 'utf8'
    });
    if (result.status !== 0) {
      errors.push(`Syntax check failed: ${file}\n${(result.stderr || result.stdout || '').trim()}`);
    }
  }
  return errors;
}

function checkEventListenerPairing(files) {
  const errors = [];
  const addRegex = /this\.addEventListener\(\s*['\"]([^'\"]+)['\"]\s*,\s*this\.([A-Za-z0-9_$]+)\s*\)/g;
  const removeRegex = /this\.removeEventListener\(\s*['\"]([^'\"]+)['\"]\s*,\s*this\.([A-Za-z0-9_$]+)\s*\)/g;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const added = new Set();

    for (const match of source.matchAll(addRegex)) {
      added.add(`${match[1]}::${match[2]}`);
    }

    for (const match of source.matchAll(removeRegex)) {
      const key = `${match[1]}::${match[2]}`;
      if (!added.has(key)) {
        errors.push(`Listener mismatch in ${file}: removeEventListener(${match[1]}, ${match[2]}) has no matching addEventListener`);
      }
    }
  }

  return errors;
}

function checkObviousUndeclaredPatterns(files) {
  const errors = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');

    if (/\breorderInfo\./.test(source) && !/\b(?:const|let|var)\s+reorderInfo\b/.test(source)) {
      errors.push(`Potential undeclared symbol in ${file}: found usage of "reorderInfo" without local declaration`);
    }
  }

  return errors;
}

function parseImportedLocalNames(indexSource) {
  const importedNames = new Set();
  const namedImportRegex = /import\s*\{([^}]+)\}\s*from\s*['\"][^'\"]+['\"]/g;

  for (const match of indexSource.matchAll(namedImportRegex)) {
    const body = match[1];
    const parts = body
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);

    for (const part of parts) {
      const [imported, local] = part.split(/\s+as\s+/).map(v => v.trim());
      importedNames.add(local || imported);
    }
  }

  return importedNames;
}

function checkRegistryConsistency(indexFile) {
  const errors = [];
  const indexSource = readFileSync(indexFile, 'utf8');
  const importedNames = parseImportedLocalNames(indexSource);
  const registrations = [];
  const registerRegex = /registerModuleUIInitializer\(\s*['\"]([^'\"]+)['\"]\s*,\s*([A-Za-z0-9_$]+)\s*\)/g;

  for (const match of indexSource.matchAll(registerRegex)) {
    const registeredName = match[1];
    const initializerName = match[2];
    registrations.push({ registeredName, initializerName });

    if (!registeredName.startsWith('init')) {
      errors.push(`Registry entry should use init* naming: ${registeredName}`);
    }

    if (!importedNames.has(initializerName)) {
      errors.push(`Registry initializer is not imported in src/ui/index.js: ${initializerName}`);
    }
  }

  const seen = new Set();
  for (const { registeredName } of registrations) {
    if (seen.has(registeredName)) {
      errors.push(`Duplicate registry entry in src/ui/index.js: ${registeredName}`);
      continue;
    }
    seen.add(registeredName);
  }

  return errors;
}

function main() {
  const uiFiles = walkFiles(
    SRC_UI_DIR,
    file => (
      file.endsWith('.js') &&
      !file.endsWith('/legacy.js') &&
      !file.endsWith('/legacy-initializers.js')
    )
  );

  const errors = [
    ...checkNodeSyntax(uiFiles),
    ...checkEventListenerPairing(uiFiles),
    ...checkObviousUndeclaredPatterns(uiFiles),
    ...checkRegistryConsistency(UI_INDEX_FILE)
  ];

  if (errors.length > 0) {
    console.error('[ui-extraction-check] FAILED');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('[ui-extraction-check] OK');
}

main();
