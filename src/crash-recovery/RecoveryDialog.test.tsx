import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { RecoveryDialog } from './RecoveryDialog';
import i18n from '../i18n';

// Ensure i18n is initialized to a known language before the component mounts.
beforeAll(async () => {
  await i18n.changeLanguage('zh-CN');
});

vi.mock('../tauri/client', () => ({
  tauri: {
    listDrafts: vi.fn().mockResolvedValue([{ fileId: 'a', path: '/a.md', savedAtMs: 1 }]),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('<RecoveryDialog>', () => {
  it('lists drafts and removes the entry when discard is clicked', async () => {
    const onClose = vi.fn();
    const { getByText, queryByText } = render(<RecoveryDialog onClose={onClose} />);
    await waitFor(() => getByText('/a.md'));
    // The discard label is translated; assert via the resolved key rather than
    // the raw Chinese text so the test still passes after locale changes.
    const discardLabel = i18n.t('recovery.discard');
    fireEvent.click(getByText(discardLabel));
    await waitFor(() => expect(queryByText('/a.md')).toBeNull());
  });

  it('renders the localized title', () => {
    const onClose = vi.fn();
    const { getByText } = render(<RecoveryDialog onClose={onClose} />);
    expect(getByText(i18n.t('recovery.title'))).toBeTruthy();
  });
});
