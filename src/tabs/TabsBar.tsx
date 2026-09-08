import { useEffect, useRef } from 'react';
import { useTabsStore } from './store';

export function TabsBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  const barRef = useRef<HTMLDivElement>(null);

  // When active tab changes, scroll it into view (so user always sees
  // which file they're in, even with many tabs)
  useEffect(() => {
    if (!barRef.current || !activeId) return;
    const el = barRef.current.querySelector(`[data-tab-id="${activeId}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeId]);

  return (
    <div className="tabs-bar" role="tablist" ref={barRef}>
      {tabs.map((t) => (
        <div
          key={t.id}
          data-tab-id={t.id}
          className={`tab ${t.id === activeId ? 'active' : ''} ${t.dirty ? 'dirty' : ''}`}
          role="tab"
          aria-selected={t.id === activeId}
          onClick={() => setActive(t.id)}
        >
          <span className="title">{t.title}</span>
          <button
            className="close"
            onClick={(e) => {
              e.stopPropagation();
              if (t.dirty && !window.confirm(`"${t.title}" 有未保存修改，确定关闭？`)) return;
              closeTab(t.id);
            }}
            aria-label="关闭"
            title="关闭"
          >×</button>
        </div>
      ))}
    </div>
  );
}
