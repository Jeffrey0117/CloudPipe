import { useState, useCallback } from 'react';
import { useProjects } from '../hooks/useProjects';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../stores/app-store';
import { DeployHistory } from '../components/DeployHistory';
import { t } from '../i18n';
import type { CloudPipeAPI, SystemInfo, Deployment } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

export function DashboardPage() {
  const projects = useProjects();
  const locale = useAppStore((s) => s.locale);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [recentDeploys, setRecentDeploys] = useState<Deployment[]>([]);
  const [actionLoading, setActionLoading] = useState('');

  const fetchSystem = useCallback(async () => {
    try {
      const info = await api.getSystemInfo();
      setSystemInfo(info as SystemInfo);
    } catch { /* ignore */ }
  }, []);

  const fetchDeploys = useCallback(async () => {
    try {
      const deploys = await api.getDeployHistory();
      setRecentDeploys((deploys as Deployment[]).slice(0, 5));
    } catch { /* ignore */ }
  }, []);

  usePolling(fetchSystem, 10_000);
  usePolling(fetchDeploys, 15_000);

  const onlineCount = projects.filter((p) => p.pm2?.status === 'online').length;

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === 'start') await api.pm2StartAll();
      else if (action === 'stop') await api.pm2StopAll();
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('dash.title', locale)}</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card flex flex-col items-center py-5">
          <div className="text-2xl font-bold text-cp-text">
            {systemInfo ? formatUptime(systemInfo.uptime * 1000) : '—'}
          </div>
          <div className="text-xs text-cp-muted mt-1">{t('dash.uptime', locale)}</div>
        </div>
        <div className="card flex flex-col items-center py-5">
          <div className="text-2xl font-bold">
            <span className="text-cp-success">{onlineCount}</span>
            <span className="text-cp-muted text-lg"> / {projects.length}</span>
          </div>
          <div className="text-xs text-cp-muted mt-1">{t('dash.services', locale)}</div>
        </div>
        <div className="card flex flex-col items-center py-5">
          <div className="text-2xl font-bold text-cp-text">
            {systemInfo?.nodeVersion || '—'}
          </div>
          <div className="text-xs text-cp-muted mt-1">{t('dash.node', locale)}</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-medium text-cp-text">{t('dash.quickActions', locale)}</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleAction('start')}
              disabled={!!actionLoading}
              className="px-4 py-1.5 bg-cp-success text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {actionLoading === 'start' ? t('dash.starting', locale) : t('dash.startAll', locale)}
            </button>
            <button
              onClick={() => handleAction('stop')}
              disabled={!!actionLoading}
              className="px-4 py-1.5 bg-cp-border/50 text-cp-muted rounded-lg text-xs font-medium hover:text-cp-text hover:bg-cp-border transition-colors disabled:opacity-50"
            >
              {actionLoading === 'stop' ? t('dash.stopping', locale) : t('dash.stopAll', locale)}
            </button>
          </div>
        </div>
      </div>

      {/* Recent Deploys */}
      <div className="card">
        <h3 className="text-sm font-medium text-cp-text mb-3">{t('dash.recentDeploys', locale)}</h3>
        {recentDeploys.length > 0
          ? <DeployHistory deployments={recentDeploys} locale={locale} />
          : <div className="text-xs text-cp-muted">{t('dash.noDeploys', locale)}</div>
        }
      </div>
    </div>
  );
}
