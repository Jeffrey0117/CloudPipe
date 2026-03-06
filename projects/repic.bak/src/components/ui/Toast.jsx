import { memo, useEffect } from 'react';
import { motion } from '../../lib/motion';
import { Check } from '../icons';

export const Toast = memo(function Toast({ message, isVisible, onHide, duration = 2000 }) {
    useEffect(() => {
        if (isVisible && duration > 0) {
            const timer = setTimeout(onHide, duration);
            return () => clearTimeout(timer);
        }
    }, [isVisible, onHide, duration]);

    if (!isVisible) return null;

    return (
        <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-emerald-500/90 backdrop-blur-xl px-4 py-2.5 rounded-xl shadow-[0_10px_40px_rgba(16,185,129,0.3)] border border-emerald-400/30"
        >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                <Check size={12} className="text-white" />
            </div>
            <span className="text-sm font-medium text-white">{message}</span>
        </motion.div>
    );
});
