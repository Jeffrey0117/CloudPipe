import { useRef, useEffect, useState } from 'react';
import { drawAnnotation } from './utils/drawingHelpers.js';

export const AnnotationLayer = ({ activeTool, onDrawEnd, imageRef }) => {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const [annotations, setAnnotations] = useState([]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx || !imageRef.current) return;

        // Sync canvas size with image size
        const resizeCanvas = () => {
            canvas.width = imageRef.current.clientWidth;
            canvas.height = imageRef.current.clientHeight;
            redraw();
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [imageRef.current]);

    const redraw = () => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        annotations.forEach(ann => drawAnnotation(ctx, ann));
    };

    const handleMouseDown = (e) => {
        if (!activeTool) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setStartPos({ x, y });
        setIsDrawing(true);
    };

    const handleMouseMove = (e) => {
        if (!isDrawing || !activeTool) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        redraw();
        const ctx = canvasRef.current.getContext('2d');
        drawAnnotation(ctx, {
            type: activeTool,
            x: startPos.x,
            y: startPos.y,
            width: x - startPos.x,
            height: y - startPos.y
        });
    };

    const handleMouseUp = (e) => {
        if (!isDrawing || !activeTool) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newAnn = {
            type: activeTool,
            x: startPos.x,
            y: startPos.y,
            width: x - startPos.x,
            height: y - startPos.y
        };

        setAnnotations([...annotations, newAnn]);
        setIsDrawing(false);
        if (onDrawEnd) onDrawEnd([...annotations, newAnn]);
    };

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-10 cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
        />
    );
};
