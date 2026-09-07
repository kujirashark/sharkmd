import { describe, it, expect, vi } from 'vitest';
import { extractImageFromClipboard } from './paste-handler';

vi.mock('../tauri/client', () => ({
  tauri: { saveAsset: vi.fn().mockResolvedValue('./assets/abc.png') },
}));

describe('extractImageFromClipboard', () => {
  it('returns null when no image', async () => {
    expect(await extractImageFromClipboard({ items: [] } as any, '/x/y.md')).toBeNull();
  });
  it('returns markdown for image', async () => {
    const fakeFile = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
    const item = { type: 'image/png', getAsFile: () => fakeFile };
    const result = await extractImageFromClipboard({ items: [item] } as any, '/x/y.md');
    expect(result).toBe('![image](./assets/abc.png)');
  });
});
