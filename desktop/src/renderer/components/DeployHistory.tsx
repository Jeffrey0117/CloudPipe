import { t } from '../i18n';
import type { Deployment } from '@shared/types';
import type { Locale } from '../i18n';

interface DeployHistoryProps {
  deployments: Deployment[];
  locale: Locale;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

function statusColor(status: string): string {
  switch (status) {
    case 'success': return 'text-cp-success';
    case 'failed': return 'text-cp-danger';
    case 'building':
    case 'deploying':
    case 'pending': return 'text-cp-warning';
    default: return 'text-cp-muted';
  }
}

function statusKey(status: string): 'deploy.success' | 'deploy.failed' | 'deploy.pending' | 'deploy.building' | 'deploy.deploying' {
  switch (status) {
    case 'success': return 'deploy.success';
    case 'failed': return 'deploy.failed';
    case 'building': return 'deploy.building';
    case 'deploying': return 'deploy.deploying';
    default: return 'deploy.pending';
  }
}

export function DeployHistory({ deployments, locale }: DeployHistoryProps) {
  if (deployments.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {deployments.map((d) => (
        <div key={d.id || d.timestamp} className="flex items-center justify-between text-xs py-1">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${statusColor(d.status)}`}>{t(statusKey(d.status), locale)}</span>
            {d.commit && <span className="text-cp-muted font-mono">{d.commit.slice(0, 7)}</span>}
            {d.projectId && <span className="text-cp-muted">{d.projectId}</span>}
          </div>
          <span className="text-cp-muted">{formatTime(d.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}
