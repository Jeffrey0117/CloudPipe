import { useState, useRef } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '../../components/ui/Button';
import getCroppedImg from './utils/canvasUtils';
import { AnnotationLayer } from './AnnotationLayer';
import { Layers } from '../../components/icons';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

export const ImageCropper = ({ imageSrc, onCancel, onComplete, fileCount = 1, onApplyToAll, isVirtual = false }) => {
    const { t } = useI18n();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [crop, setCrop] = useState();
    const [completedCrop, setCompletedCrop] = useState(null);
    const [activeTool, setActiveTool] = useState(null);
    const [annotations, setAnnotations] = useState([]);
    const imgRef = useRef(null);

    const onImageLoad = (e) => {
        const { width, height } = e.currentTarget;

        // Set initial crop to cover 100% of the image per SPEC-001
        const initialCrop = {
            unit: '%',
            width: 100,
            height: 100,
            x: 0,
            y: 0
        };
        setCrop(initialCrop);

        // Also set completedCrop in pixels for immediate save capability
        setCompletedCrop({
            unit: 'px',
            width,
            height,
            x: 0,
            y: 0
        });
    };

    const handleSave = async () => {
        // For virtual images, return edit parameters instead of generating image
        if (isVirtual) {
            // Convert annotations to percentage-based coordinates
            const img = imgRef.current;
            const percentAnnotations = img && annotations.length > 0
                ? annotations.map(ann => ({
                    type: ann.type,
                    x: (ann.x / img.clientWidth) * 100,
                    y: (ann.y / img.clientHeight) * 100,
                    width: (ann.width / img.clientWidth) * 100,
                    height: (ann.height / img.clientHeight) * 100,
                    unit: '%'
                }))
                : [];

            onComplete({
                type: 'edit-params',
                crop: crop ? {
                    x: crop.x,
                    y: crop.y,
                    width: crop.width,
                    height: crop.height,
                    unit: '%'
                } : null,
                annotations: percentAnnotations
            });
            return;
        }

        if (completedCrop && imgRef.current) {
            try {
                const croppedImage = await getCroppedImg(
                    imgRef.current,
                    completedCrop,
                    0,  // rotate
                    1,  // scale
                    annotations
                );
                onComplete(croppedImage);
            } catch (e) {
                console.error('[ImageCropper] getCroppedImg error:', e);
            }
        } else {
            onComplete(imageSrc);
        }
    };

    const tools = [
        { id: null, label: t('crop'), icon: 'Crop' },  // null = crop mode
        { id: 'rect', label: t('box'), icon: 'Square' },
        { id: 'circle', label: t('circle'), icon: 'Circle' },
        { id: 'arrow', label: t('arrow'), icon: 'ArrowUpRight' },
        { id: 'blur', label: t('blur'), icon: 'Ghost' },
    ];

    return (
        <div className="flex flex-col h-full w-full bg-black select-none">

            {/* Cropper Container */}
            <div className="relative flex-1 bg-black w-full flex items-center justify-center overflow-hidden p-4">
                <div className="max-w-full max-h-full flex items-center justify-center relative">
                    <ReactCrop
                        crop={crop}
                        onChange={(_, percentCrop) => setCrop(percentCrop)}
                        onComplete={(c) => setCompletedCrop(c)}
                        disabled={!!activeTool}
                    >
                        <img
                            ref={imgRef}
                            src={imageSrc}
                            alt="Crop me"
                            onLoad={onImageLoad}
                            className="max-w-full"
                            style={{
                                maxHeight: 'calc(100vh - 350px)',
                                maxWidth: 'calc(100vw - 120px)',
                                display: 'block'
                            }}
                            referrerPolicy="no-referrer"
                            crossOrigin="anonymous"
                        />
                    </ReactCrop>

                    {imgRef.current && activeTool && (
                        <AnnotationLayer
                            activeTool={activeTool}
                            onDrawEnd={setAnnotations}
                            imageRef={imgRef}
                        />
                    )}
                </div>
            </div>

            {/* Controls Toolbar - theme aware */}
            <div className={`backdrop-blur-md pb-safe-area-bottom px-8 py-4 space-y-4 shadow-glass w-full border-t z-20 ${isDark ? 'bg-surface/90 border-white/10' : 'bg-gray-100/95 border-black/10'}`}>

                {/* Mode Tools */}
                <div className={`flex justify-center gap-2 border-b pb-4 ${isDark ? 'border-white/5' : 'border-black/5'}`}>
                    {tools.map(tool => (
                        <button
                            key={tool.id ?? 'crop'}
                            onClick={() => setActiveTool(tool.id)}
                            className={`px-3 py-1.5 rounded-lg text-xs transition-all ${activeTool === tool.id
                                ? 'bg-primary text-white'
                                : isDark
                                    ? 'bg-white/5 text-white/60 hover:bg-white/10'
                                    : 'bg-black/5 text-black/60 hover:bg-black/10'}`}
                        >
                            {tool.label}
                        </button>
                    ))}
                </div>

                <div className="flex justify-between items-center max-w-2xl mx-auto w-full pt-2">
                    <Button variant="text" onClick={onCancel} className={isDark ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'}>
                        {t('cancel')}
                    </Button>

                    <div className="flex items-center gap-4">
                        <span className={`text-sm font-semibold tracking-wide ${isDark ? 'text-white' : 'text-black'}`}>
                            {activeTool ? t('draw', { tool: activeTool }) : t('cropMode')}
                        </span>

                        {/* Apply to Others - only show when multiple files */}
                        {fileCount > 1 && crop && (
                            <button
                                onClick={() => onApplyToAll?.(crop)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-lg text-xs font-medium transition-all border border-amber-500/30"
                            >
                                <Layers size={14} />
                                {t('applyToOthers')}
                            </button>
                        )}
                    </div>

                    <Button variant="text" onClick={handleSave} className="text-primary hover:text-blue-400 font-bold">
                        {t('done')}
                    </Button>
                </div>
            </div>
        </div>
    );
};
