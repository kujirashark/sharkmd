import { useEffect, useState } from 'react';
import { tauri, type DraftEntry } from '../tauri/client';

export function RecoveryDialog({ onClose }: { onClose: () => void }) {
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  useEffect(() => {
    tauri.listDrafts().then(setDrafts);
  }, []);
  return (
    <div className="recovery-dialog" role="dialog" aria-label="未保存的会话">
      <h2>检测到未保存的会话</h2>
      <ul>
        {drafts.map((d) => (
          <li key={d.fileId}>
            <span>{d.path || d.fileId}</span>
            <button
              onClick={() =>
                tauri.deleteDraft(d.fileId).then(() =>
                  setDrafts(drafts.filter((x) => x.fileId !== d.fileId)),
                )
              }
            >
              丢弃
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onClose}>关闭</button>
    </div>
  );
}
