import { useEffect, useRef, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { TabsBar } from '../tabs/TabsBar';
import { FileTree } from '../sidebar/FileTree';
import { extractHeadings } from '../sidebar/Outline';
import { Editor } from '../editor/Editor';
import { Toolbar } from '../editor/Toolbar';
import { ThemeSwitcher } from '../theme/ThemeSwitcher';
import { useTabsStore } from '../tabs/store';
import { tauri } from '../tauri/client';
import { parseMarkdown } from '../editor/bridge';
import { createAutoSave } from '../autosave/manager';
import { useThemeStore, type ThemeName } from '../theme/store';
import type { Editor as TiptapEditor } from '@tiptap/core';

export function AppLayout() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const addTab = useTabsStore((s) => s.addTab);
  const updateContent = useTabsStore((s) => s.updateContent);
  const [rootPath, setRootPath] = useState<string>('');
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof createAutoSave> | null>(null);
  // Path → wall-clock timestamp of our last successful save. Used to
  // suppress the watcher event fired by our own atomic write so the user
  // isn't immediately prompted about their own save.
  const lastSaveAtRef = useRef<Map<string, number>>(new Map());

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
      onSave: (path) => {
        lastSaveAtRef.current.set(path, Date.now());
      },
    });
    return () => {
      autoSaveRef.current?.stop();
      autoSaveRef.current = null;
    };
  }, [activeId]);

  // Listen for external file changes emitted by the Rust watcher.
  // If the changed file matches the currently active tab and the new
  // mtime is newer than ours, prompt the user to either reload from disk
  // or keep the in-memory edits.
  useEffect(() => {
    const un = listen<{ path: string; mtimeMs: number }>(
      'fs:external-change',
      async (event) => {
        const { path, mtimeMs } = event.payload;
        const cur = useTabsStore.getState().tabs.find(
          (t) => t.id === useTabsStore.getState().activeId,
        );
        if (!cur) return;
        if (path !== cur.path) return;
        // Suppress the watcher event triggered by our own atomic save:
        // if the event arrives within 1.5s of our recorded save and the
        // reported mtime is no newer than what we just wrote, treat it
        // as self-induced and skip the prompt.
        const lastSavedAt = lastSaveAtRef.current.get(path) ?? 0;
        if (Date.now() - lastSavedAt < 1500 && mtimeMs <= cur.mtimeMs + 1) return;
        if (mtimeMs <= cur.mtimeMs) return;
        const ok = window.confirm(
          `文件已被外部修改：${path}\n是否重新加载磁盘版本？\n（取消将保留当前编辑）`,
        );
        if (!ok) return;
        try {
          const fc = await tauri.openFile(path);
          const json = parseMarkdown(fc.text);
          useTabsStore.getState().updateContent(cur.id, json, false);
          useTabsStore.getState().setMtime(cur.id, fc.mtimeMs);
        } catch {
          // MVP：失败静默，后续接入 toast 通知
        }
      },
    );
    return () => {
      un.then((f) => f());
    };
  }, []);

  const active = tabs.find((t) => t.id === activeId);
  const headings = active ? extractHeadings(active.content) : [];

  return (
    <div className="app-layout">
      <header className="topbar">
        <ThemeSwitcher />
        <button
          onClick={async () => {
            const p = window.prompt('工作目录（粘贴完整路径）', rootPath);
            if (p) setRootPath(p);
          }}
          title="选择要浏览的工作目录"
        >
          📂 选择目录
        </button>
        {active && (
          <span style={{ marginLeft: 12, color: 'var(--muted)', fontSize: 12 }} title="自动保存到磁盘和 draft 缓存">
            {active.dirty ? '● 未保存' : '✓ 已自动保存'}
          </span>
        )}
        <span className="spacer" />
        <span style={{ color: 'var(--muted)', fontSize: 11 }}>
          快捷键: Ctrl+B 加粗 · Ctrl+I 斜体 · Ctrl+K 链接 · # 空格=H1
        </span>
      </header>
      <TabsBar />
      <div className="main">
        <aside className="sidebar">
          {rootPath ? (
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
                } catch (e) {
                  window.alert(`无法打开文件: ${e}`);
                }
              }}
            />
          ) : (
            <div className="empty">点击上方"📂 选择目录"开始</div>
          )}
        </aside>
        <main className="editor-pane">
          <Toolbar editor={editor} />
          {active ? (
            <Editor
              key={active.id /* ensure fresh editor on tab switch */}
              value={active.content}
              onChange={(c) => {
                updateContent(active.id, c);
                autoSaveRef.current?.schedule(active.id);
              }}
              onEditorReady={setEditor}
            />
          ) : (
            <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>
              打开一个 .md 文件开始编辑
            </div>
          )}
        </main>
        <aside className="outline-pane">
          <div className="outline-header">大纲</div>
          {headings.length === 0 ? (
            <div className="empty">无标题</div>
          ) : (
            <ul className="outline">
              {headings.map((h, i) => (
                <li key={i} data-level={h.level} title={`H${h.level}: ${h.text}`}>
                  {h.text}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
