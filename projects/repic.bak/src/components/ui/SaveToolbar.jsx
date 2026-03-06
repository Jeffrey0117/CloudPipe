import { motion } from '../../lib/motion';
import { Download, X, Check } from '../icons';
import { Button } from './Button';
import useI18n from '../../hooks/useI18n';

export const SaveToolbar = ({ onSaveReplace, onSaveAs, onDiscard, isLocalFile }) => {
    const { t } = useI18n();

    return (
        <motion.div
            key="save-toolbar"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 bg-surface/90 backdrop-blur-2xl px-5 py-3 rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        >
            {/* Modified indicator */}
            <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-xs font-medium text-amber-500">{t('modified')}</span>
            </div>

            {/* Action buttons */}
            {isLocalFile && (
                <Button
                    variant="primary"
                    className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm"
                    onClick={onSaveReplace}
                >
                    <Check size={14} />
                    <span>{t('replaceOriginal')}</span>
                </Button>
            )}

            <Button
                variant="secondary"
                className="flex items-center gap-2 px-4 h-9 rounded-lg text-sm bg-white/5 border-white/10 hover:bg-white/10"
                onClick={onSaveAs}
            >
                <Download size={14} />
                <span>{t('saveAsNew')}</span>
            </Button>

            <Button
                variant="ghost"
                className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-white/50 hover:text-red-400 hover:bg-red-500/10"
                onClick={onDiscard}
            >
                <X size={14} />
                <span>{t('discard')}</span>
            </Button>
        </motion.div>
    );
};
