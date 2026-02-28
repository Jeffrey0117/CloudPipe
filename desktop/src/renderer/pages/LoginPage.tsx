import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useAppStore } from '../stores/app-store';
import { t } from '../i18n';
import type { CloudPipeAPI } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function LoginPage() {
  const [serverUrl, setServerUrl] = useState('http://localhost:8787');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const setConnectionStatus = useAppStore((s) => s.setConnectionStatus);
  const locale = useAppStore((s) => s.locale);

  useEffect(() => {
    (async () => {
      try {
        const config = await api.getConfig();
        if (config.serverUrl) setServerUrl(config.serverUrl);
        if (config.token) {
          const result = await api.verifyToken();
          if (result.valid) {
            setAuth(config.serverUrl, config.token);
            setConnectionStatus('connected');
            setActivePage('dashboard');
          }
        }
      } catch {
        // No saved config
      }
    })();
  }, [setAuth, setActivePage, setConnectionStatus]);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.login(serverUrl, password);
      if (result.token) {
        setAuth(serverUrl, result.token);
        setConnectionStatus('connected');
        setActivePage('dashboard');
      } else {
        setError(t('login.invalidPassword', locale));
      }
    } catch (err) {
      setError(`${t('login.connectionFailed', locale)}: ${(err as Error).message}`);
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full">
      <div className="w-80 space-y-4">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-cp-primary">{t('login.title', locale)}</h1>
          <p className="text-xs text-cp-muted mt-1">{t('login.subtitle', locale)}</p>
        </div>
        <div>
          <label className="block text-xs text-cp-muted mb-1">{t('login.serverUrl', locale)}</label>
          <input
            type="text"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
            className="w-full px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
            placeholder="http://localhost:8787"
          />
        </div>
        <div>
          <label className="block text-xs text-cp-muted mb-1">{t('login.password', locale)}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            className="w-full px-3 py-2 bg-cp-bg border border-cp-border rounded-lg text-sm text-cp-text focus:outline-none focus:border-cp-primary"
          />
        </div>
        {error && <div className="text-xs text-cp-danger bg-cp-danger/10 border border-cp-danger/20 rounded-lg px-3 py-2">{error}</div>}
        <button
          onClick={handleLogin}
          disabled={loading || !serverUrl || !password}
          className="btn-primary w-full"
        >
          {loading ? t('login.connecting', locale) : t('login.button', locale)}
        </button>
      </div>
    </div>
  );
}
