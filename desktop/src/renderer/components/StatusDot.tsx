interface StatusDotProps {
  status: 'online' | 'offline' | 'warning' | 'deploying';
  size?: 'sm' | 'md';
}

const COLORS: Record<string, string> = {
  online: 'bg-cp-success',
  offline: 'bg-cp-danger',
  warning: 'bg-cp-warning',
  deploying: 'bg-cp-warning animate-pulse',
};

export function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';
  return (
    <span className={`inline-block rounded-full ${sizeClass} ${COLORS[status] || COLORS.offline}`} />
  );
}
