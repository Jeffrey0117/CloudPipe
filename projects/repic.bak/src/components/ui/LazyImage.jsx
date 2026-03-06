import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { loadImage, getCached, getCachedThumbnail, cacheProxyResult, PRIORITY_HIGH, PRIORITY_NORMAL, PRIORITY_LOW } from '../../utils/imageLoader';
import { hasImageTransparency, isPNGFormat } from '../../utils/imageUtils';

const electronAPI = window.electronAPI || null;

/**
 * LazyImage - Optimized image loading with fast path for HTTP URLs
 *
 * Strategy:
 * 1. Check memory/IndexedDB cache → instant display
 * 2. HTTP URLs → show <img src={url}> directly (browser native, no CORS issues)
 * 3. If native load fails → proxy fallback chain
 * 4. Background: cache base64 for offline support
 *
 * useThumbnail: prefer cached thumbnail for sidebar display
 */
export const LazyImage = memo(({
    src,
    alt = '',
    className = '',
    style,
    isHighPriority = false,
    useThumbnail = false,
    onLoad,
    onError,
    fallbackElement,
    showSpinner = true,
    hasTransparency = false
}) => {
    const imgRef = useRef(null);

    // Initialize from cache, or use HTTP URL directly (fast path)
    const [loadedSrc, setLoadedSrc] = useState(() => {
        // Check cache first (instant, base64)
        if (useThumbnail) {
            const cached = getCachedThumbnail(src) || getCached(src);
            if (cached) return cached;
        } else {
            const cached = getCached(src);
            if (cached) return cached;
        }
        // Fast path: HTTP URLs render immediately via native <img>
        if (src?.startsWith('http')) return src;
        // Local files and blob URLs (paste preview)
        if (src?.startsWith('file://') || src?.startsWith('data:') || src?.startsWith('blob:')) return src;
        return null;
    });
    const [isLoading, setIsLoading] = useState(!loadedSrc);
    const [hasError, setHasError] = useState(false);
    const [detectedTransparency, setDetectedTransparency] = useState(false);

    // Handle native <img> load failure → proxy fallback chain
    const handleImgError = useCallback(async () => {
        // Only trigger proxy for HTTP URLs loaded natively
        if (!loadedSrc?.startsWith('http')) {
            setHasError(true);
            setIsLoading(false);
            onError?.();
            return;
        }

        // Layer 1: Try imageLoader (fetch with CORS)
        try {
            const priority = isHighPriority ? PRIORITY_HIGH : PRIORITY_NORMAL;
            const data = await loadImage(src, priority);
            if (data) {
                setLoadedSrc(data);
                onLoad?.();
                return;
            }
        } catch (e) {
            if (e?.name === 'AbortError') {
                setIsLoading(false);
                return;
            }
        }

        // Layer 2: Node.js proxy
        if (electronAPI?.proxyImage) {
            try {
                const result = await electronAPI.proxyImage(src);
                if (result.success) {
                    cacheProxyResult(src, result.data);
                    setLoadedSrc(result.data);
                    onLoad?.();
                    return;
                }
            } catch (e) {}
        }

        // Layer 3: Browser proxy (for strict sites)
        if (electronAPI?.proxyImageBrowser) {
            try {
                const result = await electronAPI.proxyImageBrowser(src);
                if (result.success) {
                    cacheProxyResult(src, result.data);
                    setLoadedSrc(result.data);
                    onLoad?.();
                    return;
                }
            } catch (e) {}
        }

        setHasError(true);
        setIsLoading(false);
        onError?.();
    }, [loadedSrc, src, isHighPriority, onLoad, onError]);

    // Reset when src changes
    useEffect(() => {
        const cached = useThumbnail
            ? (getCachedThumbnail(src) || getCached(src))
            : getCached(src);

        if (cached) {
            setLoadedSrc(cached);
            setIsLoading(false);
            setHasError(false);
        } else if (src?.startsWith('http')) {
            // Fast path: use HTTP URL directly
            setLoadedSrc(src);
            setIsLoading(false);
            setHasError(false);
        } else if (src?.toLowerCase().endsWith('.repic')) {
            setLoadedSrc(null);
            setIsLoading(true);
            setHasError(false);
        } else if (src) {
            setLoadedSrc(src);
            setIsLoading(false);
            setHasError(false);
        } else {
            setLoadedSrc(null);
            setIsLoading(false);
            setHasError(false);
        }
    }, [src, useThumbnail]);

    // Background caching: for HTTP URLs displayed natively, cache base64 for offline
    useEffect(() => {
        if (!src?.startsWith('http')) return;
        // Skip if already cached as base64
        if (getCached(src) || getCachedThumbnail(src)) return;

        // Cache in background at low priority (don't block display)
        loadImage(src, PRIORITY_LOW).catch(() => {});
    }, [src]);

    // Handle .repic virtual image files
    useEffect(() => {
        if (!src?.toLowerCase().endsWith('.repic')) return;
        if (!electronAPI?.readRepicFile) {
            setHasError(true);
            setIsLoading(false);
            return;
        }

        let cancelled = false;
        (async () => {
            try {
                const result = await electronAPI.readRepicFile(src);
                if (cancelled) return;
                if (result.success && result.data?.url) {
                    const actualSrc = result.data.url;
                    // Fast path: use URL directly
                    setLoadedSrc(actualSrc);
                    setIsLoading(false);
                } else {
                    setHasError(true);
                    setIsLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setHasError(true);
                    setIsLoading(false);
                    onError?.(err);
                }
            }
        })();

        return () => { cancelled = true; };
    }, [src, onError]);

    // Detect transparency when image loads (only for base64/data URLs, not HTTP)
    useEffect(() => {
        if (!loadedSrc || hasError) return;
        // Skip transparency detection for HTTP URLs (can't read cross-origin canvas)
        if (loadedSrc.startsWith('http')) {
            setDetectedTransparency(false);
            return;
        }
        if (isPNGFormat(loadedSrc)) {
            hasImageTransparency(loadedSrc).then((hasAlpha) => {
                setDetectedTransparency(hasAlpha);
            });
        } else {
            setDetectedTransparency(false);
        }
    }, [loadedSrc, hasError]);

    if (hasError) {
        return fallbackElement || (
            <div ref={imgRef} className={`flex items-center justify-center bg-black/30 text-white/40 ${className}`} style={style}>
                <span className="text-sm">✕</span>
            </div>
        );
    }

    const shouldShowCheckerboard = hasTransparency || detectedTransparency;

    return (
        <div
            ref={imgRef}
            className={`relative ${className}`}
            style={{
                ...style,
                ...(shouldShowCheckerboard ? {
                    backgroundImage: `
                        linear-gradient(45deg, #CCCCCC 25%, transparent 25%),
                        linear-gradient(-45deg, #CCCCCC 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #CCCCCC 75%),
                        linear-gradient(-45deg, transparent 75%, #CCCCCC 75%)
                    `,
                    backgroundSize: '16px 16px',
                    backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                    backgroundColor: '#FFFFFF'
                } : {})
            }}
        >
            {isLoading && (
                useThumbnail ? (
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                ) : showSpinner ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                    </div>
                ) : null
            )}
            {loadedSrc && (
                <img
                    src={loadedSrc}
                    alt={alt}
                    className={`w-full h-full object-contain transition-opacity duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                    style={style}
                    draggable={false}
                    referrerPolicy="no-referrer"
                    onLoad={() => {
                        setIsLoading(false);
                        onLoad?.();
                    }}
                    onError={handleImgError}
                />
            )}
        </div>
    );
});

LazyImage.displayName = 'LazyImage';
