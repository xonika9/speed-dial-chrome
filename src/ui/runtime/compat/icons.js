import { dataUrlToImage, withOptionalCallback } from './utils.js';

async function renderImageOnCanvas(image, canvas, size = 160) {
  if (!canvas || !image) {
    return;
  }

  const context = canvas.getContext('2d');
  if (!context) {
    return;
  }

  const width = size || image.width || canvas.width || 160;
  const height = size || image.height || canvas.height || 160;

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
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
      }).then(dataUrl => dataUrlToImage(dataUrl));
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
