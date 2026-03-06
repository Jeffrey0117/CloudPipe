import { useState, useRef, useEffect } from 'react';
import { LazyImage } from '../ui/LazyImage';
import { ContextMenu } from '../ui/ContextMenu';
import { Scissors, Layers, Pencil } from '../icons';

/**
 * ThumbnailGrid - Grid view for album images
 *
 * @param {Array} images - Album images array
 * @param {number} currentIndex - Currently selected image index
 * @param {Function} onSelectImage - Callback when image is clicked (index)
 * @param {string} size - Grid size: 'small' | 'medium' | 'large'
 * @param {boolean} isMultiSelectMode - Multi-select mode
 * @param {Set} selectedImageIds - Selected image IDs
 * @param {Set} processingImageIds - IDs of images being processed
 * @param {Function} onToggleSelect - Toggle image selection
 * @param {Function} onRemoveBackground - Callback for removing background from image(s)
 * @param {Function} onRenameImage - Callback for renaming image (imageId, newName)
 */
export const ThumbnailGrid = ({
  images,
  currentIndex,
  onSelectImage,
  size = 'medium',
  isMultiSelectMode = false,
  selectedImageIds = new Set(),
  processingImageIds = new Set(),
  onToggleSelect,
  onRemoveBackground,
  onRenameImage
}) => {
  // Grid sizes (in pixels)
  const sizes = {
    small: 128,
    medium: 192,
    large: 256
  };
  const thumbSize = sizes[size];

  // Context menu state
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    position: { x: 0, y: 0 },
    targetImage: null,
    targetIndex: null
  });

  // Rename state
  const [renamingImageId, setRenamingImageId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef(null);

  // Focus and select rename input when renaming starts
  useEffect(() => {
    if (renamingImageId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingImageId]);

  // Handle right-click on thumbnail
  const handleContextMenu = (e, image, index) => {
    e.preventDefault();
    e.stopPropagation();

    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY },
      targetImage: image,
      targetIndex: index
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      isOpen: false,
      position: { x: 0, y: 0 },
      targetImage: null,
      targetIndex: null
    });
  };

  // Handle remove background action
  const handleRemoveBackground = () => {
    if (isMultiSelectMode && selectedImageIds.size > 0) {
      // Batch remove background for selected images
      const selectedImages = images.filter(img => selectedImageIds.has(img.id));
      onRemoveBackground?.(selectedImages, true);
    } else if (contextMenu.targetImage) {
      // Single image remove background
      onRemoveBackground?.([contextMenu.targetImage], false);
    }
  };

  // Handle rename from context menu
  const handleStartRename = () => {
    if (contextMenu.targetImage) {
      const currentName = contextMenu.targetImage.name ||
        `${contextMenu.targetIndex + 1}.jpg`;
      setRenamingImageId(contextMenu.targetImage.id);
      setRenameValue(currentName);
      closeContextMenu();
    }
  };

  // Handle rename submit
  const handleRenameSubmit = () => {
    if (renamingImageId && renameValue.trim() && onRenameImage) {
      onRenameImage(renamingImageId, renameValue.trim());
    }
    setRenamingImageId(null);
    setRenameValue('');
  };

  // Handle rename cancel
  const handleRenameCancel = () => {
    setRenamingImageId(null);
    setRenameValue('');
  };

  // Handle double-click on image name
  const handleNameDoubleClick = (e, image, index) => {
    e.stopPropagation();
    const currentName = image.name || `${index + 1}.jpg`;
    setRenamingImageId(image.id);
    setRenameValue(currentName);
  };

  // Context menu items
  const getContextMenuItems = () => {
    const items = [];

    // Rename option
    if (onRenameImage && !isMultiSelectMode) {
      items.push({
        label: 'Rename',
        icon: Pencil,
        onClick: handleStartRename
      });
    }

    // Remove Background option
    if (onRemoveBackground) {
      if (isMultiSelectMode && selectedImageIds.size > 0) {
        items.push({
          label: `Remove Background (${selectedImageIds.size} images)`,
          icon: Scissors,
          onClick: handleRemoveBackground
        });
      } else {
        items.push({
          label: 'Remove Background',
          icon: Scissors,
          onClick: handleRemoveBackground
        });
      }
    }

    return items;
  };

  return (
    <div className="w-full h-full overflow-y-auto overflow-x-hidden p-4 bg-[#0A0A0A]">
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${thumbSize}px, 1fr))`
        }}
      >
        {images.map((image, index) => {
          const isSelected = selectedImageIds.has(image.id);
          const isCurrent = index === currentIndex;
          const isProcessing = processingImageIds.has(image.id);

          return (
            <div
              key={image.id}
              className={`
                relative group cursor-pointer rounded-lg overflow-hidden
                transition-all duration-200
                ${isCurrent ? 'ring-2 ring-primary scale-105' : 'hover:scale-105'}
                ${isSelected ? 'ring-2 ring-blue-500' : ''}
              `}
              style={{
                aspectRatio: '1',
                height: `${thumbSize}px`
              }}
              onClick={(e) => {
                if (isMultiSelectMode) {
                  e.preventDefault();
                  onToggleSelect?.(image.id);
                } else {
                  onSelectImage(index);
                }
              }}
              onContextMenu={(e) => handleContextMenu(e, image, index)}
            >
              {/* Thumbnail */}
              <LazyImage
                src={image.processedUrl || image.url || image.src}
                alt={image.name || `Image ${index + 1}`}
                className="w-full h-full"
                useThumbnail
                showSpinner={true}
                hasTransparency={image.hasBackgroundRemoved || !!image.processedUrl}
              />

              {/* Multi-select checkbox */}
              {isMultiSelectMode && (
                <div className="absolute top-2 right-2 z-10">
                  <div
                    className={`
                      w-6 h-6 rounded border-2 flex items-center justify-center
                      transition-colors duration-200
                      ${isSelected
                        ? 'bg-blue-500 border-blue-500'
                        : 'bg-black/50 border-white/30 group-hover:border-white/60'
                      }
                    `}
                  >
                    {isSelected && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                </div>
              )}

              {/* Image name overlay (on hover or when renaming) */}
              <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 transition-opacity duration-200 ${
                renamingImageId === image.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}>
                {renamingImageId === image.id ? (
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameSubmit();
                      } else if (e.key === 'Escape') {
                        handleRenameCancel();
                      }
                      e.stopPropagation();
                    }}
                    onBlur={handleRenameSubmit}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 text-xs bg-white/10 text-white border border-white/20 rounded focus:outline-none focus:border-primary"
                  />
                ) : (
                  <p
                    className="text-xs text-white/90 truncate cursor-text"
                    onDoubleClick={(e) => handleNameDoubleClick(e, image, index)}
                  >
                    {image.name || `${index + 1}.jpg`}
                  </p>
                )}
              </div>

              {/* Current indicator badge */}
              {isCurrent && !isMultiSelectMode && (
                <div className="absolute top-2 left-2 bg-primary px-2 py-0.5 rounded text-xs font-medium">
                  Current
                </div>
              )}

              {/* Background removed indicator */}
              {image.hasBackgroundRemoved && !isProcessing && (
                <div className="absolute bottom-2 right-2 bg-green-500/90 p-1 rounded backdrop-blur-sm" title="Background removed">
                  <Scissors size={12} className="text-white" />
                </div>
              )}

              {/* Processing indicator */}
              {isProcessing && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-xs text-white/80">Processing...</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {images.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-white/40">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="mb-4">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
          </svg>
          <p className="text-lg">No images in this album</p>
        </div>
      )}

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={closeContextMenu}
        items={getContextMenuItems()}
      />
    </div>
  );
};
