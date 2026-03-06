import { Icon } from './Icon';

export const X = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
    </Icon>
);
