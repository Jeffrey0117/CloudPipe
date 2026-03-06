/**
 * Prefetch Manager - Sliding window image prefetching via Go
 *
 * Concept:
 * - Download images to local temp files via Go (fast, bypasses CORS)
 * - Keep only a window of images around current index
 * - Use file:// URLs for instant display
 */

const electronAPI = window.electronAPI || null;

// Config
const WINDOW_SIZE = 10; // Prefetch currentIndex ± 10

// State
const localPathCache = new Map(); // URL -> local file path
const pendingUrls = new Set(); // URLs currently being prefetched
let currentPrefetchId = 0; // For cancellation

/**
 * Start prefetching images around the current index
 * Call this when album changes or user navigates
 */
export const prefetchWindow = (urls, currentIndex) => {
  if (!electronAPI?.prefetchImages || !urls?.length) return;

  // Increment ID to invalidate previous prefetch
  currentPrefetchId++;
  const myPrefetchId = currentPrefetchId;

  // Calculate window
  const start = Math.max(0, currentIndex - WINDOW_SIZE);
  const end = Math.min(urls.length - 1, currentIndex + WINDOW_SIZE);

  // Get URLs in window that aren't cached yet
  const urlsToFetch = [];
  for (let i = start; i <= end; i++) {
    const url = urls[i];
    if (url && !localPathCache.has(url) && !pendingUrls.has(url)) {
      urlsToFetch.push(url);
      pendingUrls.add(url);
    }
  }

  if (urlsToFetch.length === 0) return;

  console.log(`[PrefetchManager] Prefetching ${urlsToFetch.length} images around index ${currentIndex}`);

  // Start streaming prefetch
  electronAPI.prefetchImages(urlsToFetch, {
    onProgress: (item) => {
      // Check if this prefetch is still valid
      if (myPrefetchId !== currentPrefetchId) return;

      if (item.type === 'summary') {
        console.log(`[PrefetchManager] Complete: ${item.completed}/${item.completed + item.failed}`);
        return;
      }

      pendingUrls.delete(item.url);

      if (item.success && item.localPath) {
        localPathCache.set(item.url, item.localPath);
        // Notify listeners
        notifyListeners(item.url, item.localPath);
      }
    }
  });
};

/**
 * Get local path for URL (or null if not prefetched)
 */
export const getLocalPath = (url) => {
  return localPathCache.get(url) || null;
};

/**
 * Check if URL is being prefetched
 */
export const isPending = (url) => {
  return pendingUrls.has(url);
};

/**
 * Get file:// URL for display (or null)
 */
export const getLocalUrl = (url) => {
  const localPath = localPathCache.get(url);
  if (localPath) {
    // Windows path to file:// URL
    return `file:///${localPath.replace(/\\/g, '/')}`;
  }
  return null;
};

// Listener system for when prefetch completes
const listeners = new Map(); // URL -> callback[]

export const onPrefetchComplete = (url, callback) => {
  if (!listeners.has(url)) {
    listeners.set(url, []);
  }
  listeners.get(url).push(callback);

  // Return unsubscribe function
  return () => {
    const cbs = listeners.get(url);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx >= 0) cbs.splice(idx, 1);
    }
  };
};

const notifyListeners = (url, localPath) => {
  const cbs = listeners.get(url);
  if (cbs) {
    cbs.forEach(cb => cb(localPath));
    listeners.delete(url);
  }
};

/**
 * Clear prefetch cache (when switching albums)
 */
export const clearPrefetch = () => {
  currentPrefetchId++;
  pendingUrls.clear();
  // Keep localPathCache - files still exist and can be reused
};

/**
 * Get stats for debugging
 */
export const getStats = () => ({
  cached: localPathCache.size,
  pending: pendingUrls.size,
  windowSize: WINDOW_SIZE
});
