import { useEffect, useState } from 'react';
import { tauri, type DirEntry } from '../tauri/client';

export interface FileTreeProps {
  rootPath: string;
  onOpen: (path: string) => void;
}

export function FileTree({ rootPath, onOpen }: FileTreeProps) {
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    tauri.readDir(rootPath).then(setEntries).catch((e) => setError(String(e)));
  }, [rootPath]);

  // Filter: show directories + .md files only, hide dotfiles
  const visible = entries.filter((e) => {
    if (e.name.startsWith('.')) return false;
    return e.isDir || e.isMd;
  });

  if (error) return <div className="error">{error}</div>;
  return (
    <>
      <div className="sidebar-header">文件</div>
      {visible.length === 0 ? (
        <div className="empty">无 .md 文件</div>
      ) : (
        <ul className="file-tree" role="tree">
          {visible.map((e) => (
            <li key={e.path} className={e.isDir ? 'dir' : 'file'}>
              <span className="icon">{e.isDir ? '📁' : '📄'}</span>
              <span onClick={() => e.isMd && onOpen(e.path)}>{e.name}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
