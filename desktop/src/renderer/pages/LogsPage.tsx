import { useState } from 'react';
import { useProjects } from '../hooks/useProjects';
import { useLogs } from '../hooks/useLogs';
import { useAppStore } from '../stores/app-store';
import { LogViewer } from '../components/LogViewer';
import { t } from '../i18n';

export function LogsPage() {
  const projects = useProjects();
  const locale = useAppStore((s) => s.locale);
  const [selectedPm2Name, setSelectedPm2Name] = useState<string | null>(null);
  const [tab, setTab] = useState<'stdout' | 'stderr'>('stdout');
  const { stdout, stderr } = useLogs(selectedPm2Name);

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('logs.title', locale)}</h2>
        <select
          value={selectedPm2Name || ''}
          onChange={(e) => setSelectedPm2Name(e.target.value || null)}
          className="px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
        >
          <option value="">{t('logs.selectProject', locale)}</option>
          {projects.map((p) => (
            <option key={p.id} value={p.pm2Name || p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => setTab('stdout')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'stdout' ? 'bg-cp-primary text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('logs.stdout', locale)}
          </button>
          <button
            onClick={() => setTab('stderr')}
            className={`px-3 py-1 rounded-lg text-xs transition-colors ${
              tab === 'stderr' ? 'bg-cp-danger text-white' : 'bg-cp-border/50 text-cp-muted hover:text-cp-text'
            }`}
          >
            {t('logs.stderr', locale)}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {selectedPm2Name ? (
          <LogViewer content={tab === 'stdout' ? stdout : stderr} filterPlaceholder={t('logs.filter', locale)} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-cp-muted">
            {t('logs.noSelection', locale)}
          </div>
        )}
      </div>
    </div>
  );
}
