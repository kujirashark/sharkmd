import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { RecoveryDialog } from './RecoveryDialog';

vi.mock('../tauri/client', () => ({
  tauri: {
    listDrafts: vi.fn().mockResolvedValue([{ fileId: 'a', path: '/a.md', savedAtMs: 1 }]),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('<RecoveryDialog>', () => {
  it('lists drafts and removes the entry when 丢弃 is clicked', async () => {
    const onClose = vi.fn();
    const { getByText, queryByText } = render(<RecoveryDialog onClose={onClose} />);
    await waitFor(() => getByText('/a.md'));
    fireEvent.click(getByText('丢弃'));
    await waitFor(() => expect(queryByText('/a.md')).toBeNull());
  });
});
