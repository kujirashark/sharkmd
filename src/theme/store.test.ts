import { describe, it, expect, beforeEach } from 'vitest';
import { useThemeStore } from './store';

describe('theme store', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'light', customCssPath: null });
  });

  it('sets light theme attribute', () => {
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('sets dark theme attribute', () => {
    useThemeStore.getState().setTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
