import { useEffect, useRef, useState, useCallback, type RefObject } from 'react';
import { listen } from '@tauri-apps/api/event';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { TabsBar } from '../tabs/TabsBar';
import { SidebarTabs, type SidebarTab } from './SidebarTabs';
import { extractHeadings, type Heading } from '../sidebar/Outline';
import { Editor } from '../editor/Editor';
import { Toolbar } from '../editor/Toolbar';
import { FindBar } from '../editor/FindBar';
import { MenuBar } from './MenuBar';
import { StatusBar } from './StatusBar';
import { useTabsStore } from '../tabs/store';
import { tauri } from '../tauri/client';
import { parseMarkdown } from '../editor/bridge';
import { createAutoSave } from '../autosave/manager';
import { useThemeStore, type ThemeName } from '../theme/store';
import i18n from '../i18n';
import type { Editor as TiptapEditor } from '@tiptap/core';
import type { SearchPanelHandle } from '../sidebar/SearchPanel';

export function AppLayout() {
  const { t } = useTranslation();
  const tabs = useTabsStore((s) => s.tabs);
  const activeId = useTabsStore((s) => s.activeId);
  const addTab = useTabsStore((s) => s.addTab);
  const updateContent = useTabsStore((s) => s.updateContent);
  const [rootPath, setRootPath] = useState<string>('');
  const [editor, setEditor] = useState<TiptapEditor | null>(null);
  const [fileTreeKey, setFileTreeKey] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
  const [showSidebar, setShowSidebar] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof createAutoSave> | null>(null);
  const lastSaveAtRef = useRef<Map<string, number>>(new Map());
  const searchPanelRef: RefObject<SearchPanelHandle> = useRef<SearchPanelHandle>(null);

  useEffect(() => {
    tauri.getSettings().then((s) => {
      useThemeStore.getState().setTheme(s.theme as ThemeName);
      if (s.lastRootPath) setRootPath(s.lastRootPath);
      if (s.language) i18n.changeLanguage(s.language).catch(() => null);
    }).catch(() => null);
  }, []);

  useEffect(() => {
    if (!rootPath) return;
    tauri.getSettings().then((s) => {
      if (s.lastRootPath === rootPath) return;
      tauri.setSettings({ ...s, lastRootPath: rootPath }).catch(() => null);
    }).catch(() => null);
  }, [rootPath]);

  // Ctrl+O shortcut (open single file) + Ctrl+Shift+F (focus search panel)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'o' || e.key === 'O') && !e.shiftKey) {
        e.preventDefault();
        openSingleFile();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSidebarTab('search');
        // Wait for React to render the SearchPanel before focusing its input.
        window.setTimeout(() => searchPanelRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Autosave manager
  useEffect(() => {
    autoSaveRef.current?.stop();
    if (!activeId) { autoSaveRef.current = null; return; }
    autoSaveRef.current = createAutoSave({
      getTab: () => useTabsStore.getState().tabs.find((t) => t.id === activeId),
      onSave: (path) => { lastSaveAtRef.current.set(path, Date.now()); },
    });
    return () => { autoSaveRef.current?.stop(); autoSaveRef.current = null; };
  }, [activeId]);

  // External change listener
  useEffect(() => {
    const un = listen<{ path: string; mtimeMs: number }>(
      'fs:external-change',
      async (event) => {
        const { path, mtimeMs } = event.payload;
        const cur = useTabsStore.getState().tabs.find(
          (t) => t.id === useTabsStore.getState().activeId,
        );
        if (!cur || path !== cur.path) return;
        const lastSavedAt = lastSaveAtRef.current.get(path) ?? 0;
        if (Date.now() - lastSavedAt < 1500 && mtimeMs <= cur.mtimeMs + 1) return;
        if (mtimeMs <= cur.mtimeMs) return;
        const ok = window.confirm(t('message.externalChangeConfirm', { path }));
        if (!ok) return;
        try {
          const fc = await tauri.openFile(path);
          const json = parseMarkdown(fc.text);
          useTabsStore.getState().updateContent(cur.id, json, false);
          useTabsStore.getState().setMtime(cur.id, fc.mtimeMs);
        } catch { /* silent */ }
      },
    );
    return () => { un.then((f) => f()); };
  }, []);

  const openSingleFile = useCallback(async () => {
    const selected = await openDialog({
      multiple: false,
      title: t('dialog.openMarkdown'),
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
      defaultPath: rootPath || undefined,
    });
    if (typeof selected === 'string' && selected) {
      openFileByPath(selected);
    }
  }, [rootPath, t]);

  const openFileByPath = useCallback(async (path: string, jumpTo?: { line: number; col: number }) => {
    try {
      const fc = await tauri.openFile(path);
      const json = parseMarkdown(fc.text);
      addTab({
        path,
        title: path.split(/[\\/]/).pop() || path,
        content: json,
        mtimeMs: fc.mtimeMs,
        ...(jumpTo ? { initialJump: jumpTo } : {}),
      });
      await tauri.watch(path).catch(() => null);
    } catch (e) {
      window.alert(t('message.cannotOpen', { error: String(e) }));
    }
  }, [addTab]);

  const chooseDirectory = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: t('dialog.chooseDir'),
      defaultPath: rootPath || undefined,
    });
    if (typeof selected === 'string' && selected) setRootPath(selected);
  }, [rootPath, t]);

  // Click outline → scroll editor to that heading
  const handleOutlineClick = useCallback((h: Heading) => {
    if (!editor) return;
    // Find the heading node in the doc by text content
    const { doc } = editor.state;
    let foundPos: number | null = null;
    doc.descendants((node, pos) => {
      if (foundPos != null) return false;
      if (node.type.name === 'heading' && node.attrs.level === h.level) {
        const text = node.textContent;
        if (text === h.text) { foundPos = pos; return false; }
      }
      return true;
    });
    if (foundPos != null) {
      editor.commands.focus();
      editor.commands.setTextSelection(foundPos + 1);
      // Scroll into view
      const dom = editor.view.domAtPos(foundPos + 1).node as HTMLElement;
      dom?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [editor]);

  const active = tabs.find((t) => t.id === activeId);
  const headings: Heading[] = active ? extractHeadings(active.content) : [];

  return (
    <div className="app-layout">
      <MenuBar
        editor={editor}
        onChooseDir={chooseDirectory}
        onOpenFile={openFileByPath}
        activeId={activeId}
        showSidebar={showSidebar}
        showOutline={true /* legacy: outline lives in sidebar tab now */}
        onToggleSidebar={() => setShowSidebar((v) => !v)}
        onToggleOutline={() => setShowSidebar((v) => !v)}
        onOpenFind={() => setFindOpen(true)}
      />
      <TabsBar />
      <div className="main">
        {showSidebar && (
          <aside className="sidebar">
            {rootPath ? (
              <SidebarTabs
                key={fileTreeKey}
                active={sidebarTab}
                onChange={setSidebarTab}
                rootPath={rootPath}
                headings={headings}
                activeFilePath={active?.path ?? null}
                onInsertAsset={(md) => {
                  if (!editor) return;
                  editor.chain().focus().insertContent(md).run();
                }}
                onOpen={openFileByPath}
                onCreate={async (path) => {
                  try {
                    const res = await tauri.saveFile(path, '');
                    addTab({
                      path,
                      title: path.split(/[\\/]/).pop() || path,
                      content: { type: 'doc', content: [{ type: 'paragraph' }] },
                      mtimeMs: res.mtimeMs,
                    });
                    await tauri.watch(path).catch(() => null);
                    setFileTreeKey((k) => k + 1);
                  } catch (e) {
                    window.alert(t('message.cannotCreateFile', { error: String(e) }));
                  }
                }}
                onOutlineClick={handleOutlineClick}
                searchPanelRef={searchPanelRef}
              />
            ) : (
              <>
                <div className="sidebar-tabs">
                  <button className="sidebar-tab active">{t('sidebar.files')}</button>
                </div>
                <div className="empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
                  {t('sidebar.emptyHint')}
                </div>
              </>
            )}
          </aside>
        )}
        <main className="editor-pane">
          <Toolbar editor={editor} />
          <FindBar editor={editor} open={findOpen} onClose={() => setFindOpen(false)} />
          <div className="editor-scroll">
            {active ? (
              <Editor
                key={active.id}
                value={active.content}
                onChange={(c) => {
                  updateContent(active.id, c);
                  autoSaveRef.current?.schedule(active.id);
                }}
                onEditorReady={setEditor}
                currentFilePath={active.path}
                initialJump={active.initialJump}
              />
            ) : (
              <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>sharkmd</p>
                <p>{t('sidebar.welcomeHint')}</p>
                <p style={{ marginTop: 16, fontSize: 12 }}>{t('sidebar.welcomeDirHint')}</p>
              </div>
            )}
          </div>
        </main>
      </div>
      <StatusBar editor={editor} />
    </div>
  );
}
