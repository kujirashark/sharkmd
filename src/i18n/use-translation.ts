import { useTranslation } from 'react-i18next';

/**
 * Convenience wrapper around react-i18next's useTranslation.
 * Returns just the `t` function for terser call sites.
 *
 * Usage:
 *   const t = useT();
 *   <button>{t('menu.file.new')}</button>
 */
export function useT() {
  return useTranslation().t;
}
