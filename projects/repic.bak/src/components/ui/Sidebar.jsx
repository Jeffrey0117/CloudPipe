import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { getThumbnail, saveThumbnail, generateThumbnail } from '../../utils/thumbnailCache';
import { getCachedImage, cacheImage } from '../../utils/offlineCache';
import { preloadImages, preloadThumbnails, getCached } from '../../utils/imageLoader';
import { getLocalUrl } from '../../utils/prefetchManager';
import { LazyImage } from './LazyImage';
import { hasImageTransparency, isPNGFormat } from '../../utils/imageUtils';

const SIDEBAR_WIDTH_KEY = 'sidebar-width';
const SIDEBAR_HEIGHT_KEY = 'sidebar-height';
const MIN_WIDTH = 80;
const MAX_WIDTH = 200;
const DEFAULT_WIDTH = 120;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 300;
const DEFAULT_HEIGHT = 160;

const electronAPI = window.electronAPI || null;

// Check if file is a .repic virtual image
const isRepicFile = (path) => path?.toLowerCase().endsWith('.repic');

// Cache for proxied images (URL -> base64)
const proxyCache = new Map();

// Memory cache for thumbnails (faster than IndexedDB for current session)
const thumbMemCache = new Map();

export const Sidebar = ({
    files,
    currentIndex,
    onSelect,
    cacheVersion = 0,
    mode = 'local',
    isMultiSelectMode = false,
    selectedIds = new Set(),
    onToggleSelect,
    onEnterMultiSelect,
    onExitMultiSelect,
    onDeleteSelected,
    onDownloadSelected,
    onUploadSelected,
    onSelectAll,
    onMoveUp,
    onMoveDown,
    onReorder,
    onContextMenu,
    position = 'left' // 'left' or 'bottom'
}) => {
    const isHorizontal = position === 'bottom';
    const scrollContainerRef = useRef(null);
    // Cache for .repic file data (url + crop)
    const [repicData, setRepicData] = useState({});
    // Reorder mode (separate from multi-select)
    const [isReorderMode, setIsReorderMode] = useState(false);
    // Drag reorder state
    const [dragIndex, setDragIndex] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    // Drag scroll state
    const [isDragScrolling, setIsDragScrolling] = useState(false);
    const [dragScrollStart, setDragScrollStart] = useState({ x: 0, y: 0, scrollX: 0, scrollY: 0 });
    // Track failed images (after proxy also failed)
    const [failedImages, setFailedImages] = useState(new Set());
    // Cached thumbnails for local files
    const [cachedThumbs, setCachedThumbs] = useState({});
    // Track images with transparency
    const [transparentImages, setTransparentImages] = useState(new Set());
    // Separate width (for left) and height (for bottom)
    const [width, setWidth] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
                return parsed;
            }
        }
        return DEFAULT_WIDTH;
    });
    const [height, setHeight] = useState(() => {
        const saved = localStorage.getItem(SIDEBAR_HEIGHT_KEY);
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (!isNaN(parsed) && parsed >= MIN_HEIGHT && parsed <= MAX_HEIGHT) {
                return parsed;
            }
        }
        return DEFAULT_HEIGHT;
    });
    const [isResizing, setIsResizing] = useState(false);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip if focus is on input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const isNext = isHorizontal ? e.key === 'ArrowRight' : e.key === 'ArrowDown';
            const isPrev = isHorizontal ? e.key === 'ArrowLeft' : e.key === 'ArrowUp';

            if (isNext && currentIndex < files.length - 1) {
                e.preventDefault();
                onSelect(currentIndex + 1);
            } else if (isPrev && currentIndex > 0) {
                e.preventDefault();
                onSelect(currentIndex - 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isHorizontal, currentIndex, files.length, onSelect]);

    // Drag to scroll (carousel effect)
    const handleScrollDragStart = useCallback((e) => {
        if (isReorderMode || isMultiSelectMode) return;
        // Don't start drag scroll if clicking on a thumbnail (let it select)
        if (e.target.closest('[data-thumb]')) return;

        const container = scrollContainerRef.current;
        if (!container) return;

        e.preventDefault();
        setIsDragScrolling(true);
        setDragScrollStart({
            x: e.clientX,
            y: e.clientY,
            scrollX: container.scrollLeft,
            scrollY: container.scrollTop
        });
    }, [isReorderMode, isMultiSelectMode]);

    // Global cleanup for drag scrolling - ensures state is always cleaned up
    useEffect(() => {
        if (!isDragScrolling) return;

        const handleMouseMove = (e) => {
            const container = scrollContainerRef.current;
            if (!container) return;

            if (isHorizontal) {
                const dx = dragScrollStart.x - e.clientX;
                container.scrollLeft = dragScrollStart.scrollX + dx;
            } else {
                const dy = dragScrollStart.y - e.clientY;
                container.scrollTop = dragScrollStart.scrollY + dy;
            }
        };

        const handleMouseUp = () => {
            setIsDragScrolling(false);
        };

        // Also clean up on blur (window loses focus)
        const handleBlur = () => {
            setIsDragScrolling(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('blur', handleBlur);
        };
    }, [isDragScrolling, dragScrollStart, isHorizontal]);

    // Safety: reset drag state when mode changes
    useEffect(() => {
        setIsDragScrolling(false);
    }, [isReorderMode, isMultiSelectMode]);

    // Calculate thumbnail size based on position
    const thumbSize = isHorizontal ? height - 60 : width - 24; // Leave room for labels

    // Virtual scrolling state
    const [scrollPosition, setScrollPosition] = useState(0);
    const [containerSize, setContainerSize] = useState(0);
    const ITEM_GAP = 28; // gap between items
    const ITEM_SIZE = thumbSize + 40 + ITEM_GAP; // thumb + label + gap
    const OVERSCAN = 3; // Extra items to render outside viewport

    // Calculate visible range
    const visibleRange = useMemo(() => {
      const startIndex = Math.max(0, Math.floor(scrollPosition / ITEM_SIZE) - OVERSCAN);
      const visibleCount = Math.ceil(containerSize / ITEM_SIZE) + OVERSCAN * 2;
      const endIndex = Math.min(files.length - 1, startIndex + visibleCount);
      return { startIndex, endIndex };
    }, [scrollPosition, containerSize, ITEM_SIZE, files.length]);

    // Total scrollable size
    const totalSize = files.length * ITEM_SIZE;

    // Handle scroll
    const handleScroll = useCallback((e) => {
      const pos = isHorizontal ? e.target.scrollLeft : e.target.scrollTop;
      setScrollPosition(pos);
    }, [isHorizontal]);

    // Update container size on resize
    useEffect(() => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const updateSize = () => {
        setContainerSize(isHorizontal ? container.clientWidth : container.clientHeight);
      };
      updateSize();

      const observer = new ResizeObserver(updateSize);
      observer.observe(container);
      return () => observer.disconnect();
    }, [isHorizontal]);

    // Track previous files to detect album change
    const prevFilesRef = useRef(files);
    // Track initial mount to skip smooth scroll on first render
    const isInitialMount = useRef(true);
    // Track orientation to detect position switch (left ↔ bottom)
    const prevIsHorizontalRef = useRef(isHorizontal);

    // Scroll to current item - useLayoutEffect for instant cases (before paint)
    useLayoutEffect(() => {
        const container = scrollContainerRef.current;
        if (!container || currentIndex < 0 || files.length === 0) return;

        const albumChanged = prevFilesRef.current !== files;
        const orientationChanged = prevIsHorizontalRef.current !== isHorizontal;
        prevFilesRef.current = files;
        prevIsHorizontalRef.current = isHorizontal;

        const shouldInstant = isInitialMount.current || albumChanged || orientationChanged;
        if (isInitialMount.current) {
            isInitialMount.current = false;
        }

        const scrollPos = currentIndex * ITEM_SIZE;

        if (shouldInstant) {
            // Set scroll position directly before browser paints (no flash)
            if (isHorizontal) {
                container.scrollLeft = Math.max(0, scrollPos - container.clientWidth / 2 + ITEM_SIZE / 2);
            } else {
                container.scrollTop = Math.max(0, scrollPos - container.clientHeight / 2 + ITEM_SIZE / 2);
            }
        } else {
            // Smooth scroll for normal navigation
            const timeoutId = setTimeout(() => {
                if (isHorizontal) {
                    container.scrollTo({ left: Math.max(0, scrollPos - container.clientWidth / 2 + ITEM_SIZE / 2), behavior: 'smooth' });
                } else {
                    container.scrollTo({ top: Math.max(0, scrollPos - container.clientHeight / 2 + ITEM_SIZE / 2), behavior: 'smooth' });
                }
            }, 50);
            return () => clearTimeout(timeoutId);
        }
    }, [currentIndex, ITEM_SIZE, isHorizontal, files]);

    const handleResizeMouseDown = useCallback((e) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e) => {
            if (isHorizontal) {
                const newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, window.innerHeight - e.clientY));
                setHeight(newHeight);
            } else {
                const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX));
                setWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            if (isHorizontal) {
                localStorage.setItem(SIDEBAR_HEIGHT_KEY, height.toString());
            } else {
                localStorage.setItem(SIDEBAR_WIDTH_KEY, width.toString());
            }
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, width, isHorizontal]);

    // Load .repic file data (url + crop) for local mode
    // Reset cache when cacheVersion changes (after crop save)
    useEffect(() => {
        if (mode !== 'local' || !electronAPI) return;

        // Clear cache and reload all repic files
        const loadRepicData = async () => {
            const newData = {};
            for (const file of files) {
                if (isRepicFile(file)) {
                    const result = electronAPI.readFile(file);
                    if (result && typeof result === 'object' && result.url) {
                        newData[file] = {
                            url: result.url,
                            crop: result.crop || null
                        };
                    }
                }
            }
            setRepicData(newData);
        };

        loadRepicData();
    }, [files, mode, cacheVersion]);

    // Load/generate thumbnails for local files (with streaming + priority)
    useEffect(() => {
        if (mode !== 'local' || !electronAPI) return;

        const loadThumbnails = async () => {
            // Filter out .repic files and already cached files
            const needThumbs = files
                .filter(f => !isRepicFile(f))
                .filter(f => !thumbMemCache.has(f) && !cachedThumbs[f]);

            if (needThumbs.length === 0) return;

            // Sort by priority: closest to currentIndex first
            const sortedFiles = [...needThumbs].sort((a, b) => {
                const idxA = files.indexOf(a);
                const idxB = files.indexOf(b);
                return Math.abs(idxA - currentIndex) - Math.abs(idxB - currentIndex);
            });

            // First: check IndexedDB cache for all files
            const uncached = [];
            for (const file of sortedFiles) {
                try {
                    const cached = await getThumbnail(file, cacheVersion);
                    if (cached) {
                        thumbMemCache.set(file, cached);
                        setCachedThumbs(prev => ({ ...prev, [file]: cached }));
                    } else {
                        uncached.push(file);
                    }
                } catch (e) {
                    uncached.push(file);
                }
            }

            if (uncached.length === 0) return;

            // Use Go streaming API for uncached files
            if (electronAPI.batchThumbnailsStream) {
                console.log(`[Sidebar] Streaming ${uncached.length} thumbnails (priority order)`);
                electronAPI.batchThumbnailsStream(uncached, {
                    size: 200,
                    concurrency: 8,
                    onProgress: (item) => {
                        if (item.type === 'summary') {
                            console.log(`[Sidebar] Thumbnails complete: ${item.completed}/${item.total} in ${item.duration_ms}ms`);
                            return;
                        }
                        if (item.success && item.base64) {
                            const base64Url = item.base64.startsWith('data:') ? item.base64 : `data:image/jpeg;base64,${item.base64}`;
                            thumbMemCache.set(item.source, base64Url);
                            setCachedThumbs(prev => ({ ...prev, [item.source]: base64Url }));
                            // Save to IndexedDB (async)
                            saveThumbnail(item.source, cacheVersion, base64Url);
                        }
                    }
                });
            } else {
                // Fallback: generate one by one with Canvas (slower)
                for (const file of uncached.slice(0, 20)) {
                    try {
                        const thumb = await generateThumbnail(`file://${file}`);
                        if (thumb) {
                            thumbMemCache.set(file, thumb);
                            setCachedThumbs(prev => ({ ...prev, [file]: thumb }));
                            saveThumbnail(file, cacheVersion, thumb);
                        }
                    } catch (e) {}
                }
            }
        };

        loadThumbnails();
    }, [files, mode, cacheVersion, currentIndex]);

    // Preload ALL thumbnails from cache when album changes (instant display)
    useEffect(() => {
        if (mode !== 'web' || files.length === 0) return;

        // Get all URLs and preload thumbnails from IndexedDB into memory
        const allUrls = files
            .map(file => typeof file === 'string' ? file : file.url)
            .filter(url => url?.startsWith('http'));

        if (allUrls.length > 0) {
            preloadThumbnails(allUrls);
        }
    }, [files, mode]);

    // Preload full images for nearby items (smoother main view navigation)
    useEffect(() => {
        if (mode !== 'web' || files.length === 0) return;

        // Preload full images around current index for main viewer
        const preloadRange = 3;
        const urlsToPreload = [];

        for (let i = -preloadRange; i <= preloadRange; i++) {
            const idx = currentIndex + i;
            if (idx >= 0 && idx < files.length && idx !== currentIndex) {
                const file = files[idx];
                const url = typeof file === 'string' ? file : file.url;
                if (url?.startsWith('http')) {
                    urlsToPreload.push(url);
                }
            }
        }

        if (urlsToPreload.length > 0) {
            preloadImages(urlsToPreload);
        }
    }, [files, mode, currentIndex]);

    return (
        <div
            className={`bg-surface/30 backdrop-blur-xl overflow-hidden relative flex-shrink-0 ${
                isHorizontal
                    ? 'w-full border-t border-white/5 flex flex-row'
                    : 'h-full border-r border-white/5 flex flex-col'
            }`}
            style={isHorizontal ? { height: `${height}px`, order: 2 } : { width: `${width}px` }}
        >
            {/* Toolbar for album mode */}
            {mode === 'web' && (
                <div className={`flex-shrink-0 ${isHorizontal ? 'border-r py-2 px-1 flex flex-col justify-center' : 'border-b px-2 py-2'} border-white/5`}>
                    {isMultiSelectMode ? (
                        <div className={`flex ${isHorizontal ? 'flex-col items-center gap-2' : 'flex-col gap-1.5'}`}>
                            {/* Row 1: Count + Close */}
                            <div className={`flex items-center ${isHorizontal ? 'flex-col gap-1' : 'justify-between w-full'}`}>
                                <span className="text-[10px] text-white/60">
                                    {selectedIds.size}/{files.length}
                                </span>
                                <button
                                    onClick={onExitMultiSelect}
                                    className="text-[10px] text-white/60 hover:text-white px-1.5 py-0.5 rounded hover:bg-white/10"
                                >
                                    ✕
                                </button>
                            </div>
                            {/* Row 2: Move arrows + Select all */}
                            <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center justify-between w-full`}>
                                <div className="flex items-center gap-0.5">
                                    {onMoveUp && (
                                        <button
                                            onClick={onMoveUp}
                                            disabled={selectedIds.size === 0}
                                            className="text-[9px] text-white/50 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="上移"
                                        >
                                            ↑
                                        </button>
                                    )}
                                    {onMoveDown && (
                                        <button
                                            onClick={onMoveDown}
                                            disabled={selectedIds.size === 0}
                                            className="text-[9px] text-white/50 hover:text-white px-1 py-0.5 rounded hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="下移"
                                        >
                                            ↓
                                        </button>
                                    )}
                                </div>
                                {onSelectAll && (
                                    <button
                                        onClick={() => onSelectAll(selectedIds.size === files.length)}
                                        className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                                            selectedIds.size === files.length
                                                ? 'text-white/50 hover:text-white hover:bg-white/10'
                                                : 'text-primary hover:bg-primary/10'
                                        }`}
                                    >
                                        {selectedIds.size === files.length ? '取消' : '全選'}
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : isReorderMode ? (
                        <div className={`flex ${isHorizontal ? 'flex-col items-center gap-2' : 'items-center justify-between'}`}>
                            <span className="text-[10px] text-yellow-400">排序中</span>
                            <button
                                onClick={() => setIsReorderMode(false)}
                                className="text-[10px] text-white/60 hover:text-white px-2 py-1 rounded hover:bg-white/10"
                            >
                                完成
                            </button>
                        </div>
                    ) : (
                        <div className={`flex ${isHorizontal ? 'flex-col' : 'flex-row'} items-center gap-1`}>
                            <button
                                onClick={onEnterMultiSelect}
                                className={`text-[10px] text-white/50 hover:text-white/80 py-1 px-2 rounded hover:bg-white/5 transition-colors ${isHorizontal ? '' : 'flex-1'}`}
                            >
                                多選
                            </button>
                            {onReorder && (
                                <button
                                    onClick={() => setIsReorderMode(true)}
                                    className={`text-[10px] text-white/50 hover:text-white/80 py-1 px-2 rounded hover:bg-white/5 transition-colors ${isHorizontal ? '' : 'flex-1'}`}
                                >
                                    排序
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div
                ref={scrollContainerRef}
                onMouseDown={handleScrollDragStart}
                onScroll={handleScroll}
                className={`flex-1 no-scrollbar select-none relative ${
                    isHorizontal
                        ? 'overflow-x-auto overflow-y-hidden'
                        : 'overflow-y-auto'
                } ${isDragScrolling ? 'cursor-grabbing' : ''}`}
            >
                {/* Virtual scroll spacer */}
                <div
                    style={isHorizontal
                        ? { width: totalSize, height: '100%', position: 'relative' }
                        : { height: totalSize, width: '100%', position: 'relative' }
                    }
                >
                {files.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((file, i) => {
                    const index = visibleRange.startIndex + i;
                    const isActive = index === currentIndex;
                    // For local mode: file is a path, extract filename
                    // For web mode: file is a URL or object with url property
                    const isWeb = mode === 'web';
                    const fileUrl = isWeb ? (typeof file === 'string' ? file : file.url) : file;
                    const fileName = isWeb
                        ? (typeof file === 'string' ? file.split('/').pop()?.split('?')[0] : file.url?.split('/').pop()?.split('?')[0]) || `Image ${index + 1}`
                        : file.split(/[\\/]/).pop();

                    // Handle .repic files in local mode - use cached data
                    const isRepic = !isWeb && isRepicFile(file);
                    const repicInfo = isRepic ? repicData[file] : null;
                    const originalUrl = isWeb
                        ? fileUrl
                        : isRepic
                            ? (repicInfo?.url || '')
                            : `file://${file}?v=${cacheVersion}`;

                    // For local files, use file:// URL directly
                    const imgSrc = isWeb ? originalUrl : originalUrl;

                    // Check if image failed to load
                    const isFailed = isWeb && failedImages.has(fileUrl);

                    // Get crop data: from .repic file or from web album image object
                    const crop = isRepic
                        ? repicInfo?.crop
                        : (isWeb && typeof file === 'object' ? file.crop : null);

                    // Calculate clip-path for cropped thumbnails
                    const clipPath = crop
                        ? `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`
                        : undefined;

                    // Get image id for multi-select
                    const imageId = isWeb && typeof file === 'object' ? file.id : null;
                    const isSelected = imageId && selectedIds.has(imageId);

                    // Drag reorder handlers (for album mode, only when reorder mode is active)
                    const canReorder = isWeb && onReorder && isReorderMode && !isMultiSelectMode;
                    const isDragging = dragIndex === index;
                    const isDragOver = dragOverIndex === index;

                    return (
                        <div
                            key={isWeb ? (typeof file === 'string' ? file : file.id) : `${file}-${cacheVersion}`}
                            data-thumb="true"
                            onClick={() => {
                                if (isMultiSelectMode && imageId) {
                                    onToggleSelect(imageId);
                                } else if (!isDragging) {
                                    onSelect(index);
                                }
                            }}
                            onContextMenu={(e) => {
                                if (onContextMenu && isWeb) {
                                    e.preventDefault();
                                    onContextMenu(e, file, index);
                                }
                            }}
                            draggable={canReorder}
                            onDragStart={(e) => {
                                if (canReorder) {
                                    setDragIndex(index);
                                    e.dataTransfer.effectAllowed = 'move';
                                }
                            }}
                            onDragOver={(e) => {
                                if (canReorder && dragIndex !== null && dragIndex !== index) {
                                    e.preventDefault();
                                    setDragOverIndex(index);
                                }
                            }}
                            onDragLeave={() => {
                                if (canReorder) {
                                    setDragOverIndex(null);
                                }
                            }}
                            onDrop={(e) => {
                                if (canReorder && dragIndex !== null && dragIndex !== index) {
                                    e.preventDefault();
                                    onReorder(dragIndex, index);
                                    setDragIndex(null);
                                    setDragOverIndex(null);
                                }
                            }}
                            onDragEnd={() => {
                                setDragIndex(null);
                                setDragOverIndex(null);
                            }}
                            className={`absolute cursor-pointer group flex flex-col items-center transition-transform duration-100 ${isDragging ? 'opacity-50' : ''} ${isDragOver ? 'scale-110' : ''} ${!isMultiSelectMode && !isDragging ? 'hover:scale-105 active:scale-95' : ''}`}
                            style={isHorizontal
                                ? { left: index * ITEM_SIZE + 16, top: 12, width: thumbSize }
                                : { top: index * ITEM_SIZE + 16, left: 12, width: thumbSize }
                            }
                        >
                            <div className="text-[10px] text-white/40 truncate w-full mb-1 text-center group-hover:text-white/80 transition-colors">
                                {index + 1}
                            </div>

                            <div
                                className={`
                                    rounded-lg overflow-hidden border-2 transition-all duration-200 bg-black/50 relative
                                    ${isSelected ? 'border-green-500' : isActive ? 'border-primary' : 'border-transparent group-hover:border-white/20'}
                                    ${isDragOver ? 'border-primary border-dashed' : ''}
                                `}
                                style={{ width: `${thumbSize}px`, height: `${thumbSize}px` }}
                                draggable={!isMultiSelectMode && !canReorder}
                                onDragStart={(e) => {
                                    if (!canReorder) {
                                        e.preventDefault();
                                        if (electronAPI?.startDrag) {
                                            // Prefer fastest source for drag:
                                            // 1. Go-prefetched local file (instant)
                                            // 2. Cached base64 (fast writeFileSync)
                                            // 3. Original src (may be slow for HTTP)
                                            const localUrl = isWeb ? getLocalUrl(originalUrl) : null;
                                            const cached = isWeb ? getCached(imgSrc) : null;
                                            electronAPI.startDrag(localUrl || cached || imgSrc, fileName);
                                        }
                                    }
                                }}
                            >
                                {isFailed ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-black/30 text-white/40">
                                        <span className="text-sm">✕</span>
                                        <span className="text-[8px] mt-0.5">暫不支援</span>
                                    </div>
                                ) : isWeb && originalUrl.startsWith('http') ? (
                                    // Web images: use LazyImage with thumbnail for fast loading
                                    <LazyImage
                                        src={originalUrl}
                                        className="w-full h-full"
                                        style={clipPath ? { clipPath } : undefined}
                                        isHighPriority={Math.abs(index - currentIndex) <= 2}
                                        useThumbnail={true}
                                        onError={() => setFailedImages(prev => new Set([...prev, fileUrl]))}
                                        fallbackElement={
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-black/30 text-white/40">
                                                <span className="text-sm">✕</span>
                                                <span className="text-[8px] mt-0.5">暫不支援</span>
                                            </div>
                                        }
                                    />
                                ) : imgSrc ? (
                                    // Local files: detect and show checkerboard for transparent images
                                    (() => {
                                        const hasTransparency = transparentImages.has(fileUrl);
                                        const isPNG = isPNGFormat(imgSrc);

                                        return (
                                            <div
                                                className="w-full h-full"
                                                style={hasTransparency || isPNG ? {
                                                    // Checkerboard pattern for images with transparency
                                                    backgroundImage: `
                                                        linear-gradient(45deg, #CCCCCC 25%, transparent 25%),
                                                        linear-gradient(-45deg, #CCCCCC 25%, transparent 25%),
                                                        linear-gradient(45deg, transparent 75%, #CCCCCC 75%),
                                                        linear-gradient(-45deg, transparent 75%, #CCCCCC 75%)
                                                    `,
                                                    backgroundSize: '16px 16px',
                                                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                                                    backgroundColor: '#FFFFFF'
                                                } : {}}
                                            >
                                                <img
                                                    src={imgSrc}
                                                    alt=""
                                                    className="w-full h-full object-contain pointer-events-none"
                                                    style={clipPath ? { clipPath } : undefined}
                                                    loading="lazy"
                                                    draggable={false}
                                                    referrerPolicy="no-referrer"
                                                    onLoad={async (e) => {
                                                        // Detect transparency after image loads
                                                        if (isPNG && !transparentImages.has(fileUrl)) {
                                                            const hasAlpha = await hasImageTransparency(imgSrc);
                                                            if (hasAlpha) {
                                                                setTransparentImages(prev => new Set([...prev, fileUrl]));
                                                            }
                                                        }
                                                    }}
                                                />
                                            </div>
                                        );
                                    })()
                                ) : (
                                    // Loading spinner for .repic files loading
                                    isRepic ? (
                                        <div className="w-full h-full flex items-center justify-center bg-black/20">
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                                        </div>
                                    ) : null
                                )}
                                {/* Selection checkbox indicator */}
                                {isMultiSelectMode && imageId && (
                                    <div className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-green-500 text-white' : 'bg-black/50 border border-white/30 text-transparent'}`}>
                                        ✓
                                    </div>
                                )}
                            </div>

                            <div className={`mt-1.5 text-[10px] truncate w-full px-1 text-center font-medium ${isActive ? 'text-primary' : 'text-white/70'}`}>
                                {fileName}
                            </div>
                        </div>
                    );
                })}
                </div>
            </div>

            {/* Resize Handle */}
            <div
                onMouseDown={handleResizeMouseDown}
                className={`
                    absolute transition-colors duration-150 z-50
                    ${isHorizontal
                        ? 'left-0 top-0 h-1 w-full cursor-row-resize'
                        : 'top-0 right-0 w-1 h-full cursor-col-resize'
                    }
                    ${isResizing ? 'bg-primary' : 'bg-transparent hover:bg-white/30'}
                `}
            />
        </div>
    );
};
