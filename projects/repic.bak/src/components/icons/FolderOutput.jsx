import { Icon } from './Icon';

export const FolderOutput = ({ size, className, ...props }) => (
    <Icon size={size} className={className} {...props}>
        <path d="M2 7.5V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-1.5" />
        <path d="M2 13h10" />
        <path d="m5 10-3 3 3 3" />
    </Icon>
);
