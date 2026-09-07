import { useEffect, useRef, useState } from 'react';
import { TabsBar } from '../tabs/TabsBar';
import { FileTree } from '../sidebar/FileTree';
import { Outline, extractHeadings } from '../sidebar/Outline';
import { Editor } from '../editor/Editor';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { useTabsStore } from '../tabs/store';
import { tauri } from '../tauri/client';
import { parseMarkdown } from '../editor/bridge';
import { createAutoSave } from '../autosave/manager';
import { useThemeStore, type ThemeName } from '../theme/store';

export function AppLayout() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const addTab = useTabsStore((s) => s.addTab);
  const updateContent = useTabsStore((s) => s.updateContent);
  const [rootPath, setRootPath] = useState<string>('');
  const autoSaveRef = useRef<ReturnType<typeof createAutoSave> | null>(null);

  useEffect(() => {
    tauri.getSettings().then((s) => {
      useThemeStore.getState().setTheme(s.theme as ThemeName);
    }).catch(() => null);
  }, []);

  // Recreate autosave manager whenever the active tab changes. The manager
  // captures the active tab at the time a scheduled save fires, so a fresh
  // instance is required per tab.
  useEffect(() => {
    autoSaveRef.current?.stop();
    if (!activeId) {
      autoSaveRef.current = null;
      return;
    }
    autoSaveRef.current = createAutoSave({
      getTab: () => useTabsStore.getState().tabs.find((t) => t.id === activeId),
    });
    return () => {
      autoSaveRef.current?.stop();
      autoSaveRef.current = null;
    };
  }, [activeId]);

  const active = tabs.find((t) => t.id === activeId);
  const headings = active ? extractHeadings(active.content) : [];

  return (
    <div className="app-layout">
      <header className="topbar">
        <ThemeSwitcher />
        <button
          onClick={async () => {
            // MVP：使用固定根目录（settings 后续扩展）
            const p = await window.prompt('工作目录', rootPath);
            if (p) setRootPath(p);
          }}
        >
          选择目录
        </button>
      </header>
      <TabsBar />
      <div className="main">
        <aside className="sidebar">
          {rootPath && (
            <FileTree
              rootPath={rootPath}
              onOpen={async (path) => {
                try {
                  const fc = await tauri.openFile(path);
                  const json = parseMarkdown(fc.text);
                  addTab({
                    path,
                    title: path.split(/[\\/]/).pop() || path,
                    content: json,
                    mtimeMs: fc.mtimeMs,
                  });
                  await tauri.watch(path).catch(() => null);
                } catch {
                  // MVP：失败静默，后续接入 toast 通知
                }
              }}
            />
          )}
        </aside>
        <main className="editor-pane">
          {active && (
            <Editor
              value={active.content}
              onChange={(c) => {
                updateContent(active.id, c);
                autoSaveRef.current?.schedule(active.id);
              }}
            />
          )}
        </main>
        <aside className="outline-pane">
          <Outline headings={headings} />
        </aside>
      </div>
    </div>
  );
}
