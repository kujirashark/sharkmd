import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { FileTree } from './FileTree';

vi.mock('../tauri/client', () => ({
  tauri: {
    readDir: vi.fn().mockResolvedValue([
      { name: 'a.md', path: '/r/a.md', isDir: false, isMd: true },
      { name: 'sub', path: '/r/sub', isDir: true, isMd: false },
    ]),
  },
}));

describe('<FileTree>', () => {
  it('lists entries and invokes onOpen on click', async () => {
    const onOpen = vi.fn();
    const { getByText } = render(<FileTree rootPath="/r" onOpen={onOpen} />);
    await waitFor(() => getByText('a.md'));
    fireEvent.click(getByText('a.md'));
    expect(onOpen).toHaveBeenCalledWith('/r/a.md');
  });
});
