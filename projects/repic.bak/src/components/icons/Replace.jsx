import { Icon } from './Icon';

export const Replace = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M14 4c0-1.1.9-2 2-2" />
        <path d="M20 2c1.1 0 2 .9 2 2" />
        <path d="M22 8c0 1.1-.9 2-2 2" />
        <path d="M16 10c-1.1 0-2-.9-2-2" />
        <path d="m3 7 3 3 3-3" />
        <path d="M6 10V5c0-1.7 1.3-3 3-3h1" />
        <rect width="8" height="8" x="2" y="14" rx="2" />
        <path d="m14 14 3-3 3 3" />
        <path d="M17 17v-5c0-1.7-1.3-3-3-3h-1" />
    </Icon>
);
