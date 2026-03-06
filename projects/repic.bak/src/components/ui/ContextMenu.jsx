import { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from '../../lib/motion';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Simple context menu component
 * Usage:
 *   <ContextMenu
 *     isOpen={showMenu}
 *     position={{ x: 100, y: 200 }}
 *     onClose={() => setShowMenu(false)}
 *     items={[
 *       { label: '複製', icon: Copy, onClick: handleCopy },
 *       { label: '刪除', icon: Trash2, onClick: handleDelete, danger: true },
 *       { type: 'separator' },
 *       { label: '其他', onClick: handleOther }
 *     ]}
 *   />
 */
export const ContextMenu = memo(({ isOpen, position, onClose, items = [] }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const menuRef = useRef(null);

  // Close on click outside or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Adjust position to keep menu in viewport
  const adjustedPosition = { ...position };
  if (typeof window !== 'undefined' && menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (position.x + rect.width > window.innerWidth) {
      adjustedPosition.x = window.innerWidth - rect.width - 8;
    }
    if (position.y + rect.height > window.innerHeight) {
      adjustedPosition.y = window.innerHeight - rect.height - 8;
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className={`fixed z-[300] py-1.5 rounded-lg shadow-xl border min-w-[160px] ${
            isDark
              ? 'bg-[#1a1a1a] border-white/10'
              : 'bg-white border-black/10'
          }`}
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y
          }}
        >
          {items.map((item, index) => {
            if (item.type === 'separator') {
              return (
                <div
                  key={index}
                  className={`my-1.5 h-px ${isDark ? 'bg-white/10' : 'bg-black/10'}`}
                />
              );
            }

            const Icon = item.icon;

            return (
              <button
                key={index}
                onClick={() => {
                  item.onClick?.();
                  onClose();
                }}
                disabled={item.disabled}
                className={`w-full px-3 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
                  item.disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : item.danger
                      ? isDark
                        ? 'text-red-400 hover:bg-red-500/20'
                        : 'text-red-500 hover:bg-red-50'
                      : isDark
                        ? 'text-white/80 hover:bg-white/10'
                        : 'text-gray-700 hover:bg-black/5'
                }`}
              >
                {Icon && <Icon size={16} className="opacity-60" />}
                {item.label}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
});

ContextMenu.displayName = 'ContextMenu';

export default ContextMenu;
