import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../stores/app-store';
import type { CloudPipeAPI, Machine } from '@shared/types';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const locale = useAppStore((s) => s.locale);
  const toggleLocale = useAppStore((s) => s.toggleLocale);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [activeMachineId, setActiveMachineId] = useState('');
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.windowIsMaximized().then(setMaximized);
    api.getConfig().then((c) => {
      setMachines(c.machines || []);
      setActiveMachineId(c.activeMachineId || '');
    });
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeMachine = machines.find((m) => m.id === activeMachineId);

  const handleSwitch = async (id: string) => {
    const config = await api.switchMachine(id);
    setActiveMachineId(config.activeMachineId);
    setShowSwitcher(false);
    window.location.reload();
  };

  return (
    <div className="drag-region flex items-center justify-between h-10 bg-cp-bg border-b border-cp-border px-3 select-none">
      <div className="flex items-center gap-2 no-drag">
        <span className="text-[10px] font-bold tracking-wider text-cp-muted uppercase">CloudPipe</span>
        {/* Machine switcher */}
        {machines.length > 0 && (
          <div className="relative" ref={switcherRef}>
            <button
              onClick={() => setShowSwitcher(!showSwitcher)}
              className="px-2 py-0.5 rounded bg-cp-border/30 hover:bg-cp-border/50 transition-colors text-[10px] text-cp-muted hover:text-cp-text flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cp-success inline-block" />
              {activeMachine?.name || 'Local'}
              <span className="text-[8px] ml-0.5">{showSwitcher ? '\u25B2' : '\u25BC'}</span>
            </button>
            {showSwitcher && (
              <div className="absolute top-full left-0 mt-1 bg-cp-surface border border-cp-border rounded-lg shadow-lg py-1 min-w-[140px] z-50">
                {machines.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => handleSwitch(m.id)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-cp-border/30 transition-colors flex items-center gap-2 ${
                      m.id === activeMachineId ? 'text-cp-primary' : 'text-cp-text'
                    }`}
                  >
                    {m.id === activeMachineId && <span className="w-1.5 h-1.5 rounded-full bg-cp-primary inline-block" />}
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 no-drag">
        {/* Locale toggle */}
        <button
          onClick={toggleLocale}
          className="px-2 py-1 rounded hover:bg-cp-border/50 transition-colors text-xs text-cp-muted hover:text-cp-text"
          title={locale === 'en' ? 'Switch to Chinese' : '\u5207\u63DB\u70BA\u82F1\u6587'}
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
        <span className="text-[10px] text-cp-muted px-1">v0.2.0</span>
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
