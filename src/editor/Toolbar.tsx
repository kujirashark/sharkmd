import { useState, useEffect } from 'react';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { useTranslation } from 'react-i18next';

export interface ToolbarProps {
  editor: TiptapEditor | null;
}

interface ButtonDef {
  key: string;
  label: string;
  /** i18n key for the tooltip. Resolved at render via t(). */
  titleKey: string;
  isActive?: (e: TiptapEditor) => boolean;
  run: (e: TiptapEditor, t: (k: string) => string) => void;
}

const buttons: (ButtonDef | 'sep')[] = [
  {
    key: 'h1', label: 'H1', titleKey: 'toolbar.h1',
    isActive: (e) => e.isActive('heading', { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: 'h2', label: 'H2', titleKey: 'toolbar.h2',
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: 'h3', label: 'H3', titleKey: 'toolbar.h3',
    isActive: (e) => e.isActive('heading', { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  'sep',
  {
    key: 'b', label: 'B', titleKey: 'toolbar.bold',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    key: 'i', label: 'I', titleKey: 'toolbar.italic',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    key: 's', label: 'S', titleKey: 'toolbar.strike',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    key: 'code', label: '</>', titleKey: 'toolbar.code',
    isActive: (e) => e.isActive('code'),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
  'sep',
  {
    key: 'ul', label: '• 列表', titleKey: 'toolbar.ul',
    isActive: (e) => e.isActive('bulletList'),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'ol', label: '1. 列表', titleKey: 'toolbar.ol',
    isActive: (e) => e.isActive('orderedList'),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: 'quote', label: '" 引用', titleKey: 'toolbar.quote',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  'sep',
  {
    key: 'link', label: '🔗', titleKey: 'toolbar.link',
    isActive: (e) => e.isActive('link'),
    run: (e, t) => {
      const href = window.prompt(t('dialog.linkUrl'));
      if (!href) return;
      e.chain().focus().toggleLink({ href }).run();
    },
  },
  {
    key: 'hr', label: '— 分割', titleKey: 'toolbar.hr',
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  'sep',
  {
    key: 'table', label: '⊞ 表格', titleKey: 'toolbar.table',
    // Explicit focus() before insertTable — when the toolbar button receives
    // focus, the editor loses its selection; without this first call the
    // table lands at doc start and can clobber content.
    run: (e) => {
      e.commands.focus();
      e.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    key: 'codeblock', label: '``` 代码', titleKey: 'toolbar.codeblock',
    isActive: (e) => e.isActive('codeBlock'),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: 'image', label: '🖼 图片', titleKey: 'toolbar.image',
    run: (e, t) => {
      const url = window.prompt(t('dialog.imageUrlShort'));
      if (!url) return;
      e.chain().focus().setImage({ src: url, alt: '' }).run();
    },
  },
];

export function Toolbar({ editor }: ToolbarProps) {
  const { t } = useTranslation();
  // Force re-render on selection change so isActive() reflects current state
  const [, force] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const update = () => force((n) => n + 1);
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction', update);
    };
  }, [editor]);

  if (!editor) return <div className="toolbar" />;

  return (
    <div className="toolbar" role="toolbar" aria-label={t('menu.format.label')}>
      {buttons.map((b, i) => {
        if (b === 'sep') return <span key={`sep-${i}`} className="sep" />;
        const active = b.isActive?.(editor) ?? false;
        return (
          <button
            key={b.key}
            type="button"
            title={t(b.titleKey)}
            data-active={active}
            onMouseDown={(e) => e.preventDefault() /* keep editor focus */}
            onClick={() => b.run(editor, t)}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
