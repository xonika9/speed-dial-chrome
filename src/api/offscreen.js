/**
 * Offscreen API - Manages Offscreen Document for DOM Operations
 * Service workers can't access DOM, so we use offscreen document
 */

import { registerHandlers } from './messaging.js';

let creating = null; // Prevent concurrent creation
const OFFSCREEN_DOCUMENT_PATH = 'src/offscreen/offscreen.html';
const OFFSCREEN_DOCUMENT_URL = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
const NORMALIZED_OFFSCREEN_DOCUMENT_URL = normalizeContextURL(OFFSCREEN_DOCUMENT_URL);

function normalizeContextURL(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);
    parsed.hash = '';

    if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    return url.split('#')[0].replace(/\/$/, '');
  }
}

/**
 * Query existing offscreen contexts.
 * Uses runtime.getContexts when available and falls back to clients.matchAll for Chrome 109 compatibility.
 */
async function getExistingOffscreenContexts() {
  if (chrome.runtime?.getContexts) {
    try {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT']
      });
      return (contexts || []).filter(context => {
        if (!context.documentUrl) {
          return true;
        }

        return normalizeContextURL(context.documentUrl) === NORMALIZED_OFFSCREEN_DOCUMENT_URL;
      });
    } catch (error) {
      console.warn('[Offscreen] runtime.getContexts failed, using fallback:', error);
    }
  }

  if (typeof clients !== 'undefined' && clients.matchAll) {
    try {
      const clientList = await clients.matchAll({
        includeUncontrolled: true,
        type: 'window'
      });
      return clientList.filter(client =>
        normalizeContextURL(client.url) === NORMALIZED_OFFSCREEN_DOCUMENT_URL
      );
    } catch (error) {
      console.warn('[Offscreen] clients.matchAll fallback failed:', error);
    }
  }

  return [];
}

/**
 * Ensure offscreen document exists
 */
async function ensureOffscreenDocument() {
  const existingContexts = await getExistingOffscreenContexts();

  if (existingContexts.length > 0) {
    return true;
  }

  if (creating) {
    await creating;
    return true;
  }

  creating = (async () => {
    try {
      await chrome.offscreen.createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ['DOM_PARSER', 'BLOBS'],
        justification: 'Parse XML/HTML and generate icons using canvas'
      });
    } catch (error) {
      console.error('[Offscreen] Failed to create offscreen document', {
        error: error?.message || String(error),
        hasGetContexts: Boolean(chrome.runtime?.getContexts),
        offscreenUrl: OFFSCREEN_DOCUMENT_URL
      });
      throw error;
    }
  })();

  try {
    await creating;
  } finally {
    creating = null;
  }
  return true;
}

/**
 * Send message to offscreen document
 */
async function sendToOffscreen(action, data = {}) {
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { target: 'offscreen', action, ...data },
      response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.error) {
          reject(new Error(response.error));
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Parse XML string using DOMParser
 */
export async function parseXML(xmlString, mimeType = 'text/xml') {
  const response = await sendToOffscreen('parseXML', { xmlString, mimeType });
  return response.document;
}

/**
 * Parse HTML string
 */
export async function parseHTML(htmlString) {
  const response = await sendToOffscreen('parseHTML', { htmlString });
  return response.document;
}

/**
 * Generate icon using canvas
 */
export async function generateIcon(options) {
  const response = await sendToOffscreen('generateIcon', options);
  return response.dataUrl;
}

/**
 * Resize image using canvas
 */
export async function resizeImage(dataUrl, width, height) {
  const response = await sendToOffscreen('resizeImage', { dataUrl, width, height });
  return response.dataUrl;
}

/**
 * Create thumbnail from image
 */
export async function createThumbnail(dataUrl, maxSize = 128) {
  const response = await sendToOffscreen('createThumbnail', { dataUrl, maxSize });
  return response.dataUrl;
}

/**
 * Convert image to different format
 */
export async function convertImage(dataUrl, format = 'image/png', quality = 0.92) {
  const response = await sendToOffscreen('convertImage', { dataUrl, format, quality });
  return response.dataUrl;
}

/**
 * Check if offscreen document exists
 */
export async function hasOffscreenDocument() {
  const existingContexts = await getExistingOffscreenContexts();
  return existingContexts.length > 0;
}

/**
 * Close offscreen document
 */
export async function closeOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
    return true;
  }
  return false;
}

/**
 * Initialize offscreen module
 */
export function initOffscreen() {
  registerHandlers({
    parseXML: async ({ xmlString, mimeType }) => parseXML(xmlString, mimeType),
    parseHTML: async ({ htmlString }) => parseHTML(htmlString),
    generateIcon: async (options) => generateIcon(options),
    resizeImage: async ({ dataUrl, width, height }) => resizeImage(dataUrl, width, height),
    createThumbnail: async ({ dataUrl, maxSize }) => createThumbnail(dataUrl, maxSize),
    convertImage: async ({ dataUrl, format, quality }) => convertImage(dataUrl, format, quality),
    hasOffscreenDocument: async () => hasOffscreenDocument(),
    closeOffscreenDocument: async () => closeOffscreenDocument()
  });

  console.log('[Offscreen] Module initialized');
}

export default {
  parseXML,
  parseHTML,
  generateIcon,
  resizeImage,
  createThumbnail,
  convertImage,
  hasOffscreenDocument,
  closeOffscreenDocument,
  initOffscreen
};
