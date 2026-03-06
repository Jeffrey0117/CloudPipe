import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Trash2 } from '../../components/icons';
import { useTheme } from '../../contexts/ThemeContext';
import useI18n from '../../hooks/useI18n';

// Panel width constant
const PANEL_WIDTH = 220;
const TRANSITION_DURATION = 250;

export const AlbumSidebar = ({
  albums,
  selectedAlbumId,
  onSelectAlbum,
  onCreateAlbum,
  onRenameAlbum,
  onDeleteAlbum,
  onExportAlbums,
  onImportAlbums,
  onExportAlbum,
  onContextMenu,
  isVisible = true,
  renamingAlbumId = null,
  onClearRenaming
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');

  // Rename dialog state
  const [renameDialog, setRenameDialog] = useState({ open: false, albumId: null, albumName: '' });
  const renameInputRef = useRef(null);

  const handleCreate = () => {
    if (newAlbumName.trim()) {
      onCreateAlbum(newAlbumName.trim());
      setNewAlbumName('');
      setIsCreating(false);
    }
  };

  const openRenameDialog = (album) => {
    setRenameDialog({ open: true, albumId: album.id, albumName: album.name });
  };

  const closeRenameDialog = () => {
    setRenameDialog({ open: false, albumId: null, albumName: '' });
    onClearRenaming?.();
  };

  const handleRename = () => {
    if (renameDialog.albumName.trim() && renameDialog.albumId) {
      onRenameAlbum(renameDialog.albumId, renameDialog.albumName.trim());
      closeRenameDialog();
    }
  };

  const handleKeyDown = (e, action) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape') {
      if (isCreating) {
        setIsCreating(false);
        setNewAlbumName('');
      } else if (renameDialog.open) {
        closeRenameDialog();
      }
    }
  };

  // Track last processed rename ID to avoid duplicate processing
  const lastProcessedRenameId = useRef(null);

  // Handle external rename trigger (from context menu)
  useEffect(() => {
    if (renamingAlbumId && renamingAlbumId !== lastProcessedRenameId.current) {
      lastProcessedRenameId.current = renamingAlbumId;
      const album = albums.find(a => a.id === renamingAlbumId);
      if (album) {
        openRenameDialog(album);
      }
    }
  }, [renamingAlbumId, albums]);

  // Clear the ref when renaming is done
  useEffect(() => {
    if (!renamingAlbumId) {
      lastProcessedRenameId.current = null;
    }
  }, [renamingAlbumId]);

  // Focus input when dialog opens
  useEffect(() => {
    if (renameDialog.open && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renameDialog.open]);

  // CSS transition for smooth open/close - same as InfoPanel
  const sidebarStyle = {
    width: isVisible ? PANEL_WIDTH : 0,
    transition: `width ${TRANSITION_DURATION}ms cubic-bezier(0.32, 0.72, 0, 1)`,
    overflow: 'hidden',
  };

  return (
    <>
      <aside
        style={sidebarStyle}
        className={`h-full border-r flex flex-col shrink-0 ${
          theme === 'dark'
            ? 'bg-surface/50 border-white/5'
            : 'bg-gray-50 border-gray-200'
        }`}
      >
        {/* Fixed width inner container prevents content squish */}
        <div className="flex flex-col h-full" style={{ width: PANEL_WIDTH, minWidth: PANEL_WIDTH }}>
          {/* Header */}
          <div className={`flex items-center justify-between p-3 border-b ${theme === 'dark' ? 'border-white/5' : 'border-gray-200'}`}>
            <h2 className={`text-sm font-semibold ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
              {t('webAlbums')}
            </h2>
            <div className="flex items-center gap-1">
              <button
                onClick={onExportAlbums}
                title="匯出"
                className={`p-1.5 rounded text-[10px] ${theme === 'dark' ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-500'}`}
              >
                ↓
              </button>
              <label
                title="匯入"
                className={`p-1.5 rounded text-[10px] cursor-pointer ${theme === 'dark' ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-200 text-gray-500'}`}
              >
                ↑
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => onImportAlbums(reader.result);
                      reader.readAsText(file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Album List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {albums.map(album => (
              <div
                key={album.id}
                onClick={() => onSelectAlbum(album.id)}
                onDoubleClick={() => openRenameDialog(album)}
                onContextMenu={(e) => {
                  if (onContextMenu) {
                    e.preventDefault();
                    onContextMenu(e, album);
                  }
                }}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  selectedAlbumId === album.id
                    ? 'bg-primary/20 border border-primary/30'
                    : theme === 'dark'
                      ? 'hover:bg-white/5 border border-transparent'
                      : 'hover:bg-gray-100 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FolderOpen size={16} className="text-primary" />
                  <span
                    className={`text-sm font-medium truncate ${
                      theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                    }`}
                  >
                    {album.name}
                  </span>
                </div>
                <div className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>
                  {album.images.length} {t('images')}
                </div>
                {/* Delete button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDeleteAlbum) {
                      onDeleteAlbum(album.id);
                    }
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    theme === 'dark'
                      ? 'hover:bg-red-500/20 text-red-400'
                      : 'hover:bg-red-100 text-red-500'
                  }`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {/* Create New Album */}
            {isCreating ? (
              <div className={`p-3 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                <input
                  type="text"
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleCreate)}
                  placeholder={t('albumName')}
                  autoFocus
                  className={`w-full px-2 py-1.5 text-sm rounded ${
                    theme === 'dark'
                      ? 'bg-black/30 text-white border border-white/10 placeholder:text-white/30'
                      : 'bg-white text-gray-800 border border-gray-300 placeholder:text-gray-400'
                  }`}
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleCreate}
                    disabled={!newAlbumName.trim()}
                    className="flex-1 py-1.5 text-xs font-medium bg-primary text-white rounded hover:bg-primary/80 disabled:opacity-50"
                  >
                    {t('confirm')}
                  </button>
                  <button
                    onClick={() => { setIsCreating(false); setNewAlbumName(''); }}
                    className={`flex-1 py-1.5 text-xs font-medium rounded ${
                      theme === 'dark'
                        ? 'bg-white/10 text-white/70 hover:bg-white/20'
                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                    }`}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setIsCreating(true)}
                className={`w-full p-3 rounded-lg border-2 border-dashed text-sm font-medium transition-all ${
                  theme === 'dark'
                    ? 'border-white/10 text-white/40 hover:border-primary/50 hover:text-primary'
                    : 'border-gray-300 text-gray-400 hover:border-primary/50 hover:text-primary'
                }`}
              >
                + {t('newAlbum')}
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Rename Dialog */}
      {createPortal(
        renameDialog.open && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={closeRenameDialog}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className={`w-80 p-4 rounded-xl shadow-2xl border ${
                theme === 'dark'
                  ? 'bg-surface border-white/10'
                  : 'bg-white border-gray-200'
              }`}
            >
              <h3 className={`text-base font-semibold mb-3 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                {t('rename')}
              </h3>
              <input
                ref={renameInputRef}
                type="text"
                value={renameDialog.albumName}
                onChange={(e) => setRenameDialog(prev => ({ ...prev, albumName: e.target.value }))}
                onKeyDown={(e) => handleKeyDown(e, handleRename)}
                className={`w-full px-3 py-2 text-sm rounded-lg ${
                  theme === 'dark'
                    ? 'bg-white/5 text-white border border-white/10 focus:border-primary/50'
                    : 'bg-gray-50 text-gray-800 border border-gray-300 focus:border-primary/50'
                } outline-none transition-colors`}
              />
              <div className="flex gap-2 mt-4">
                <button
                  onClick={closeRenameDialog}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                    theme === 'dark'
                      ? 'bg-white/5 text-white/70 hover:bg-white/10'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {t('cancel')}
                </button>
                <button
                  onClick={handleRename}
                  disabled={!renameDialog.albumName.trim()}
                  className="flex-1 py-2 text-sm font-medium bg-primary rounded-lg hover:bg-primary/80 disabled:opacity-50 transition-colors"
                  style={{ color: '#ffffff' }}
                >
                  {t('confirm')}
                </button>
              </div>
            </div>
          </div>
        ),
        document.body
      )}
    </>
  );
};

export default AlbumSidebar;
