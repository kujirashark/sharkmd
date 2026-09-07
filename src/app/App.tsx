import { useEffect, useState } from 'react';
import { AppLayout } from './AppLayout';
import { tauri } from '../tauri/client';
import { RecoveryDialog } from '../crash-recovery/RecoveryDialog';

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
  return (
    <>
      <AppLayout />
      {showRecovery && <RecoveryDialog onClose={() => setShowRecovery(false)} />}
    </>
  );
}
