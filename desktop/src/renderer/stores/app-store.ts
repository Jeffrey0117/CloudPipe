import { create } from 'zustand';
import type { Page } from '@shared/types';
import type { Locale } from '../i18n';

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
}

export const useAppStore = create<AppStore>()((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
  theme: 'dark',
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
  locale: 'en',
  toggleLocale: () => set((s) => ({ locale: s.locale === 'en' ? 'zh' : 'en' })),
  connectionStatus: 'disconnected',
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}));
