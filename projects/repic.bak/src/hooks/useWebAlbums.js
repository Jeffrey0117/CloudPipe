import { useState, useEffect, useCallback, useMemo } from 'react';
import { cancelAll } from '../utils/imageLoader';

const STORAGE_KEY = 'repic-web-albums';
const SOFT_DELETE_DAYS = 7; // Days before permanent deletion
const SOFT_DELETE_MS = SOFT_DELETE_DAYS * 24 * 60 * 60 * 1000;

// Generate unique ID
const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Load albums from localStorage (for lazy initialization)
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const albums = JSON.parse(stored);
    // Filter out images with expired blob: URLs (from interrupted paste uploads)
    return albums.map(album => ({
      ...album,
      images: album.images.filter(img => !img.url?.startsWith('blob:'))
    }));
  } catch (e) {
    console.error('[useWebAlbums] Failed to load from localStorage:', e);
    return [];
  }
};

// Clean up expired soft-deleted images (older than SOFT_DELETE_DAYS)
const cleanupExpiredImages = (albums) => {
  const now = Date.now();
  let cleanedCount = 0;

  const cleaned = albums.map(album => {
    const filteredImages = album.images.filter(img => {
      if (img.deletedAt && (now - img.deletedAt > SOFT_DELETE_MS)) {
        cleanedCount++;
        return false; // Remove permanently
      }
      return true;
    });
    return { ...album, images: filteredImages };
  });

  if (cleanedCount > 0) {
    console.log(`[useWebAlbums] Permanently deleted ${cleanedCount} expired images`);
  }

  return cleaned;
};

/**
 * Hook for managing web albums with localStorage persistence
 * Supports soft delete with 7-day retention
 */
// Shared initial load (called once at module init, avoids repeated reads)
let _initialAlbums = null;
const getInitialAlbums = () => {
  if (_initialAlbums === null) {
    _initialAlbums = cleanupExpiredImages(loadFromStorage());
  }
  return _initialAlbums;
};

export const useWebAlbums = () => {
  // Lazy initialization from localStorage - runs only once, with cleanup
  const [albums, setAlbums] = useState(getInitialAlbums);
  const [selectedAlbumId, setSelectedAlbumId] = useState(() => {
    const initial = getInitialAlbums();
    return initial.length > 0 ? initial[0].id : null;
  });

  // Save albums to localStorage whenever they change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(albums));
      } catch (e) {
        console.error('[useWebAlbums] Failed to save to localStorage:', e);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [albums]);

  // Periodic cleanup of expired images (every hour)
  useEffect(() => {
    const cleanup = () => {
      setAlbums(prev => cleanupExpiredImages(prev));
    };

    const intervalId = setInterval(cleanup, 60 * 60 * 1000); // Every hour
    return () => clearInterval(intervalId);
  }, []);

  // Get current selected album with active images only (memoized)
  const selectedAlbum = useMemo(() => {
    const album = albums.find(a => a.id === selectedAlbumId);
    if (!album) return null;

    // Filter out soft-deleted images for display
    return {
      ...album,
      images: album.images.filter(img => !img.deletedAt)
    };
  }, [albums, selectedAlbumId]);

  // Create new album
  const createAlbum = useCallback((name) => {
    const newAlbum = {
      id: generateId(),
      name: name.trim() || `Album ${albums.length + 1}`,
      images: [],
      createdAt: Date.now()
    };
    setAlbums(prev => [...prev, newAlbum]);
    setSelectedAlbumId(newAlbum.id);
    return newAlbum;
  }, [albums.length]);

  // Rename album
  const renameAlbum = useCallback((albumId, newName) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? { ...album, name: newName.trim() }
        : album
    ));
  }, []);

  // Delete album
  const deleteAlbum = useCallback((albumId) => {
    setAlbums(prev => {
      const filtered = prev.filter(a => a.id !== albumId);
      // If deleted album was selected, select next available
      if (selectedAlbumId === albumId) {
        setSelectedAlbumId(filtered.length > 0 ? filtered[0].id : null);
      }
      return filtered;
    });
  }, [selectedAlbumId]);

  // Add image to album
  const addImage = useCallback((albumId, url) => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return null;

    const newImage = {
      id: generateId(),
      url: trimmedUrl,
      addedAt: Date.now()
    };

    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? { ...album, images: [...album.images, newImage] }
        : album
    ));

    return newImage;
  }, []);

  // Add multiple images to album
  const addImages = useCallback((albumId, urls) => {
    const validUrls = urls.filter(url => url.trim());
    if (validUrls.length === 0) return [];

    const newImages = validUrls.map(url => ({
      id: generateId(),
      url: url.trim(),
      addedAt: Date.now()
    }));

    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? { ...album, images: [...album.images, ...newImages] }
        : album
    ));

    return newImages;
  }, []);

  // Soft delete image (marks with deletedAt, will be permanently removed after 7 days)
  const removeImage = useCallback((albumId, imageId) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? {
            ...album,
            images: album.images.map(img =>
              img.id === imageId
                ? { ...img, deletedAt: Date.now() }
                : img
            )
          }
        : album
    ));
  }, []);

  // Restore soft-deleted image
  const restoreImage = useCallback((albumId, imageId) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? {
            ...album,
            images: album.images.map(img =>
              img.id === imageId
                ? { ...img, deletedAt: undefined }
                : img
            )
          }
        : album
    ));
  }, []);

  // Get deleted images for an album (for potential trash UI)
  const getDeletedImages = useCallback((albumId) => {
    const album = albums.find(a => a.id === albumId);
    if (!album) return [];
    return album.images.filter(img => img.deletedAt);
  }, [albums]);

  // Update image edit parameters (crop and annotations)
  const updateImageCrop = useCallback((albumId, imageId, crop, annotations = null) => {
    setAlbums(prev => {
      const newAlbums = prev.map(album =>
        album.id === albumId
          ? {
              ...album,
              images: album.images.map(img =>
                img.id === imageId
                  ? {
                      ...img,
                      crop,
                      annotations: annotations?.length > 0 ? annotations : undefined
                    }
                  : img
              )
            }
          : album
      );
      return newAlbums;
    });
  }, []);

  // Clear image crop (reset to original)
  const clearImageCrop = useCallback((albumId, imageId) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? {
            ...album,
            images: album.images.map(img =>
              img.id === imageId
                ? { ...img, crop: undefined }
                : img
            )
          }
        : album
    ));
  }, []);

  // Update image data (for background removal, etc.)
  const updateImageData = useCallback((albumId, imageId, updates) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? {
            ...album,
            images: album.images.map(img =>
              img.id === imageId
                ? { ...img, ...updates }
                : img
            )
          }
        : album
    ));
  }, []);

  // Rename image
  const renameImage = useCallback((albumId, imageId, newName) => {
    setAlbums(prev => prev.map(album =>
      album.id === albumId
        ? {
            ...album,
            images: album.images.map(img =>
              img.id === imageId
                ? { ...img, name: newName.trim() }
                : img
            )
          }
        : album
    ));
  }, []);

  // Select album (immediate switch)
  const selectAlbum = useCallback((albumId) => {
    // Cancel pending image loads BEFORE switching (prevents old album blocking new)
    cancelAll();
    setSelectedAlbumId(albumId);
  }, []);

  // Reorder images in album (drag and drop) - only considers active images
  const reorderImages = useCallback((albumId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;

    setAlbums(prev => prev.map(album => {
      if (album.id !== albumId) return album;

      // Get active images (not deleted)
      const activeImages = album.images.filter(img => !img.deletedAt);
      const deletedImages = album.images.filter(img => img.deletedAt);

      // Reorder active images
      const [removed] = activeImages.splice(fromIndex, 1);
      activeImages.splice(toIndex, 0, removed);

      // Combine back with deleted images at the end
      return { ...album, images: [...activeImages, ...deletedImages] };
    }));
  }, []);

  // Update album images directly (for batch operations like move up/down)
  const updateAlbumImages = useCallback((albumId, newImages) => {
    setAlbums(prev => prev.map(album => {
      if (album.id !== albumId) return album;
      return { ...album, images: newImages };
    }));
  }, []);

  // Export all albums to JSON (excludes soft-deleted images)
  const exportAlbums = useCallback(() => {
    // Clean export: remove deleted images entirely
    const cleanAlbums = albums.map(album => ({
      ...album,
      images: album.images.filter(img => !img.deletedAt)
    }));

    const data = {
      version: 1,
      exportedAt: Date.now(),
      albums: cleanAlbums
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repic-albums-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [albums]);

  // Import albums from JSON
  const importAlbums = useCallback((jsonData, mode = 'merge') => {
    try {
      const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!data.albums || !Array.isArray(data.albums)) {
        throw new Error('Invalid format');
      }

      if (mode === 'replace') {
        setAlbums(data.albums);
        setSelectedAlbumId(data.albums.length > 0 ? data.albums[0].id : null);
      } else {
        // Merge: add albums that don't exist by name
        setAlbums(prev => {
          const existingNames = new Set(prev.map(a => a.name));
          const newAlbums = data.albums.filter(a => !existingNames.has(a.name));
          return [...prev, ...newAlbums];
        });
      }
      return { success: true, count: data.albums.length };
    } catch (e) {
      console.error('[importAlbums] Error:', e);
      return { success: false, error: e.message };
    }
  }, []);

  return {
    albums,
    selectedAlbum,
    selectedAlbumId,
    selectAlbum,
    createAlbum,
    renameAlbum,
    deleteAlbum,
    addImage,
    addImages,
    removeImage,
    restoreImage,
    getDeletedImages,
    updateImageCrop,
    clearImageCrop,
    updateImageData,
    renameImage,
    reorderImages,
    updateAlbumImages,
    exportAlbums,
    importAlbums
  };
};

export default useWebAlbums;
