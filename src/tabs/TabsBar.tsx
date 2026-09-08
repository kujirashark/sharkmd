import { useTabsStore } from './store';

export function TabsBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);
  return (
    <div className="tabs-bar" role="tablist">
      {tabs.map((t) => (
        <div
          key={t.id}
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
