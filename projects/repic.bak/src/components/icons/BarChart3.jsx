import { Icon } from './Icon';

export const BarChart3 = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
    </Icon>
);
