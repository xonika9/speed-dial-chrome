import { withOptionalCallback } from './utils.js';

function traverseTree(node, callback) {
  if (!node) {
    return;
  }
  callback(node);
  if (Array.isArray(node.children)) {
    node.children.forEach(child => traverseTree(child, callback));
  }
}

export function createBookmarksCompat(sendMessage, eventBus) {
  function dispatchChange() {
    eventBus.dispatch('bookmarks/change');
  }

  function withMutationDispatch(result) {
    return Promise.resolve(result).then(value => {
      dispatchChange();
      return value;
    });
  }

  const bookmarks = {
    getChildren(id = '1', callback) {
      return withOptionalCallback(sendMessage('getBookmarkChildren', { id }), callback);
    },
    getSingle(id, callback) {
      return withOptionalCallback(sendMessage('getBookmark', { id }), callback);
    },
    getSubTree(id = '0', callback) {
      const result = sendMessage('getBookmarkSubTree', { id })
        .then(node => (node ? [node] : []));
      return withOptionalCallback(result, callback);
    },
    getTree(callback) {
      return withOptionalCallback(sendMessage('getBookmarkTree'), callback);
    },
    getPath(id, callback) {
      return withOptionalCallback(sendMessage('getBookmarkPath', { id }), callback);
    },
    search(query, callback) {
      return withOptionalCallback(sendMessage('searchBookmarks', { query }), callback);
    },
    create(bookmark, callback) {
      const result = withMutationDispatch(sendMessage('createBookmark', bookmark))
        .then(node => {
          if (node && node.id) {
            eventBus.dispatch('bookmarks/created', { id: node.id, bookmark: node });
          }
          return node;
        });
      return withOptionalCallback(result, callback);
    },
    safecreate(bookmark, callback) {
      const result = withMutationDispatch(sendMessage('createBookmarkSafe', bookmark))
        .then(response => {
          const node = response?.bookmark || null;
          if (node && !response?.exists) {
            eventBus.dispatch('bookmarks/created', { id: node.id, bookmark: node });
          }
          return node;
        });
      return withOptionalCallback(result, callback);
    },
    safecreatemany(parentId, index, bookmarkTreeNodes, callback) {
      const result = withMutationDispatch(sendMessage('safeCreateManyBookmarks', {
        parentId,
        index,
        bookmarks: bookmarkTreeNodes || []
      }));
      return withOptionalCallback(result, callback);
    },
    update(id, changes, callback) {
      const result = withMutationDispatch(sendMessage('updateBookmark', { id, changes }));
      return withOptionalCallback(result, callback);
    },
    move(id, destination, callback) {
      const result = withMutationDispatch(sendMessage('moveBookmark', { id, destination }));
      return withOptionalCallback(result, callback);
    },
    moveMany(ids, parentId, index, callback) {
      const result = withMutationDispatch(sendMessage('moveManyBookmarks', {
        ids,
        parentId,
        index
      }));
      return withOptionalCallback(result, callback);
    },
    reorderByTitle(parentId, callback) {
      const result = withMutationDispatch(sendMessage('reorderBookmarksByTitle', { parentId }));
      return withOptionalCallback(result, callback);
    },
    remove(id, callback) {
      const result = withMutationDispatch(sendMessage('removeBookmark', { id }))
        .then(response => {
          eventBus.dispatch('bookmarks/removed', { id, removeInfo: {} });
          return response;
        });
      return withOptionalCallback(result, callback);
    },
    removeTree(id, callback) {
      const result = withMutationDispatch(sendMessage('removeBookmarkTree', { id }))
        .then(response => {
          eventBus.dispatch('bookmarks/removed', { id, removeInfo: {} });
          return response;
        });
      return withOptionalCallback(result, callback);
    },
    getAllURLS(idOrArray, callback) {
      const ids = Array.isArray(idOrArray) ? idOrArray : [idOrArray];
      const result = Promise.all(ids.map(id => sendMessage('getBookmarkSubTree', { id })))
        .then(nodes => {
          const urls = [];
          nodes.forEach(rootNode => {
            traverseTree(rootNode, node => {
              if (node?.url) {
                urls.push(node.url);
              }
            });
          });
          return urls;
        });
      return withOptionalCallback(result, callback);
    }
  };

  return bookmarks;
}

export default {
  createBookmarksCompat
};
