import { useAppStore } from '../stores/app-store';
import { useAuthStore } from '../stores/auth-store';
import { StatusDot } from './StatusDot';
import { t } from '../i18n';
import type { Page } from '@shared/types';

const NAV_ITEMS: { id: Page; key: 'nav.dashboard' | 'nav.projects' | 'nav.logs' | 'nav.gateway' | 'nav.deploy' | 'nav.settings'; icon: string }[] = [
  { id: 'dashboard', key: 'nav.dashboard', icon: '\u25A3' },
  { id: 'projects', key: 'nav.projects', icon: '\u2630' },
  { id: 'logs', key: 'nav.logs', icon: '\u25B6' },
  { id: 'gateway', key: 'nav.gateway', icon: '\u2194' },
  { id: 'deploy', key: 'nav.deploy', icon: '\u2B06' },
  { id: 'settings', key: 'nav.settings', icon: '\u2699' },
];

export function Sidebar() {
  const activePage = useAppStore((s) => s.activePage);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const connectionStatus = useAppStore((s) => s.connectionStatus);
  const locale = useAppStore((s) => s.locale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const statusKey = connectionStatus === 'connected' ? 'status.connected'
    : connectionStatus === 'checking' ? 'status.checking'
    : 'status.disconnected';

  return (
    <aside className="w-48 flex flex-col bg-[var(--cp-sidebar)] border-r border-cp-border">
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActivePage(item.id)}
            disabled={!isAuthenticated && item.id !== 'settings'}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
              activePage === item.id
                ? 'bg-cp-primary/10 text-cp-primary border-r-2 border-cp-primary'
                : 'text-cp-muted hover:text-cp-text hover:bg-cp-surface/50'
            } disabled:opacity-30 disabled:cursor-not-allowed`}
          >
            <span className="text-base">{item.icon}</span>
            {t(item.key, locale)}
          </button>
        ))}
      </nav>
      <div className="p-3 border-t border-cp-border">
        <div className="flex items-center gap-2 text-xs text-cp-muted">
          <StatusDot status={connectionStatus === 'connected' ? 'online' : connectionStatus === 'checking' ? 'warning' : 'offline'} />
          {t(statusKey as 'status.connected', locale)}
        </div>
      </div>
    </aside>
  );
}
