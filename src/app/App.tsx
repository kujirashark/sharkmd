import { useEffect, useState } from 'react';
import { AppLayout } from './AppLayout';
import { tauri } from '../tauri/client';

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
      {/* RecoveryDialog 由 Task 19 实现，此处用内联占位，逻辑先就位 */}
      {showRecovery && (
        <div className="recovery-placeholder" role="dialog" aria-modal="true">
          <div className="recovery-placeholder__inner">
            <p>检测到未保存的草稿，RecoveryDialog 待 Task 19 实现。</p>
            <button onClick={() => setShowRecovery(false)}>关闭</button>
          </div>
        </div>
      )}
    </>
  );
}
