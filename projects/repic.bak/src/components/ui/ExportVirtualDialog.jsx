import { useState } from 'react';
import { motion, AnimatePresence } from '../../lib/motion';
import { X, FolderOpen } from '../icons';
import { useTheme } from '../../contexts/ThemeContext';
import useI18n from '../../hooks/useI18n';
import { prepareAlbumExport } from '../../utils/repicFile';

const electronAPI = window.electronAPI || null;

export const ExportVirtualDialog = ({
  isOpen,
  onClose,
  album,
  onExportComplete
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const [targetFolder, setTargetFolder] = useState('');
  const [useNumbered, setUseNumbered] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const handleSelectFolder = async () => {
    if (!electronAPI) return;
    const folder = await electronAPI.selectDirectory();
    if (folder) {
      setTargetFolder(folder);
    }
  };

  const handleExport = async () => {
    if (!targetFolder || !album || album.images.length === 0) return;

    setIsExporting(true);

    try {
      // Prepare files for export
      const files = prepareAlbumExport(album.images, album.id, album.name, useNumbered);

      // Write files
      const result = await electronAPI.writeRepicFilesBatch(targetFolder, files);

      if (result.success) {
        onExportComplete?.(result.count);
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('[ExportVirtualDialog] Export failed:', error);
      alert(t('exportFailed', { error: error.message }));
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  const imageCount = album?.images?.length || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className={`w-[420px] rounded-2xl shadow-2xl overflow-hidden ${
              theme === 'dark'
                ? 'bg-surface border border-white/10'
                : 'bg-white border border-gray-200'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`flex items-center justify-between px-5 py-4 border-b ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <h2 className={`text-lg font-semibold ${
                theme === 'dark' ? 'text-white' : 'text-gray-800'
              }`}>
                {t('exportVirtualTitle')}
              </h2>
              <button
                onClick={onClose}
                className={`p-1.5 rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'hover:bg-white/10 text-white/60'
                    : 'hover:bg-gray-100 text-gray-500'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-5">
              {/* Album info */}
              <div className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                {album?.name} ({imageCount} {t('images')})
              </div>

              {/* Target folder */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>
                  {t('targetFolder')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={targetFolder}
                    readOnly
                    placeholder={t('selectDirectory')}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg ${
                      theme === 'dark'
                        ? 'bg-black/30 text-white border border-white/10'
                        : 'bg-gray-50 text-gray-800 border border-gray-200'
                    }`}
                  />
                  <button
                    onClick={handleSelectFolder}
                    className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      theme === 'dark'
                        ? 'bg-white/10 hover:bg-white/20 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <FolderOpen size={16} />
                    {t('browse')}
                  </button>
                </div>
              </div>

              {/* Filename format */}
              <div className="space-y-3">
                <label className={`text-sm font-medium ${
                  theme === 'dark' ? 'text-white/80' : 'text-gray-700'
                }`}>
                  {t('filenameFormat')}
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    !useNumbered
                      ? 'bg-primary/20 border border-primary/30'
                      : theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 border border-transparent'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}>
                    <input
                      type="radio"
                      name="format"
                      checked={!useNumbered}
                      onChange={() => setUseNumbered(false)}
                      className="accent-primary"
                    />
                    <div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        {t('useImageName')}
                      </div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
                        sunset-beach.repic
                      </div>
                    </div>
                  </label>
                  <label className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                    useNumbered
                      ? 'bg-primary/20 border border-primary/30'
                      : theme === 'dark'
                        ? 'bg-white/5 hover:bg-white/10 border border-transparent'
                        : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
                  }`}>
                    <input
                      type="radio"
                      name="format"
                      checked={useNumbered}
                      onChange={() => setUseNumbered(true)}
                      className="accent-primary"
                    />
                    <div>
                      <div className={`text-sm ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                        {t('useNumberedName')}
                      </div>
                      <div className={`text-xs ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
                        001-sunset-beach.repic
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`flex justify-end gap-3 px-5 py-4 border-t ${
              theme === 'dark' ? 'border-white/10' : 'border-gray-200'
            }`}>
              <button
                onClick={onClose}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  theme === 'dark'
                    ? 'bg-white/10 hover:bg-white/20 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleExport}
                disabled={!targetFolder || imageCount === 0 || isExporting}
                className="px-4 py-2 text-sm font-medium bg-primary hover:bg-primary/80 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? t('exporting') : t('exportVirtual')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
