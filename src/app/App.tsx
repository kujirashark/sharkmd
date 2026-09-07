/// <reference types="vite/client" />
import { useEffect, useState } from 'react';
import { AppLayout } from './AppLayout';
import { tauri } from '../tauri/client';
import { RecoveryDialog } from '../crash-recovery/RecoveryDialog';
import { parseMarkdown } from '../editor/bridge';
import { useTabsStore } from '../tabs/store';

export function App() {
  const [showRecovery, setShowRecovery] = useState(false);
  useEffect(() => {
    tauri
      .listDrafts()
      .then((d) => {
        if (d.length) setShowRecovery(true);
      })
      .catch(() => null);
  }, []);
  // Test hook (dev only): lets Playwright inject a file into the editor
  // without going through window.prompt or a real OS file picker.
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).__easymd_open = async (path: string) => {
        const fc = await tauri.openFile(path);
        const json = parseMarkdown(fc.text);
        useTabsStore.getState().addTab({
          path,
          title: path.split(/[\\/]/).pop() || path,
          content: json,
          mtimeMs: fc.mtimeMs,
        });
      };
    }
  }, []);
  return (
    <>
      <AppLayout />
      {showRecovery && <RecoveryDialog onClose={() => setShowRecovery(false)} />}
    </>
  );
}