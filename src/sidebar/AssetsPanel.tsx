import { useEffect, useState } from 'react';
import { tauri } from '../tauri/client';
import { useT } from '../i18n/use-translation';

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
  const t = useT();
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
    return <div className="assets-empty">{t('assets.emptyOpenFile')}</div>;
  }
  if (loading) {
    return <div className="assets-empty">{t('assets.loading')}</div>;
  }
  if (error) {
    return (
      <div className="assets-empty">
        <div>{t('assets.readError')}</div>
        <div className="assets-error-detail">{error}</div>
      </div>
    );
  }
  if (assets.length === 0) {
    return (
      <div className="assets-empty">
        <div>{t('assets.empty')}</div>
        <div className="assets-hint">{t('assets.hint')}</div>
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
