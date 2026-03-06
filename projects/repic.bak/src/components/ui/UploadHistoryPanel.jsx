import { motion, AnimatePresence } from '../../lib/motion';
import { X, Copy, Trash2 } from '../icons';
import { useTheme } from '../../contexts/ThemeContext';
import useI18n from '../../hooks/useI18n';

export const UploadHistoryPanel = ({ isVisible, history, onClose, onClear }) => {
    const { theme } = useTheme();
    const { t } = useI18n();

    const handleCopy = async (url) => {
        try {
            await navigator.clipboard.writeText(url);
            alert(t('copied'));
        } catch {
            prompt(t('uploadSuccessManualCopy'), url);
        }
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        return date.toLocaleTimeString();
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, x: 300 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 300 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className={`fixed right-0 top-14 bottom-0 w-80 z-40 border-l shadow-2xl flex flex-col ${
                        theme === 'dark'
                            ? 'bg-[#0f0f0f] border-white/10'
                            : 'bg-white border-black/10'
                    }`}
                >
                    {/* Header */}
                    <div className={`flex items-center justify-between px-4 py-3 border-b ${
                        theme === 'dark' ? 'border-white/10' : 'border-black/10'
                    }`}>
                        <h3 className={`font-medium ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
                            {t('uploadHistory')}
                        </h3>
                        <div className="flex items-center gap-2">
                            {history.length > 0 && (
                                <button
                                    onClick={onClear}
                                    className={`p-1.5 rounded-lg transition-colors ${
                                        theme === 'dark'
                                            ? 'hover:bg-white/10 text-white/60'
                                            : 'hover:bg-black/10 text-gray-500'
                                    }`}
                                    title={t('clear')}
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className={`p-1.5 rounded-lg transition-colors ${
                                    theme === 'dark'
                                        ? 'hover:bg-white/10 text-white/60'
                                        : 'hover:bg-black/10 text-gray-500'
                                }`}
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* History List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {history.length === 0 ? (
                            <div className={`text-center py-8 ${
                                theme === 'dark' ? 'text-white/40' : 'text-gray-400'
                            }`}>
                                {t('noUploadHistory')}
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {history.map((item, index) => (
                                    <motion.div
                                        key={item.id + item.timestamp}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className={`p-3 rounded-lg border ${
                                            theme === 'dark'
                                                ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                                : 'bg-black/5 border-black/10 hover:bg-black/10'
                                        } transition-colors`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs truncate ${
                                                    theme === 'dark' ? 'text-white/60' : 'text-gray-500'
                                                }`}>
                                                    {formatTime(item.timestamp)}
                                                </p>
                                                <p className={`text-sm font-mono truncate mt-1 ${
                                                    theme === 'dark' ? 'text-white/90' : 'text-gray-800'
                                                }`}>
                                                    {item.url}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleCopy(item.url)}
                                                className={`p-2 rounded-lg transition-colors shrink-0 ${
                                                    theme === 'dark'
                                                        ? 'hover:bg-white/10 text-primary'
                                                        : 'hover:bg-black/10 text-primary'
                                                }`}
                                                title={t('copy')}
                                            >
                                                <Copy size={16} />
                                            </button>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
