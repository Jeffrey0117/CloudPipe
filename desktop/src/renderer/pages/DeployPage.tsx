import { useState } from 'react';
import { useAppStore } from '../stores/app-store';
import { LocalDeployTab } from '../components/deploy/LocalDeployTab';
import { GitHubDeployTab } from '../components/deploy/GitHubDeployTab';
import { t } from '../i18n';

export function DeployPage() {
  const locale = useAppStore((s) => s.locale);
  const [tab, setTab] = useState<'local' | 'github'>('local');

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('deploy.title', locale)}</h2>
        <div className="flex gap-1">
          <button
            onClick={() => setTab('local')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'local' ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('deploy.localTab', locale)}
          </button>
          <button
            onClick={() => setTab('github')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'github' ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('deploy.githubTab', locale)}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div style={{ display: tab === 'local' ? undefined : 'none' }}>
          <LocalDeployTab locale={locale} />
        </div>
        <div style={{ display: tab === 'github' ? undefined : 'none' }}>
          <GitHubDeployTab locale={locale} />
        </div>
      </div>
    </div>
  );
}
