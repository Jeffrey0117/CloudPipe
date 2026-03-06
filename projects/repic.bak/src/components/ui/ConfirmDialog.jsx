import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from '../../lib/motion';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Custom confirm dialog to replace browser confirm()
 * Usage:
 *   const [confirm, ConfirmDialog] = useConfirmDialog();
 *   const result = await confirm('Delete this?', { confirmText: 'Delete', danger: true });
 */
export const ConfirmDialog = memo(({
  isOpen,
  title,
  message,
  confirmText = '確認',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel
}) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onCancel?.();
      if (e.key === 'Enter') onConfirm?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onConfirm, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={`rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border ${
              isDark
                ? 'bg-[#1a1a1a] border-white/10'
                : 'bg-white border-black/10'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
            )}
            <p className={`text-sm mb-6 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>{message}</p>

            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isDark
                    ? 'text-white/60 hover:text-white hover:bg-white/5'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
                }`}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  danger
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                    : 'bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30'
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

ConfirmDialog.displayName = 'ConfirmDialog';

export default ConfirmDialog;
