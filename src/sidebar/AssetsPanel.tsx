import { useEffect, useState } from 'react';
import { tauri } from '../tauri/client';

export interface Asset {
  name: string;
  path: string;
  size: number;
  mtimeMs: number;
}

/**
 * List images in `<fileDir>/assets/` for the currently open file.
 * Allows clicking to insert the markdown image syntax into the editor
 * (caller passes onInsert callback that has the editor instance).
 */
export function AssetsPanel({
  filePath,
  onInsert,
  onOpen,
}: {
  filePath: string | null;
  onInsert: (markdown: string) => void;
  onOpen?: (path: string) => void;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    if (!filePath) {
      setAssets([]);
      return;
    }
    const sep = filePath.includes('\\') ? '\\' : '/';
    const dir = filePath.replace(/[\\/][^\\/]+$/, '');
    const assetsDir = dir + sep + 'assets';
    setLoading(true);
    try {
      const entries = await tauri.readDir(assetsDir);
      const items: Asset[] = entries
        .filter((e) => !e.isDir && /\.(png|jpe?g|gif|webp|svg|bmp|ico)$/i.test(e.name))
        .map((e) => ({
          name: e.name,
          path: e.path,
          size: 0,
          mtimeMs: 0,
        }));
      setAssets(items);
      setError('');
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  if (!filePath) {
    return <div className="assets-empty">打开一个文件以查看其 assets/ 目录</div>;
  }
  if (loading) {
    return <div className="assets-empty">加载中…</div>;
  }
  if (error) {
    return (
      <div className="assets-empty">
        <div>无法读取 assets/ 目录</div>
        <div className="assets-error-detail">{error}</div>
      </div>
    );
  }
  if (assets.length === 0) {
    return (
      <div className="assets-empty">
        <div>暂无图片</div>
        <div className="assets-hint">拖入或粘贴图片会自动保存到该目录</div>
      </div>
    );
  }
  return (
    <div className="assets-panel">
      {assets.map((a) => (
        <div
          key={a.path}
          className="asset-item"
          title={a.name}
          onClick={() => {
            const rel = a.path.replace(/.*[\\/]assets[\\/]/, './assets/');
            onInsert(`![${a.name}](${rel})`);
          }}
          onDoubleClick={() => onOpen?.(a.path)}
        >
          <div className="asset-thumb">🖼</div>
          <div className="asset-name">{a.name}</div>
        </div>
      ))}
    </div>
  );
}
