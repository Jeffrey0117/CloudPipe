/**
 * Optimized image loader with:
 * - Concurrent request limiting (prevents network congestion)
 * - Priority queue (visible images first)
 * - Memory cache (instant subsequent loads)
 * - IndexedDB persistence (offline support)
 * - Thumbnail generation (fast sidebar loading)
 */

import { getCachedImage, cacheImage } from './offlineCache';

// Configuration
const MAX_CONCURRENT = 6; // Max simultaneous downloads
const PRIORITY_HIGH = 0;
const PRIORITY_NORMAL = 1;
const PRIORITY_LOW = 2;

// Thumbnail config
const THUMB_SIZE = 256; // Max dimension
const THUMB_QUALITY = 0.7; // JPEG quality (0.7 = ~10KB per thumb)
const THUMB_PREFIX = 'thumb:';

// Cache limits (LRU eviction)
const MAX_MEMORY_CACHE = 50; // ~50 full images (~50MB max)
const MAX_THUMB_CACHE = 200; // ~200 thumbnails (~2MB max)

/**
 * Simple LRU Cache implementation using Map's insertion order
 */
class LRUCache {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Move to end (most recently used)
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key, value) {
    // Delete if exists to update order
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, value);
    // Evict oldest if over limit
    if (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value;
      this.cache.delete(oldest);
    }
  }

  has(key) {
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  get size() {
    return this.cache.size;
  }
}

// State
const memoryCache = new LRUCache(MAX_MEMORY_CACHE); // URL -> base64/blob URL
const thumbCache = new LRUCache(MAX_THUMB_CACHE); // URL -> thumbnail base64
const loadingPromises = new Map(); // URL -> Promise (dedup concurrent requests)
const abortControllers = new Map(); // URL -> AbortController (for cancellation)
const queue = []; // Priority queue: { url, priority, resolve, reject }
let activeCount = 0;
let cancelGeneration = 0; // Incremented on cancelAll(), used to detect stale requests

/**
 * Generate thumbnail from base64 image data
 * Returns JPEG base64, ~5-15KB per image
 */
const generateThumbnail = (base64) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Calculate size maintaining aspect ratio
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > THUMB_SIZE) {
          h = Math.round(h * THUMB_SIZE / w);
          w = THUMB_SIZE;
        }
      } else {
        if (h > THUMB_SIZE) {
          w = Math.round(w * THUMB_SIZE / h);
          h = THUMB_SIZE;
        }
      }

      // Draw to canvas
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      // Export as JPEG (smaller than PNG)
      const thumbData = canvas.toDataURL('image/jpeg', THUMB_QUALITY);
      resolve(thumbData);
    };
    img.onerror = () => resolve(null);
    img.src = base64;
  });
};

/**
 * Insert item into queue maintaining priority order (binary search)
 */
const enqueue = (item) => {
  // Binary search for insert position
  let lo = 0, hi = queue.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (queue[mid].priority <= item.priority) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  queue.splice(lo, 0, item);
};

/**
 * Process the next item in the queue
 */
const processQueue = () => {
  if (activeCount >= MAX_CONCURRENT || queue.length === 0) return;

  // Queue is already sorted, just take first item
  const item = queue.shift();
  if (!item) return;

  // Capture generation to detect if cancelled
  const myGeneration = cancelGeneration;

  activeCount++;

  fetchImage(item.url)
    .then(item.resolve)
    .catch(item.reject)
    .finally(() => {
      // Only decrement if not cancelled (cancelAll resets activeCount)
      if (cancelGeneration === myGeneration) {
        activeCount--;
        processQueue(); // Process next
      }
    });
};

/**
 * Fetch a single image with caching + thumbnail generation
 */
const fetchImage = async (url) => {
  // Capture current generation to detect if cancelled during async operations
  const myGeneration = cancelGeneration;

  // Check memory cache first (instant)
  if (memoryCache.has(url)) {
    return memoryCache.get(url);
  }

  // Check IndexedDB cache (fast)
  try {
    const cached = await getCachedImage(url);
    // Check if cancelled while waiting for cache
    if (cancelGeneration !== myGeneration) {
      throw new DOMException('Cancelled', 'AbortError');
    }
    if (cached) {
      memoryCache.set(url, cached);
      // Also try to load cached thumbnail
      const cachedThumb = await getCachedImage(THUMB_PREFIX + url);
      if (cachedThumb) {
        thumbCache.set(url, cachedThumb);
      } else {
        // Generate thumbnail from cached full image
        generateThumbnail(cached).then(thumb => {
          if (thumb) {
            thumbCache.set(url, thumb);
            cacheImage(THUMB_PREFIX + url, thumb).catch(() => {});
          }
        });
      }
      return cached;
    }
  } catch (e) {
    // Re-throw AbortError, ignore other cache errors
    if (e?.name === 'AbortError') throw e;
  }

  // Check again if cancelled before starting network request
  if (cancelGeneration !== myGeneration) {
    throw new DOMException('Cancelled', 'AbortError');
  }

  // Create AbortController for this request
  const controller = new AbortController();
  abortControllers.set(url, controller);

  // Fetch from network
  let response;
  try {
    response = await fetch(url, {
      mode: 'cors',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: controller.signal
    });
  } finally {
    abortControllers.delete(url);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();

  // Convert to base64 for caching
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Store in caches
  memoryCache.set(url, base64);
  cacheImage(url, base64).catch(() => {}); // Async, don't wait

  // Generate and cache thumbnail (async, don't block)
  generateThumbnail(base64).then(thumb => {
    if (thumb) {
      thumbCache.set(url, thumb);
      cacheImage(THUMB_PREFIX + url, thumb).catch(() => {});
    }
  });

  return base64;
};

/**
 * Load an image with priority
 * @param {string} url - Image URL
 * @param {number} priority - 0=high, 1=normal, 2=low
 * @returns {Promise<string>} - Resolved image data (base64 or blob URL)
 */
export const loadImage = (url, priority = PRIORITY_NORMAL) => {
  if (!url || !url.startsWith('http')) {
    return Promise.reject(new Error('Invalid URL'));
  }

  // Return from memory cache immediately
  if (memoryCache.has(url)) {
    return Promise.resolve(memoryCache.get(url));
  }

  // Dedup: if already loading this URL, return existing promise
  if (loadingPromises.has(url)) {
    return loadingPromises.get(url);
  }

  // Create new loading promise
  const promise = new Promise((resolve, reject) => {
    enqueue({ url, priority, resolve, reject });
    processQueue();
  });

  loadingPromises.set(url, promise);

  // Clean up promise map when done
  promise.finally(() => {
    loadingPromises.delete(url);
  });

  return promise;
};

/**
 * Load thumbnail only (much faster for sidebar)
 * Returns cached thumbnail immediately if available
 * Otherwise loads full image and generates thumbnail
 * Falls back to full image if thumbnail generation fails (e.g., GIFs)
 */
export const loadThumbnail = async (url) => {
  if (!url || !url.startsWith('http')) {
    return null;
  }

  // Check memory cache first
  if (thumbCache.has(url)) {
    return thumbCache.get(url);
  }

  // Check IndexedDB for cached thumbnail
  try {
    const cached = await getCachedImage(THUMB_PREFIX + url);
    if (cached) {
      thumbCache.set(url, cached);
      return cached;
    }
  } catch (e) {
    // Ignore
  }

  // No thumbnail cached, need to load full image first
  // This will also generate thumbnail
  const fullImage = await loadImage(url, PRIORITY_NORMAL);

  // Return thumbnail if available, otherwise fall back to full image
  // This handles cases like GIFs where thumbnail generation might fail
  return thumbCache.get(url) || fullImage;
};

/**
 * Get cached thumbnail synchronously (or null)
 */
export const getCachedThumbnail = (url) => {
  return thumbCache.get(url) || null;
};

/**
 * Preload thumbnails for URLs (for sidebar)
 * Parallel batch processing for fast cache checking
 */
export const preloadThumbnails = async (urls) => {
  // Filter out already-cached URLs
  const uncached = urls.filter(url => url && !thumbCache.has(url));
  if (uncached.length === 0) return;

  // Check IndexedDB in parallel batches (much faster than sequential)
  const BATCH_SIZE = 8;
  for (let i = 0; i < uncached.length; i += BATCH_SIZE) {
    const batch = uncached.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const cached = await getCachedImage(THUMB_PREFIX + url);
        if (cached) {
          thumbCache.set(url, cached);
          return { url, cached: true };
        }
        return { url, cached: false };
      })
    );

    // Queue uncached URLs for background loading
    for (const result of results) {
      if (result.status === 'fulfilled' && !result.value.cached) {
        loadImage(result.value.url, PRIORITY_LOW).catch(() => {});
      }
    }
  }
};

/**
 * Check if image is already cached
 */
export const isImageCached = (url) => {
  return memoryCache.has(url);
};

/**
 * Get cached image synchronously (or null)
 */
export const getCached = (url) => {
  return memoryCache.get(url) || null;
};

/**
 * Preload images in background (low priority)
 */
export const preloadImages = (urls) => {
  urls.forEach(url => {
    if (url && !memoryCache.has(url)) {
      loadImage(url, PRIORITY_LOW).catch(() => {});
    }
  });
};

/**
 * Cancel pending loads for URLs (when user navigates away)
 */
export const cancelPending = (urls) => {
  const urlSet = new Set(urls);
  // Remove from queue
  for (let i = queue.length - 1; i >= 0; i--) {
    if (urlSet.has(queue[i].url)) {
      queue.splice(i, 1);
    }
  }
  // Abort in-flight requests
  for (const url of urls) {
    const controller = abortControllers.get(url);
    if (controller) {
      controller.abort();
      abortControllers.delete(url);
    }
  }
};

/**
 * Cancel ALL pending and in-flight requests (for album switch)
 */
export const cancelAll = () => {
  // Increment generation to invalidate any in-progress async operations
  cancelGeneration++;

  // Clear the queue
  queue.length = 0;

  // Abort all in-flight requests
  for (const controller of abortControllers.values()) {
    controller.abort();
  }
  abortControllers.clear();

  // Clear loading promises (they will reject due to abort)
  loadingPromises.clear();

  // Reset active count to allow new requests immediately
  activeCount = 0;
};

/**
 * Clear memory cache (for memory management)
 */
export const clearMemoryCache = () => {
  memoryCache.clear();
  thumbCache.clear();
};

/**
 * Cache a proxy result (for images that needed proxy due to CORS)
 * Also generates and caches thumbnail
 */
export const cacheProxyResult = (url, base64Data) => {
  if (!url || !base64Data) return;

  // Cache the full image
  memoryCache.set(url, base64Data);
  cacheImage(url, base64Data).catch(() => {});

  // Generate and cache thumbnail (async, don't block)
  generateThumbnail(base64Data).then(thumb => {
    if (thumb) {
      thumbCache.set(url, thumb);
      cacheImage(THUMB_PREFIX + url, thumb).catch(() => {});
    }
  });
};

/**
 * Get loader stats (for debugging)
 */
export const getStats = () => ({
  memoryCacheSize: memoryCache.size,
  memoryCacheMax: MAX_MEMORY_CACHE,
  thumbCacheSize: thumbCache.size,
  thumbCacheMax: MAX_THUMB_CACHE,
  queueLength: queue.length,
  activeCount,
  maxConcurrent: MAX_CONCURRENT
});

// Priority exports
export { PRIORITY_HIGH, PRIORITY_NORMAL, PRIORITY_LOW };
