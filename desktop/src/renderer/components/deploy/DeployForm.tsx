import { useState } from 'react';
import { t } from '../../i18n';
import type { Locale } from '../../i18n';
import type { CloudPipeAPI, RegisterProjectData } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

interface DeployFormProps {
  locale: Locale;
  initialData: Partial<RegisterProjectData> & { localPath?: string };
  onSuccess: () => void;
  onClose: () => void;
}

export function DeployForm({ locale, initialData, onSuccess, onClose }: DeployFormProps) {
  const [form, setForm] = useState({
    id: initialData.id || '',
    port: initialData.port || 0,
    entryFile: initialData.entryFile || 'index.js',
    buildCommand: initialData.buildCommand || '',
    repoUrl: initialData.repoUrl || '',
    branch: initialData.branch || 'main',
    deployMethod: initialData.deployMethod || 'github' as const,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const updateField = (key: string, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.id.trim()) {
      setError(t('deploy.errorNoId', locale));
      return;
    }
    if (!form.port || form.port < 1000) {
      setError(t('deploy.errorBadPort', locale));
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data: RegisterProjectData = {
        id: form.id.trim().toLowerCase(),
        repoUrl: form.deployMethod === 'manual' ? (initialData.localPath || '') : form.repoUrl,
        branch: form.branch,
        port: form.port,
        entryFile: form.entryFile,
        buildCommand: form.buildCommand,
        deployMethod: form.deployMethod,
      };

      const result = await api.registerProject(data);
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-cp-surface border border-cp-border rounded-xl p-5 w-[520px] max-h-[80vh] overflow-y-auto shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-bold text-cp-text">{t('deploy.formTitle', locale)}</h3>
          <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
            form.deployMethod === 'github'
              ? 'bg-purple-500/20 text-purple-400'
              : 'bg-yellow-500/20 text-yellow-400'
          }`}>
            {form.deployMethod === 'github' ? 'GitHub' : 'Manual'}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-cp-muted hover:text-cp-text text-lg leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldId', locale)}</label>
            <input
              value={form.id}
              onChange={(e) => updateField('id', e.target.value)}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              placeholder="my-project"
            />
          </div>
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldPort', locale)}</label>
            <input
              type="number"
              value={form.port || ''}
              onChange={(e) => updateField('port', parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              placeholder="4010"
            />
          </div>
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldEntry', locale)}</label>
            <input
              value={form.entryFile}
              onChange={(e) => updateField('entryFile', e.target.value)}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              placeholder="server.js"
            />
          </div>
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldBuild', locale)}</label>
            <input
              value={form.buildCommand}
              onChange={(e) => updateField('buildCommand', e.target.value)}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              placeholder="npm run build"
            />
          </div>
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldRepo', locale)}</label>
            <input
              value={form.repoUrl}
              onChange={(e) => updateField('repoUrl', e.target.value)}
              disabled={form.deployMethod === 'manual'}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary disabled:opacity-50"
              placeholder="https://github.com/user/repo.git"
            />
          </div>
          <div>
            <label className="block text-[11px] text-cp-muted mb-1">{t('deploy.fieldBranch', locale)}</label>
            <input
              value={form.branch}
              onChange={(e) => updateField('branch', e.target.value)}
              className="w-full px-3 py-1.5 bg-cp-bg border border-cp-border rounded-lg text-xs text-cp-text focus:outline-none focus:border-cp-primary"
              placeholder="main"
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary text-xs flex-1"
          >
            {submitting ? t('deploy.registering', locale) : t('deploy.register', locale)}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
          >
            {t('gw.cancel', locale)}
          </button>
        </div>
      </div>
    </div>
  );
}
