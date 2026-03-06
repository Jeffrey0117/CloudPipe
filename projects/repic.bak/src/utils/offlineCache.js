/**
 * Offline cache for web album images using IndexedDB
 * Caches fetched web images for offline viewing
 */

const DB_NAME = 'repic-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'images';
const MAX_CACHE_SIZE = 200; // Max cached images
const MAX_AGE_DAYS = 30; // Cache expiration

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
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

// Get image from cache
export const getCachedImage = async (url) => {
  try {
    const database = await initDB();

    return new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Check if cache is expired
          const ageMs = Date.now() - result.timestamp;
          const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
          if (ageMs < maxAgeMs) {
            resolve(result.dataUrl);
            return;
          }
        }
        resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) {
    console.error('[OfflineCache] Get error:', e);
    return null;
  }
};

// Save image to cache
export const cacheImage = async (url, dataUrl) => {
  try {
    const database = await initDB();

    const tx = database.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    store.put({
      url,
      dataUrl,
      timestamp: Date.now()
    });

    // Cleanup old entries if cache is too large
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      if (countRequest.result > MAX_CACHE_SIZE) {
        const index = store.index('timestamp');
        const deleteCount = countRequest.result - MAX_CACHE_SIZE + 20;
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
    console.error('[OfflineCache] Save error:', e);
  }
};

// Fetch and cache an image
export const fetchAndCache = async (url) => {
  try {
    // Check cache first
    const cached = await getCachedImage(url);
    if (cached) {
      return cached;
    }

    // Fetch image
    const response = await fetch(url);
    if (!response.ok) throw new Error('Fetch failed');

    const blob = await response.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    // Cache for offline use
    await cacheImage(url, dataUrl);

    return dataUrl;
  } catch (e) {
    // If fetch fails, try cache (might have stale data)
    const cached = await getCachedImage(url);
    if (cached) return cached;
    throw e;
  }
};

// Check if image is cached
export const isCached = async (url) => {
  const cached = await getCachedImage(url);
  return cached !== null;
};

// Clear all cache
export const clearOfflineCache = async () => {
  try {
    const database = await initDB();
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  } catch (e) {
    console.error('[OfflineCache] Clear error:', e);
  }
};

// Get cache stats
export const getCacheStats = async () => {
  try {
    const database = await initDB();
    return new Promise((resolve) => {
      const tx = database.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        resolve({
          count: countRequest.result,
          maxSize: MAX_CACHE_SIZE
        });
      };
      countRequest.onerror = () => resolve({ count: 0, maxSize: MAX_CACHE_SIZE });
    });
  } catch (e) {
    return { count: 0, maxSize: MAX_CACHE_SIZE };
  }
};
