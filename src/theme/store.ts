import { create } from 'zustand';

export type ThemeName = 'light' | 'dark' | 'custom';
interface ThemeState {
  theme: ThemeName;
  customCssPath: string | null;
  setTheme: (t: ThemeName) => void;
  setCustomCss: (path: string | null) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  customCssPath: null,
  setTheme: (t) => {
    set({ theme: t });
    applyTheme(t, null);
  },
  setCustomCss: (path) => {
    set({ customCssPath: path, theme: path ? 'custom' : 'light' });
    applyTheme(path ? 'custom' : 'light', path);
  },
}));

function applyTheme(theme: ThemeName, customPath: string | null) {
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  const existing = document.getElementById('custom-css');
  if (existing) existing.remove();
  if (customPath) {
    const link = document.createElement('link');
    link.id = 'custom-css';
    link.rel = 'stylesheet';
    link.href = `file://${customPath}`; // Tauri 可访问 file://
    document.head.appendChild(link);
  }
}
