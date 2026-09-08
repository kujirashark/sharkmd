import { useThemeStore } from './store';
import { useT } from '../i18n/use-translation';

export function ThemeSwitcher() {
  const t = useT();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  return (
    <div className="theme-switcher">
      <button data-active={theme === 'light'} onClick={() => setTheme('light')}>{t('theme.light')}</button>
      <button data-active={theme === 'dark'} onClick={() => setTheme('dark')}>{t('theme.dark')}</button>
    </div>
  );
}
