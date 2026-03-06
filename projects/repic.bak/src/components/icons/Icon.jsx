/**
 * Base Icon component - SVG wrapper with consistent styling
 * All icons use 24x24 viewBox, stroke-width=2, stroke=currentColor, fill=none
 */
export const Icon = ({
    children,
    size = 24,
    className = '',
    ...props
}) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            {children}
        </svg>
    );
};
