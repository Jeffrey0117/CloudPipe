import { useState, useEffect } from 'react';
import { useAppStore } from '../stores/app-store';
import type { CloudPipeAPI } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const toggleLocale = useAppStore((s) => s.toggleLocale);

  useEffect(() => {
    api.windowIsMaximized().then(setMaximized);
  }, []);

  return (
    <div className="drag-region flex items-center justify-between h-10 bg-cp-bg border-b border-cp-border px-3 select-none">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-[10px] font-bold tracking-wider text-cp-muted uppercase">CloudPipe</span>
      </div>
      <div className="flex items-center gap-1 no-drag">
        {/* Locale toggle */}
        <button
          onClick={toggleLocale}
          className="px-2 py-1 rounded hover:bg-cp-border/50 transition-colors text-xs text-cp-muted hover:text-cp-text"
          title={locale === 'en' ? 'Switch to Chinese' : '切換為英文'}
        >
          {locale === 'en' ? 'ZH' : 'EN'}
        </button>
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="px-2 py-1 rounded hover:bg-cp-border/50 transition-colors text-xs text-cp-muted hover:text-cp-text"
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
        {/* Version */}
        <span className="text-[10px] text-cp-muted px-1">v0.1.0</span>
        {/* Separator */}
        <div className="w-px h-4 bg-cp-border mx-1" />
        {/* Window controls */}
        <button
          onClick={() => api.windowMinimize()}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors text-cp-muted hover:text-cp-text hover:bg-cp-border/50"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect fill="currentColor" width="10" height="1" /></svg>
        </button>
        <button
          onClick={async () => {
            await api.windowMaximize();
            setMaximized(await api.windowIsMaximized());
          }}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors text-cp-muted hover:text-cp-text hover:bg-cp-border/50"
        >
          {maximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10"><path fill="none" stroke="currentColor" d="M2 3h5v5H2zM3 3V1h5v5h-2" /></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10"><rect fill="none" stroke="currentColor" x=".5" y=".5" width="9" height="9" /></svg>
          )}
        </button>
        <button
          onClick={() => api.windowClose()}
          className="w-8 h-8 flex items-center justify-center rounded transition-colors text-cp-muted hover:text-white hover:bg-red-600"
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><path stroke="currentColor" strokeWidth="1.2" d="M1 1l8 8M9 1l-8 8" /></svg>
        </button>
      </div>
    </div>
  );
}
