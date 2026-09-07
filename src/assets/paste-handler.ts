import { tauri } from '../tauri/client';

export async function extractImageFromClipboard(
  clipboard: DataTransfer | { items: DataTransferItem[] },
  currentFilePath: string,
): Promise<string | null> {
  const items = (clipboard as any).items as DataTransferItem[];
  for (const it of items) {
    if (it.type?.startsWith('image/')) {
      const file = it.getAsFile();
      if (!file) continue;
      const buf = new Uint8Array(await file.arrayBuffer());
      const sourceDir = currentFilePath.replace(/[\\/][^\\/]+$/, '');
      const filename = file.name || 'pasted.png';
      const rel = await tauri.saveAsset(sourceDir, filename, buf);
      return `![image](${rel})`;
    }
  }
  return null;
}
