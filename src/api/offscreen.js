/**
 * Offscreen API - Manages Offscreen Document for DOM Operations
 * Service workers can't access DOM, so we use offscreen document
 */

import { registerHandlers } from './messaging.js';

let creating = null; // Prevent concurrent creation

/**
 * Ensure offscreen document exists
 */
async function ensureOffscreenDocument() {
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });

  if (existingContexts.length > 0) {
    return true;
  }

  if (creating) {
    await creating;
    return true;
  }

  creating = chrome.offscreen.createDocument({
    url: 'src/offscreen/offscreen.html',
    reasons: ['DOM_PARSER', 'CANVAS'],
    justification: 'Parse XML/HTML and generate icons using canvas'
  });

  await creating;
  creating = null;
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
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  });
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
