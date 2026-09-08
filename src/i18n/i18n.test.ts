import { describe, it, expect } from 'vitest';
import i18n from './index';

describe('i18n', () => {
  it('translates to zh-CN', () => {
    expect(i18n.t('menu.file.new', { lng: 'zh-CN' })).toBe('新建文件');
  });

  it('translates to en-US', () => {
    expect(i18n.t('menu.file.new', { lng: 'en-US' })).toBe('New File');
  });

  it('falls back to zh-CN for unknown language', () => {
    expect(i18n.t('menu.file.new', { lng: 'fr-FR' })).toBe('新建文件');
  });

  it('renders interpolated strings', () => {
    expect(i18n.t('status.wordsChars', { lng: 'en-US', words: 5, chars: 30 })).toBe(
      '5 words · 30 chars',
    );
    expect(i18n.t('status.wordsChars', { lng: 'zh-CN', words: 5, chars: 30 })).toBe(
      '5 词 · 30 字符',
    );
  });

  it('renders message interpolation', () => {
    expect(
      i18n.t('message.cannotCreate', { lng: 'en-US', error: 'no permission' }),
    ).toBe('Cannot create: no permission');
  });

  it('has a language switch menu', () => {
    expect(i18n.t('menu.language.label', { lng: 'en-US' })).toBe('Language');
    expect(i18n.t('menu.language.label', { lng: 'zh-CN' })).toBe('语言');
  });
});
