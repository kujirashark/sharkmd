import { useEffect, useState } from 'react';
import { tauri, type DraftEntry } from '../tauri/client';
import { useT } from '../i18n/use-translation';
import { useTabsStore } from '../tabs/store';
import type { JSONContent } from '@tiptap/core';

/**
 * Shown at startup when one or more drafts (autosave snapshots) exist
 * on disk. Each row has Restore (re-open the tab from the snapshot)
 * and Discard (delete the snapshot). The dialog can also be closed
 * without touching drafts — drafts stay on disk for the next session.
 *
 * v0.3 addition: Restore button. v0.2 only had Discard + Close because
 * the frontend had no read_draft API; the Rust side stored the JSON
 * but the UI couldn't fetch it.
 */
export function RecoveryDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    tauri.listDrafts().then(setDrafts).catch(() => setDrafts([]));
  }, []);

  const refresh = () => {
    tauri.listDrafts().then(setDrafts).catch(() => setDrafts([]));
  };

  const handleRestore = async (fileId: string) => {
    setRestoring(fileId);
    setError(null);
    try {
      const payload = await tauri.readDraft(fileId);
      const content: JSONContent = JSON.parse(payload.json || '{}');
      const addTab = useTabsStore.getState().addTab;
      if (payload.path) {
        // Path is known — restore as a real tab. Use addTab which dedupes
        // by path; if a tab already exists we just land on it.
        addTab({
          path: payload.path,
          title: payload.path.split(/[\\/]/).pop() || payload.path,
          content,
          mtimeMs: 0,
        });
      } else {
        // No path (draft from an unsaved buffer); open as a new untitled tab
        // pointed at a synthetic path so the user can save-as later.
        const synthPath = `__recovery__/${fileId}.md`;
        addTab({
          path: synthPath,
          title: fileId,
          content,
          mtimeMs: 0,
        });
      }
      await tauri.deleteDraft(fileId);
      refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setRestoring(null);
    }
  };

  const handleDiscard = async (fileId: string) => {
    await tauri.deleteDraft(fileId);
    refresh();
  };

  return (
    <div className="recovery-dialog" role="dialog" aria-label={t('recovery.title')}>
      <h2>{t('recovery.title')}</h2>
      {error && <div className="recovery-error">{error}</div>}
      <ul>
        {drafts.length === 0 && <li className="recovery-empty">{t('recovery.empty')}</li>}
        {drafts.map((d) => {
          const basename = d.path ? d.path.split(/[\\/]/).pop() || d.path : d.fileId;
          return (
            <li key={d.fileId}>
              <span title={d.path || d.fileId} className="recovery-label">
                {basename}
              </span>
              <button
                data-testid={`recovery-restore-${d.fileId}`}
                disabled={restoring === d.fileId}
                onClick={() => handleRestore(d.fileId)}
              >
                {restoring === d.fileId ? t('recovery.restoring') : t('recovery.restore')}
              </button>
              <button
                data-testid={`recovery-discard-${d.fileId}`}
                disabled={restoring === d.fileId}
                onClick={() => handleDiscard(d.fileId)}
              >
                {t('recovery.discard')}
              </button>
            </li>
          );
        })}
      </ul>
      <button onClick={onClose}>{t('recovery.close')}</button>
    </div>
  );
}
