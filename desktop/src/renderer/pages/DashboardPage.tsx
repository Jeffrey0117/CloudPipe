import { useState, useCallback, useEffect } from 'react';
import { useProjects } from '../hooks/useProjects';
import { usePolling } from '../hooks/usePolling';
import { useAppStore } from '../stores/app-store';
import { DeployHistory } from '../components/DeployHistory';
import { t } from '../i18n';
import type { CloudPipeAPI, SystemInfo, Deployment, TunnelInfo, StartupProgress } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m`;
}

const TUNNEL_STATUS_COLORS: Record<string, string> = {
  running: 'text-cp-success',
  starting: 'text-yellow-400',
  stopped: 'text-cp-muted',
  errored: 'text-red-400',
};

export function DashboardPage() {
  const projects = useProjects();
  const locale = useAppStore((s) => s.locale);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [recentDeploys, setRecentDeploys] = useState<Deployment[]>([]);
  const [actionLoading, setActionLoading] = useState('');
  const [tunnelInfo, setTunnelInfo] = useState<TunnelInfo>({ status: 'stopped' });
  const [startupProgress, setStartupProgress] = useState<StartupProgress | null>(null);

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

  const fetchTunnel = useCallback(async () => {
    try {
      const info = await api.tunnelStatus();
      setTunnelInfo(info);
    } catch { /* ignore */ }
  }, []);

  usePolling(fetchSystem, 10_000);
  usePolling(fetchDeploys, 15_000);

  // Fetch tunnel status once on mount; updates come via push events
  useEffect(() => { fetchTunnel(); }, []);

  // Subscribe to startup progress + tunnel status events
  useEffect(() => {
    const unsubProgress = api.onStartupProgress((data) => {
      const progress = data as StartupProgress;
      setStartupProgress(progress);
      // Auto-clear after 5s on complete/failed
      if (progress.step === 'complete' || progress.step === 'failed') {
        setTimeout(() => setStartupProgress(null), 5_000);
      }
    });
    const unsubTunnel = api.onTunnelStatus((data) => {
      setTunnelInfo(data as TunnelInfo);
    });
    return () => { unsubProgress(); unsubTunnel(); };
  }, []);

  const onlineCount = projects.filter((p) => p.pm2?.status === 'online').length;

  const handleAction = async (action: string) => {
    setActionLoading(action);
    try {
      if (action === 'start') await api.startupSequence();
      else if (action === 'stop') await api.pm2StopAll();
      else if (action === 'deploy') await api.deployAll();
    } finally {
      setActionLoading('');
      fetchDeploys();
    }
  };

  // Listen for keyboard shortcut / tray triggers
  useEffect(() => {
    const unsubDeploy = api.onTriggerDeployAll(() => {
      handleAction('deploy');
    });
    const unsubStart = api.onTriggerStartAll(() => {
      handleAction('start');
    });
    const unsubStop = api.onTriggerStopAll(() => {
      handleAction('stop');
    });
    return () => { unsubDeploy(); unsubStart(); unsubStop(); };
  }, []);

  const tunnelStatusKey = `tunnel.${tunnelInfo.status}` as const;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('dash.title', locale)}</h2>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="card flex flex-col items-center py-5">
          <div className="text-2xl font-bold text-cp-text">
            {systemInfo ? formatUptime(systemInfo.uptime * 1000) : '\u2014'}
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
            {systemInfo?.nodeVersion || '\u2014'}
          </div>
          <div className="text-xs text-cp-muted mt-1">{t('dash.node', locale)}</div>
        </div>
        <div className="card flex flex-col items-center py-5">
          <div className={`text-2xl font-bold ${TUNNEL_STATUS_COLORS[tunnelInfo.status] || 'text-cp-muted'}`}>
            {t(tunnelStatusKey, locale)}
          </div>
          <div className="text-xs text-cp-muted mt-1">Tunnel</div>
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
              onClick={() => handleAction('deploy')}
              disabled={!!actionLoading}
              className="px-4 py-1.5 bg-cp-primary text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {actionLoading === 'deploy' ? t('dash.deployingAll', locale) : t('dash.deployAll', locale)}
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

        {/* Startup Progress */}
        {startupProgress && (
          <div className="mt-2 p-3 rounded-lg bg-cp-card border border-cp-border">
            <div className="flex items-center gap-2 text-xs">
              {startupProgress.step !== 'complete' && startupProgress.step !== 'failed' && (
                <div className="w-3 h-3 border-2 border-cp-primary border-t-transparent rounded-full animate-spin" />
              )}
              <span className={
                startupProgress.step === 'complete' ? 'text-cp-success' :
                startupProgress.step === 'failed' ? 'text-red-400' :
                'text-cp-text'
              }>
                {t(`startup.${startupProgress.step}` as Parameters<typeof t>[0], locale)}
              </span>
              <span className="text-cp-muted">{startupProgress.message}</span>
            </div>
            {startupProgress.step === 'deploying' && startupProgress.totalProjects && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-cp-muted mb-1">
                  <span>{startupProgress.currentProject}</span>
                  <span>{startupProgress.deployedCount}/{startupProgress.totalProjects}</span>
                </div>
                <div className="w-full h-1.5 bg-cp-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cp-primary rounded-full transition-all duration-300"
                    style={{ width: `${((startupProgress.deployedCount ?? 0) / startupProgress.totalProjects) * 100}%` }}
                  />
                </div>
              </div>
            )}
            {startupProgress.error && (
              <div className="mt-1 text-xs text-red-400">{startupProgress.error}</div>
            )}
          </div>
        )}
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
