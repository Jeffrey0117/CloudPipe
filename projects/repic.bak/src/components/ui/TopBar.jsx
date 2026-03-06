import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from '../../lib/motion';
import {
    FolderOpen,
    Info,
    Globe,
    Sun,
    Moon,
    Album
} from '../icons';
import { Button } from './Button';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

const electronAPI = window.electronAPI || null;

// Sidebar toggle icon
const PanelLeft = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M9 3v18" />
    </svg>
);

// Panel bottom icon
const PanelBottom = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 15h18" />
    </svg>
);

// Pin icon for always on top
const Pin = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 17v5" />
        <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6a1 1 0 0 1 1-1h1V3H7v2h1a1 1 0 0 1 1 1z" />
    </svg>
);

// Link/URL icon
const Link = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
);

// X close icon
const X = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </svg>
);

// Help/About icon
const HelpCircle = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path d="M12 17h.01" />
    </svg>
);

// Settings/Gear icon
const Settings = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

// Toolbar icons
const RotateCcw = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);

const Scissors = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="6" cy="6" r="3" />
        <path d="M8.12 8.12 12 12" />
        <path d="M20 4 8.12 15.88" />
        <circle cx="6" cy="18" r="3" />
        <path d="M14.8 14.8 20 20" />
    </svg>
);

const Copy = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
);

const Download = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
);

const Upload = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
);

const Layers = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
        <path d="m22 12.5-8.58 3.91a2 2 0 0 1-1.66 0L2 12.5" />
        <path d="m22 17.5-8.58 3.91a2 2 0 0 1-1.66 0L2 17.5" />
    </svg>
);

const FolderOutput = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M2 7.5V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3.5" />
        <path d="M2 13h10" />
        <path d="m5 10-3 3 3 3" />
    </svg>
);

const LayoutGrid = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
);

const ImageIcon = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
);

const Trash2 = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" x2="10" y1="11" y2="17" />
        <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
);

// Check if URL looks like a direct image URL
const looksLikeImageUrl = (url) => {
    if (!url) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const urlPath = url.split('?')[0].toLowerCase();
    return imageExtensions.some(ext => urlPath.endsWith(ext));
};

export const TopBar = ({
    currentPath,
    onOpenFolder,
    showInfoPanel,
    onToggleInfo,
    viewMode,
    onToggleViewMode,
    selectedAlbum,
    onAddAlbumImage,
    onScrapeUrl,
    albumSidebarCollapsed,
    onToggleAlbumSidebar,
    sidebarPosition,
    onToggleSidebarPosition,
    onAbout,
    // Toolbar props
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
    isMultiSelectMode,
    selectedImageIds,
    // Grid/Image view toggle
    currentViewMode,
    onToggleViewLayout
}) => {
    const { t, language, setLanguage } = useI18n();
    const { theme, toggleTheme } = useTheme();
    const [urlInput, setUrlInput] = useState('');
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false);

    // Load initial always on top state
    useEffect(() => {
        if (electronAPI?.getAlwaysOnTop) {
            electronAPI.getAlwaysOnTop().then(result => {
                if (result.success) {
                    setIsAlwaysOnTop(result.isAlwaysOnTop);
                }
            });
        }
    }, []);

    const toggleAlwaysOnTop = async () => {
        console.log('[TopBar] toggleAlwaysOnTop called, current:', isAlwaysOnTop);
        if (electronAPI?.setAlwaysOnTop) {
            const result = await electronAPI.setAlwaysOnTop(!isAlwaysOnTop);
            console.log('[TopBar] setAlwaysOnTop result:', result);
            if (result.success) {
                setIsAlwaysOnTop(result.isAlwaysOnTop);
            }
        } else {
            console.log('[TopBar] electronAPI.setAlwaysOnTop not available');
        }
    };

    // Get folder name using electronAPI or fallback
    const getFolderName = () => {
        if (viewMode === 'album') {
            return selectedAlbum?.name || t('selectOrCreateAlbum');
        }
        if (!currentPath) return t('openFolder');
        if (electronAPI && electronAPI.path) {
            return electronAPI.path.basename(currentPath);
        }
        // Fallback to simple string parsing
        return currentPath.split(/[\\/]/).pop() || currentPath;
    };

    const folderName = getFolderName();

    const handleAddUrl = (e) => {
        e.preventDefault();
        if (urlInput.trim() && onAddAlbumImage) {
            const urls = urlInput.split(/[\n,]/).map(u => u.trim()).filter(u => u.startsWith('http'));
            if (urls.length === 0) return;

            // Single webpage URL - trigger scrape
            if (urls.length === 1 && !looksLikeImageUrl(urls[0]) && onScrapeUrl) {
                onScrapeUrl(urls[0]);
            } else {
                // Direct image URLs - add directly
                urls.forEach(url => onAddAlbumImage(url));
            }
            setUrlInput('');
        }
    };

    const handlePaste = (e) => {
        const pastedText = e.clipboardData.getData('text');
        if (pastedText) {
            const urls = pastedText.split(/[\n,]/).map(u => u.trim()).filter(u => u.startsWith('http'));
            if (urls.length > 0) {
                e.preventDefault();
                // Single webpage URL - trigger scrape
                if (urls.length === 1 && !looksLikeImageUrl(urls[0]) && onScrapeUrl) {
                    onScrapeUrl(urls[0]);
                } else {
                    // Direct image URLs - add directly
                    urls.forEach(url => onAddAlbumImage(url));
                }
            }
        }
    };

    const nextLang = language === 'en' ? 'zh-TW' : 'en';
    const langDisplay = language === 'en' ? 'EN' : '中';

    return (
        <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`h-14 w-full backdrop-blur-xl border-b flex items-center justify-between px-6 z-30 ${
                theme === 'dark'
                    ? 'bg-surface/30 border-white/5'
                    : 'bg-white/80 border-black/10'
            }`}
        >
            {/* Left: Folder/Album Info */}
            <div className="flex items-center gap-2">
                {/* Album sidebar toggle - only in album mode */}
                {viewMode === 'album' && (
                    <button
                        onClick={onToggleAlbumSidebar}
                        className={`p-2 rounded-lg transition-all ${
                            albumSidebarCollapsed
                                ? 'bg-primary/20 text-primary'
                                : theme === 'dark'
                                    ? 'hover:bg-white/10 text-white/60'
                                    : 'hover:bg-black/10 text-gray-500'
                        }`}
                        title={albumSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
                    >
                        <PanelLeft size={18} />
                    </button>
                )}

                <div
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all border ${
                        viewMode === 'album' ? '' : 'cursor-pointer'
                    } ${
                        theme === 'dark'
                            ? 'bg-white/5 hover:bg-white/10 border-white/5'
                            : 'bg-black/5 hover:bg-black/10 border-black/10'
                    }`}
                    onClick={viewMode === 'local' ? onOpenFolder : undefined}
                >
                    {viewMode === 'album' ? (
                        <Album size={16} className="text-primary" />
                    ) : (
                        <FolderOpen size={16} className="text-primary" />
                    )}
                    <span className={`text-xs font-medium max-w-[150px] truncate ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{folderName}</span>
                </div>

                {/* Mode toggle - moved to left side */}
                <button
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        viewMode === 'album'
                            ? 'bg-primary/20 text-primary'
                            : theme === 'dark'
                                ? 'bg-white/5 hover:bg-white/10 text-white/70'
                                : 'bg-black/5 hover:bg-black/10 text-gray-600'
                    }`}
                    onClick={onToggleViewMode}
                    title={t('webAlbum')}
                >
                    <Album size={14} />
                    <span>{viewMode === 'album' ? t('album') : t('local')}</span>
                </button>

                {/* Add URL button - Album mode only */}
                {viewMode === 'album' && selectedAlbum && (
                    <button
                        onClick={() => setShowUrlModal(true)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            theme === 'dark'
                                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                : 'bg-primary/10 text-primary hover:bg-primary/20'
                        }`}
                    >
                        <Link size={14} />
                        {t('addUrl')}
                    </button>
                )}
            </div>

            {/* Center: Main Toolbar */}
            <div className={`flex items-center gap-0.5 px-2 py-1 rounded-xl border ${
                theme === 'dark'
                    ? 'bg-white/5 border-white/10'
                    : 'bg-black/5 border-black/10'
            }`}>
                <ToolbarButton
                    icon={RotateCcw}
                    title={t('refresh')}
                    onClick={onRefresh}
                    theme={theme}
                />
                <ToolbarButton
                    icon={Scissors}
                    title={t('editArea')}
                    onClick={onToggleEdit}
                    active={isEditing}
                    disabled={!hasImage}
                    theme={theme}
                />
                <ToolbarButton
                    icon={Copy}
                    title={t('copyToClipboard')}
                    onClick={onCopy}
                    disabled={isCopying || !hasImage}
                    loading={isCopying}
                    theme={theme}
                />
                <ToolbarButton
                    icon={Download}
                    title={t('download')}
                    onClick={onSave}
                    disabled={!hasImage}
                    theme={theme}
                />

                <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

                <ToolbarButton
                    icon={Upload}
                    title={t('upload')}
                    onClick={onUpload}
                    disabled={isUploading || viewMode === 'album'}
                    loading={isUploading}
                    theme={theme}
                />
                <ToolbarButton
                    icon={Layers}
                    title={t('uploadHistory')}
                    onClick={onToggleUploadHistory}
                    badge={uploadHistoryCount}
                    theme={theme}
                />

                <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

                <ToolbarButton
                    icon={FolderOutput}
                    title={t('exportVirtual')}
                    onClick={onExportVirtual}
                    disabled={viewMode !== 'album' || !selectedAlbum?.images?.length}
                    theme={theme}
                />
                <ToolbarButton
                    icon={Trash2}
                    title={isMultiSelectMode && selectedImageIds?.size > 0 ? `${t('delete')} (${selectedImageIds.size})` : t('delete')}
                    onClick={onDelete}
                    disabled={isMultiSelectMode ? selectedImageIds?.size === 0 : !hasImage}
                    danger
                    badge={isMultiSelectMode ? selectedImageIds?.size || 0 : 0}
                    theme={theme}
                />

                {onToggleViewLayout && (
                    <>
                        <div className={`w-px h-5 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                        <ToolbarButton
                            icon={currentViewMode === 'grid' ? ImageIcon : LayoutGrid}
                            title={currentViewMode === 'grid' ? t('switchToImageView') : t('switchToGridView')}
                            onClick={onToggleViewLayout}
                            theme={theme}
                        />
                    </>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-1">
                {/* Always on top toggle */}
                <button
                    className={`h-9 w-9 p-0 rounded-lg transition-colors flex items-center justify-center ${
                        isAlwaysOnTop
                            ? theme === 'dark' ? 'bg-white/20 text-white' : 'bg-black/20 text-gray-800'
                            : `hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`
                    }`}
                    onClick={toggleAlwaysOnTop}
                    title={isAlwaysOnTop ? t('unpinWindow') : t('pinWindow')}
                >
                    <Pin size={18} />
                </button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg transition-all ${showInfoPanel ? 'bg-primary/20 text-primary' : `hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}`}
                    onClick={onToggleInfo}
                    title={t('toggleInfo')}
                >
                    <Info size={18} />
                </Button>
                <Button
                    variant="ghost"
                    className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}
                    onClick={onToggleSidebarPosition}
                    title={sidebarPosition === 'left' ? '縮圖移到底部' : '縮圖移到左側'}
                >
                    {sidebarPosition === 'left' ? <PanelBottom size={18} /> : <PanelLeft size={18} />}
                </Button>

                <div className={`w-px h-6 mx-1 ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />

                {/* Settings dropdown */}
                <div className="relative">
                    <Button
                        variant="ghost"
                        className={`h-9 w-9 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/5 ${
                            showSettingsMenu
                                ? 'bg-primary/20 text-primary'
                                : theme === 'dark' ? 'text-white/70' : 'text-gray-600'
                        }`}
                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                        title={t('settings')}
                    >
                        <Settings size={18} />
                    </Button>
                    {showSettingsMenu && (
                        <>
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setShowSettingsMenu(false)}
                            />
                            <div className={`absolute right-0 top-full mt-2 z-50 w-48 py-1 rounded-xl border shadow-xl ${
                                theme === 'dark'
                                    ? 'bg-surface border-white/10'
                                    : 'bg-white border-black/10'
                            }`}>
                                <button
                                    onClick={() => { toggleTheme(); setShowSettingsMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                                        theme === 'dark'
                                            ? 'hover:bg-white/10 text-white/80'
                                            : 'hover:bg-black/5 text-gray-700'
                                    }`}
                                >
                                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                                    <span>{theme === 'dark' ? t('lightMode') : t('darkMode')}</span>
                                </button>
                                <button
                                    onClick={() => { setLanguage(nextLang); setShowSettingsMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                                        theme === 'dark'
                                            ? 'hover:bg-white/10 text-white/80'
                                            : 'hover:bg-black/5 text-gray-700'
                                    }`}
                                >
                                    <Globe size={16} />
                                    <span>{t('changeLanguage')}</span>
                                    <span className={`ml-auto text-xs font-bold ${theme === 'dark' ? 'text-white/50' : 'text-gray-400'}`}>{langDisplay}</span>
                                </button>
                                <div className={`my-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-black/10'}`} />
                                <button
                                    onClick={() => { onAbout(); setShowSettingsMenu(false); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                                        theme === 'dark'
                                            ? 'hover:bg-white/10 text-white/80'
                                            : 'hover:bg-black/5 text-gray-700'
                                    }`}
                                >
                                    <HelpCircle size={16} />
                                    <span>{t('about')}</span>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* URL Input Modal - rendered via Portal to avoid transform issues */}
            {createPortal(
                <AnimatePresence>
                    {showUrlModal && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                            onClick={() => setShowUrlModal(false)}
                        >
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.95, opacity: 0 }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-full max-w-md mx-4 p-5 rounded-2xl shadow-2xl border ${
                                    theme === 'dark'
                                        ? 'bg-surface border-white/10'
                                        : 'bg-white border-black/10'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className={`text-lg font-semibold ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                                        {t('addImageUrl')}
                                    </h3>
                                    <button
                                        onClick={() => setShowUrlModal(false)}
                                        className={`p-1.5 rounded-lg transition-colors ${
                                            theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/10 text-gray-500'
                                        }`}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    if (urlInput.trim() && onAddAlbumImage) {
                                        const urls = urlInput.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
                                        urls.forEach(url => onAddAlbumImage(url));
                                        setUrlInput('');
                                        setShowUrlModal(false);
                                    }
                                }}>
                                    <textarea
                                        value={urlInput}
                                        onChange={(e) => setUrlInput(e.target.value)}
                                        onPaste={(e) => {
                                            const pastedText = e.clipboardData.getData('text');
                                            if (pastedText) {
                                                const urls = pastedText.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
                                                if (urls.length > 0 && urls.every(url => url.startsWith('http'))) {
                                                    e.preventDefault();
                                                    urls.forEach(url => onAddAlbumImage(url));
                                                    setShowUrlModal(false);
                                                }
                                            }
                                        }}
                                        placeholder={t('pasteImageUrlPlaceholder')}
                                        rows={4}
                                        autoFocus
                                        className={`w-full px-3 py-2.5 text-sm rounded-xl resize-none transition-colors ${
                                            theme === 'dark'
                                                ? 'bg-white/5 text-white border border-white/10 placeholder:text-white/30 focus:border-primary/50'
                                                : 'bg-black/5 text-gray-800 border border-black/10 placeholder:text-gray-400 focus:border-primary/50'
                                        } focus:outline-none`}
                                    />
                                    <p className={`mt-2 text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                                        {t('urlInputHint')}
                                    </p>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowUrlModal(false)}
                                            className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                                                theme === 'dark'
                                                    ? 'bg-white/5 text-white/70 hover:bg-white/10'
                                                    : 'bg-black/5 text-gray-600 hover:bg-black/10'
                                            }`}
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={!urlInput.trim()}
                                            className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {t('addImage')}
                                        </button>
                                    </div>
                                </form>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </motion.div>
    );
};

// Toolbar button component
const ToolbarButton = ({
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
            className={`p-2 rounded-lg transition-all relative ${
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
                                : 'hover:bg-black/10 text-gray-500 hover:text-gray-700'
            }`}
        >
            <Icon size={18} className={loading ? 'animate-pulse' : ''} />
            {badge > 0 && (
                <span className={`absolute -top-0.5 -right-0.5 text-white text-[9px] rounded-full min-w-[14px] h-3.5 flex items-center justify-center font-bold px-0.5 ${
                    danger ? 'bg-red-500' : 'bg-primary'
                }`}>
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </button>
    );
};

