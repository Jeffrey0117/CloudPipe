import { Icon } from './Icon';

export const Moon = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </Icon>
);
