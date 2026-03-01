import { useState } from 'react';
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

function CopyButton({ text, locale }: { text: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="px-1 py-0.5 text-[10px] text-cp-muted hover:text-cp-text hover:bg-cp-border/50 rounded transition-colors shrink-0"
      title={text}
    >
      {copied ? t('proj.copied', locale) : '\u2398'}
    </button>
  );
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

  const handleOpen = () => {
    if (project.webUrl) {
      api.openUrl(project.webUrl);
    }
  };

  return (
    <div className="card group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <StatusDot status={deploying ? 'deploying' : dotStatus} size="md" />
          <div className="min-w-0">
            <div className="font-medium text-sm text-cp-text">{project.name || project.id}</div>
            <div className="text-xs text-cp-muted">
              :{project.port} &middot; {pm2Status}
              {project.pm2?.memory ? ` \u00B7 ${Math.round(project.pm2.memory / 1024 / 1024)}MB` : ''}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={handleOpen}
            className="px-3 py-1.5 border border-cp-border text-cp-text rounded-lg text-xs font-medium hover:bg-cp-border/50 transition-colors"
          >
            {t('proj.open', locale)}
          </button>
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
      {/* Paths */}
      <div className="mt-2 space-y-0.5 text-[11px] text-cp-muted">
        {project.repoUrl && (
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-cp-muted/60 shrink-0">repo</span>
            <span className="truncate font-mono">{project.repoUrl}</span>
            <CopyButton text={project.repoUrl} locale={locale} />
          </div>
        )}
        {project.localPath && (
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-cp-muted/60 shrink-0">path</span>
            <span className="truncate font-mono">{project.localPath}</span>
            <CopyButton text={project.localPath} locale={locale} />
          </div>
        )}
      </div>
    </div>
  );
}
