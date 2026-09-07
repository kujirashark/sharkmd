import { useThemeStore } from './store';

export function ThemeSwitcher() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div className="theme-switcher">
      <button data-active={theme === 'light'} onClick={() => setTheme('light')}>浅色</button>
      <button data-active={theme === 'dark'} onClick={() => setTheme('dark')}>深色</button>
    </div>
  );
}
