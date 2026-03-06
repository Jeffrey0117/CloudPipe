import { memo, useEffect } from 'react';
import { motion, AnimatePresence } from '../../lib/motion';
import useI18n from '../../hooks/useI18n';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * About dialog showing app info, version, and credits
 */
export const AboutDialog = memo(({ isOpen, onClose }) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // Get version from electron or fallback
  const version = window.electron?.version || '1.0.0';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className={`rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center border ${
              isDark
                ? 'bg-[#1a1a1a] border-white/10'
                : 'bg-white border-black/10'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* App Icon */}
            <div className="w-24 h-24 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-50 to-gray-50 flex items-center justify-center p-2">
              <img src="/logo.png" alt="Repic Logo" className="w-full h-full object-contain" />
            </div>

            {/* App Name */}
            <h2 className={`text-2xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>Repic</h2>

            {/* Version */}
            <p className={`text-sm mb-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              {t('version') || 'Version'} {version}
            </p>

            {/* Description */}
            <p className={`text-sm mb-6 leading-relaxed ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              {t('aboutDescription') || '快速、輕量的圖片管理工具。支援本地圖片瀏覽、網頁圖片收藏、基礎編輯等功能。'}
            </p>

            {/* Links */}
            <div className="flex justify-center gap-4 mb-6">
              <a
                href="https://github.com/mrbear01/repic"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm flex items-center gap-1.5 transition-colors ${
                  isDark
                    ? 'text-white/50 hover:text-white'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>

            {/* Copyright */}
            <p className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
              © 2024-2025 Repic. {t('allRightsReserved') || 'All rights reserved.'}
            </p>

            {/* Close Button */}
            <button
              onClick={onClose}
              className={`mt-6 px-6 py-2 text-sm font-medium rounded-lg transition-colors ${
                isDark
                  ? 'text-white/60 hover:text-white hover:bg-white/5'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-black/5'
              }`}
            >
              {t('close') || '關閉'}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

AboutDialog.displayName = 'AboutDialog';

export default AboutDialog;
