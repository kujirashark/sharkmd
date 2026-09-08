import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { tauri } from '../tauri/client';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { serializeMarkdown } from '../editor/bridge';
import { useThemeStore } from '../theme/store';
import { useTabsStore } from '../tabs/store';

export interface MenuBarProps {
  editor: Editor | null;
  onChooseDir: () => void;
  onOpenFile: (path: string) => void;
  activeId: string | null;
  // Show/hide side panels
  showSidebar: boolean;
  showOutline: boolean;
  onToggleSidebar: () => void;
  onToggleOutline: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run?: () => void;
  separator?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

export function MenuBar({
  editor, onChooseDir, onOpenFile, activeId,
  showSidebar, showOutline, onToggleSidebar, onToggleOutline,
}: MenuBarProps) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themeName = useThemeStore((s) => s.theme);
  const closeTab = useTabsStore((s) => s.closeTab);
  const tabs = useTabsStore((s) => s.tabs);

  const run = (fn?: () => void) => {
    setOpenMenu(null);
    if (fn) fn();
  };

  const menus: MenuDef[] = [
    {
      label: '文件',
      items: [
        { label: '新建文件', shortcut: 'Ctrl+N', run: () => {
          if (!editor) return;
          const name = window.prompt('新文件名称', 'untitled');
          if (!name) return;
          const safe = name.replace(/[\\/:*?"<>|]/g, '_').trim();
          const filename = safe.endsWith('.md') ? safe : safe + '.md';
          // Create in current file's directory or rootPath fallback
          const current = tabs.find((t) => t.id === activeId);
          const baseDir = current ? current.path.replace(/[\\/][^\\/]+$/, '') : '';
          const full = baseDir ? baseDir + '\\' + filename : filename;
          tauri.saveFile(full, '').then(() => {
            onOpenFile(full);
          }).catch((e) => window.alert(`无法创建: ${e}`));
        } },
        { label: '选择工作目录…', run: onChooseDir },
        { label: '打开文件…', shortcut: 'Ctrl+O', run: async () => {
          const selected = await openDialog({
            multiple: false,
            title: '打开 Markdown 文件',
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
          });
          if (typeof selected === 'string' && selected) onOpenFile(selected);
        } },
        { separator: true, label: '' },
        { label: '保存', shortcut: 'Ctrl+S', disabled: !editor, run: () => {
          if (!editor || !activeId) return;
          const current = tabs.find((t) => t.id === activeId);
          if (!current) return;
          const md = serializeMarkdown(editor.getJSON());
          tauri.saveFile(current.path, md).then((res) => {
            useTabsStore.getState().setMtime(current.id, res.mtimeMs);
            useTabsStore.getState().updateContent(current.id, current.content, false);
          }).catch((e) => window.alert(`保存失败: ${e}`));
        } },
        { label: '关闭当前标签', shortcut: 'Ctrl+W', disabled: !activeId, run: () => { if (activeId) closeTab(activeId); } },
      ],
    },
    {
      label: '编辑',
      items: [
        { label: '撤销', shortcut: 'Ctrl+Z', disabled: !editor, run: () => editor?.chain().focus().undo().run() },
        { label: '重做', shortcut: 'Ctrl+Y', disabled: !editor, run: () => editor?.chain().focus().redo().run() },
        { separator: true, label: '' },
        { label: '查找…', shortcut: 'Ctrl+F', run: () => {
          const q = window.prompt('查找（不支持替换）');
          if (!q || !editor) return;
          // Simple find: move cursor to first match
          const text = editor.getText();
          const idx = text.indexOf(q);
          if (idx >= 0) {
            // TipTap's text-relative positions are tricky; this is a best-effort
            window.alert(`找到 "${q}"，位置 ${idx}（简化实现）`);
          } else {
            window.alert(`未找到 "${q}"`);
          }
        } },
      ],
    },
    {
      label: '段落',
      items: [
        { label: '一级标题', shortcut: 'Ctrl+1', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
        { label: '二级标题', shortcut: 'Ctrl+2', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: '三级标题', shortcut: 'Ctrl+3', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
        { label: '正文', shortcut: 'Ctrl+0', disabled: !editor, run: () => editor?.chain().focus().setParagraph().run() },
        { separator: true, label: '' },
        { label: '无序列表', disabled: !editor, run: () => editor?.chain().focus().toggleBulletList().run() },
        { label: '有序列表', disabled: !editor, run: () => editor?.chain().focus().toggleOrderedList().run() },
        { label: '引用', disabled: !editor, run: () => editor?.chain().focus().toggleBlockquote().run() },
        { label: '代码块', disabled: !editor, run: () => editor?.chain().focus().toggleCodeBlock().run() },
        { label: '分割线', disabled: !editor, run: () => editor?.chain().focus().setHorizontalRule().run() },
      ],
    },
    {
      label: '格式',
      items: [
        { label: '加粗', shortcut: 'Ctrl+B', disabled: !editor, run: () => editor?.chain().focus().toggleBold().run() },
        { label: '斜体', shortcut: 'Ctrl+I', disabled: !editor, run: () => editor?.chain().focus().toggleItalic().run() },
        { label: '删除线', disabled: !editor, run: () => editor?.chain().focus().toggleStrike().run() },
        { label: '行内代码', shortcut: 'Ctrl+`', disabled: !editor, run: () => editor?.chain().focus().toggleCode().run() },
        { separator: true, label: '' },
        { label: '插入链接…', shortcut: 'Ctrl+K', disabled: !editor, run: () => {
          if (!editor) return;
          const href = window.prompt('链接 URL');
          if (!href) return;
          editor.chain().focus().toggleLink({ href }).run();
        } },
        { label: '插入图片…', disabled: !editor, run: () => {
          if (!editor) return;
          const url = window.prompt('图片 URL（也可直接拖拽图片到编辑器）');
          if (!url) return;
          editor.chain().focus().setImage({ src: url, alt: '' }).run();
        } },
        { label: '插入表格 3×3', disabled: !editor, run: () =>
          editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        },
      ],
    },
    {
      label: '视图',
      items: [
        { label: showSidebar ? '✓ 侧栏' : '侧栏', run: onToggleSidebar },
        { label: showOutline ? '✓ 大纲' : '大纲', run: onToggleOutline },
      ],
    },
    {
      label: '主题',
      items: [
        { label: themeName === 'light' ? '✓ 浅色' : '浅色', run: () => setTheme('light') },
        { label: themeName === 'dark' ? '✓ 深色' : '深色', run: () => setTheme('dark') },
      ],
    },
    {
      label: '帮助',
      items: [
        { label: '关于 easymd', run: () => window.alert('easymd — 产品级 Markdown 编辑器\nMVP for Windows\n\nTauri 2 + React + TipTap') },
        { label: 'Markdown 快捷键', run: () => window.alert(
          '# 空格     = H1\n## 空格    = H2\n### 空格   = H3\n**文字**   = 加粗\n*文字*     = 斜体\n~~文字~~   = 删除线\n`代码`     = 行内代码\n```代码``` = 代码块\n- 空格     = 无序列表\n1. 空格    = 有序列表\n> 空格     = 引用\n--- 空格   = 分割线\n[T](URL)  = 链接'
        ) },
      ],
    },
  ];

  return (
    <div className="menubar" role="menubar">
      {menus.map((m) => (
        <div key={m.label} className="menu-item-wrap"
             onMouseLeave={() => { /* keep open until click outside */ }}>
          <button
            className={`menu-trigger ${openMenu === m.label ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === m.label ? null : m.label)}
          >
            {m.label}
          </button>
          {openMenu === m.label && (
            <div className="menu-dropdown" role="menu">
              {m.items.map((it, i) => it.separator ? (
                <div key={i} className="menu-separator" />
              ) : (
                <button
                  key={i}
                  className="menu-dropdown-item"
                  disabled={it.disabled}
                  onClick={() => run(it.run)}
                >
                  <span>{it.label}</span>
                  {it.shortcut && <span className="menu-shortcut">{it.shortcut}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
      {openMenu && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 99 }}
          onClick={() => setOpenMenu(null)}
        />
      )}
    </div>
  );
}
