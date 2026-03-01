import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import { useAuthStore } from '../stores/auth-store';
import { t } from '../i18n';
import type { CloudPipeAPI, AppConfig, Machine } from '@shared/types';

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

  // Machine form
  const [machines, setMachines] = useState<Machine[]>([]);
  const [activeMachineId, setActiveMachineId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newToken, setNewToken] = useState('');

  useEffect(() => {
    api.getConfig().then((c) => {
      setConfig(c as AppConfig);
      setMachines(c.machines || []);
      setActiveMachineId(c.activeMachineId || '');
    });
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

  const handleAddMachine = async () => {
    if (!newName.trim() || !newUrl.trim()) return;
    const machine: Machine = {
      id: `machine-${Date.now()}`,
      name: newName.trim(),
      serverUrl: newUrl.trim(),
      token: newToken.trim(),
    };
    await api.addMachine(machine);
    setMachines([...machines, machine]);
    setNewName('');
    setNewUrl('');
    setNewToken('');
  };

  const handleRemoveMachine = async (id: string) => {
    await api.removeMachine(id);
    setMachines(machines.filter((m) => m.id !== id));
    if (activeMachineId === id) setActiveMachineId('');
  };

  const handleSwitchMachine = async (id: string) => {
    const newConfig = await api.switchMachine(id);
    setActiveMachineId(newConfig.activeMachineId);
    setConfig(newConfig);
    window.location.reload();
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

      {/* Machines */}
      <div className="card space-y-3">
        <h3 className="text-sm font-medium text-cp-text">{t('set.machines', locale)}</h3>
        {machines.length === 0 ? (
          <div className="text-xs text-cp-muted">{t('set.noMachines', locale)}</div>
        ) : (
          <div className="space-y-2">
            {machines.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-cp-bg rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-cp-text">{m.name}</span>
                    {m.id === activeMachineId && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-cp-primary/20 text-cp-primary rounded">{t('set.active', locale)}</span>
                    )}
                  </div>
                  <div className="text-xs text-cp-muted truncate">{m.serverUrl}</div>
                </div>
                <div className="flex gap-1 ml-2">
                  {m.id !== activeMachineId && (
                    <button
                      onClick={() => handleSwitchMachine(m.id)}
                      className="px-2 py-1 text-xs text-cp-primary hover:bg-cp-primary/10 rounded transition-colors"
                    >
                      {t('set.switchMachine', locale)}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemoveMachine(m.id)}
                    className="px-2 py-1 text-xs text-cp-danger hover:bg-cp-danger/10 rounded transition-colors"
                  >
                    {t('set.removeMachine', locale)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* Add Machine Form */}
        <div className="flex flex-col gap-2 pt-2 border-t border-cp-border">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('set.machineName', locale)}
            className="px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
          />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder={t('set.machineUrl', locale)}
            className="px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
          />
          <input
            type="text"
            value={newToken}
            onChange={(e) => setNewToken(e.target.value)}
            placeholder={`${t('set.machineToken', locale)} (optional)`}
            className="px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
          />
          <button
            onClick={handleAddMachine}
            disabled={!newName.trim() || !newUrl.trim()}
            className="px-4 py-2 bg-cp-primary text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-opacity self-start"
          >
            {t('set.addMachine', locale)}
          </button>
        </div>
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
            {locale === 'en' ? 'English' : '\u4E2D\u6587'}
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
