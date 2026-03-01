import { create } from 'zustand';
import type { Page, CloudPipeAPI } from '@shared/types';
import type { Locale } from '../i18n';

const api = (window as unknown as { cloudpipe: CloudPipeAPI }).cloudpipe;

export type Theme = 'dark' | 'light';
type ConnectionStatus = 'connected' | 'disconnected' | 'checking';

interface AppStore {
  activePage: Page;
  setActivePage: (page: Page) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  locale: Locale;
  toggleLocale: () => void;
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  loadFromConfig: () => Promise<void>;
}

export const useAppStore = create<AppStore>()((set, get) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    set({ theme: next });
    api.setConfig({ theme: next });
  },
  locale: 'zh',
  toggleLocale: () => {
    const next = get().locale === 'en' ? 'zh' : 'en';
    set({ locale: next });
    api.setConfig({ locale: next });
  },
  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  loadFromConfig: async () => {
    const config = await api.getConfig();
    set({
      theme: config.theme || 'light',
      locale: (config.locale as Locale) || 'zh',
    });
  },
}));
