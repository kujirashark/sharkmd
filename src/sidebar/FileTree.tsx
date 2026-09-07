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
  if (error) return <div className="error">{error}</div>;
  return (
    <ul className="file-tree" role="tree">
      {entries.map((e) => (
        <li key={e.path} className={e.isDir ? 'dir' : 'file'}>
          {e.isDir ? '📁' : e.isMd ? '📄' : '·'} <span onClick={() => e.isMd && onOpen(e.path)}>{e.name}</span>
        </li>
      ))}
    </ul>
  );
}
