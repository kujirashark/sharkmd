import { useState } from 'react';
import type { Editor } from '@tiptap/core';
import { save as saveDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';
import { tauri } from '../tauri/client';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { serializeMarkdown } from '../editor/bridge';
import { useThemeStore } from '../theme/store';
import { useTabsStore } from '../tabs/store';
import { exportToHTML, exportToPDF } from '../export/export-html';
import { exportToDocx, blobToUint8Array } from '../export/export-docx';
import i18n from '../i18n';
import { PromptModal } from '../components/PromptModal';

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
  onOpenFind: () => void;
  // Spell-check toggle (view menu). Mirrors the `✓ ` prefix pattern used
  // for sidebar / outline / theme entries.
  spellcheckEnabled: boolean;
  onToggleSpell: () => void;
  // Open the UpdaterPanel dialog (Help → Check for Updates…).
  onCheckUpdate: () => void;
}

interface MenuItem {
  /** Stable identifier — used as React key. Must be globally unique so that
   *  switching language doesn't force React to remount every menu item. */
  id: string;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  run?: () => void;
  separator?: boolean;
}

interface MenuDef {
  id: string;
  label: string;
  items: MenuItem[];
}

export function MenuBar({
  editor, onChooseDir, onOpenFile, activeId,
  showSidebar, showOutline, onToggleSidebar, onToggleOutline, onOpenFind,
  spellcheckEnabled, onToggleSpell, onCheckUpdate,
}: MenuBarProps) {
  const { t } = useTranslation();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  // Inline React modal state — `window.prompt` is unreliable in Tauri
  // WebView2 (silently swallowed on some platform builds), so we
  // replace every prompt-style flow with a real Modal+input pair.
  const [pendingNewFileName, setPendingNewFileName] = useState<string | null>(null);
  const [pendingLinkUrl, setPendingLinkUrl] = useState(false);
  const [pendingImageUrl, setPendingImageUrl] = useState(false);
  const setTheme = useThemeStore((s) => s.setTheme);
  const themeName = useThemeStore((s) => s.theme);
  const closeTab = useTabsStore((s) => s.closeTab);
  const tabs = useTabsStore((s) => s.tabs);

  // Submit handler for the "New File" modal. Resolves the target path
  // (current tab's directory, or filename-only if no rootPath), writes
  // an empty file via Rust, then opens it as a tab.
  const createNewFile = (name: string) => {
    setPendingNewFileName(null);
    const safe = name.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!safe) return;
    const filename = safe.endsWith('.md') ? safe : safe + '.md';
    const current = tabs.find((t) => t.id === activeId);
    const baseDir = current ? current.path.replace(/[\\/][^\\/]+$/, '') : '';
    const full = baseDir ? baseDir + '\\' + filename : filename;
    tauri.saveFile(full, '').then(() => {
      onOpenFile(full);
    }).catch((e) => {
      window.alert(t('message.cannotCreate', { error: String(e) }));
    });
  };

  const run = (fn?: () => void) => {
    setOpenMenu(null);
    if (fn) fn();
  };

  // Switch the UI language and persist via settings. Errors are swallowed:
  // language switch must not crash the app even if the disk write fails.
  const switchLang = async (lng: string) => {
    try {
      await i18n.changeLanguage(lng);
    } catch {
      // ignore — i18next itself never rejects
    }
    try {
      const s = await tauri.getSettings();
      await tauri.setSettings({ ...s, language: lng });
    } catch {
      // ignore
    }
  };

  const menus: MenuDef[] = [
    {
      id: 'file',
      label: t('menu.file.label'),
      items: [
        { id: 'file-new', label: t('menu.file.new'), shortcut: 'Ctrl+N', run: () => {
          // Don't gate on `editor` — when no tab is open <Editor> is
          // unmounted and `editor` is null, so an early-return here
          // silently swallows the click. Creating a file doesn't need
          // an editor instance; createNewFile writes the empty file
          // via Rust and opens it as a new tab.
          setPendingNewFileName('untitled.md');
        } },
        { id: 'file-choose-dir', label: t('menu.file.chooseDir'), run: onChooseDir },
        { id: 'file-open', label: t('menu.file.openFile'), shortcut: 'Ctrl+O', run: async () => {
          const selected = await openDialog({
            multiple: false,
            title: t('dialog.openMarkdown'),
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
          });
          if (typeof selected === 'string' && selected) onOpenFile(selected);
        } },
        { id: 'file-sep-1', separator: true, label: '' },
        { id: 'file-save', label: t('menu.file.save'), shortcut: 'Ctrl+S', disabled: !editor, run: () => {
          if (!editor || !activeId) return;
          const current = tabs.find((t) => t.id === activeId);
          if (!current) return;
          const md = serializeMarkdown(editor.getJSON());
          tauri.saveFile(current.path, md).then((res) => {
            useTabsStore.getState().setMtime(current.id, res.mtimeMs);
            useTabsStore.getState().updateContent(current.id, current.content, false);
          }).catch((e) => window.alert(t('message.saveFailure', { error: String(e) })));
        } },
        { id: 'file-sep-2', separator: true, label: '' },
        { id: 'file-export-html', label: t('menu.file.exportHtml'), disabled: !editor, run: async () => {
          if (!editor) return;
          const current = tabs.find((t) => t.id === activeId);
          const baseName = current ? current.title.replace(/\.md$/i, '') : 'untitled';
          const theme = useThemeStore.getState().theme === 'dark' ? 'github-dark' : 'github-light';
          try {
            const html = await exportToHTML(editor.getJSON(), { title: baseName, theme });
            const dest = await saveDialog({
              title: t('dialog.exportHtml'),
              defaultPath: baseName + '.html',
              filters: [{ name: 'HTML', extensions: ['html'] }],
            });
            if (typeof dest === 'string' && dest) {
              await tauri.saveFile(dest, html);
              window.alert(t('message.exportedTo', { dest }));
            }
          } catch (e) {
            window.alert(t('message.exportFailure', { error: String(e) }));
          }
        } },
        { id: 'file-export-pdf', label: t('menu.file.exportPdf'), disabled: !editor, run: async () => {
          if (!editor) return;
          const current = tabs.find((t) => t.id === activeId);
          const baseName = current ? current.title.replace(/\.md$/i, '') : 'untitled';
          const theme = useThemeStore.getState().theme === 'dark' ? 'github-dark' : 'github-light';
          const dest = await saveDialog({
            title: t('dialog.exportPdf'),
            defaultPath: baseName + '.pdf',
            filters: [{ name: 'PDF', extensions: ['pdf'] }],
          });
          if (typeof dest !== 'string' || !dest) return;
          try {
            await exportToPDF(editor.getJSON(), { title: baseName, theme }, dest);
            window.alert(t('message.exportedTo', { dest }));
          } catch (e) {
            window.alert(t('message.exportPdfFailure', { error: String(e) }));
          }
        } },
        { id: 'file-export-docx', label: t('menu.file.exportDocx'), disabled: !editor, run: async () => {
          if (!editor) return;
          const current = tabs.find((t) => t.id === activeId);
          const baseName = current ? current.title.replace(/\.md$/i, '') : 'untitled';
          const theme = useThemeStore.getState().theme === 'dark' ? 'github-dark' : 'github-light';
          try {
            const blob = await exportToDocx(editor.getJSON(), { title: baseName, theme });
            const dest = await saveDialog({
              title: t('dialog.exportDocx'),
              defaultPath: baseName + '.docx',
              filters: [{ name: 'Word Document', extensions: ['docx'] }],
            });
            if (typeof dest === 'string' && dest) {
              const bytes = await blobToUint8Array(blob);
              await tauri.saveBinaryFile(dest, bytes);
              window.alert(t('message.exportedToWithHint', { dest }));
            }
          } catch (e) {
            window.alert(t('message.exportDocxFailure', { error: String(e) }));
          }
        } },
        { id: 'file-close-tab', label: t('menu.file.closeTab'), shortcut: 'Ctrl+W', disabled: !activeId, run: () => { if (activeId) closeTab(activeId); } },
      ],
    },
    {
      id: 'edit',
      label: t('menu.edit.label'),
      items: [
        { id: 'edit-undo', label: t('menu.edit.undo'), shortcut: 'Ctrl+Z', disabled: !editor, run: () => editor?.chain().focus().undo().run() },
        { id: 'edit-redo', label: t('menu.edit.redo'), shortcut: 'Ctrl+Y', disabled: !editor, run: () => editor?.chain().focus().redo().run() },
        { id: 'edit-sep', separator: true, label: '' },
        { id: 'edit-find', label: t('menu.edit.find'), shortcut: 'Ctrl+F', run: () => onOpenFind() },
      ],
    },
    {
      id: 'paragraph',
      label: t('menu.paragraph.label'),
      items: [
        { id: 'paragraph-h1', label: t('menu.paragraph.h1'), shortcut: 'Ctrl+1', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 1 }).run() },
        { id: 'paragraph-h2', label: t('menu.paragraph.h2'), shortcut: 'Ctrl+2', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run() },
        { id: 'paragraph-h3', label: t('menu.paragraph.h3'), shortcut: 'Ctrl+3', disabled: !editor, run: () => editor?.chain().focus().toggleHeading({ level: 3 }).run() },
        { id: 'paragraph-p', label: t('menu.paragraph.paragraph'), shortcut: 'Ctrl+0', disabled: !editor, run: () => editor?.chain().focus().setParagraph().run() },
        { id: 'paragraph-sep-1', separator: true, label: '' },
        { id: 'paragraph-ul', label: t('menu.paragraph.ul'), disabled: !editor, run: () => editor?.chain().focus().toggleBulletList().run() },
        { id: 'paragraph-ol', label: t('menu.paragraph.ol'), disabled: !editor, run: () => editor?.chain().focus().toggleOrderedList().run() },
        { id: 'paragraph-quote', label: t('menu.paragraph.quote'), disabled: !editor, run: () => editor?.chain().focus().toggleBlockquote().run() },
        { id: 'paragraph-codeblock', label: t('menu.paragraph.codeblock'), disabled: !editor, run: () => editor?.chain().focus().toggleCodeBlock().run() },
        { id: 'paragraph-hr', label: t('menu.paragraph.hr'), disabled: !editor, run: () => editor?.chain().focus().setHorizontalRule().run() },
      ],
    },
    {
      id: 'format',
      label: t('menu.format.label'),
      items: [
        { id: 'format-bold', label: t('menu.format.bold'), shortcut: 'Ctrl+B', disabled: !editor, run: () => editor?.chain().focus().toggleBold().run() },
        { id: 'format-italic', label: t('menu.format.italic'), shortcut: 'Ctrl+I', disabled: !editor, run: () => editor?.chain().focus().toggleItalic().run() },
        { id: 'format-strike', label: t('menu.format.strike'), disabled: !editor, run: () => editor?.chain().focus().toggleStrike().run() },
        { id: 'format-code', label: t('menu.format.inlineCode'), shortcut: 'Ctrl+`', disabled: !editor, run: () => editor?.chain().focus().toggleCode().run() },
        { id: 'format-sep-1', separator: true, label: '' },
        { id: 'format-link', label: t('menu.format.link'), shortcut: 'Ctrl+K', disabled: !editor, run: () => {
          if (!editor) return;
          setPendingLinkUrl(true);
        } },
        { id: 'format-image', label: t('menu.format.image'), disabled: !editor, run: () => {
          if (!editor) return;
          setPendingImageUrl(true);
        } },
        { id: 'format-table', label: t('menu.format.table'), disabled: !editor, run: () => {
          if (!editor) return;
          editor.commands.focus();
          editor.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        } },
      ],
    },
    {
      id: 'view',
      label: t('menu.view.label'),
      items: [
        { id: 'view-sidebar', label: (showSidebar ? '✓ ' : '') + t('menu.view.sidebar'), run: onToggleSidebar },
        { id: 'view-outline', label: (showOutline ? '✓ ' : '') + t('menu.view.outline'), run: onToggleOutline },
        { id: 'view-sep', separator: true, label: '' },
        { id: 'view-find', label: t('menu.view.find'), shortcut: 'Ctrl+F', run: () => onOpenFind() },
        { id: 'view-spellcheck', label: (spellcheckEnabled ? '✓ ' : '') + t('menu.view.spellCheck'), run: onToggleSpell },
      ],
    },
    {
      id: 'theme',
      label: t('menu.theme.label'),
      items: [
        { id: 'theme-light', label: (themeName === 'light' ? '✓ ' : '') + t('menu.theme.light'), run: () => setTheme('light') },
        { id: 'theme-dark', label: (themeName === 'dark' ? '✓ ' : '') + t('menu.theme.dark'), run: () => setTheme('dark') },
      ],
    },
    {
      id: 'language',
      label: t('menu.language.label'),
      items: [
        { id: 'lang-zh', label: (i18n.language === 'zh-CN' ? '✓ ' : '') + t('menu.language.zh'), run: () => switchLang('zh-CN') },
        { id: 'lang-en', label: (i18n.language === 'en-US' ? '✓ ' : '') + t('menu.language.en'), run: () => switchLang('en-US') },
      ],
    },
    {
      id: 'help',
      label: t('menu.help.label'),
      items: [
        { id: 'help-check-update', label: t('menu.help.checkUpdate'), run: () => onCheckUpdate() },
        { id: 'help-sep', separator: true, label: '' },
        { id: 'help-about', label: t('menu.help.about'), run: () => window.alert(t('menu.aboutBody')) },
        { id: 'help-shortcuts', label: t('menu.help.shortcuts'), run: () => window.alert(t('menu.shortcutsBody')) },
      ],
    },
  ];

  return (
    <div className="menubar" role="menubar">
      {menus.map((m) => (
        <div key={m.id} className="menu-item-wrap"
             onMouseLeave={() => { /* keep open until click outside */ }}>
          <button
            className={`menu-trigger ${openMenu === m.id ? 'active' : ''}`}
            onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
          >
            {m.label}
          </button>
          {openMenu === m.id && (
            <div className="menu-dropdown" role="menu">
              {m.items.map((it) => it.separator ? (
                <div key={it.id} className="menu-separator" />
              ) : (
                <button
                  key={it.id}
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

      {/* Inline modal replacements for window.prompt / window.confirm. */}
      <PromptModal
        open={pendingNewFileName !== null}
        title={t('dialog.newFile')}
        defaultValue={pendingNewFileName ?? 'untitled.md'}
        placeholder="untitled.md"
        okLabel={t('dialog.create')}
        cancelLabel={t('dialog.cancel')}
        emptyError={t('validation.empty')}
        validate={(v) =>
          /[\\/:*?"<>|]/.test(v) ? t('dialog.filenameInvalid') : null
        }
        onConfirm={createNewFile}
        onCancel={() => setPendingNewFileName(null)}
      />
      <PromptModal
        open={pendingLinkUrl}
        title={t('dialog.linkUrl')}
        message={t('dialog.linkUrlHint')}
        defaultValue="https://"
        placeholder="https://example.com"
        okLabel={t('dialog.insert')}
        cancelLabel={t('dialog.cancel')}
        emptyError={t('validation.empty')}
        onConfirm={(href) => {
          setPendingLinkUrl(false);
          editor?.chain().focus().toggleLink({ href }).run();
        }}
        onCancel={() => setPendingLinkUrl(false)}
      />
      <PromptModal
        open={pendingImageUrl}
        title={t('dialog.imageUrl')}
        message={t('dialog.imageUrlHint')}
        defaultValue="https://"
        placeholder="https://example.com/image.png"
        okLabel={t('dialog.insert')}
        cancelLabel={t('dialog.cancel')}
        emptyError={t('validation.empty')}
        onConfirm={(url) => {
          setPendingImageUrl(false);
          editor?.chain().focus().setImage({ src: url, alt: '' }).run();
        }}
        onCancel={() => setPendingImageUrl(false)}
      />
    </div>
  );
}
