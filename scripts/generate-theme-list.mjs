#!/usr/bin/env node
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const themesDir = path.join(repoRoot, 'themes');
const outputFile = path.join(repoRoot, 'data', 'themes.json');

async function listThemeDirectories() {
  const entries = await readdir(themesDir, { withFileTypes: true });
  const themes = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const cssPath = path.join(themesDir, entry.name, 'style.css');
    try {
      const cssStat = await stat(cssPath);
      if (cssStat.isFile()) {
        themes.push(entry.name);
      }
    } catch {
      // Skip directories without style.css
    }
  }

  themes.sort((a, b) => a.localeCompare(b));
  return themes;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const themes = await listThemeDirectories();
  const nextContent = JSON.stringify(themes, null, 2) + '\n';

  if (checkOnly) {
    let currentContent = '';
    try {
      currentContent = await readFile(outputFile, 'utf8');
    } catch {
      // Missing file is handled by mismatch check below.
    }

    if (currentContent !== nextContent) {
      console.error(`Theme list is stale: ${outputFile}`);
      console.error('Run: node scripts/generate-theme-list.mjs');
      process.exit(1);
    }

    console.log(`Theme list is up-to-date (${themes.length} themes)`);
    return;
  }

  await writeFile(outputFile, nextContent, 'utf8');
  console.log(`Wrote ${themes.length} themes to ${outputFile}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
