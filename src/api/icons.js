/**
 * Icons API - Icon Generation and Management
 * Uses MV3 favicon API and offscreen canvas for generation
 */

import { registerHandlers } from './messaging.js';
import { generateIcon as generateViaOffscreen } from './offscreen.js';

// Icon cache using Cache API
const CACHE_NAME = 'icon-cache-v1';

/**
 * Get favicon URL using MV3 API
 */
export function getFaviconUrl(pageUrl, size = 32) {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', size.toString());
  return url.toString();
}

/**
 * Get cached icon or generate new one
 */
async function getCachedIcon(key, generator) {
  try {
    const cacheUrl = `https://icon-cache/${encodeURIComponent(key)}`;
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheUrl);

    if (cached) {
      return await cached.text();
    }

    const dataUrl = await generator();

    // Cache the result
    await cache.put(cacheUrl, new Response(dataUrl));

    return dataUrl;
  } catch (error) {
    console.warn('[Icons] Cache error:', error);
    return generator();
  }
}

/**
 * Generate letter icon for a URL
 */
export async function generateLetterIcon(url, options = {}) {
  const {
    size = 64,
    fontSize = 32,
    backgroundColor = null,
    textColor = '#ffffff'
  } = options;

  // Extract first letter from hostname
  let letter = '?';
  try {
    const hostname = new URL(url).hostname;
    letter = hostname.replace('www.', '').charAt(0).toUpperCase();
  } catch {
    letter = url.charAt(0).toUpperCase() || '?';
  }

  // Generate background color from URL if not provided
  const bgColor = backgroundColor || generateColorFromString(url);

  const cacheKey = `letter:${letter}:${size}:${bgColor}`;

  return getCachedIcon(cacheKey, () =>
    generateViaOffscreen({
      type: 'letter',
      letter,
      size,
      fontSize,
      backgroundColor: bgColor,
      textColor
    })
  );
}

/**
 * Generate color from string (consistent hash)
 */
function generateColorFromString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 65%, 50%)`;
}

/**
 * Generate folder icon
 */
export async function generateFolderIcon(options = {}) {
  const {
    size = 64,
    color = '#ffc107',
    style = 'default'
  } = options;

  const cacheKey = `folder:${size}:${color}:${style}`;

  return getCachedIcon(cacheKey, () =>
    generateViaOffscreen({
      type: 'folder',
      size,
      color,
      style
    })
  );
}

/**
 * Load icon from URL
 */
export async function loadIconFromUrl(url, options = {}) {
  const { size = 64, fallbackToLetter = true } = options;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('[Icons] Failed to load icon from URL:', url, error);
    if (fallbackToLetter) {
      return generateLetterIcon(url, { size });
    }
    throw error;
  }
}

/**
 * Get best icon for a bookmark
 */
export async function getBookmarkIcon(bookmark, options = {}) {
  const { size = 64 } = options;

  // If it's a folder
  if (!bookmark.url) {
    return generateFolderIcon({ size });
  }

  // Try favicon first
  try {
    const faviconUrl = getFaviconUrl(bookmark.url, size);
    const response = await fetch(faviconUrl);

    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(generateLetterIcon(bookmark.url, { size }));
          reader.readAsDataURL(blob);
        });
      }
    }
  } catch (error) {
    console.warn('[Icons] Favicon fetch failed:', error);
  }

  // Fallback to letter icon
  return generateLetterIcon(bookmark.url, { size });
}

/**
 * Clear icon cache
 */
export async function clearCache() {
  try {
    await caches.delete(CACHE_NAME);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get cache stats
 */
export async function getCacheStats() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const keys = await cache.keys();
    return {
      count: keys.length,
      keys: keys.map(r => r.url)
    };
  } catch (error) {
    return { count: 0, error: error.message };
  }
}

/**
 * Initialize icons module
 */
export async function initIcons() {
  registerHandlers({
    getFaviconUrl: async ({ pageUrl, size }) => getFaviconUrl(pageUrl, size),
    generateLetterIcon: async ({ url, options }) => generateLetterIcon(url, options),
    generateFolderIcon: async ({ options }) => generateFolderIcon(options),
    loadIconFromUrl: async ({ url, options }) => loadIconFromUrl(url, options),
    getBookmarkIcon: async ({ bookmark, options }) => getBookmarkIcon(bookmark, options),
    clearIconCache: async () => clearCache(),
    getIconCacheStats: async () => getCacheStats()
  });

  console.log('[Icons] Module initialized');
}

export default {
  getFaviconUrl,
  generateLetterIcon,
  generateFolderIcon,
  loadIconFromUrl,
  getBookmarkIcon,
  clearCache,
  getCacheStats,
  initIcons
};
