import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { RecoveryDialog } from './RecoveryDialog';
import i18n from '../i18n';
import { useTabsStore } from '../tabs/store';

// Ensure i18n is initialized to a known language before the component mounts.
beforeAll(async () => {
  await i18n.changeLanguage('zh-CN');
});

const { listDrafts: listDraftsFn, readDraft: readDraftFn, deleteDraft: deleteDraftFn } = vi.hoisted(() => ({
  listDrafts: vi.fn(),
  readDraft: vi.fn(),
  deleteDraft: vi.fn(),
}));

vi.mock('../tauri/client', () => ({
  tauri: {
    listDrafts: listDraftsFn,
    readDraft: readDraftFn,
    deleteDraft: deleteDraftFn,
  },
}));

describe('<RecoveryDialog>', () => {
  beforeEach(() => {
    listDraftsFn.mockReset();
    readDraftFn.mockReset();
    deleteDraftFn.mockReset();
  });

  it('lists drafts and removes the entry when discard is clicked', async () => {
    listDraftsFn
      .mockResolvedValueOnce([{ fileId: 'a', path: '/a.md', savedAtMs: 1 }])
      .mockResolvedValueOnce([]); // after delete
    deleteDraftFn.mockResolvedValue(undefined);

    const onClose = vi.fn();
    const { getByTestId, queryByTestId } = render(<RecoveryDialog onClose={onClose} />);
    const discardBtn = await waitFor(() => getByTestId('recovery-discard-a'));
    fireEvent.click(discardBtn);
    await waitFor(() => expect(queryByTestId('recovery-discard-a')).toBeNull());
    expect(deleteDraftFn).toHaveBeenCalledWith('a');
  });

  it('renders the localized title', () => {
    listDraftsFn.mockResolvedValue([]);
    const onClose = vi.fn();
    const { getByText } = render(<RecoveryDialog onClose={onClose} />);
    expect(getByText(i18n.t('recovery.title'))).toBeTruthy();
  });

  // Regression: v0.2 had no Restore button (the read_draft API was
  // missing on both Rust and frontend sides). v0.3 wires it through.
  it('Restore button re-opens the draft as a tab and deletes the draft', async () => {
    listDraftsFn
      .mockResolvedValueOnce([{ fileId: 'a', path: '/a.md', savedAtMs: 1 }])
      .mockResolvedValueOnce([]); // after restore + delete
    readDraftFn.mockResolvedValue({
      fileId: 'a',
      path: '/a.md',
      savedAtMs: 1,
      json: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
    });
    deleteDraftFn.mockResolvedValue(undefined);

    useTabsStore.setState({ tabs: [], activeId: null });

    const onClose = vi.fn();
    const { getByTestId, queryByTestId } = render(<RecoveryDialog onClose={onClose} />);
    const restoreBtn = await waitFor(() => getByTestId('recovery-restore-a'));
    fireEvent.click(restoreBtn);

    await waitFor(() => expect(queryByTestId('recovery-restore-a')).toBeNull());
    expect(readDraftFn).toHaveBeenCalledWith('a');
    expect(deleteDraftFn).toHaveBeenCalledWith('a');

    const tabs = useTabsStore.getState().tabs;
    expect(tabs.find((t) => t.path === '/a.md')).toBeDefined();
  });
});
