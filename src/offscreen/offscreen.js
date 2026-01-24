/**
 * Offscreen Document Script
 * Handles DOM operations that service worker can't do
 */

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only handle messages targeted at offscreen document
  if (message.target !== 'offscreen') {
    return false;
  }

  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ error: error.message }));

  return true; // Keep channel open for async response
});

/**
 * Handle incoming messages
 */
async function handleMessage(message) {
  const { action, ...data } = message;

  switch (action) {
    case 'parseXML':
      return parseXML(data.xmlString, data.mimeType);

    case 'parseHTML':
      return parseHTML(data.htmlString);

    case 'generateIcon':
      return generateIcon(data);

    case 'resizeImage':
      return resizeImage(data.dataUrl, data.width, data.height);

    case 'createThumbnail':
      return createThumbnail(data.dataUrl, data.maxSize);

    case 'convertImage':
      return convertImage(data.dataUrl, data.format, data.quality);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Parse XML string using DOMParser
 */
function parseXML(xmlString, mimeType = 'text/xml') {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, mimeType);

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('XML parse error: ' + parseError.textContent);
  }

  // Serialize DOM to transferable format
  return { document: serializeNode(doc.documentElement) };
}

/**
 * Parse HTML string
 */
function parseHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  return { document: serializeNode(doc.documentElement) };
}

/**
 * Serialize DOM node to transferable object
 */
function serializeNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    return {
      type: 'text',
      content: node.textContent
    };
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const attributes = {};
    for (const attr of node.attributes) {
      attributes[attr.name] = attr.value;
    }

    return {
      type: 'element',
      tagName: node.tagName.toLowerCase(),
      attributes,
      children: Array.from(node.childNodes).map(serializeNode)
    };
  }

  return { type: 'unknown' };
}

/**
 * Generate icon using canvas
 */
async function generateIcon(options) {
  const { type, size = 64 } = options;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  switch (type) {
    case 'letter':
      drawLetterIcon(ctx, options);
      break;

    case 'folder':
      drawFolderIcon(ctx, options);
      break;

    default:
      throw new Error(`Unknown icon type: ${type}`);
  }

  return { dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Draw letter icon
 */
function drawLetterIcon(ctx, options) {
  const {
    letter,
    size = 64,
    fontSize = 32,
    backgroundColor = '#4285f4',
    textColor = '#ffffff'
  } = options;

  // Background
  ctx.fillStyle = backgroundColor;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // Letter
  ctx.fillStyle = textColor;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, size / 2, size / 2);
}

/**
 * Draw folder icon
 */
function drawFolderIcon(ctx, options) {
  const {
    size = 64,
    color = '#ffc107'
  } = options;

  const padding = size * 0.1;
  const width = size - padding * 2;
  const height = width * 0.8;
  const tabWidth = width * 0.4;
  const tabHeight = height * 0.15;
  const radius = size * 0.05;

  ctx.fillStyle = color;

  // Folder body
  ctx.beginPath();
  ctx.moveTo(padding + radius, padding + tabHeight);
  ctx.lineTo(padding + tabWidth, padding + tabHeight);
  ctx.lineTo(padding + tabWidth + tabHeight, padding);
  ctx.lineTo(padding + width - radius, padding);
  ctx.arcTo(padding + width, padding, padding + width, padding + radius, radius);
  ctx.lineTo(padding + width, padding + height - radius);
  ctx.arcTo(padding + width, padding + height, padding + width - radius, padding + height, radius);
  ctx.lineTo(padding + radius, padding + height);
  ctx.arcTo(padding, padding + height, padding, padding + height - radius, radius);
  ctx.lineTo(padding, padding + tabHeight + radius);
  ctx.arcTo(padding, padding + tabHeight, padding + radius, padding + tabHeight, radius);
  ctx.fill();
}

/**
 * Resize image using canvas
 */
async function resizeImage(dataUrl, width, height) {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Create thumbnail maintaining aspect ratio
 */
async function createThumbnail(dataUrl, maxSize = 128) {
  const img = await loadImage(dataUrl);

  let width = img.width;
  let height = img.height;

  if (width > height) {
    if (width > maxSize) {
      height = Math.round(height * maxSize / width);
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = Math.round(width * maxSize / height);
      height = maxSize;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0, width, height);

  return { dataUrl: canvas.toDataURL('image/png') };
}

/**
 * Convert image to different format
 */
async function convertImage(dataUrl, format = 'image/png', quality = 0.92) {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(img, 0, 0);

  return { dataUrl: canvas.toDataURL(format, quality) };
}

/**
 * Load image from data URL
 */
function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

console.log('[Offscreen] Document loaded');
