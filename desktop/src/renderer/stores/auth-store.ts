import { create } from 'zustand';

interface AuthStore {
  serverUrl: string;
  token: string;
  isAuthenticated: boolean;
  setAuth: (serverUrl: string, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()((set) => ({
  serverUrl: '',
  token: '',
  isAuthenticated: false,
  setAuth: (serverUrl, token) => set({ serverUrl, token, isAuthenticated: true }),
  clearAuth: () => set({ serverUrl: '', token: '', isAuthenticated: false }),
}));
