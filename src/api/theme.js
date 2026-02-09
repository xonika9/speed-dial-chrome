/**
 * Theme API - Theme CSS Generation and Management
 */

import { registerHandlers, broadcast } from './messaging.js';
import { get as getSetting } from './settings.js';

const DEFAULT_THEME = 'default_white';
const THEME_LIST_PATH = '/data/themes.json';
let themeListCache = null;

async function loadThemeList() {
  if (themeListCache) {
    return themeListCache;
  }

  try {
    const response = await fetch(chrome.runtime.getURL(THEME_LIST_PATH));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = await response.json();
    if (!Array.isArray(parsed)) {
      throw new Error('Invalid themes list format');
    }

    themeListCache = parsed.filter(name => typeof name === 'string' && name.length > 0);
  } catch (error) {
    console.warn('[Theme] Failed to load theme list, using fallback:', error);
    themeListCache = [DEFAULT_THEME];
  }

  if (!themeListCache.includes(DEFAULT_THEME)) {
    themeListCache.unshift(DEFAULT_THEME);
  }

  return themeListCache;
}

/**
 * Generate background CSS based on settings
 */
export function generateBackgroundCSS() {
  const type = getSetting('background-type');
  const rules = [];

  switch (type) {
    case 'color':
      const color = getSetting('background-color') || '#ffffff';
      rules.push(`--background-color: ${color};`);
      rules.push(`background-color: var(--background-color);`);
      break;

    case 'image':
    case 'web':
      const imageUrl = getSetting('background-image-url');
      if (imageUrl) {
        rules.push(`background-image: url("${imageUrl}");`);
        rules.push(`background-size: cover;`);
        rules.push(`background-position: center;`);
        rules.push(`background-attachment: fixed;`);
      }
      break;

    case 'file':
      const fileData = getSetting('background-image-file');
      if (fileData) {
        rules.push(`background-image: url("${fileData}");`);
        rules.push(`background-size: cover;`);
        rules.push(`background-position: center;`);
        rules.push(`background-attachment: fixed;`);
      }
      break;

    case 'theme':
    default:
      // Use theme's default background
      break;
  }

  return rules.join('\n');
}

/**
 * Generate filter CSS
 */
export function generateFilterCSS() {
  const enabled = getSetting('filter-enabled');
  if (!enabled) return '';

  const blur = getSetting('filter-blur') || 0;
  const brightness = getSetting('filter-brightness') || 100;
  const grayscale = getSetting('filter-grayscale') || 0;

  const filters = [];
  if (blur > 0) filters.push(`blur(${blur}px)`);
  if (brightness !== 100) filters.push(`brightness(${brightness}%)`);
  if (grayscale > 0) filters.push(`grayscale(${grayscale}%)`);

  if (filters.length === 0) return '';

  return `filter: ${filters.join(' ')};`;
}

/**
 * Generate dock CSS
 */
export function generateDockCSS() {
  const style = getSetting('dock-style');

  switch (style) {
    case 'transparent':
      return `
        --dock-background: transparent;
        --dock-border: none;
      `;
    case 'blur':
      return `
        --dock-background: rgba(255, 255, 255, 0.1);
        --dock-backdrop-filter: blur(10px);
      `;
    case 'solid':
      return `
        --dock-background: var(--surface-color, #ffffff);
        --dock-border: 1px solid var(--border-color, #e0e0e0);
      `;
    default:
      return '';
  }
}

/**
 * Get full theme CSS
 */
export async function getThemeCSS() {
  const requestedTheme = getSetting('theme') || DEFAULT_THEME;
  const availableThemes = await loadThemeList();
  const normalizedTheme = availableThemes.includes(requestedTheme)
    ? requestedTheme
    : DEFAULT_THEME;

  const candidatePaths = [
    `/themes/${normalizedTheme}/style.css`
  ];

  if (normalizedTheme !== DEFAULT_THEME) {
    candidatePaths.push(`/themes/${DEFAULT_THEME}/style.css`);
  }

  for (const themePath of candidatePaths) {
    try {
      const response = await fetch(chrome.runtime.getURL(themePath));
      if (!response.ok) {
        continue;
      }
      return await response.text();
    } catch {
      // Try next candidate path
    }
  }

  console.warn(`[Theme] Failed to load theme CSS for "${requestedTheme}"`);
  return '';
}

/**
 * Get combined styles (theme + custom)
 */
export async function getCombinedStyles() {
  const themeCSS = await getThemeCSS();
  const backgroundCSS = generateBackgroundCSS();
  const filterCSS = generateFilterCSS();
  const dockCSS = generateDockCSS();

  return {
    theme: themeCSS,
    background: backgroundCSS,
    filter: filterCSS,
    dock: dockCSS,
    combined: `
      ${themeCSS}

      /* Custom Background */
      body {
        ${backgroundCSS}
      }

      /* Custom Filter */
      .background-filter {
        ${filterCSS}
      }

      /* Custom Dock */
      .dock {
        ${dockCSS}
      }
    `
  };
}

/**
 * List available themes
 */
export async function listThemes() {
  return loadThemeList();
}

/**
 * Apply theme change
 */
export async function applyTheme(themeName) {
  const availableThemes = await loadThemeList();
  const normalizedTheme = availableThemes.includes(themeName) ? themeName : DEFAULT_THEME;

  // Broadcast theme change to all views
  await broadcast({
    action: 'themeChanged',
    theme: normalizedTheme
  });

  return { success: true, theme: normalizedTheme };
}

/**
 * Initialize theme module
 */
export function initTheme() {
  // Listen for setting changes that affect theme
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;

    const themeKeys = [
      'theme',
      'background-type',
      'background-color',
      'background-image-url',
      'background-image-file',
      'filter-enabled',
      'filter-blur',
      'filter-brightness',
      'filter-grayscale',
      'dock-style'
    ];

    const hasThemeChange = Object.keys(changes).some(key => themeKeys.includes(key));

    if (hasThemeChange) {
      broadcast({ action: 'themeSettingsChanged', changes }).catch(() => {});
    }
  });

  registerHandlers({
    getThemeCSS: async () => getThemeCSS(),
    getCombinedStyles: async () => getCombinedStyles(),
    generateBackgroundCSS: async () => generateBackgroundCSS(),
    generateFilterCSS: async () => generateFilterCSS(),
    generateDockCSS: async () => generateDockCSS(),
    listThemes: async () => listThemes(),
    applyTheme: async ({ themeName }) => applyTheme(themeName)
  });

  console.log('[Theme] Module initialized');
}

export default {
  generateBackgroundCSS,
  generateFilterCSS,
  generateDockCSS,
  getThemeCSS,
  getCombinedStyles,
  listThemes,
  applyTheme,
  initTheme
};
