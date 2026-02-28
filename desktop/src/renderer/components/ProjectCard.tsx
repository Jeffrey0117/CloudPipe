import { StatusDot } from './StatusDot';
import { t } from '../i18n';
import type { ProjectWithStatus, CloudPipeAPI } from '@shared/types';
import type { Locale } from '../i18n';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

interface ProjectCardProps {
  project: ProjectWithStatus;
  deploying: boolean;
  onDeployStart: () => void;
  onDeployEnd: () => void;
  locale: Locale;
}

export function ProjectCard({ project, deploying, onDeployStart, onDeployEnd, locale }: ProjectCardProps) {
  const pm2Status = project.pm2?.status || 'stopped';
  const dotStatus = pm2Status === 'online' ? 'online'
    : pm2Status === 'launching' ? 'deploying'
    : pm2Status === 'errored' ? 'offline'
    : 'offline';

  const handleDeploy = async () => {
    onDeployStart();
    try {
      await api.deployProject(project.id);
    } finally {
      onDeployEnd();
    }
  };

  const handleRestart = async () => {
    await api.restartProject(project.id);
  };

  return (
    <div className="card flex items-center justify-between group">
      <div className="flex items-center gap-3">
        <StatusDot status={deploying ? 'deploying' : dotStatus} size="md" />
        <div>
          <div className="font-medium text-sm text-cp-text">{project.name || project.id}</div>
          <div className="text-xs text-cp-muted">
            :{project.port} &middot; {pm2Status}
            {project.pm2?.memory ? ` &middot; ${Math.round(project.pm2.memory / 1024 / 1024)}MB` : ''}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleDeploy}
          disabled={deploying}
          className="px-3 py-1.5 bg-cp-primary text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {deploying ? t('proj.deploying', locale) : t('proj.deploy', locale)}
        </button>
        <button
          onClick={handleRestart}
          className="px-3 py-1.5 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
        >
          {t('proj.restart', locale)}
        </button>
      </div>
    </div>
  );
}
