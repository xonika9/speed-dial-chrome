import { dataUrlToImage, withOptionalCallback } from './utils.js';

const PREFERRED_MIN_SIZE = 57;

async function renderImageOnCanvas(image, canvas, size = 160) {
  if (!canvas || !image) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  // Match legacy: scale canvas backing store by devicePixelRatio for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  const logicalSize = size || image.width || canvas.width || 160;
  const backingSize = Math.round(logicalSize * dpr);

  canvas.width = backingSize;
  canvas.height = backingSize;

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  const imgW = image.naturalWidth || image.width || backingSize;
  const imgH = image.naturalHeight || image.height || backingSize;

  if (imgW >= PREFERRED_MIN_SIZE) {
    // Good quality source — draw scaled to fill
    if (imgW === imgH) {
      context.drawImage(image, 0, 0, backingSize, backingSize);
    } else {
      // Preserve aspect ratio (match legacy)
      const hr = backingSize / imgW;
      const vr = backingSize / imgH;
      const r = Math.min(hr, vr);
      const tw = imgW * r;
      const th = imgH * r;
      const cx = (backingSize - tw) / 2;
      const cy = (backingSize - th) / 2;
      context.drawImage(image, 0, 0, imgW, imgH, cx, cy, tw, th);
    }
  } else {
    // Small source (e.g. 16x16 favicon) — render on colored background with centered icon
    // Sample a pixel for background color, then draw icon centered at reasonable size
    context.fillStyle = '#536168';
    context.fillRect(0, 0, backingSize, backingSize);
    context.imageSmoothingEnabled = false;
    // Sample color from favicon
    context.drawImage(image, 2, Math.floor(imgH / 2), 1, 1, 0, 0, backingSize, backingSize);
    context.imageSmoothingEnabled = true;
    // White circle backdrop
    context.fillStyle = 'rgba(255,255,255,0.65)';
    context.beginPath();
    context.arc(backingSize / 2, backingSize / 2, backingSize * 0.3, 0, 2 * Math.PI);
    context.fill();
    // Draw favicon centered at 30% of canvas
    context.drawImage(image, backingSize * 0.35, backingSize * 0.35, backingSize * 0.3, backingSize * 0.3);
  }
}

function renderIcon(source, canvas, size = 160) {
  if (!source || !canvas) {
    return Promise.resolve();
  }

  if (typeof source === 'string') {
    return dataUrlToImage(source).then(image => renderImageOnCanvas(image, canvas, size));
  }

  if (source instanceof ImageBitmap || source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) {
    return renderImageOnCanvas(source, canvas, size);
  }

  return Promise.resolve();
}

export function createIconsCompat(sendMessage, eventBus) {
  const iconsUtil = {
    getCacheURL(url) {
      return `icon://${encodeURIComponent(url || '')}`;
    },
    loadIcon(url) {
      return dataUrlToImage(url);
    },
    renderIcon
  };

  const icons = {
    getIconImageBitmap(url, id, callback) {
      const result = sendMessage('getBookmarkIcon', {
        bookmark: { id, url },
        options: { size: 160 }
      })
        .then(iconSrc => dataUrlToImage(iconSrc))
        .catch(() => {
          // WA icon URL may fail to load (stale, CORS, offline) — fall back to Chrome favicon
          const faviconUrl = `${chrome.runtime.getURL('/_favicon/')}?pageUrl=${encodeURIComponent(url)}&size=48`;
          return dataUrlToImage(faviconUrl);
        });
      return withOptionalCallback(result, callback);
    },
    clearCache(callback) {
      const result = sendMessage('clearIconCache')
        .then(response => {
          eventBus.dispatch('icons/invalidate');
          return response;
        });
      return withOptionalCallback(result, callback);
    },
    countCached(callback) {
      const result = sendMessage('getIconCacheStats')
        .then(stats => Number(stats?.count || 0));
      return withOptionalCallback(result, callback);
    },
    invalidate() {
      eventBus.dispatch('icons/invalidate');
    }
  };

  return { icons, iconsUtil };
}

export default {
  createIconsCompat
};
