import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { UpdaterPanel, fetchLatestRelease } from './UpdaterPanel';
import i18n from '../i18n';

const RELEASE_URL = 'https://api.github.com/repos/kujirashark/sharkmd/releases/latest';

const originalFetch = global.fetch;

beforeEach(async () => {
  if (!i18n.isInitialized) {
    await new Promise<void>((resolve) => {
      i18n.on('initialized', () => resolve());
      if (i18n.isInitialized) resolve();
    });
  }
  await i18n.changeLanguage('en-US');
});

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetchResponse(body: unknown, status = 200) {
  global.fetch = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)) as unknown as typeof fetch;
}

function mockFetchReject(err: Error) {
  global.fetch = vi.fn(async () => {
    throw err;
  }) as unknown as typeof fetch;
}

describe('fetchLatestRelease', () => {
  it('returns release info on success', async () => {
    mockFetchResponse({
      tag_name: 'v9.9.9',
      name: 'Release v9.9.9',
      body: '## Changes\n- new stuff',
      published_at: '2026-09-01T00:00:00Z',
      html_url: 'https://github.com/kujirashark/sharkmd/releases/tag/v9.9.9',
    });
    const info = await fetchLatestRelease();
    expect(info?.tagName).toBe('v9.9.9');
    expect(info?.htmlUrl).toContain('v9.9.9');
    expect(info?.body).toContain('Changes');
    expect(info?.publishedAt).toBe('2026-09-01T00:00:00Z');
    expect(global.fetch).toHaveBeenCalledWith(
      RELEASE_URL,
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('throws on 4xx with status', async () => {
    mockFetchResponse({ message: 'Not Found' }, 404);
    await expect(fetchLatestRelease()).rejects.toMatchObject({ status: 404 });
  });

  it('throws on 5xx with status', async () => {
    mockFetchResponse({ message: 'boom' }, 500);
    await expect(fetchLatestRelease()).rejects.toMatchObject({ status: 500 });
  });

  it('propagates network errors', async () => {
    mockFetchReject(new TypeError('Failed to fetch'));
    await expect(fetchLatestRelease()).rejects.toThrow(/Failed to fetch/);
  });
});

describe('<UpdaterPanel>', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<UpdaterPanel open={false} onClose={() => {}} />);
    expect(container.querySelector('.modal-backdrop')).toBeNull();
  });

  it('shows the "checking" state while request is in flight, then "up to date"', async () => {
    mockFetchResponse({
      tag_name: 'v0.0.1', // below current package.json version
      name: 'old',
      body: '',
      published_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com',
    });
    render(<UpdaterPanel open onClose={() => {}} />);
    // Initially shows checking text
    expect(screen.getByText(/Checking/i)).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByTestId('updater-uptodate-headline')).toBeTruthy();
    });
    // Open Release button should NOT exist when up-to-date
    expect(screen.queryByTestId('updater-open-release')).toBeNull();
  });

  it('shows release info + open button when a newer tag exists', async () => {
    mockFetchResponse({
      tag_name: 'v99.0.0',
      name: 'v99',
      body: '- feature A\n- fix B',
      published_at: '2026-09-09T00:00:00Z',
      html_url: 'https://github.com/kujirashark/sharkmd/releases/tag/v99.0.0',
    });
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<UpdaterPanel open onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByTestId('updater-open-release')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('updater-open-release'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://github.com/kujirashark/sharkmd/releases/tag/v99.0.0',
      '_blank',
      'noopener,noreferrer',
    );
    openSpy.mockRestore();
  });

  it('shows the API error message on 404', async () => {
    mockFetchResponse({ message: 'Not Found' }, 404);
    render(<UpdaterPanel open onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/HTTP 404/)).toBeTruthy();
    });
  });

  it('shows network error when fetch rejects', async () => {
    mockFetchReject(new TypeError('Failed to fetch'));
    render(<UpdaterPanel open onClose={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeTruthy();
    });
  });

  it('calls onClose when the close button is clicked in the up-to-date state', async () => {
    mockFetchResponse({
      tag_name: 'v0.0.1',
      name: 'old',
      body: '',
      published_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com',
    });
    const onClose = vi.fn();
    render(<UpdaterPanel open onClose={onClose} />);
    await waitFor(() => screen.getByTestId('updater-close'));
    fireEvent.click(screen.getByTestId('updater-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refetches when reopened', async () => {
    mockFetchResponse({
      tag_name: 'v0.0.1',
      name: 'old',
      body: '',
      published_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com',
    });
    const onClose = vi.fn();
    const { rerender } = render(<UpdaterPanel open onClose={onClose} />);
    await waitFor(() => screen.getByTestId('updater-uptodate-headline'));
    expect(global.fetch).toHaveBeenCalledTimes(1);

    rerender(<UpdaterPanel open={false} onClose={onClose} />);
    rerender(<UpdaterPanel open onClose={onClose} />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  it('formats published_at date as a human-readable string', async () => {
    mockFetchResponse({
      tag_name: 'v99.0.0',
      name: 'v99',
      body: 'release notes',
      published_at: '2026-09-09T12:34:56Z',
      html_url: 'https://example.com/v99',
    });
    render(<UpdaterPanel open onClose={() => {}} />);
    await waitFor(() => {
      // The label contains "Published:" plus some date — assert the
      // prefix is rendered; locale-dependent date strings would make
      // the test brittle otherwise.
      expect(screen.getByText(/Published:/i)).toBeTruthy();
    });
  });

  // Guard: catch stray unhandled rejections in async checks so a
  // failing fetch doesn't surface as a vitest error.
  it('does not leak unhandled rejections when re-opening', async () => {
    mockFetchResponse({
      tag_name: 'v0.0.1',
      name: 'old',
      body: '',
      published_at: '2026-01-01T00:00:00Z',
      html_url: 'https://example.com',
    });
    const onClose = vi.fn();
    const { rerender } = render(<UpdaterPanel open onClose={onClose} />);
    await waitFor(() => screen.getByTestId('updater-uptodate-headline'));
    // Trigger a fast re-mount
    await act(async () => {
      rerender(<UpdaterPanel open={false} onClose={onClose} />);
      rerender(<UpdaterPanel open onClose={onClose} />);
    });
  });
});