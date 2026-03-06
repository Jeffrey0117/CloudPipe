import { useState, useRef, useCallback } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Button } from '../../components/ui/Button';
import getCroppedImg from './utils/canvasUtils';
import { AnnotationLayer } from './AnnotationLayer';
import { Layers } from '../../components/icons';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

// Tab definitions
const TABS = {
  CROP: 'crop',
  ANNOTATE: 'annotate',
  MOSAIC: 'mosaic',
  COMPRESS: 'compress',
  REMOVE_BG: 'removebg'
};

export const ImageEditor = ({
  imageSrc,
  onCancel,
  onComplete,
  fileCount = 1,
  onApplyToAll,
  isVirtual = false
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Active tab
  const [activeTab, setActiveTab] = useState(TABS.CROP);

  // Crop state
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);

  // Annotation state
  const [activeTool, setActiveTool] = useState(null);
  const [annotations, setAnnotations] = useState([]);

  // Compress state
  const [quality, setQuality] = useState(85);
  const [estimatedSize, setEstimatedSize] = useState(null);

  // Remove background state
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [removedBgImage, setRemovedBgImage] = useState(null);

  const imgRef = useRef(null);

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrop = {
      unit: '%',
      width: 100,
      height: 100,
      x: 0,
      y: 0
    };
    setCrop(initialCrop);
    setCompletedCrop({
      unit: 'px',
      width,
      height,
      x: 0,
      y: 0
    });

    // Estimate initial size
    estimateCompressedSize(85);
  };

  // Estimate compressed size
  const estimateCompressedSize = useCallback((q) => {
    if (!imgRef.current) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imgRef.current.naturalWidth;
    canvas.height = imgRef.current.naturalHeight;
    ctx.drawImage(imgRef.current, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setEstimatedSize(blob.size);
      }
    }, 'image/jpeg', q / 100);
  }, []);

  const handleQualityChange = (e) => {
    const q = parseInt(e.target.value);
    setQuality(q);
    estimateCompressedSize(q);
  };

  // Handle background removal
  const handleRemoveBackground = async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.removeBackground) {
      console.error('Background removal not available');
      return;
    }

    setIsRemovingBg(true);
    try {
      const result = await electronAPI.removeBackground(imageSrc);
      if (result.success) {
        setRemovedBgImage(result.data);
      } else {
        console.error('Background removal failed:', result.error);
      }
    } catch (error) {
      console.error('Background removal error:', error);
    } finally {
      setIsRemovingBg(false);
    }
  };

  const handleSave = async () => {
    // If background was removed, use the removed background image
    if (activeTab === TABS.REMOVE_BG && removedBgImage) {
      onComplete(removedBgImage);
      return;
    }

    // For virtual images, return crop parameters
    if (isVirtual && crop) {
      onComplete({
        type: 'crop-params',
        crop: {
          x: crop.x,
          y: crop.y,
          width: crop.width,
          height: crop.height,
          unit: '%'
        }
      });
      return;
    }

    if (completedCrop && imgRef.current) {
      try {
        const croppedImage = await getCroppedImg(
          imgRef.current,
          completedCrop,
          0,
          1,
          annotations,
          activeTab === TABS.COMPRESS ? quality : 100
        );
        onComplete(croppedImage);
      } catch (e) {
        console.error('[ImageEditor] getCroppedImg error:', e);
      }
    } else {
      onComplete(imageSrc);
    }
  };

  // Annotation tools
  const annotationTools = [
    { id: 'rect', label: t('box'), icon: 'Square' },
    { id: 'circle', label: t('circle'), icon: 'Circle' },
    { id: 'arrow', label: t('arrow'), icon: 'ArrowUpRight' },
  ];

  // Mosaic tools
  const mosaicTools = [
    { id: 'blur', label: t('blur'), icon: 'Ghost' },
    { id: 'mosaic', label: t('mosaic') || '马赛克', icon: 'Grid' },
  ];

  // Tab content renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case TABS.ANNOTATE:
        return (
          <div className="flex justify-center gap-2">
            {annotationTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  activeTool === tool.id
                    ? 'bg-primary text-white'
                    : isDark
                      ? 'bg-white/5 text-white/60 hover:bg-white/10'
                      : 'bg-black/5 text-black/60 hover:bg-black/10'
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>
        );

      case TABS.MOSAIC:
        return (
          <div className="flex justify-center gap-2">
            {mosaicTools.map(tool => (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  activeTool === tool.id
                    ? 'bg-primary text-white'
                    : isDark
                      ? 'bg-white/5 text-white/60 hover:bg-white/10'
                      : 'bg-black/5 text-black/60 hover:bg-black/10'
                }`}
              >
                {tool.label}
              </button>
            ))}
          </div>
        );

      case TABS.COMPRESS:
        return (
          <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
            <div className="flex items-center gap-4 w-full">
              <span className={`text-xs ${isDark ? 'text-white/60' : 'text-black/60'}`}>
                {t('quality') || '质量'}
              </span>
              <input
                type="range"
                min="10"
                max="100"
                value={quality}
                onChange={handleQualityChange}
                className="flex-1 accent-primary"
              />
              <span className={`text-xs font-mono w-12 text-right ${isDark ? 'text-white' : 'text-black'}`}>
                {quality}%
              </span>
            </div>
            {estimatedSize && (
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                {t('estimatedSize') || '预估大小'}: {(estimatedSize / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        );

      case TABS.REMOVE_BG:
        return (
          <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto">
            <button
              onClick={handleRemoveBackground}
              disabled={isRemovingBg || !!removedBgImage}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                removedBgImage
                  ? isDark
                    ? 'bg-green-500/20 text-green-400 cursor-default'
                    : 'bg-green-500/20 text-green-600 cursor-default'
                  : isRemovingBg
                    ? isDark
                      ? 'bg-white/5 text-white/40 cursor-wait'
                      : 'bg-black/5 text-black/40 cursor-wait'
                    : 'bg-primary text-white hover:bg-blue-600'
              }`}
            >
              {isRemovingBg ? '處理中...' : removedBgImage ? '✓ 去背完成' : '一鍵去背'}
            </button>
            {removedBgImage && (
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-black/40'}`}>
                背景已移除，點擊「完成」保存
              </p>
            )}
          </div>
        );

      case TABS.CROP:
      default:
        return (
          <div className="flex justify-center items-center gap-4">
            <span className={`text-sm ${isDark ? 'text-white/60' : 'text-black/60'}`}>
              {t('cropHint') || '拖动调整裁剪区域'}
            </span>
            {fileCount > 1 && crop && onApplyToAll && (
              <button
                onClick={() => onApplyToAll?.(crop)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 rounded-lg text-xs font-medium transition-all border border-amber-500/30"
              >
                <Layers size={14} />
                {t('applyToOthers')}
              </button>
            )}
          </div>
        );
    }
  };

  // Tab definitions with labels
  const tabs = [
    { id: TABS.CROP, label: t('crop') || '裁剪' },
    { id: TABS.ANNOTATE, label: t('annotate') || '标注' },
    { id: TABS.MOSAIC, label: t('mosaic') || '马赛克' },
    { id: TABS.COMPRESS, label: t('compress') || '压缩' },
    { id: TABS.REMOVE_BG, label: t('removeBg') || '去背' },
  ];

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    // Reset annotation tool when switching tabs
    if (tabId === TABS.CROP) {
      setActiveTool(null);
    } else if (tabId === TABS.ANNOTATE) {
      setActiveTool('rect');
    } else if (tabId === TABS.MOSAIC) {
      setActiveTool('blur');
    } else if (tabId === TABS.REMOVE_BG) {
      setActiveTool(null);
      // Reset background removal state when switching away
      if (activeTab !== TABS.REMOVE_BG) {
        setRemovedBgImage(null);
      }
    } else {
      setActiveTool(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-black select-none">
      {/* Editor Container */}
      <div className="relative flex-1 bg-black w-full flex items-center justify-center overflow-hidden p-4">
        <div className="max-w-full max-h-full flex items-center justify-center relative">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            onComplete={(c) => setCompletedCrop(c)}
            disabled={activeTab !== TABS.CROP}
            style={(() => {
              // Check if displaying a PNG or removed background image
              const displaySrc = activeTab === TABS.REMOVE_BG && removedBgImage ? removedBgImage : imageSrc;
              const isPNG = displaySrc && (
                displaySrc.toLowerCase().includes('.png') ||
                displaySrc.toLowerCase().includes('image/png') ||
                displaySrc.toLowerCase().includes('data:image/png')
              );

              return isPNG || removedBgImage ? {
                // Checkerboard for PNG or removed background
                backgroundImage: `
                  linear-gradient(45deg, #CCCCCC 25%, transparent 25%),
                  linear-gradient(-45deg, #CCCCCC 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #CCCCCC 75%),
                  linear-gradient(-45deg, transparent 75%, #CCCCCC 75%)
                `,
                backgroundSize: '24px 24px',
                backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                backgroundColor: '#FFFFFF'
              } : {};
            })()}
          >
            <img
              ref={imgRef}
              src={activeTab === TABS.REMOVE_BG && removedBgImage ? removedBgImage : imageSrc}
              alt="Edit"
              onLoad={onImageLoad}
              className="max-w-full"
              style={{
                maxHeight: 'calc(100vh - 200px)',
                display: 'block'
              }}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
            />
          </ReactCrop>

          {imgRef.current && activeTool && (activeTab === TABS.ANNOTATE || activeTab === TABS.MOSAIC) && (
            <AnnotationLayer
              activeTool={activeTool}
              onDrawEnd={setAnnotations}
              imageRef={imgRef}
            />
          )}
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className={`backdrop-blur-md pb-safe-area-bottom px-4 py-3 space-y-3 shadow-glass w-full border-t z-20 ${
        isDark ? 'bg-surface/90 border-white/10' : 'bg-gray-100/95 border-black/10'
      }`}>
        {/* Tabs */}
        <div className={`flex justify-center gap-1 border-b pb-3 ${isDark ? 'border-white/5' : 'border-black/5'}`}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : isDark
                    ? 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    : 'text-black/50 hover:text-black/80 hover:bg-black/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[40px] flex items-center justify-center">
          {renderTabContent()}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between items-center max-w-2xl mx-auto w-full pt-2 border-t border-white/5">
          <Button
            variant="text"
            onClick={onCancel}
            className={isDark ? 'text-white/70 hover:text-white' : 'text-black/70 hover:text-black'}
          >
            {t('cancel')}
          </Button>

          <Button
            variant="text"
            onClick={handleSave}
            className="text-primary hover:text-blue-400 font-bold"
          >
            {t('done')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
