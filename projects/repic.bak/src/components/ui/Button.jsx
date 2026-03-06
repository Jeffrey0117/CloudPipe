import { motion } from '../../lib/motion';

const baseStyles = "flex items-center justify-center gap-2 rounded-full font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer";

const variants = {
    primary: "bg-primary text-white hover:bg-blue-600",
    ghost: "bg-surface/80 backdrop-blur-md text-white hover:bg-zinc-700/80",
    danger: "bg-danger text-white hover:bg-red-600",
    text: "bg-transparent text-primary hover:text-blue-400 p-0 active:scale-100"
};

export const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled = false }) => (
    <motion.button
        whileTap={{ scale: 0.96 }}
        className={`${baseStyles} ${variants[variant]} ${className}`}
        onClick={onClick}
        disabled={disabled}
    >
        {Icon && <Icon size={18} strokeWidth={2.5} />}
        {children}
    </motion.button>
);
