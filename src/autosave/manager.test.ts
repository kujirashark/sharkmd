import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutoSave } from './manager';
import { useTabsStore } from '../tabs/store';

vi.mock('../tauri/client', () => ({
  tauri: {
    saveFile: vi.fn().mockResolvedValue({ mtimeMs: 1 }),
    saveDraft: vi.fn().mockResolvedValue(undefined),
  },
}));

import { tauri } from '../tauri/client';

describe('autosave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(tauri.saveFile).mockClear();
    vi.mocked(tauri.saveDraft).mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it('saves after debounce', async () => {
    useTabsStore.setState({ tabs: [], activeId: null });
    const id = useTabsStore.getState().addTab({
      path: '/a.md',
      title: 'a',
      content: { type: 'doc' },
      mtimeMs: 0,
    });
    const m = createAutoSave({ getTab: () => useTabsStore.getState().tabs[0] });
    m.schedule(id);
    expect(tauri.saveFile).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    await Promise.resolve();
    await Promise.resolve();
    expect(tauri.saveFile).toHaveBeenCalledWith('/a.md', expect.any(String));
    expect(tauri.saveDraft).toHaveBeenCalled();
  });

  it('stops after stop()', async () => {
    useTabsStore.setState({ tabs: [], activeId: null });
    const id = useTabsStore.getState().addTab({
      path: '/a.md',
      title: 'a',
      content: { type: 'doc' },
      mtimeMs: 0,
    });
    const m = createAutoSave({ getTab: () => useTabsStore.getState().tabs[0] });
    m.schedule(id);
    m.stop();
    vi.advanceTimersByTime(1000);
    expect(tauri.saveFile).not.toHaveBeenCalled();
  });
});