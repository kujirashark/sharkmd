import { useEffect, useState } from 'react';
import { tauri, type DirEntry } from '../tauri/client';

export interface FileTreeProps {
  /** The root working directory (immutable, set from settings/dialog). */
  rootPath: string;
  onOpen: (path: string) => void;
}

export function FileTree({ rootPath, onOpen }: FileTreeProps) {
  // currentPath: where the user is currently browsing inside the tree.
  // Always starts at rootPath; can navigate into subdirectories.
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // When rootPath changes (user picks a new working dir), reset to root.
  useEffect(() => {
    setCurrentPath(rootPath);
  }, [rootPath]);

  useEffect(() => {
    if (!currentPath) return;
    tauri.readDir(currentPath)
      .then((items) => { setEntries(items); setError(null); })
      .catch((e) => setError(String(e)));
  }, [currentPath, refreshKey]);

  // Filter: show directories + .md files only, hide dotfiles.
  const visible = entries.filter((e) => {
    if (e.name.startsWith('.')) return false;
    return e.isDir || e.isMd;
  });

  const goUp = () => {
    if (!currentPath || currentPath === rootPath) return;
    const parent = currentPath.replace(/[\\/][^\\/]+$/, '');
    setCurrentPath(parent || rootPath);
  };

  // Path breadcrumb relative to rootPath
  const crumbs = currentPath
    ? currentPath.split(/[\\/]/).filter(Boolean)
    : [];

  return (
    <>
      <div className="sidebar-header">
        <span style={{ flex: 1 }}>文件</span>
        {currentPath !== rootPath && (
          <button
            className="back-btn"
            onClick={goUp}
            title="返回上级目录"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '0 4px' }}
          >
            ← 上级
          </button>
        )}
        <button
          className="refresh-btn"
          onClick={() => setRefreshKey((k) => k + 1)}
          title="刷新"
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 4px' }}
        >
          ↻
        </button>
      </div>
      <div className="breadcrumb" title={currentPath}>
        {crumbs.map((seg, i, arr) => {
          // Reconstruct absolute path: walk from rootPath forward
          const absPath = (() => {
            let p = rootPath;
            for (let j = 1; j <= i; j++) p = p + '/' + arr[j];
            return p;
          })();
          return (
            <span key={i}>
              <a
                onClick={() => setCurrentPath(absPath)}
                style={{ cursor: 'pointer', color: 'var(--accent)' }}
              >
                {seg}
              </a>
              {i < arr.length - 1 && <span style={{ color: 'var(--muted)' }}> / </span>}
            </span>
          );
        })}
      </div>
      {error ? (
        <div className="error">{error}</div>
      ) : visible.length === 0 ? (
        <div className="empty">无 .md 文件</div>
      ) : (
        <ul className="file-tree" role="tree">
          {visible.map((e) => (
            <li key={e.path} className={e.isDir ? 'dir' : 'file'}>
              <span
                className="icon"
                onClick={() => {
                  if (e.isDir) setCurrentPath(e.path);
                  else if (e.isMd) onOpen(e.path);
                }}
              >
                {e.isDir ? '📁' : '📄'}
              </span>
              <span
                onClick={() => {
                  if (e.isDir) setCurrentPath(e.path);
                  else if (e.isMd) onOpen(e.path);
                }}
                title={e.path}
              >
                {e.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
