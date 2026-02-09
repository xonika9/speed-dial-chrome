function isPromiseLike(value) {
  return Boolean(value && typeof value.then === 'function');
}

export function withOptionalCallback(result, callback) {
  if (typeof callback !== 'function') {
    return result;
  }

  Promise.resolve(result)
    .then(value => callback(value))
    .catch(error => {
      console.error('[Compat] Callback-wrapped call failed', error);
      callback(null);
    });

  return result;
}

export function createMessageSender() {
  return function sendMessage(action, data = {}) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action, ...data }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        if (response && response.error) {
          reject(new Error(response.error));
          return;
        }

        resolve(response);
      });
    });
  };
}

export function createClipboardUtil() {
  let timestamp = null;
  let data = null;

  return {
    setData(newTimestamp, newData) {
      timestamp = newTimestamp;
      data = newData;
    },
    getData() {
      return data;
    },
    getTS() {
      return timestamp;
    }
  };
}

export function createDndUtil() {
  let data = null;

  return {
    setData(newData) {
      data = newData;
    },
    getData() {
      return data;
    },
    clearData() {
      data = null;
    },
    hasData() {
      return data !== null;
    }
  };
}

function nodesToHtml(nodes) {
  return nodes
    .map(node => (
      node.url
        ? `<a href="${node.url}">${node.title || node.url}</a>`
        : `<a href="chrome://newtab/#bookmarks?${node.id}">${node.title || node.id}</a>`
    ))
    .join('<br>\n');
}

function nodesToText(nodes) {
  return nodes
    .map(node => (node.url ? node.url : `chrome://newtab/#bookmarks?${node.id}`))
    .join('\n');
}

export function createDataExport() {
  return {
    exportToEventData(eventData, nodes) {
      if (!eventData || !Array.isArray(nodes)) {
        return;
      }
      eventData.setData('text/plain', nodesToText(nodes));
      eventData.setData('text/html', nodesToHtml(nodes));
    }
  };
}

function importFromUriList(uriList) {
  return uriList
    .trim()
    .split('\n')
    .map(line => line.trim())
    .filter(line => Boolean(line) && !line.startsWith('#'))
    .map(url => ({ url, title: url }));
}

function importFromHtml(html) {
  const parser = new DOMParser();
  const documentRoot = parser.parseFromString(html, 'text/html');
  const links = Array.from(documentRoot.querySelectorAll('a'));
  return links
    .map(anchor => {
      const url = anchor.getAttribute('href');
      if (!url) {
        return null;
      }
      const title = (anchor.textContent || '').trim() || url;
      return { url, title };
    })
    .filter(Boolean);
}

export function createDataImport(bookmarks) {
  return {
    importFromEventData(eventData, parentId, index, callback) {
      if (!eventData || !bookmarks?.safecreatemany) {
        return withOptionalCallback(Promise.resolve([]), callback);
      }

      let nodes = [];
      const html = eventData.getData('text/html');
      const uriList = eventData.getData('text/uri-list');

      if (html) {
        nodes = importFromHtml(html);
      } else if (uriList) {
        nodes = importFromUriList(uriList);
      }

      const result = bookmarks.safecreatemany(parentId, index, nodes);
      return withOptionalCallback(result, callback);
    }
  };
}

export function createStringUtil() {
  function parseURLMapping(text) {
    const mapping = {};
    const lines = String(text || '').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const parts = trimmed.split('>');
      if (parts.length !== 2) {
        continue;
      }
      mapping[parts[0].trim()] = parts[1].trim();
    }
    return mapping;
  }

  function stringifyURLMapping(mapping) {
    return Object.entries(mapping)
      .map(([key, value]) => `${key}>${value}`)
      .join('\n');
  }

  return {
    parseURLMapping,
    addURLMapping(text, fromUrl, toUrl) {
      const mapping = parseURLMapping(text);
      if (typeof fromUrl === 'string' && typeof toUrl === 'string' && fromUrl.trim() && toUrl.trim()) {
        mapping[fromUrl.trim()] = toUrl.trim();
      }
      return stringifyURLMapping(mapping);
    },
    removeURLMapping(text, fromUrl) {
      const mapping = parseURLMapping(text);
      if (typeof fromUrl === 'string' && fromUrl.trim()) {
        delete mapping[fromUrl.trim()];
      }
      return stringifyURLMapping(mapping);
    },
    formatCounter1K(value) {
      const numericValue = Number(value || 0);
      if (numericValue >= 1000) {
        return `${Math.round(numericValue / 100) / 10}k`;
      }
      return `${numericValue}`;
    }
  };
}

export function createUriUtil() {
  return {
    isValid(url) {
      if (typeof url !== 'string' || !url.trim()) {
        return false;
      }
      try {
        const parsed = new URL(url);
        return Boolean(parsed.protocol && parsed.hostname);
      } catch {
        return false;
      }
    },
    resolveRelative(baseUrl, relativeUrl) {
      return new URL(relativeUrl, baseUrl).toString();
    },
    getPathname(url) {
      return new URL(url).pathname;
    },
    hasDomain(url, domain) {
      try {
        return new URL(url).hostname.endsWith(domain);
      } catch {
        return false;
      }
    }
  };
}

export async function dataUrlToImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length === 0) {
    return null;
  }

  const image = new Image();
  const loaded = new Promise((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = reject;
  });
  image.src = dataUrl;
  return loaded;
}

export function isAsyncValue(value) {
  return isPromiseLike(value);
}
