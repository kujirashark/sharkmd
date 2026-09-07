import { useTabsStore } from './store';

export function TabsBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  return (
    <div className="tabs-bar" role="tablist">
      {tabs.map((t) => (
        <div key={t.id} className={`tab ${t.id === activeId ? 'active' : ''}`} role="tab"
             aria-selected={t.id === activeId} onClick={() => setActive(t.id)}>
          <span>{t.title}{t.dirty ? ' •' : ''}</span>
          <button onClick={(e) => { e.stopPropagation(); closeTab(t.id); }} aria-label="close">×</button>
        </div>
      ))}
    </div>
  );
}
