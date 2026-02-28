import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { useAuthStore } from '../stores/auth-store';
import { t } from '../i18n';
import type { CloudPipeAPI, AppConfig } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function SettingsPage() {
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const toggleLocale = useAppStore((s) => s.toggleLocale);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [testResult, setTestResult] = useState('');

  useEffect(() => {
    api.getConfig().then((c) => setConfig(c as AppConfig));
  }, []);

  const handleTestConnection = async () => {
    setTestResult('Testing...');
    try {
      const info = await api.getSystemInfo();
      setTestResult(info ? 'Connected!' : 'Failed');
    } catch (err) {
      setTestResult(`Failed: ${(err as Error).message}`);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    clearAuth();
    setActivePage('dashboard');
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-sm font-medium text-cp-muted uppercase tracking-wider">{t('set.title', locale)}</h2>

      {/* Connection */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-cp-text">{t('set.connection', locale)}</h3>
        <div>
          <label className="block text-xs text-cp-muted mb-1">{t('set.serverUrl', locale)}</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={config?.serverUrl || ''}
              onChange={(e) => setConfig(config ? { ...config, serverUrl: e.target.value } : null)}
              className="flex-1 px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
            />
            <button
              onClick={handleTestConnection}
              className="px-4 py-2 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
            >
              {t('set.test', locale)}
            </button>
          </div>
          {testResult && (
            <div className={`text-xs mt-1 ${testResult.includes('Connected') ? 'text-cp-success' : 'text-cp-danger'}`}>
              {testResult}
            </div>
          )}
        </div>
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            className="px-4 py-1.5 text-xs text-cp-danger border border-cp-danger/30 rounded-lg hover:bg-cp-danger/10 transition-colors"
          >
            {t('set.logout', locale)}
          </button>
        )}
      </div>

      {/* Appearance */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-cp-text">{t('set.appearance', locale)}</h3>
        <div className="flex items-center justify-between">
          <span className="text-sm text-cp-text">{t('set.theme', locale)}</span>
          <button
            onClick={toggleTheme}
            className="px-4 py-1.5 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
          >
            {theme === 'dark' ? t('set.dark', locale) : t('set.light', locale)}
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-cp-text">{t('set.language', locale)}</span>
          <button
            onClick={toggleLocale}
            className="px-4 py-1.5 bg-cp-border/50 text-cp-muted hover:text-cp-text rounded-lg text-xs transition-colors"
          >
            {locale === 'en' ? 'English' : '中文'}
          </button>
        </div>
      </div>

      {/* About */}
      <div className="card space-y-2">
        <h3 className="text-sm font-medium text-cp-text">{t('set.about', locale)}</h3>
        <div className="text-xs text-cp-muted space-y-1">
          <div>{t('set.version', locale)}</div>
          <div>{t('set.description', locale)}</div>
        </div>
      </div>
    </div>
  );
}
