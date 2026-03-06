import { useState, useEffect, useRef, useCallback } from 'react';
import useI18n from '../../hooks/useI18n';
import { getCached, loadImage, cacheProxyResult, PRIORITY_HIGH, PRIORITY_LOW } from '../../utils/imageLoader';
import { getLocalUrl, onPrefetchComplete } from '../../utils/prefetchManager';
import { drawAnnotation } from '../editor/utils/drawingHelpers';
import { hasImageTransparency, isPNGFormat } from '../../utils/imageUtils';

const electronAPI = window.electronAPI || null;

export const ImageViewer = ({ src, crop, annotations = [] }) => {
    const { t } = useI18n();
    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const canvasRef = useRef(null);

    const [scale, setScale] = useState(1);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

    // Refs to hold latest scale/position for stable event handlers (avoids race conditions)
    const scaleRef = useRef(1);
    const positionRef = useRef({ x: 0, y: 0 });

    // Draw annotations on canvas overlay
    useEffect(() => {
        const canvas = canvasRef.current;
        const img = imageRef.current;
        if (!canvas || !img || !annotations?.length) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Match canvas size to displayed image size
        const rect = img.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        // Clear and redraw
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Convert percentage-based annotations to pixel coordinates and draw
        annotations.forEach(ann => {
            if (ann.unit === '%') {
                const pixelAnn = {
                    type: ann.type,
                    x: (ann.x / 100) * canvas.width,
                    y: (ann.y / 100) * canvas.height,
                    width: (ann.width / 100) * canvas.width,
                    height: (ann.height / 100) * canvas.height
                };
                drawAnnotation(ctx, pixelAnn);
            } else {
                drawAnnotation(ctx, ann);
            }
        });
    }, [annotations, imageSize, scale]);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [proxiedSrc, setProxiedSrc] = useState(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [detectedTransparency, setDetectedTransparency] = useState(false);

    // Reset state when src changes
    useEffect(() => {
        if (!src) return;

        scaleRef.current = 1;
        positionRef.current = { x: 0, y: 0 };
        setScale(1);
        setPosition({ x: 0, y: 0 });
        setProxiedSrc(null);
        setLoadFailed(false);

        // Handle .repic virtual image files
        if (src.toLowerCase().endsWith('.repic')) {
            if (electronAPI?.readRepicFile) {
                setIsLoading(true);
                (async () => {
                    try {
                        const result = await electronAPI.readRepicFile(src);
                        if (result.success && result.data?.url) {
                            const actualSrc = result.data.url;
                            // Fast path: use URL directly for instant display
                            if (actualSrc.startsWith('http')) {
                                setProxiedSrc(actualSrc);
                                setIsLoading(false);
                                // Background cache for offline/drag
                                loadImage(actualSrc, PRIORITY_LOW).catch(() => {});
                            } else {
                                setProxiedSrc(actualSrc);
                                setIsLoading(false);
                            }
                        } else {
                            setIsLoading(false);
                            setLoadFailed(true);
                        }
                    } catch (err) {
                        setIsLoading(false);
                        setLoadFailed(true);
                    }
                })();
            } else {
                setLoadFailed(true);
            }
            return;
        }

        // Local/blob files: no loading state needed (browser displays natively)
        const isLocal = src.startsWith('file://') || src.startsWith('data:') || src.startsWith('blob:');
        if (isLocal) {
            setIsLoading(false);
            return;
        }

        // Check if Go prefetched this image to local temp
        const localUrl = getLocalUrl(src);
        if (localUrl) {
            setProxiedSrc(localUrl);
            setIsLoading(false);
            return;
        }

        // Check JS memory cache
        const cached = getCached(src);
        if (cached) {
            setProxiedSrc(cached);
            setIsLoading(false);
            return;
        }

        // FAST PATH: For HTTP URLs, show directly via native <img src>
        // Browser can load cross-origin images natively (no CORS on <img>)
        if (src.startsWith('http')) {
            setIsLoading(false); // No spinner - browser loads natively
            // Pre-warm drag file in main process
            electronAPI?.prepareDragFile?.(src);
            // Background: cache base64 for offline/drag (don't update display)
            loadImage(src, PRIORITY_LOW).catch(() => {});
            // Listen for Go prefetch completion (even faster local file)
            const unsubscribe = onPrefetchComplete(src, (localPath) => {
                const fileUrl = `file:///${localPath.replace(/\\/g, '/')}`;
                setProxiedSrc(fileUrl);
            });
            return () => unsubscribe();
        }

        // Fallback for other protocols
        setIsLoading(false);
    }, [src]);

    // Actual image source (cached > proxied > original)
    const imageSrc = proxiedSrc || src;

    // Detect transparency when image loads
    useEffect(() => {
        if (!imageSrc || loadFailed) return;

        // Only detect for PNG format images to save performance
        if (isPNGFormat(imageSrc)) {
            hasImageTransparency(imageSrc).then((hasAlpha) => {
                setDetectedTransparency(hasAlpha);
            });
        } else {
            setDetectedTransparency(false);
        }
    }, [imageSrc, loadFailed]);

    // Sync refs whenever state changes
    useEffect(() => { scaleRef.current = scale; }, [scale]);
    useEffect(() => { positionRef.current = position; }, [position]);

    // Stable helpers that read from refs (never recreated)
    const updateScaleAndPosition = useCallback((newScale, newPosition) => {
        scaleRef.current = newScale;
        positionRef.current = newPosition;
        setScale(newScale);
        setPosition(newPosition);
    }, []);

    // Handle scroll wheel zoom - zoom toward mouse position (stable, no deps)
    const handleWheel = useCallback((e) => {
        e.preventDefault();

        const container = containerRef.current;
        if (!container) return;

        const currentScale = scaleRef.current;
        const currentPosition = positionRef.current;
        const rect = container.getBoundingClientRect();

        // Mouse position relative to container center
        const mouseX = e.clientX - rect.left - rect.width / 2;
        const mouseY = e.clientY - rect.top - rect.height / 2;

        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const newScale = Math.max(0.5, Math.min(5, currentScale + delta));

        if (newScale !== currentScale) {
            // Adjust position to zoom toward mouse
            const scaleRatio = newScale / currentScale;
            const newX = mouseX - (mouseX - currentPosition.x) * scaleRatio;
            const newY = mouseY - (mouseY - currentPosition.y) * scaleRatio;

            updateScaleAndPosition(newScale, { x: newX, y: newY });
        }
    }, [updateScaleAndPosition]);

    // Handle double-click to reset zoom
    const handleDoubleClick = useCallback(() => {
        updateScaleAndPosition(1, { x: 0, y: 0 });
    }, [updateScaleAndPosition]);

    // Start dragging (panning)
    const handleMouseDown = useCallback((e) => {
        if (scaleRef.current <= 1) return; // Only allow panning when zoomed in
        e.preventDefault();
        setIsDragging(true);
        setDragStart({
            x: e.clientX - positionRef.current.x,
            y: e.clientY - positionRef.current.y
        });
    }, []);

    // During drag
    const dragStartRef = useRef(dragStart);
    useEffect(() => { dragStartRef.current = dragStart; }, [dragStart]);

    const handleMouseMove = useCallback((e) => {
        setPosition({
            x: e.clientX - dragStartRef.current.x,
            y: e.clientY - dragStartRef.current.y
        });
    }, []);

    // End drag
    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Attach wheel event once (stable handler, never removed/re-added)
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, [handleWheel]);

    // Global mouse up to handle drag release outside container
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mousemove', handleMouseMove);
            return () => {
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('mousemove', handleMouseMove);
            };
        }
    }, [isDragging, handleMouseUp, handleMouseMove]);

    const zoomPercent = Math.round(scale * 100);

    // Determine cursor style
    const getCursor = () => {
        if (isDragging) return 'grabbing';
        if (scale > 1) return 'grab';
        return 'default';
    };

    // Handle drag start for system-level drag (only when not zoomed)
    const handleDragStart = useCallback((e) => {
        if (scaleRef.current > 1) {
            e.preventDefault();
            return;
        }
        e.preventDefault();
        if (electronAPI?.startDrag && src) {
            // Prefer fastest source for drag:
            // 1. Go-prefetched local file (instant)
            // 2. Cached base64 (fast writeFileSync in main)
            // 3. Proxied/cached src
            // 4. Original URL (slowest - needs download)
            const localUrl = src.startsWith('http') ? getLocalUrl(src) : null;
            const cached = src.startsWith('http') ? getCached(src) : null;
            electronAPI.startDrag(localUrl || cached || imageSrc || src);
        }
    }, [src, imageSrc]);

    return (
        <div
            ref={containerRef}
            onDoubleClick={handleDoubleClick}
            onMouseDown={handleMouseDown}
            draggable={scale <= 1}
            onDragStart={handleDragStart}
            className="w-full h-full flex items-center justify-center overflow-hidden relative bg-transparent"
            style={{ cursor: getCursor() }}
        >
            {/* Zoom percentage indicator */}
            {scale !== 1 && (
                <div
                    className="absolute top-4 left-4 z-10 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full font-mono tracking-wide shadow-lg border border-white/10 cursor-pointer hover:bg-black/80 transition-colors"
                    onClick={handleDoubleClick}
                    title={t('resetZoom')}
                >
                    {zoomPercent}%
                </div>
            )}

            {/* Unsaved indicator */}
            {src?.startsWith('data:') && (
                <div className="absolute top-4 right-4 z-10 bg-primary/80 backdrop-blur-md text-[10px] text-white px-2 py-1 rounded-full uppercase tracking-widest font-bold shadow-lg">
                    Unsaved
                </div>
            )}

            {/* Processing indicator for blob URLs (paste upload in progress) */}
            {(src?.startsWith('blob:') || imageSrc?.startsWith('blob:')) && (
                <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-md text-[10px] text-white px-3 py-1.5 rounded-full tracking-wide font-medium shadow-lg border border-white/10 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white/80 rounded-full animate-spin" />
                    載入中
                </div>
            )}

            {/* Loading spinner */}
            {isLoading && !loadFailed && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-8 h-8 border-3 border-white/20 border-t-white/80 rounded-full animate-spin" />
                </div>
            )}

            {loadFailed ? (
                <div className="flex flex-col items-center justify-center text-white/40 p-8">
                    <span className="text-4xl mb-3">✕</span>
                    <span className="text-base font-medium">暫不支援此來源</span>
                </div>
            ) : (
                (() => {
                    // Show checkerboard ONLY if transparency is actually detected
                    const shouldShowCheckerboard = detectedTransparency;

                    return (
                        <div
                            className="relative rounded-md"
                            style={{
                                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                                // Show checkerboard for images with transparency
                                ...(shouldShowCheckerboard ? {
                                    backgroundImage: `
                                        linear-gradient(45deg, #CCCCCC 25%, transparent 25%),
                                        linear-gradient(-45deg, #CCCCCC 25%, transparent 25%),
                                        linear-gradient(45deg, transparent 75%, #CCCCCC 75%),
                                        linear-gradient(-45deg, transparent 75%, #CCCCCC 75%)
                                    `,
                                    backgroundSize: '24px 24px',
                                    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                                    backgroundColor: '#FFFFFF'
                                } : {})
                            }}
                        >
                            <img
                        ref={imageRef}
                        src={imageSrc}
                        alt="View"
                        className={`block select-none transition-opacity duration-150 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
                        style={{
                            maxWidth: 'calc(100vw - 280px)',
                            maxHeight: 'calc(100vh - 160px)',
                            objectFit: crop ? 'none' : 'contain',
                            ...(crop && {
                                // Use object-view-box to show only crop region (centered & scaled)
                                objectViewBox: `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`,
                                objectFit: 'contain',
                            })
                        }}
                        draggable={false}
                        referrerPolicy="no-referrer"
                        onLoad={(e) => {
                            setIsLoading(false);
                            setImageSize({ width: e.target.clientWidth, height: e.target.clientHeight });
                        }}
                        onError={async () => {
                            // For HTTP URLs displayed natively, try proxy fallback chain
                            const urlToProxy = src?.startsWith('http') ? src : null;
                            if (urlToProxy && !proxiedSrc) {
                                // Layer 1: Try JS imageLoader (fetch with CORS)
                                try {
                                    const data = await loadImage(urlToProxy, PRIORITY_HIGH);
                                    if (data) {
                                        setProxiedSrc(data);
                                        return;
                                    }
                                } catch (e) {
                                    if (e?.name === 'AbortError') { setIsLoading(false); return; }
                                }
                                // Layer 2: Node.js proxy
                                if (electronAPI?.proxyImage) {
                                    try {
                                        const result = await electronAPI.proxyImage(urlToProxy);
                                        if (result.success) {
                                            cacheProxyResult(urlToProxy, result.data);
                                            setProxiedSrc(result.data);
                                            return;
                                        }
                                    } catch (e) {}
                                }
                                // Layer 3: Browser proxy
                                if (electronAPI?.proxyImageBrowser) {
                                    try {
                                        const result = await electronAPI.proxyImageBrowser(urlToProxy);
                                        if (result.success) {
                                            cacheProxyResult(urlToProxy, result.data);
                                            setProxiedSrc(result.data);
                                            return;
                                        }
                                    } catch (e) {}
                                }
                            }
                            setIsLoading(false);
                            setLoadFailed(true);
                        }}
                    />
                    {/* Annotations overlay */}
                    {annotations?.length > 0 && (
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                ...(crop && {
                                    objectViewBox: `inset(${crop.y}% ${100 - crop.x - crop.width}% ${100 - crop.y - crop.height}% ${crop.x}%)`,
                                })
                            }}
                        />
                    )}
                        </div>
                    );
                })()
            )}
        </div>
    );
};
