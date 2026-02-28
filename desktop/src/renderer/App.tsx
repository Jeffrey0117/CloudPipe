import { useEffect, Component, type ReactNode } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { LogsPage } from './pages/LogsPage';
import { GatewayPage } from './pages/GatewayPage';
import { SettingsPage } from './pages/SettingsPage';
import { useAppStore } from './stores/app-store';
import { useAuthStore } from './stores/auth-store';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-red-400 bg-cp-surface">
          <h2 className="text-lg font-bold mb-2">Render Error</h2>
          <pre className="text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
          <pre className="text-xs whitespace-pre-wrap text-cp-muted mt-2">{this.state.error.stack}</pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-4 px-4 py-2 bg-cp-primary text-white rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const activePage = useAppStore((s) => s.activePage);
  const theme = useAppStore((s) => s.theme);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex flex-col bg-cp-bg text-cp-text">
        <TitleBar />
        <main className="flex-1">
          <ErrorBoundary>
            <LoginPage />
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-cp-bg text-cp-text">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-cp-surface border-t border-cp-border p-4">
          <ErrorBoundary>
            {activePage === 'dashboard' && <DashboardPage />}
            {activePage === 'projects' && <ProjectsPage />}
            {activePage === 'logs' && <LogsPage />}
            {activePage === 'gateway' && <GatewayPage />}
            {activePage === 'settings' && <SettingsPage />}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
