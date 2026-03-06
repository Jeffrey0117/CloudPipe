/**
 * Shared drawing helper functions for annotation rendering
 */
import {
    STROKE_WIDTH,
    STROKE_COLOR,
    STROKE_CAP,
    BLUR_AMOUNT,
    ARROW_HEAD_LENGTH
} from '../../../constants/drawing.js';

/**
 * Setup stroke style on canvas context
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} color - Stroke color (defaults to STROKE_COLOR)
 * @param {number} width - Stroke width (defaults to STROKE_WIDTH)
 */
export function setupStrokeStyle(ctx, color = STROKE_COLOR, width = STROKE_WIDTH) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = STROKE_CAP;
}

/**
 * Draw an arrow annotation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with x, y, width, height
 * @param {number} scale - Scale factor for arrow head (defaults to 1)
 */
export function drawArrow(ctx, annotation, scale = 1) {
    const { x, y, width, height } = annotation;
    const headlen = ARROW_HEAD_LENGTH * scale;
    const tox = x + width;
    const toy = y + height;
    const dx = tox - x;
    const dy = toy - y;
    const angle = Math.atan2(dy, dx);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle - Math.PI / 6), toy - headlen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(tox, toy);
    ctx.lineTo(tox - headlen * Math.cos(angle + Math.PI / 6), toy - headlen * Math.sin(angle + Math.PI / 6));
    ctx.stroke();
}

/**
 * Draw a rectangle annotation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with x, y, width, height
 */
export function drawRect(ctx, annotation) {
    const { x, y, width, height } = annotation;
    ctx.strokeRect(x, y, width, height);
}

/**
 * Draw a circle/ellipse annotation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with x, y, width, height
 */
export function drawCircle(ctx, annotation) {
    const { x, y, width, height } = annotation;
    ctx.beginPath();
    ctx.ellipse(
        x + width / 2,
        y + height / 2,
        Math.abs(width / 2),
        Math.abs(height / 2),
        0,
        0,
        Math.PI * 2
    );
    ctx.stroke();
}

/**
 * Draw a blur annotation
 * For preview mode (no image source), draws a semi-transparent overlay
 * For export mode (with image source), applies actual blur filter
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with x, y, width, height
 * @param {HTMLImageElement|null} image - Image element for actual blur (null for preview)
 */
export function drawBlur(ctx, annotation, image = null) {
    const { x, y, width, height } = annotation;

    if (image) {
        // Export mode: apply actual blur filter
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.filter = `blur(${BLUR_AMOUNT}px)`;
        ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
        ctx.restore();
    } else {
        // Preview mode: draw semi-transparent overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.strokeRect(x, y, width, height);
    }
}

/**
 * Draw a mosaic/pixelate annotation
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with x, y, width, height
 * @param {HTMLImageElement|null} image - Image element for actual mosaic (null for preview)
 * @param {number} pixelSize - Size of mosaic blocks (default 10)
 */
export function drawMosaic(ctx, annotation, image = null, pixelSize = 10) {
    const { x, y, width, height } = annotation;

    if (image) {
        // Export mode: apply actual mosaic effect
        ctx.save();

        // Get the region from the image
        const scaleX = image.naturalWidth / ctx.canvas.width;
        const scaleY = image.naturalHeight / ctx.canvas.height;
        const srcX = x * scaleX;
        const srcY = y * scaleY;
        const srcW = width * scaleX;
        const srcH = height * scaleY;

        // Create temp canvas for pixelation
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Draw at small size then scale up for pixelation
        const smallW = Math.max(1, Math.floor(Math.abs(srcW) / pixelSize));
        const smallH = Math.max(1, Math.floor(Math.abs(srcH) / pixelSize));
        tempCanvas.width = smallW;
        tempCanvas.height = smallH;

        tempCtx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, smallW, smallH);

        // Draw back scaled up with pixelation
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tempCanvas, 0, 0, smallW, smallH, x, y, width, height);
        ctx.imageSmoothingEnabled = true;

        ctx.restore();
    } else {
        // Preview mode: draw grid pattern
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fillRect(x, y, width, height);

        // Draw grid lines for preview
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        const gridSize = 8;
        for (let gx = x; gx < x + width; gx += gridSize) {
            ctx.beginPath();
            ctx.moveTo(gx, y);
            ctx.lineTo(gx, y + height);
            ctx.stroke();
        }
        for (let gy = y; gy < y + height; gy += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + width, gy);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.strokeRect(x, y, width, height);
    }
}

/**
 * Draw any annotation based on its type
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} annotation - Annotation object with type, x, y, width, height
 * @param {Object} options - Drawing options
 * @param {number} options.scale - Scale factor for stroke width and arrow heads
 * @param {HTMLImageElement|null} options.image - Image for blur effect
 * @param {string} options.color - Stroke color
 */
export function drawAnnotation(ctx, annotation, options = {}) {
    const { scale = 1, image = null, color = STROKE_COLOR } = options;

    setupStrokeStyle(ctx, color, STROKE_WIDTH * scale);

    switch (annotation.type) {
        case 'rect':
            drawRect(ctx, annotation);
            break;
        case 'circle':
            drawCircle(ctx, annotation);
            break;
        case 'arrow':
            drawArrow(ctx, annotation, scale);
            break;
        case 'blur':
            drawBlur(ctx, annotation, image);
            break;
        case 'mosaic':
            drawMosaic(ctx, annotation, image);
            break;
        default:
            console.warn(`Unknown annotation type: ${annotation.type}`);
    }
}
