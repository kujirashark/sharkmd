import { useEffect, useState, useCallback } from 'react';
import { tauri, type DirEntry } from '../tauri/client';

export interface FileTreeProps {
  /** The root working directory (immutable, set from settings/dialog). */
  rootPath: string;
  onOpen: (path: string) => void;
}

/**
 * Recursive tree view of .md files. Directories can be expanded/collapsed.
 * Each directory is lazy-loaded: contents are fetched only when first expanded.
 */
export function FileTree({ rootPath, onOpen }: FileTreeProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <>
      <div className="sidebar-header">
        <span style={{ flex: 1 }}>文件</span>
        <button
          onClick={refresh}
          title="刷新"
          style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0 4px' }}
        >
          ↻
        </button>
      </div>
      <ul className="file-tree" role="tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        <TreeNode path={rootPath} name={rootPath.split(/[\\/]/).pop() || rootPath} depth={0} onOpen={onOpen} refreshKey={refreshKey} />
      </ul>
    </>
  );
}

interface TreeNodeProps {
  path: string;
  name: string;
  depth: number;
  onOpen: (path: string) => void;
  refreshKey: number;
}

function TreeNode({ path, name, depth, onOpen, refreshKey }: TreeNodeProps) {
  const [entries, setEntries] = useState<DirEntry[] | null>(null);
  const [expanded, setExpanded] = useState(depth < 1); // root auto-expanded
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded) return;
    let cancelled = false;
    tauri.readDir(path)
      .then((items) => { if (!cancelled) { setEntries(items); setError(null); } })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; };
  }, [path, expanded, refreshKey]);

  const visible = (entries ?? []).filter((e) => {
    if (e.name.startsWith('.')) return false;
    return e.isDir || e.isMd;
  });
  const dirs = visible.filter((e) => e.isDir);
  const files = visible.filter((e) => e.isMd);

  const paddingLeft = 8 + depth * 14;

  return (
    <>
      <li
        className="dir"
        style={{ padding: '3px 0', paddingLeft, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(!expanded)}
        title={path}
      >
        <span className="icon" style={{ display: 'inline-block', width: 14, color: 'var(--muted)' }}>
          {expanded ? '▼' : '▶'}
        </span>
        <span style={{ color: 'var(--accent)' }}>📁 {name}</span>
      </li>
      {expanded && (
        <>
          {error && <li style={{ paddingLeft: paddingLeft + 14, color: '#ef4444', fontSize: 12 }}>⚠ {error}</li>}
          {entries === null && !error && (
            <li style={{ paddingLeft: paddingLeft + 14, color: 'var(--muted)', fontSize: 12 }}>加载中…</li>
          )}
          {dirs.map((d) => (
            <TreeNode key={d.path} path={d.path} name={d.name} depth={depth + 1} onOpen={onOpen} refreshKey={refreshKey} />
          ))}
          {files.map((f) => (
            <li
              key={f.path}
              className="file"
              style={{ padding: '3px 0', paddingLeft: paddingLeft + 14, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              onClick={() => onOpen(f.path)}
              title={f.path}
            >
              <span style={{ marginRight: 6, opacity: 0.7 }}>📄</span>
              {f.name}
            </li>
          ))}
          {entries !== null && !error && dirs.length === 0 && files.length === 0 && (
            <li style={{ paddingLeft: paddingLeft + 14, color: 'var(--muted)', fontSize: 12 }}>空目录</li>
          )}
        </>
      )}
    </>
  );
}
