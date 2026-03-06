/**
 * Thumbnail cache using IndexedDB
 * Stores generated thumbnails to avoid re-processing large images
 */

const DB_NAME = 'repic-thumbnail-cache';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';
const MAX_CACHE_SIZE = 500; // Max number of cached thumbnails
const THUMB_SIZE = 200; // Thumbnail max dimension

let db = null;

// Initialize IndexedDB
const initDB = () => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Generate cache key from file path and modification time
const getCacheKey = (filePath, mtime) => {
  return `${filePath}:${mtime || 0}`;
};

// Get thumbnail from cache
export const getThumbnail = async (filePath, mtime) => {
  try {
    const database = await initDB();
    const key = getCacheKey(filePath, mtime);

    return new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.dataUrl);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error('[ThumbnailCache] Get error:', e);
    return null;
  }
};

// Save thumbnail to cache
export const saveThumbnail = async (filePath, mtime, dataUrl) => {
  try {
    const database = await initDB();
    const key = getCacheKey(filePath, mtime);

    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      key,
      filePath,
      dataUrl,
      timestamp: Date.now()
    });

    // Cleanup old entries if cache is too large
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > MAX_CACHE_SIZE) {
        // Delete oldest entries
        const index = store.index('timestamp');
        const deleteCount = countRequest.result - MAX_CACHE_SIZE + 50; // Delete 50 extra
        let deleted = 0;

        index.openCursor().onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor && deleted < deleteCount) {
            store.delete(cursor.primaryKey);
            deleted++;
            cursor.continue();
          }
        };
      }
    };
  } catch (e) {
    console.error('[ThumbnailCache] Save error:', e);
  }
};

// Generate thumbnail from image source
export const generateThumbnail = (imageSrc) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Calculate thumbnail dimensions (maintain aspect ratio)
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > height) {
          if (width > THUMB_SIZE) {
            height = Math.round((height * THUMB_SIZE) / width);
            width = THUMB_SIZE;
          }
        } else {
          if (height > THUMB_SIZE) {
            width = Math.round((width * THUMB_SIZE) / height);
            height = THUMB_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      } catch (e) {
        reject(e);
      }
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = imageSrc;
  });
};

// Batch generate thumbnails using Go (faster than Canvas)
export const batchGenerateThumbnails = async (sources) => {
  const electronAPI = window.electronAPI;

  if (electronAPI?.batchThumbnails) {
    try {
      const result = await electronAPI.batchThumbnails(sources, { size: THUMB_SIZE, base64: true });
      if (result && result.completed > 0) {
        // Build a map of source -> base64
        const thumbnailMap = {};
        for (const item of result.items) {
          if (item.success && item.base64) {
            thumbnailMap[item.source] = item.base64;
          }
        }
        console.log(`[ThumbnailCache] Go generated ${result.completed}/${result.total} thumbnails in ${result.duration_ms}ms`);
        return thumbnailMap;
      }
    } catch (e) {
      console.error('[ThumbnailCache] Go batch failed:', e);
    }
  }

  // Fallback: generate one by one with Canvas
  console.log('[ThumbnailCache] Using Canvas fallback');
  const thumbnailMap = {};
  for (const src of sources) {
    try {
      thumbnailMap[src] = await generateThumbnail(src);
    } catch (e) {
      console.warn('[ThumbnailCache] Canvas failed for:', src);
    }
  }
  return thumbnailMap;
};

// Clear all cache
export const clearCache = async () => {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (e) {
    console.error('[ThumbnailCache] Clear error:', e);
  }
};
