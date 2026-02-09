/**
 * Remote Cache API
 * Serves cached responses for cache.web-accessories.com in MV3 service worker.
 */

const REMOTE_CACHE_ORIGIN = 'https://cache.web-accessories.com/';
const NOT_FOUND = new Response(null, { status: 404 });

function resolveCacheBucket(pathname) {
  if (pathname.startsWith('/icon/')) {
    return 'icon';
  }
  if (pathname.startsWith('/wallpaper/')) {
    return 'wallpaper';
  }
  if (pathname.startsWith('/settings/')) {
    return 'settings';
  }
  return null;
}

/**
 * Returns a response promise for remote cache requests, otherwise null.
 */
export function handleRemoteCacheFetch(request) {
  if (!request || typeof request.url !== 'string') {
    return null;
  }

  if (request.method && request.method.toUpperCase() !== 'GET') {
    return null;
  }

  if (!request.url.startsWith(REMOTE_CACHE_ORIGIN)) {
    return null;
  }

  const { pathname } = new URL(request.url);
  const bucket = resolveCacheBucket(pathname);

  if (!bucket) {
    return Promise.resolve(NOT_FOUND.clone());
  }

  return caches
    .open(bucket)
    .then(cache => cache.match(request.url))
    .then(response => response || NOT_FOUND.clone());
}

export function initRemoteCache() {
  console.log('[RemoteCache] Module initialized');
}

export default {
  handleRemoteCacheFetch,
  initRemoteCache
};
