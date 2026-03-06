import { Icon } from './Icon';

export const Check = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M20 6 9 17l-5-5" />
    </Icon>
);
