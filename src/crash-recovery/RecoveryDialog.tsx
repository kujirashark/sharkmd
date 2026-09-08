import { useEffect, useState } from 'react';
import { tauri, type DraftEntry } from '../tauri/client';
import { useT } from '../i18n/use-translation';

export function RecoveryDialog({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [drafts, setDrafts] = useState<DraftEntry[]>([]);
  useEffect(() => {
    tauri.listDrafts().then(setDrafts);
  }, []);
  return (
    <div className="recovery-dialog" role="dialog" aria-label={t('recovery.title')}>
      <h2>{t('recovery.title')}</h2>
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
              {t('recovery.discard')}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onClose}>{t('recovery.close')}</button>
    </div>
  );
}
