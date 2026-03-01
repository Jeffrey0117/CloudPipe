import { useState } from 'react';
import { DeployForm } from './DeployForm';
import { t } from '../../i18n';
import type { Locale } from '../../i18n';
import type { CloudPipeAPI, FolderScanResult, RegisterProjectData } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

interface LocalDeployTabProps {
  locale: Locale;
}

export function LocalDeployTab({ locale }: LocalDeployTabProps) {
  const [workspacePath, setWorkspacePath] = useState('');
  const [scanning, setScanning] = useState(false);
  const [projects, setProjects] = useState<FolderScanResult[]>([]);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [nextPort, setNextPort] = useState(0);
  const [justDeployed, setJustDeployed] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

  const toId = (name: string) => name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const handleBrowse = async () => {
    setError('');
    try {
      const selected = await api.browseFolder();
      if (!selected) return;

      setWorkspacePath(selected);
      setScanning(true);
      setProjects([]);
      setSelectedIdx(null);
      setJustDeployed(new Set());

      const [results, port, registered] = await Promise.all([
        api.scanWorkspace(selected),
        api.getNextPort(),
        api.getProjects(),
      ]);
      setProjects(results);
      setNextPort(port);
      setExistingIds(new Set(registered.map((p) => p.id)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  const handleDeploySuccess = () => {
    if (selected) {
      const id = toId(selected.name);
      setJustDeployed((prev) => new Set([...prev, id]));
      setExistingIds((prev) => new Set([...prev, id]));
      setNextPort((p) => p + 1);
    }
    setSelectedIdx(null);
  };

  const selected = selectedIdx !== null ? projects[selectedIdx] : null;
  const selectedId = selected ? toId(selected.name) : '';
  const isSelectedExisting = existingIds.has(selectedId) && !justDeployed.has(selectedId);

  const formData: Partial<RegisterProjectData> & { localPath?: string } = selected
    ? {
        id: selectedId,
        port: nextPort,
        entryFile: selected.entryFile,
        buildCommand: selected.buildCommand,
        repoUrl: selected.repoUrl,
        branch: selected.branch,
        deployMethod: selected.hasGit ? 'github' : 'manual',
        localPath: selected.folderPath,
      }
    : {};

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={handleBrowse} disabled={scanning} className="btn-primary text-xs">
          {scanning ? t('deploy.scanning', locale) : t('deploy.browse', locale)}
        </button>
        {workspacePath && (
          <span className="text-xs text-cp-muted truncate max-w-[400px]" title={workspacePath}>
            {workspacePath}
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
      )}

      {scanning && (
        <div className="text-xs text-cp-muted animate-pulse">{t('deploy.scanning', locale)}</div>
      )}

      {projects.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11px] text-cp-muted mb-1">
            {projects.length} {t('deploy.projectsFound', locale)}
          </div>
          <div className="overflow-y-auto space-y-1" style={{ maxHeight: 'calc(100vh - 220px)' }}>
            {projects.map((proj, idx) => {
              const id = toId(proj.name);
              const alreadyRegistered = existingIds.has(id);
              const wasJustDeployed = justDeployed.has(id);

              return (
                <button
                  key={proj.folderPath || proj.name}
                  onClick={() => !alreadyRegistered && setSelectedIdx(idx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors border ${
                    alreadyRegistered
                      ? 'border-cp-border/30 opacity-40 cursor-default'
                      : 'border-transparent hover:bg-cp-surface/80 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-cp-text font-medium">{proj.name}</span>
                    <span className="px-1.5 py-0.5 rounded bg-cp-border/50 text-cp-muted text-[10px]">
                      {proj.packageManager}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cp-border/50 text-cp-muted text-[10px]">
                      {proj.entryFile}
                    </span>
                    {proj.hasGit ? (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px]">git</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px]">local</span>
                    )}
                    {alreadyRegistered && !wasJustDeployed && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-cp-border/50 text-cp-muted text-[10px]">
                        {t('deploy.alreadyDeployed', locale)}
                      </span>
                    )}
                    {wasJustDeployed && (
                      <span className="ml-auto px-1.5 py-0.5 rounded bg-green-500/20 text-green-400 text-[10px]">
                        {t('deploy.success', locale)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {workspacePath && !scanning && projects.length === 0 && (
        <div className="text-xs text-cp-muted text-center py-4">{t('deploy.noProjects', locale)}</div>
      )}

      {/* Modal */}
      {selected && !isSelectedExisting && (
        <DeployForm
          key={selected.folderPath}
          locale={locale}
          initialData={formData}
          onSuccess={handleDeploySuccess}
          onClose={() => setSelectedIdx(null)}
        />
      )}
    </div>
  );
}
