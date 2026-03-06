import { useState, useEffect, useRef } from 'react';
import {
  RotateCcw,
  Scissors,
  Trash2,
  Download,
  Upload,
  FolderOutput,
  Layers,
  Copy
} from '../icons';
import { useTheme } from '../../contexts/ThemeContext';
import useI18n from '../../hooks/useI18n';

/**
 * Floating toolbar at the bottom center of the screen
 * Auto-hides when mouse is idle, shows on hover
 * Uses CSS transitions for smooth, flicker-free animation
 */
export const FloatingToolbar = ({
  onRefresh,
  onToggleEdit,
  isEditing,
  onCopy,
  isCopying,
  onUpload,
  isUploading,
  onToggleUploadHistory,
  uploadHistoryCount,
  onExportVirtual,
  onDelete,
  onSave,
  hasImage,
  viewMode,
  selectedAlbum,
  isMultiSelectMode,
  selectedImageIds
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const toolbarRef = useRef(null);

  // Auto-hide logic - show near bottom, hide when leave toolbar
  useEffect(() => {
    const handleMouseMove = (e) => {
      // Show when near the bottom of the screen (60px zone)
      const isNearBottom = window.innerHeight - e.clientY < 60;

      if (isNearBottom || isHovered) {
        setIsVisible(true);
      } else if (!isHovered) {
        setIsVisible(false);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isHovered]);

  // Keep visible when editing
  useEffect(() => {
    if (isEditing) {
      setIsVisible(true);
    }
  }, [isEditing]);

  const deleteTitle = isMultiSelectMode && selectedImageIds?.size > 0
    ? `${t('delete')} (${selectedImageIds.size})`
    : t('delete');

  const isDeleteDisabled = isMultiSelectMode
    ? selectedImageIds?.size === 0
    : !hasImage;

  return (
    <div
      ref={toolbarRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-2 py-1.5 rounded-2xl border shadow-2xl backdrop-blur-xl transition-all duration-150 ease-out ${
        isDark
          ? 'bg-black/70 border-white/10'
          : 'bg-white/80 border-black/10'
      } ${
        isVisible
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-2 scale-95 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-0.5">
        <ToolButton
          icon={RotateCcw}
          title={t('refresh')}
          onClick={onRefresh}
          theme={theme}
        />

        <Divider theme={theme} />

        <ToolButton
          icon={Scissors}
          title={t('editArea')}
          onClick={onToggleEdit}
          active={isEditing}
          disabled={!hasImage}
          theme={theme}
        />

        <ToolButton
          icon={Copy}
          title={t('copyToClipboard')}
          onClick={onCopy}
          disabled={isCopying || !hasImage}
          loading={isCopying}
          theme={theme}
        />

        <ToolButton
          icon={Download}
          title={t('download')}
          onClick={onSave}
          disabled={!hasImage}
          theme={theme}
        />

        <Divider theme={theme} />

        <ToolButton
          icon={Upload}
          title={t('upload')}
          onClick={onUpload}
          disabled={isUploading || viewMode === 'album'}
          loading={isUploading}
          theme={theme}
        />

        <ToolButton
          icon={Layers}
          title={t('uploadHistory')}
          onClick={onToggleUploadHistory}
          badge={uploadHistoryCount}
          theme={theme}
        />

        <Divider theme={theme} />

        <ToolButton
          icon={FolderOutput}
          title={t('exportVirtual')}
          onClick={onExportVirtual}
          disabled={viewMode !== 'album' || !selectedAlbum?.images?.length}
          theme={theme}
        />

        <ToolButton
          icon={Trash2}
          title={deleteTitle}
          onClick={onDelete}
          disabled={isDeleteDisabled}
          danger
          badge={isMultiSelectMode ? selectedImageIds?.size || 0 : 0}
          theme={theme}
        />
      </div>
    </div>
  );
};

const Divider = ({ theme }) => (
  <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
);

const ToolButton = ({
  icon: Icon,
  title,
  onClick,
  active = false,
  disabled = false,
  loading = false,
  danger = false,
  badge = 0,
  theme = 'dark'
}) => {
  const isDark = theme === 'dark';

  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-2.5 rounded-xl transition-all relative ${
        disabled
          ? 'opacity-40 cursor-not-allowed'
          : active
            ? 'bg-primary/20 text-primary'
            : danger
              ? isDark
                ? 'hover:bg-red-500/20 text-red-400 hover:text-red-300'
                : 'hover:bg-red-50 text-red-500 hover:text-red-600'
              : isDark
                ? 'hover:bg-white/10 text-white/60 hover:text-white'
                : 'hover:bg-black/10 text-gray-500 hover:text-gray-800'
      }`}
    >
      <Icon size={20} className={loading ? 'animate-pulse' : ''} />
      {badge > 0 && (
        <span className={`absolute -top-1 -right-1 text-white text-[10px] rounded-full min-w-[16px] h-4 flex items-center justify-center font-bold px-1 ${
          danger ? 'bg-red-500' : 'bg-primary'
        }`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  );
};

export default FloatingToolbar;
