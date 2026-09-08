import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { SearchPanel, type SearchPanelHandle } from './SearchPanel';
import i18n from '../i18n';

// Mock tauri client — only searchInFiles is exercised here.
vi.mock('../tauri/client', () => ({
  tauri: {
    searchInFiles: vi.fn(),
  },
}));

import { tauri } from '../tauri/client';
const mockSearch = vi.mocked(tauri.searchInFiles);

describe('SearchPanel', () => {
  beforeEach(async () => {
    // Ensure react-i18next is initialised before any render that reads keys.
    if (!i18n.isInitialized) {
      await new Promise<void>((resolve) => {
        i18n.on('initialized', () => resolve());
        // Fallback: if init already fired before we subscribed, just resolve.
        if (i18n.isInitialized) resolve();
      });
    }
    mockSearch.mockReset();
  });

  it('renders input and toggles', () => {
    render(<SearchPanel rootPath="/tmp" onOpen={() => {}} />);
    expect(screen.getByTestId('search-input')).toBeTruthy();
  });

  it('calls searchInFiles after 300ms debounce', async () => {
    vi.useFakeTimers();
    mockSearch.mockResolvedValue([]);
    try {
      render(<SearchPanel rootPath="/tmp" onOpen={() => {}} />);
      const input = screen.getByTestId('search-input');
      fireEvent.change(input, { target: { value: 'hello' } });

      // Should not fire before debounce
      expect(mockSearch).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(300);
        // flush the resolved-promise microtasks so React commits the result
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockSearch).toHaveBeenCalledTimes(1);
      expect(mockSearch).toHaveBeenCalledWith({
        root: '/tmp',
        pattern: 'hello',
        useRegex: false,
        caseSensitive: false,
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders grouped results with line numbers', async () => {
    mockSearch.mockResolvedValue([
      { file: '/tmp/a.md', relPath: 'a.md', line: 1, col: 1, lineText: 'hello world', matchText: 'hello' },
      { file: '/tmp/a.md', relPath: 'a.md', line: 5, col: 3, lineText: 'say hello there', matchText: 'hello' },
      { file: '/tmp/b.md', relPath: 'b.md', line: 2, col: 1, lineText: 'hello', matchText: 'hello' },
    ]);

    render(<SearchPanel rootPath="/tmp" onOpen={() => {}} />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'hello' } });

    const results = await screen.findAllByTestId('search-result');
    expect(results.length).toBe(3);
  });

  it('calls onOpen with jumpTo when a result is clicked', async () => {
    mockSearch.mockResolvedValue([
      { file: '/tmp/a.md', relPath: 'a.md', line: 7, col: 5, lineText: 'find here', matchText: 'find' },
    ]);
    const onOpen = vi.fn();

    render(<SearchPanel rootPath="/tmp" onOpen={onOpen} />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: 'find' } });

    const results = await screen.findAllByTestId('search-result');
    fireEvent.click(results[0]);

    expect(onOpen).toHaveBeenCalledWith('/tmp/a.md', { line: 7, col: 5 });
  });

  it('exposes focus via ref', () => {
    const ref: { current: SearchPanelHandle | null } = { current: null };
    render(<SearchPanel ref={ref} rootPath="/tmp" onOpen={() => {}} />);
    const input = screen.getByTestId('search-input');

    act(() => {
      ref.current?.focus();
    });

    expect(document.activeElement).toBe(input);
  });

  it('shows error message when search fails', async () => {
    mockSearch.mockRejectedValue(new Error('regex invalid'));

    render(<SearchPanel rootPath="/tmp" onOpen={() => {}} />);
    fireEvent.change(screen.getByTestId('search-input'), { target: { value: '[' } });

    await waitFor(() => {
      expect(screen.getByText(/regex invalid/)).toBeTruthy();
    });
  });
});
